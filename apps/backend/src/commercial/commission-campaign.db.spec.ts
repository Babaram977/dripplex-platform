import { randomUUID } from 'node:crypto';

import {
  CommissionCampaignStatus,
  CommissionScope,
  NotificationType,
  PrismaClient,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { CommissionCampaignSweepService } from './commission-campaign-sweep.service';
import { CommissionCampaignService } from './commission-campaign.service';
import { CommissionRateResolverService } from './commission-rate-resolver.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Commission campaigns against a real database, because a campaign decides what
 * every merchant, rider or driver on the platform is charged.
 *
 * The unit spec proves the resolver's arithmetic against a mock. Only Postgres
 * proves the two halves agree — that a campaign Ops creates is actually found
 * by the resolver's query, that the window filter is really doing the work, and
 * that a campaign cannot be announced twice.
 */
describe('Commission campaigns (database)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let campaigns: CommissionCampaignService;
  let resolver: CommissionRateResolverService;
  let sweep: CommissionCampaignSweepService;
  let broadcast: jest.Mock;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    broadcast = jest.fn().mockResolvedValue({ sent: 0, skipped: 0, notificationIds: [] });
    campaigns = new CommissionCampaignService(prisma, new AuditService(auditLogRepository), {
      broadcast,
    } as unknown as NotificationCenterService);
    resolver = new CommissionRateResolverService(prisma);
    sweep = new CommissionCampaignSweepService(campaigns);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.commissionCampaign.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (databaseAvailable) {
      await prisma.commissionCampaign.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function create(
    overrides: {
      scope?: CommissionScope;
      commissionRate?: number;
      priority?: number;
      startsAt?: Date;
      endsAt?: Date;
      rules?: Record<string, unknown>;
      announce?: boolean;
    } = {},
  ): Promise<string> {
    const created = await campaigns.create({
      name: `Test campaign ${randomUUID()}`,
      scope: overrides.scope ?? CommissionScope.MERCHANT_ORDER,
      commissionRate: overrides.commissionRate ?? 0.07,
      priority: overrides.priority ?? 0,
      startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000),
      endsAt: overrides.endsAt ?? new Date(Date.now() + 86_400_000),
      ...(overrides.rules === undefined ? {} : { rules: overrides.rules }),
      announce: overrides.announce ?? false,
    });
    createdIds.push(created.id);
    return created.id;
  }

  it('is created SCHEDULED and only charges anything once the sweep starts it', async () => {
    if (!databaseAvailable) return;

    const id = await create();

    // Created inside its own window, but not yet in force: activation is the
    // single code path, so a campaign created mid-window still gets announced.
    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.1,
      campaignId: null,
    });

    await sweep.runSweep();

    const after = await prisma.commissionCampaign.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe(CommissionCampaignStatus.ACTIVE);
    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.07,
      campaignId: id,
    });
  });

  it('does not leak across scopes', async () => {
    if (!databaseAvailable) return;

    await create({ scope: CommissionScope.RIDE, commissionRate: 0.05 });
    await sweep.runSweep();

    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.1,
    });
    await expect(resolver.resolve(CommissionScope.RIDE, 0.1)).resolves.toMatchObject({
      rate: 0.05,
    });
  });

  it('stops charging the campaign rate the moment its window closes', async () => {
    if (!databaseAvailable) return;

    const id = await create({ endsAt: new Date(Date.now() + 1_000) });
    await sweep.runSweep();
    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.07,
    });

    // Close the window without running the sweep — the resolver must not need
    // the sweep to have caught up before it stops charging the old rate.
    await prisma.commissionCampaign.update({
      where: { id },
      data: { endsAt: new Date(Date.now() - 1_000) },
    });

    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.1,
      campaignId: null,
    });
  });

  it('ranks a deliberate override above a broad standing campaign', async () => {
    if (!databaseAvailable) return;

    await create({ commissionRate: 0.07, priority: 0 });
    const override = await create({ commissionRate: 0.14, priority: 10 });
    await sweep.runSweep();

    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.14,
      campaignId: override,
    });
  });

  it('announces a campaign once, however many times the sweep runs', async () => {
    if (!databaseAvailable) return;

    await create({ announce: true });

    await sweep.runSweep();
    await sweep.runSweep();
    await sweep.runSweep();

    const starts = broadcast.mock.calls.filter(
      ([dto]: [{ type: NotificationType }]) =>
        dto.type === NotificationType.COMMISSION_CAMPAIGN_STARTED,
    );
    expect(starts).toHaveLength(1);
  });

  it('pausing stops the campaign charging without waiting for its window', async () => {
    if (!databaseAvailable) return;

    const id = await create();
    await sweep.runSweep();
    await campaigns.pause(id);

    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.1,
      campaignId: null,
    });
  });

  it('a campaign resumed after its window has closed does not come back into force', async () => {
    if (!databaseAvailable) return;

    const id = await create();
    await sweep.runSweep();
    await campaigns.pause(id);
    await prisma.commissionCampaign.update({
      where: { id },
      data: { endsAt: new Date(Date.now() - 1_000) },
    });

    await campaigns.resume(id);
    await sweep.runSweep();

    const after = await prisma.commissionCampaign.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe(CommissionCampaignStatus.EXPIRED);
    await expect(resolver.resolve(CommissionScope.MERCHANT_ORDER, 0.1)).resolves.toMatchObject({
      rate: 0.1,
    });
  });

  it('refuses to edit a campaign that has already finished', async () => {
    if (!databaseAvailable) return;

    const id = await create({ endsAt: new Date(Date.now() + 1_000) });
    await prisma.commissionCampaign.update({
      where: { id },
      data: { status: CommissionCampaignStatus.EXPIRED },
    });

    // Editing it would rewrite the explanation for settlements that already
    // happened under it.
    await expect(campaigns.update(id, { commissionRate: 0.2 })).rejects.toThrow(
      'can no longer be edited',
    );
  });
});
