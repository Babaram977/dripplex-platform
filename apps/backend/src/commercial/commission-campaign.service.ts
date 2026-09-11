import { Injectable, Logger } from '@nestjs/common';
import {
  CommissionCampaignStatus,
  CommissionScope,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  COMMISSION_CAMPAIGN_ANNOUNCE_BATCH_SIZE,
  COMMISSION_CAMPAIGN_AUDIT_ACTIONS,
} from './commission-campaign.constants';

import type { PromotionRules } from '../promotions/promotion-rules';
import type { PaginatedResult } from '@dripplex/types';
import type { CommissionCampaign } from '@prisma/client';

export interface CommissionCampaignDto {
  id: string;
  name: string;
  description: string | null;
  scope: CommissionScope;
  /** Fraction, not percent: 0.07 is 7%. */
  commissionRate: number;
  status: CommissionCampaignStatus;
  priority: number;
  startsAt: string;
  endsAt: string;
  rules: PromotionRules | null;
  announce: boolean;
  announcedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommissionCampaignInput {
  name: string;
  description?: string;
  scope: CommissionScope;
  commissionRate: number;
  priority?: number;
  startsAt: Date;
  endsAt: Date;
  rules?: PromotionRules;
  announce?: boolean;
  context?: AuditContext;
}

export interface UpdateCommissionCampaignInput {
  name?: string;
  description?: string;
  commissionRate?: number;
  priority?: number;
  startsAt?: Date;
  endsAt?: Date;
  rules?: PromotionRules;
  announce?: boolean;
  context?: AuditContext;
}

/**
 * The role whose members are charged under each scope — who a campaign is
 * actually about, and therefore who hears about it.
 */
const SCOPE_AUDIENCE: Record<
  CommissionScope,
  { role: string; noun: string; category: NotificationCategory }
> = {
  [CommissionScope.MERCHANT_ORDER]: {
    role: 'merchant',
    noun: 'orders',
    category: NotificationCategory.MERCHANT,
  },
  [CommissionScope.DELIVERY]: {
    role: 'rider',
    noun: 'deliveries',
    category: NotificationCategory.DELIVERY,
  },
  [CommissionScope.RIDE]: { role: 'driver', noun: 'rides', category: NotificationCategory.RIDE },
};

/**
 * DPX-COMMISSION-001 — Ops creates, edits and runs commission campaigns here.
 *
 * The lifecycle mirrors the promotions module, which solved the same problem
 * for customer discounts: DRAFT while it is being written, SCHEDULED once it is
 * committed to, ACTIVE inside its window, EXPIRED after, with PAUSED and
 * ARCHIVED as the two explicit Ops actions. Time-driven transitions belong to
 * the sweep; pausing and archiving are decisions, so they stay manual.
 *
 * Nothing here is ever hard-deleted. A rate that was once charged against real
 * money has to stay explicable, and settlement rows point back at these ids.
 */
@Injectable()
export class CommissionCampaignService {
  private readonly logger = new Logger(CommissionCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationCenterService,
  ) {}

  public async list(query: {
    page: number;
    pageSize: number;
    scope?: CommissionScope;
    status?: CommissionCampaignStatus;
  }): Promise<PaginatedResult<CommissionCampaignDto>> {
    const where: Prisma.CommissionCampaignWhereInput = {
      ...(query.scope !== undefined ? { scope: query.scope } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.commissionCampaign.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.commissionCampaign.count({ where }),
    ]);

    return {
      items: items.map(toDto),
      meta: {
        page: query.page,
        limit: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize) || 1),
      },
    };
  }

  public async get(id: string): Promise<CommissionCampaignDto> {
    return toDto(await this.require(id));
  }

  public async create(input: CreateCommissionCampaignInput): Promise<CommissionCampaignDto> {
    this.assertRate(input.commissionRate);
    this.assertWindow(input.startsAt, input.endsAt);

    const campaign = await this.prisma.commissionCampaign.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        scope: input.scope,
        commissionRate: new Prisma.Decimal(input.commissionRate),
        // Created SCHEDULED, not ACTIVE: the sweep is what moves a campaign
        // into force, so a campaign created mid-window still goes through the
        // one code path that announces it.
        status: CommissionCampaignStatus.SCHEDULED,
        priority: input.priority ?? 0,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        rules: input.rules === undefined ? Prisma.DbNull : (input.rules as Prisma.InputJsonValue),
        announce: input.announce ?? true,
        createdBy: input.context?.userId ?? null,
      },
    });

    await this.auditService.record(COMMISSION_CAMPAIGN_AUDIT_ACTIONS.CREATED, input.context ?? {}, {
      resource: 'commission_campaign',
      resourceId: campaign.id,
      metadata: {
        scope: campaign.scope,
        commissionRate: Number(campaign.commissionRate),
        startsAt: campaign.startsAt.toISOString(),
        endsAt: campaign.endsAt.toISOString(),
      },
    });

    return toDto(campaign);
  }

  public async update(
    id: string,
    input: UpdateCommissionCampaignInput,
  ): Promise<CommissionCampaignDto> {
    const existing = await this.require(id);
    if (
      existing.status === CommissionCampaignStatus.ARCHIVED ||
      existing.status === CommissionCampaignStatus.EXPIRED
    ) {
      // Editing a finished campaign would rewrite the explanation for
      // settlements that already happened under it.
      throw new ValidationDomainException(
        'A campaign that has expired or been archived can no longer be edited. Create a new one.',
      );
    }

    if (input.commissionRate !== undefined) {
      this.assertRate(input.commissionRate);
    }
    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    this.assertWindow(startsAt, endsAt);

    const data: Prisma.CommissionCampaignUpdateInput = {
      updatedBy: input.context?.userId ?? null,
    };
    if (input.name !== undefined) {
      data.name = input.name.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description.trim();
    }
    if (input.commissionRate !== undefined) {
      data.commissionRate = new Prisma.Decimal(input.commissionRate);
    }
    if (input.priority !== undefined) {
      data.priority = input.priority;
    }
    if (input.startsAt !== undefined) {
      data.startsAt = input.startsAt;
    }
    if (input.endsAt !== undefined) {
      data.endsAt = input.endsAt;
    }
    if (input.rules !== undefined) {
      data.rules = input.rules as Prisma.InputJsonValue;
    }
    if (input.announce !== undefined) {
      data.announce = input.announce;
    }

    const campaign = await this.prisma.commissionCampaign.update({ where: { id }, data });

    await this.auditService.record(COMMISSION_CAMPAIGN_AUDIT_ACTIONS.UPDATED, input.context ?? {}, {
      resource: 'commission_campaign',
      resourceId: campaign.id,
      metadata: {
        previousRate: Number(existing.commissionRate),
        newRate: Number(campaign.commissionRate),
        previousWindow: [
          existing.startsAt.toISOString(),
          existing.endsAt.toISOString(),
        ] as unknown as Prisma.InputJsonValue,
      },
    });

    return toDto(campaign);
  }

  public async pause(id: string, context: AuditContext = {}): Promise<CommissionCampaignDto> {
    const existing = await this.require(id);
    if (
      existing.status !== CommissionCampaignStatus.ACTIVE &&
      existing.status !== CommissionCampaignStatus.SCHEDULED
    ) {
      throw new ValidationDomainException('Only a scheduled or active campaign can be paused');
    }

    const campaign = await this.prisma.commissionCampaign.update({
      where: { id },
      data: {
        status: CommissionCampaignStatus.PAUSED,
        pausedAt: new Date(),
        updatedBy: context.userId ?? null,
      },
    });

    // Pausing takes effect on the next settlement, not retroactively — the
    // resolver only ever looks at ACTIVE campaigns.
    await this.auditService.record(COMMISSION_CAMPAIGN_AUDIT_ACTIONS.PAUSED, context, {
      resource: 'commission_campaign',
      resourceId: id,
      metadata: { scope: campaign.scope },
    });
    await this.announceEnd(campaign);

    return toDto(campaign);
  }

  public async resume(id: string, context: AuditContext = {}): Promise<CommissionCampaignDto> {
    const existing = await this.require(id);
    if (existing.status !== CommissionCampaignStatus.PAUSED) {
      throw new ValidationDomainException('Only a paused campaign can be resumed');
    }

    const now = new Date();
    const campaign = await this.prisma.commissionCampaign.update({
      where: { id },
      data: {
        // Back to SCHEDULED, and the sweep decides whether its window is open —
        // a campaign paused in January and resumed in March must not come back
        // ACTIVE on a window that closed weeks ago.
        status: CommissionCampaignStatus.SCHEDULED,
        pausedAt: null,
        updatedBy: context.userId ?? null,
      },
    });

    await this.auditService.record(COMMISSION_CAMPAIGN_AUDIT_ACTIONS.RESUMED, context, {
      resource: 'commission_campaign',
      resourceId: id,
      metadata: { scope: campaign.scope, resumedAt: now.toISOString() },
    });

    return toDto(campaign);
  }

  public async archive(id: string, context: AuditContext = {}): Promise<CommissionCampaignDto> {
    const existing = await this.require(id);
    const campaign = await this.prisma.commissionCampaign.update({
      where: { id },
      data: {
        status: CommissionCampaignStatus.ARCHIVED,
        archivedAt: new Date(),
        updatedBy: context.userId ?? null,
      },
    });

    await this.auditService.record(COMMISSION_CAMPAIGN_AUDIT_ACTIONS.ARCHIVED, context, {
      resource: 'commission_campaign',
      resourceId: id,
      metadata: { previousStatus: existing.status },
    });
    if (existing.status === CommissionCampaignStatus.ACTIVE) {
      await this.announceEnd(campaign);
    }

    return toDto(campaign);
  }

  // ─── Sweep (called by CommissionCampaignSweepService) ──────────────────────

  /** Campaigns whose window has opened. Returns how many started. */
  public async activateDueCampaigns(now = new Date()): Promise<number> {
    const due = await this.prisma.commissionCampaign.findMany({
      where: {
        status: CommissionCampaignStatus.SCHEDULED,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });

    let activated = 0;
    for (const campaign of due) {
      // Claim it before announcing, so two sweeps cannot both tell every
      // merchant on the platform that the rate changed.
      const claimed = await this.prisma.commissionCampaign.updateMany({
        where: { id: campaign.id, status: CommissionCampaignStatus.SCHEDULED },
        data: { status: CommissionCampaignStatus.ACTIVE },
      });
      if (claimed.count !== 1) {
        continue;
      }
      activated += 1;

      await this.auditService.record(
        COMMISSION_CAMPAIGN_AUDIT_ACTIONS.ACTIVATED,
        {},
        {
          resource: 'commission_campaign',
          resourceId: campaign.id,
          metadata: { scope: campaign.scope, commissionRate: Number(campaign.commissionRate) },
        },
      );
      await this.announceStart(campaign);
    }

    return activated;
  }

  /** Campaigns whose window has closed. Returns how many ended. */
  public async expireDueCampaigns(now = new Date()): Promise<number> {
    const due = await this.prisma.commissionCampaign.findMany({
      where: {
        status: { in: [CommissionCampaignStatus.ACTIVE, CommissionCampaignStatus.SCHEDULED] },
        endsAt: { lte: now },
      },
    });

    let expired = 0;
    for (const campaign of due) {
      const claimed = await this.prisma.commissionCampaign.updateMany({
        where: {
          id: campaign.id,
          status: { in: [CommissionCampaignStatus.ACTIVE, CommissionCampaignStatus.SCHEDULED] },
        },
        data: { status: CommissionCampaignStatus.EXPIRED },
      });
      if (claimed.count !== 1) {
        continue;
      }
      expired += 1;

      await this.auditService.record(
        COMMISSION_CAMPAIGN_AUDIT_ACTIONS.EXPIRED,
        {},
        {
          resource: 'commission_campaign',
          resourceId: campaign.id,
          metadata: { scope: campaign.scope },
        },
      );
      // Only a campaign that actually ran is worth an ending notice; one that
      // was scheduled and whose window passed without activating never
      // affected anybody.
      if (campaign.status === CommissionCampaignStatus.ACTIVE) {
        await this.announceEnd(campaign);
      }
    }

    return expired;
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  private async announceStart(campaign: CommissionCampaign): Promise<void> {
    if (!campaign.announce || campaign.announcedAt !== null) {
      return;
    }

    const audience = SCOPE_AUDIENCE[campaign.scope];
    const percent = formatPercent(Number(campaign.commissionRate));
    const until = campaign.endsAt.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const sent = await this.notifyRole(audience, {
      type: NotificationType.COMMISSION_CAMPAIGN_STARTED,
      title: campaign.name,
      body: `DrippleX commission on ${audience.noun} is ${percent} until ${until}.${
        campaign.description === null ? '' : ` ${campaign.description}`
      }`,
      campaignId: campaign.id,
    });

    await this.prisma.commissionCampaign.update({
      where: { id: campaign.id },
      data: { announcedAt: new Date() },
    });
    await this.auditService.record(
      COMMISSION_CAMPAIGN_AUDIT_ACTIONS.ANNOUNCED,
      {},
      {
        resource: 'commission_campaign',
        resourceId: campaign.id,
        metadata: { audience: audience.role, sent },
      },
    );
  }

  private async announceEnd(campaign: CommissionCampaign): Promise<void> {
    // Only campaigns whose start was announced get an ending notice. Telling
    // partners a rate has reverted when they were never told it changed is
    // worse than saying nothing.
    if (!campaign.announce || campaign.announcedAt === null) {
      return;
    }

    const audience = SCOPE_AUDIENCE[campaign.scope];
    await this.notifyRole(audience, {
      type: NotificationType.COMMISSION_CAMPAIGN_ENDED,
      title: `${campaign.name} has ended`,
      body: `DrippleX commission on ${audience.noun} is back to the standard rate.`,
      campaignId: campaign.id,
    });
  }

  /**
   * Sends to every active holder of a role, in batches. `broadcast` fans out
   * with Promise.all, and every merchant on the platform at once is not a fan-
   * out anybody wants against the notification providers.
   */
  private async notifyRole(
    audience: { role: string; category: NotificationCategory },
    message: { type: NotificationType; title: string; body: string; campaignId: string },
  ): Promise<number> {
    let sent = 0;
    let cursor: string | undefined;

    for (;;) {
      const recipients = await this.prisma.user.findMany({
        where: { deletedAt: null, roles: { some: { role: { name: audience.role } } } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: COMMISSION_CAMPAIGN_ANNOUNCE_BATCH_SIZE,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      if (recipients.length === 0) {
        break;
      }

      try {
        const result = await this.notifications.broadcast({
          userIds: recipients.map((recipient) => recipient.id),
          category: audience.category,
          channel: NotificationChannel.IN_APP,
          type: message.type,
          title: message.title,
          body: message.body,
          payload: { commissionCampaignId: message.campaignId },
        });
        sent += result.sent;
      } catch (error) {
        // A failed announcement must not roll back a rate change that is
        // already in force — the campaign is the money, the notice is not.
        this.logger.error(
          `Could not announce commission campaign ${message.campaignId} to ${audience.role}s: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      cursor = recipients[recipients.length - 1]?.id;
      if (recipients.length < COMMISSION_CAMPAIGN_ANNOUNCE_BATCH_SIZE) {
        break;
      }
    }

    return sent;
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  private assertRate(rate: number): void {
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
      throw new ValidationDomainException(
        `Rate must be a fraction between 0 and 1 — 0.07 for 7%. Got ${String(rate)}`,
      );
    }
  }

  private assertWindow(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new ValidationDomainException('A campaign must end after it starts');
    }
  }

  private async require(id: string): Promise<CommissionCampaign> {
    const campaign = await this.prisma.commissionCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundDomainException('Commission campaign not found');
    }
    return campaign;
  }
}

function formatPercent(rate: number): string {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

function toDto(campaign: CommissionCampaign): CommissionCampaignDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    scope: campaign.scope,
    commissionRate: Number(campaign.commissionRate),
    status: campaign.status,
    priority: campaign.priority,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    rules: (campaign.rules ?? null) as PromotionRules | null,
    announce: campaign.announce,
    announcedAt: campaign.announcedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}
