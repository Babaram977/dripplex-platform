import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Prisma,
  PromotionDomain,
  PromotionStatus,
  PromotionType,
  WalletOwnerType,
  type Promotion,
  type PromotionRedemption,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import {
  evaluatePromotionRules,
  type PromotionEligibilityContext,
  type PromotionRules,
} from './promotion-rules';
import {
  CREDIT_PROMOTION_TYPES,
  PROMOTION_AUDIT_ACTIONS,
  PROMOTION_WALLET_REFERENCE_TYPE,
} from './promotion.constants';
import {
  toPromotionDto,
  toPromotionRedemptionDto,
  type PromotionAnalyticsDto,
  type PromotionDiscountDto,
  type PromotionDto,
  type PromotionEvaluationDto,
  type PromotionLeaderboardEntryDto,
  type PromotionRedemptionDto,
} from './promotion.mapper';

import type {
  CampaignAnalyticsQueryDto,
  CloneCampaignDto,
  CreatePromotionDto,
  ListPromotionsQueryDto,
  RedeemPromotionDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';

interface PromotionRedeemOrder {
  id: string;
  customerId: string;
  merchantId: string;
  subtotal: Prisma.Decimal;
}

export interface PromotionPreviewInput {
  userId: string;
  domain: PromotionDomain;
  subtotal: number;
  merchantId?: string;
  couponCode?: string;
  eligibility?: Omit<PromotionEligibilityContext, 'userId' | 'now'>;
}

export interface PromotionGenericRedeemInput {
  userId: string;
  domain: PromotionDomain;
  subtotal: number;
  merchantId?: string;
  referenceType: string;
  referenceId: string;
  deviceId?: string;
  promotionId?: string;
  couponCode?: string;
  walletOwnerType?: WalletOwnerType;
  eligibility?: Omit<PromotionEligibilityContext, 'userId' | 'now'>;
}

export interface PromotionGenericRedeemResult {
  redemption: PromotionRedemptionDto;
  discountAmount: number;
  creditAmount: number;
  promotion: PromotionDto;
}

/**
 * DPX-CORE-002 — see the doc comment on the `Promotion` Prisma model for
 * the overall design. This service keeps the original order/marketplace
 * `redeem()` path byte-for-byte compatible with its existing callers and
 * tests, and adds a parallel domain-generic `redeemForReference()` path
 * (used by Ride, and any future non-order domain) that shares the same
 * locking/limit/rule-evaluation discipline via `assertPromotionActiveForDomain`
 * and `calculateEffect`.
 */
@Injectable()
export class PromotionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.COUPON_REDEEMED, (event) => {
      this.handleCouponRedeemed(event);
    });
  }

  public async create(
    adminId: string,
    dto: CreatePromotionDto,
    context: AuditContext,
  ): Promise<PromotionDto> {
    this.validatePromotionShape(dto);
    const promotion = await this.prisma.promotion.create({
      data: this.toCreateData(dto, adminId),
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.CREATED,
      { ...context, userId: adminId },
      {
        resource: 'promotion',
        resourceId: promotion.id,
        metadata: { type: promotion.type, code: promotion.code },
      },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.PROMOTION_CREATED,
      {
        promotionId: promotion.id,
        type: promotion.type,
        code: promotion.code,
      },
      { actorUserId: adminId },
    );
    return toPromotionDto(promotion);
  }

  public async list(query: ListPromotionsQueryDto): Promise<PromotionDto[]> {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        deletedAt: null,
        ...(query.status !== undefined ? { status: query.status } : {}),
        AND: [
          ...(query.merchantId !== undefined
            ? [{ OR: [{ merchantId: query.merchantId }, { merchantId: null }] }]
            : []),
          ...(query.domain !== undefined
            ? [{ OR: [{ domains: { isEmpty: true } }, { domains: { has: query.domain } }] }]
            : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return promotions.map(toPromotionDto);
  }

  public async listActive(merchantId?: string, domain?: PromotionDomain): Promise<PromotionDto[]> {
    const input: { merchantId?: string; domain?: PromotionDomain } = {};
    if (merchantId !== undefined) {
      input.merchantId = merchantId;
    }
    if (domain !== undefined) {
      input.domain = domain;
    }
    const promotions = await this.findActivePromotions(input);
    return promotions.map(toPromotionDto);
  }

  public async get(id: string): Promise<PromotionDto> {
    return toPromotionDto(await this.requirePromotion(id));
  }

  public async update(
    adminId: string,
    id: string,
    dto: UpdatePromotionDto,
    context: AuditContext,
  ): Promise<PromotionDto> {
    await this.requirePromotion(id);
    this.validatePromotionShape(dto);
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: this.toUpdateData(dto),
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.UPDATED,
      { ...context, userId: adminId },
      {
        resource: 'promotion',
        resourceId: id,
      },
    );
    return toPromotionDto(updated);
  }

  public async delete(adminId: string, id: string, context: AuditContext): Promise<PromotionDto> {
    await this.requirePromotion(id);
    const deleted = await this.prisma.promotion.update({
      where: { id },
      data: { deletedAt: new Date(), status: PromotionStatus.CANCELLED },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.DELETED,
      { ...context, userId: adminId },
      {
        resource: 'promotion',
        resourceId: id,
      },
    );
    return toPromotionDto(deleted);
  }

  // ---------------------------------------------------------------------
  // Lifecycle (pause / resume / archive / force-expire / clone)
  // ---------------------------------------------------------------------

  public async pause(adminId: string, id: string, context: AuditContext): Promise<PromotionDto> {
    const promotion = await this.requirePromotion(id);
    if (
      promotion.status !== PromotionStatus.ACTIVE &&
      promotion.status !== PromotionStatus.SCHEDULED
    ) {
      throw new ValidationDomainException('Only active or scheduled promotions can be paused');
    }
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { status: PromotionStatus.PAUSED, pausedAt: new Date() },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.PAUSED,
      { ...context, userId: adminId },
      { resource: 'promotion', resourceId: id },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.CAMPAIGN_PAUSED,
      { promotionId: id, code: updated.code },
      { actorUserId: adminId },
    );
    return toPromotionDto(updated);
  }

  public async resume(adminId: string, id: string, context: AuditContext): Promise<PromotionDto> {
    const promotion = await this.requirePromotion(id);
    if (promotion.status !== PromotionStatus.PAUSED) {
      throw new ValidationDomainException('Only paused promotions can be resumed');
    }
    const now = new Date();
    const nextStatus =
      promotion.startsAt !== null && promotion.startsAt > now
        ? PromotionStatus.SCHEDULED
        : PromotionStatus.ACTIVE;
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { status: nextStatus, pausedAt: null },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.RESUMED,
      { ...context, userId: adminId },
      { resource: 'promotion', resourceId: id },
    );
    if (nextStatus === PromotionStatus.ACTIVE) {
      await this.eventBus.emit(
        DOMAIN_EVENTS.CAMPAIGN_ACTIVATED,
        { promotionId: id, code: updated.code },
        { actorUserId: adminId },
      );
    }
    return toPromotionDto(updated);
  }

  public async archive(adminId: string, id: string, context: AuditContext): Promise<PromotionDto> {
    const promotion = await this.requirePromotion(id);
    if (promotion.status === PromotionStatus.ARCHIVED) {
      throw new ConflictDomainException('Promotion is already archived');
    }
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: { status: PromotionStatus.ARCHIVED, archivedAt: new Date() },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.ARCHIVED,
      { ...context, userId: adminId },
      { resource: 'promotion', resourceId: id },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.CAMPAIGN_ARCHIVED,
      { promotionId: id, code: updated.code },
      { actorUserId: adminId },
    );
    return toPromotionDto(updated);
  }

  public async forceExpire(
    adminId: string,
    id: string,
    context: AuditContext,
  ): Promise<PromotionDto> {
    const promotion = await this.requirePromotion(id);
    if (
      promotion.status === PromotionStatus.EXPIRED ||
      promotion.status === PromotionStatus.ARCHIVED ||
      promotion.status === PromotionStatus.CANCELLED
    ) {
      throw new ConflictDomainException('Promotion is already inactive');
    }
    const now = new Date();
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        status: PromotionStatus.EXPIRED,
        endsAt: promotion.endsAt !== null && promotion.endsAt <= now ? promotion.endsAt : now,
      },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.FORCE_EXPIRED,
      { ...context, userId: adminId },
      { resource: 'promotion', resourceId: id },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.CAMPAIGN_EXPIRED,
      { promotionId: id, code: updated.code },
      { actorUserId: adminId },
    );
    return toPromotionDto(updated);
  }

  public async clone(
    adminId: string,
    id: string,
    dto: CloneCampaignDto,
    context: AuditContext,
  ): Promise<PromotionDto> {
    const source = await this.requirePromotion(id);
    const created = await this.prisma.promotion.create({
      data: {
        code: dto.code !== undefined ? this.normalizeCode(dto.code) : null,
        name: dto.name?.trim() ?? `${source.name} (Copy)`,
        type: source.type,
        status: PromotionStatus.DRAFT,
        domains: source.domains,
        percentOff: source.percentOff,
        amountOff: source.amountOff,
        creditAmount: source.creditAmount,
        maxDiscount: source.maxDiscount,
        buyQty: source.buyQty,
        getQty: source.getQty,
        priority: source.priority,
        stackable: source.stackable,
        usageLimit: source.usageLimit,
        perUserLimit: source.perUserLimit,
        perDeviceLimit: source.perDeviceLimit,
        minOrderAmount: source.minOrderAmount,
        rules: (source.rules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        merchantId: source.merchantId,
        clonedFromId: source.id,
        createdBy: adminId,
        metadata: (source.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.CLONED,
      { ...context, userId: adminId },
      { resource: 'promotion', resourceId: created.id, metadata: { clonedFromId: source.id } },
    );
    return toPromotionDto(created);
  }

  // ---------------------------------------------------------------------
  // Sweep (called by PromotionSweepService)
  // ---------------------------------------------------------------------

  public async activateDueCampaigns(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.promotion.findMany({
      where: {
        status: PromotionStatus.SCHEDULED,
        deletedAt: null,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      select: { id: true, code: true },
    });
    for (const item of due) {
      await this.prisma.promotion.update({
        where: { id: item.id },
        data: { status: PromotionStatus.ACTIVE },
      });
      await this.eventBus.emit(DOMAIN_EVENTS.CAMPAIGN_ACTIVATED, {
        promotionId: item.id,
        code: item.code,
      });
    }
    return due.length;
  }

  public async expireDueCampaigns(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.promotion.findMany({
      where: {
        status: { in: [PromotionStatus.ACTIVE, PromotionStatus.SCHEDULED, PromotionStatus.PAUSED] },
        deletedAt: null,
        endsAt: { not: null, lte: now },
      },
      select: { id: true, code: true },
    });
    for (const item of due) {
      await this.prisma.promotion.update({
        where: { id: item.id },
        data: { status: PromotionStatus.EXPIRED },
      });
      await this.eventBus.emit(DOMAIN_EVENTS.CAMPAIGN_EXPIRED, {
        promotionId: item.id,
        code: item.code,
      });
    }
    return due.length;
  }

  // ---------------------------------------------------------------------
  // Analytics / CSV export
  // ---------------------------------------------------------------------

  public async getCampaignAnalytics(
    id: string,
    query: CampaignAnalyticsQueryDto,
  ): Promise<PromotionAnalyticsDto> {
    const promotion = await this.requirePromotion(id);
    const redemptions = await this.prisma.promotionRedemption.findMany({
      where: { promotionId: id, ...this.dateRangeFilter(query) },
      select: { userId: true, amountSaved: true },
    });
    const totalDiscountCost = redemptions.reduce((sum, r) => sum + Number(r.amountSaved), 0);
    return {
      promotionId: id,
      totalRedemptions: redemptions.length,
      uniqueUsers: new Set(redemptions.map((r) => r.userId)).size,
      totalDiscountCost: this.roundMoney(totalDiscountCost),
      usageLimit: promotion.usageLimit,
      usageCount: promotion.usageCount,
      redemptionRate:
        promotion.usageLimit !== null ? redemptions.length / promotion.usageLimit : null,
    };
  }

  public async getTopCampaigns(
    query: CampaignAnalyticsQueryDto,
    limit = 10,
  ): Promise<PromotionLeaderboardEntryDto[]> {
    const grouped = await this.prisma.promotionRedemption.groupBy({
      by: ['promotionId'],
      where: this.dateRangeFilter(query),
      _count: { _all: true },
      _sum: { amountSaved: true },
      orderBy: { _count: { promotionId: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) {
      return [];
    }
    const promotions = await this.prisma.promotion.findMany({
      where: { id: { in: grouped.map((g) => g.promotionId) } },
    });
    const byId = new Map(promotions.map((p) => [p.id, p]));
    return grouped
      .map((g): PromotionLeaderboardEntryDto | null => {
        const promotion = byId.get(g.promotionId);
        if (!promotion) {
          return null;
        }
        return {
          promotionId: promotion.id,
          code: promotion.code,
          name: promotion.name,
          type: promotion.type,
          redemptions: g._count._all,
          discountCost: this.roundMoney(Number(g._sum.amountSaved ?? 0)),
        };
      })
      .filter((entry): entry is PromotionLeaderboardEntryDto => entry !== null);
  }

  public async exportRedemptionsCsv(id: string): Promise<string> {
    await this.requirePromotion(id);
    const redemptions = await this.prisma.promotionRedemption.findMany({
      where: { promotionId: id },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'id,userId,orderId,referenceType,referenceId,deviceId,amountSaved,createdAt';
    const rows = redemptions.map((r) =>
      [
        r.id,
        r.userId,
        r.orderId ?? '',
        r.referenceType ?? '',
        r.referenceId ?? '',
        r.deviceId ?? '',
        Number(r.amountSaved).toFixed(2),
        r.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  private dateRangeFilter(query: CampaignAnalyticsQueryDto): Prisma.PromotionRedemptionWhereInput {
    if (!query.from && !query.to) {
      return {};
    }
    return {
      createdAt: {
        ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
        ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
      },
    };
  }

  // ---------------------------------------------------------------------
  // Evaluation (read-only preview) and redemption (transactional, locked)
  // ---------------------------------------------------------------------

  public async previewPromotion(input: PromotionPreviewInput): Promise<PromotionEvaluationDto> {
    const subtotal = this.roundMoney(input.subtotal);
    const couponCode = this.normalizeCode(input.couponCode);
    const promotions = await this.findActivePromotions({
      ...(input.merchantId !== undefined ? { merchantId: input.merchantId } : {}),
      couponCode,
      domain: input.domain,
    });
    const eligibilityContext: PromotionEligibilityContext = {
      userId: input.userId,
      ...input.eligibility,
    };
    const eligible: PromotionDiscountDto[] = [];

    for (const promotion of promotions) {
      if (!this.isEligibleForSubtotal(promotion, subtotal)) {
        continue;
      }
      if (
        !evaluatePromotionRules(promotion.rules as PromotionRules | null, eligibilityContext)
          .eligible
      ) {
        continue;
      }
      if (promotion.perUserLimit !== null) {
        const userUses = await this.prisma.promotionRedemption.count({
          where: { promotionId: promotion.id, userId: input.userId },
        });
        if (userUses >= promotion.perUserLimit) {
          continue;
        }
      }
      const effect = this.calculateEffect(promotion, subtotal);
      if (effect.discountAmount <= 0 && effect.creditAmount <= 0) {
        continue;
      }
      eligible.push({
        promotionId: promotion.id,
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        priority: promotion.priority,
        stackable: promotion.stackable,
        discountAmount: effect.discountAmount,
        creditAmount: effect.creditAmount,
      });
    }

    const discounts = this.selectDiscounts(eligible, subtotal);
    const discountTotal = this.roundMoney(
      Math.min(
        subtotal,
        discounts.reduce((sum, discount) => sum + discount.discountAmount, 0),
      ),
    );

    return {
      subtotal,
      discountTotal,
      discounts,
      couponCode,
      valid:
        couponCode === null ? discounts.length > 0 : discounts.some((d) => d.code === couponCode),
    };
  }

  /** Read-only, unlocked lookup of a single named promotion's effect for a
   * given subtotal — resolves by id or code, checks status/dates/domain/
   * merchant/subtotal/rules/perUserLimit/usageLimit, and returns `null`
   * instead of throwing when any check fails (this is a preview, not an
   * enforcement point — the caller decides what to do with "no discount").
   * Real enforcement happens in `redeemForReference`/`redeem`. */
  public async previewSinglePromotion(input: {
    userId: string;
    domain: PromotionDomain;
    subtotal: number;
    merchantId?: string;
    promotionId?: string;
    couponCode?: string;
    eligibility?: Omit<PromotionEligibilityContext, 'userId' | 'now'>;
  }): Promise<{ promotion: PromotionDto; discountAmount: number; creditAmount: number } | null> {
    if (!input.promotionId && !input.couponCode) {
      return null;
    }
    let promotion: Promotion;
    try {
      promotion = input.promotionId
        ? await this.requirePromotion(input.promotionId)
        : await this.requirePromotionByCode(input.couponCode);
    } catch {
      return null;
    }
    const subtotal = this.roundMoney(input.subtotal);
    const now = new Date();
    try {
      this.assertPromotionActiveForDomain(
        promotion,
        input.domain,
        input.merchantId ?? null,
        subtotal,
        now,
      );
    } catch {
      return null;
    }
    const eligibilityContext: PromotionEligibilityContext = {
      userId: input.userId,
      now,
      ...input.eligibility,
    };
    if (
      !evaluatePromotionRules(promotion.rules as PromotionRules | null, eligibilityContext).eligible
    ) {
      return null;
    }
    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
      return null;
    }
    if (promotion.perUserLimit !== null) {
      const uses = await this.prisma.promotionRedemption.count({
        where: { promotionId: promotion.id, userId: input.userId },
      });
      if (uses >= promotion.perUserLimit) {
        return null;
      }
    }
    const effect = this.calculateEffect(promotion, subtotal);
    if (effect.discountAmount <= 0 && effect.creditAmount <= 0) {
      return null;
    }
    return {
      promotion: toPromotionDto(promotion),
      discountAmount: effect.discountAmount,
      creditAmount: effect.creditAmount,
    };
  }

  public async evaluateForCart(input: {
    subtotal: number;
    merchantId?: string;
    userId: string;
    couponCode?: string;
  }): Promise<PromotionEvaluationDto> {
    return await this.previewPromotion({
      userId: input.userId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: input.subtotal,
      ...(input.merchantId !== undefined ? { merchantId: input.merchantId } : {}),
      ...(input.couponCode !== undefined ? { couponCode: input.couponCode } : {}),
    });
  }

  public async validateCoupon(input: {
    subtotal: number;
    merchantId?: string;
    userId: string;
    couponCode?: string;
  }): Promise<PromotionEvaluationDto> {
    if (!input.couponCode?.trim()) {
      throw new ValidationDomainException('couponCode is required');
    }
    return await this.evaluateForCart(input);
  }

  /** Order/marketplace redemption — the original RIDE-004.2-era path, kept
   * behaviourally unchanged for existing callers/tests. New domains should
   * use `redeemForReference` instead. */
  public async redeem(
    userId: string,
    dto: RedeemPromotionDto,
    context: AuditContext,
  ): Promise<PromotionRedemptionDto> {
    if (!dto.promotionId && !dto.couponCode) {
      throw new ValidationDomainException('promotionId or couponCode is required');
    }
    if (!dto.orderId) {
      throw new ValidationDomainException('orderId is required');
    }
    const order = await this.requireRedeemableOrder(dto.orderId, userId);
    const now = new Date();
    const promotion = dto.promotionId
      ? await this.requirePromotion(dto.promotionId)
      : await this.requirePromotionByCode(dto.couponCode);
    await this.emitCouponExpiredIfPast(promotion, userId, now);
    this.assertPromotionRedeemable(promotion, order, now);
    const subtotal = this.roundMoney(Number(order.subtotal));
    const eligibilityContext: PromotionEligibilityContext = { userId, now };

    const { redemption, discountAmount, creditAmount, redeemedPromotion } =
      await this.prisma.$transaction(
        async (tx) => {
          await this.lockPromotionForRedemption(tx, promotion.id);
          const lockedPromotion = await tx.promotion.findFirst({
            where: { id: promotion.id },
          });
          if (!lockedPromotion) {
            throw new NotFoundDomainException('Promotion not found');
          }
          this.assertPromotionRedeemable(lockedPromotion, order, now);
          const ruleResult = evaluatePromotionRules(
            lockedPromotion.rules as PromotionRules | null,
            eligibilityContext,
          );
          if (!ruleResult.eligible) {
            throw new ValidationDomainException(ruleResult.reason ?? 'Promotion is not eligible');
          }
          if (
            lockedPromotion.usageLimit !== null &&
            lockedPromotion.usageCount >= lockedPromotion.usageLimit
          ) {
            throw new ValidationDomainException('Promotion usage limit reached');
          }
          if (lockedPromotion.perUserLimit !== null) {
            const userUses = await tx.promotionRedemption.count({
              where: { promotionId: lockedPromotion.id, userId },
            });
            if (userUses >= lockedPromotion.perUserLimit) {
              throw new ValidationDomainException('Promotion user limit reached');
            }
          }
          if (dto.deviceId !== undefined && lockedPromotion.perDeviceLimit !== null) {
            const deviceUses = await tx.promotionRedemption.count({
              where: { promotionId: lockedPromotion.id, deviceId: dto.deviceId },
            });
            if (deviceUses >= lockedPromotion.perDeviceLimit) {
              throw new ValidationDomainException('Promotion device limit reached');
            }
          }
          const existingRedemption = await tx.promotionRedemption.findFirst({
            where: { promotionId: lockedPromotion.id, orderId: order.id },
            select: { id: true },
          });
          if (existingRedemption) {
            throw new ConflictDomainException('Promotion already redeemed for order');
          }
          const effect = this.calculateEffect(lockedPromotion, subtotal);
          if (effect.discountAmount <= 0 && effect.creditAmount <= 0) {
            throw new ValidationDomainException('Promotion does not apply to order');
          }
          const created = await tx.promotionRedemption.create({
            data: {
              promotionId: lockedPromotion.id,
              userId,
              orderId: order.id,
              referenceType: 'order',
              referenceId: order.id,
              ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
              amountSaved: this.roundMoney(effect.discountAmount + effect.creditAmount),
            },
          });
          await tx.promotion.update({
            where: { id: lockedPromotion.id },
            data: { usageCount: { increment: 1 } },
          });
          return {
            redemption: created,
            discountAmount: effect.discountAmount,
            creditAmount: effect.creditAmount,
            redeemedPromotion: lockedPromotion,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.REDEEMED,
      { ...context, userId },
      {
        resource: 'promotion',
        resourceId: redeemedPromotion.id,
        metadata: { orderId: order.id, amountSaved: Number(redemption.amountSaved) },
      },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.COUPON_REDEEMED,
      {
        promotionId: redeemedPromotion.id,
        code: redeemedPromotion.code,
        userId,
        orderId: order.id,
        amountSaved: Number(redemption.amountSaved),
      },
      { actorUserId: userId },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.PROMOTION_REDEEMED,
      {
        promotionId: redeemedPromotion.id,
        redemptionId: redemption.id,
        code: redeemedPromotion.code,
        userId,
        referenceType: 'order',
        referenceId: order.id,
        discountAmount: String(discountAmount),
        creditAmount: String(creditAmount),
      },
      { actorUserId: userId },
    );

    if (creditAmount > 0) {
      await this.creditWalletForRedemption(
        redeemedPromotion,
        redemption,
        userId,
        creditAmount,
        WalletOwnerType.CUSTOMER,
        context,
      );
    }

    return toPromotionRedemptionDto(redemption);
  }

  /** Domain-generic redemption for Ride and any future non-order domain.
   * Shares the same locking/limit/rule discipline as `redeem()` above but
   * is parameterized by an arbitrary `(referenceType, referenceId)` pair
   * instead of being hard-wired to `Order`. */
  public async redeemForReference(
    input: PromotionGenericRedeemInput,
    context: AuditContext,
  ): Promise<PromotionGenericRedeemResult> {
    if (!input.promotionId && !input.couponCode) {
      throw new ValidationDomainException('promotionId or couponCode is required');
    }
    const now = new Date();
    const promotion = input.promotionId
      ? await this.requirePromotion(input.promotionId)
      : await this.requirePromotionByCode(input.couponCode);
    const subtotal = this.roundMoney(input.subtotal);
    const merchantId = input.merchantId ?? null;
    await this.emitCouponExpiredIfPast(promotion, input.userId, now);
    this.assertPromotionActiveForDomain(promotion, input.domain, merchantId, subtotal, now);
    const eligibilityContext: PromotionEligibilityContext = {
      userId: input.userId,
      now,
      ...input.eligibility,
    };

    const { redemption, discountAmount, creditAmount, redeemedPromotion } =
      await this.prisma.$transaction(
        async (tx) => {
          await this.lockPromotionForRedemption(tx, promotion.id);
          const lockedPromotion = await tx.promotion.findFirst({ where: { id: promotion.id } });
          if (!lockedPromotion) {
            throw new NotFoundDomainException('Promotion not found');
          }
          this.assertPromotionActiveForDomain(
            lockedPromotion,
            input.domain,
            merchantId,
            subtotal,
            now,
          );
          const ruleResult = evaluatePromotionRules(
            lockedPromotion.rules as PromotionRules | null,
            eligibilityContext,
          );
          if (!ruleResult.eligible) {
            throw new ValidationDomainException(ruleResult.reason ?? 'Promotion is not eligible');
          }
          if (
            lockedPromotion.usageLimit !== null &&
            lockedPromotion.usageCount >= lockedPromotion.usageLimit
          ) {
            throw new ValidationDomainException('Promotion usage limit reached');
          }
          if (lockedPromotion.perUserLimit !== null) {
            const userUses = await tx.promotionRedemption.count({
              where: { promotionId: lockedPromotion.id, userId: input.userId },
            });
            if (userUses >= lockedPromotion.perUserLimit) {
              throw new ValidationDomainException('Promotion user limit reached');
            }
          }
          if (input.deviceId !== undefined && lockedPromotion.perDeviceLimit !== null) {
            const deviceUses = await tx.promotionRedemption.count({
              where: { promotionId: lockedPromotion.id, deviceId: input.deviceId },
            });
            if (deviceUses >= lockedPromotion.perDeviceLimit) {
              throw new ValidationDomainException('Promotion device limit reached');
            }
          }
          const existingRedemption = await tx.promotionRedemption.findFirst({
            where: {
              promotionId: lockedPromotion.id,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
            },
            select: { id: true },
          });
          if (existingRedemption) {
            throw new ConflictDomainException('Promotion already redeemed for this reference');
          }
          const effect = this.calculateEffect(lockedPromotion, subtotal);
          if (effect.discountAmount <= 0 && effect.creditAmount <= 0) {
            throw new ValidationDomainException('Promotion does not apply');
          }
          const created = await tx.promotionRedemption.create({
            data: {
              promotionId: lockedPromotion.id,
              userId: input.userId,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
              ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
              amountSaved: this.roundMoney(effect.discountAmount + effect.creditAmount),
            },
          });
          await tx.promotion.update({
            where: { id: lockedPromotion.id },
            data: { usageCount: { increment: 1 } },
          });
          return {
            redemption: created,
            discountAmount: effect.discountAmount,
            creditAmount: effect.creditAmount,
            redeemedPromotion: lockedPromotion,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.REDEEMED,
      { ...context, userId: input.userId },
      {
        resource: 'promotion',
        resourceId: redeemedPromotion.id,
        metadata: {
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          amountSaved: Number(redemption.amountSaved),
        },
      },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.PROMOTION_REDEEMED,
      {
        promotionId: redeemedPromotion.id,
        redemptionId: redemption.id,
        code: redeemedPromotion.code,
        userId: input.userId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        discountAmount: String(discountAmount),
        creditAmount: String(creditAmount),
      },
      { actorUserId: input.userId },
    );

    if (creditAmount > 0) {
      await this.creditWalletForRedemption(
        redeemedPromotion,
        redemption,
        input.userId,
        creditAmount,
        input.walletOwnerType ?? WalletOwnerType.CUSTOMER,
        context,
      );
    }

    return {
      redemption: toPromotionRedemptionDto(redemption),
      discountAmount,
      creditAmount,
      promotion: toPromotionDto(redeemedPromotion),
    };
  }

  public calculateDiscount(promotion: Promotion, subtotal: number): number {
    const raw = this.rawDiscount(promotion, subtotal);
    if (raw <= 0) {
      return 0;
    }
    const capped =
      promotion.maxDiscount !== null ? Math.min(raw, Number(promotion.maxDiscount)) : raw;
    return this.roundMoney(Math.min(subtotal, capped));
  }

  /** Splits a promotion's benefit into `discountAmount` (reduces the
   * current subtotal immediately) and `creditAmount` (paid into the
   * user's wallet post-commit) — see CREDIT_PROMOTION_TYPES. */
  public calculateEffect(
    promotion: Promotion,
    subtotal: number,
  ): { discountAmount: number; creditAmount: number } {
    if (this.isCreditType(promotion.type)) {
      const raw = promotion.creditAmount !== null ? Number(promotion.creditAmount) : 0;
      const capped =
        promotion.maxDiscount !== null ? Math.min(raw, Number(promotion.maxDiscount)) : raw;
      return { discountAmount: 0, creditAmount: this.roundMoney(Math.max(0, capped)) };
    }
    return { discountAmount: this.calculateDiscount(promotion, subtotal), creditAmount: 0 };
  }

  public selectDiscounts(
    discounts: PromotionDiscountDto[],
    subtotal: number,
  ): PromotionDiscountDto[] {
    const ordered = [...discounts].sort(
      (a, b) => b.priority - a.priority || b.discountAmount - a.discountAmount,
    );
    const stackable = ordered.filter((discount) => discount.stackable);
    const stackableTotal = this.roundMoney(
      Math.min(
        subtotal,
        stackable.reduce((sum, discount) => sum + discount.discountAmount, 0),
      ),
    );
    const bestSingle = ordered.reduce<PromotionDiscountDto | null>(
      (best, discount) =>
        best === null || discount.discountAmount > best.discountAmount ? discount : best,
      null,
    );

    if (!bestSingle) {
      return [];
    }
    return stackable.length > 0 && stackableTotal > bestSingle.discountAmount
      ? stackable
      : [bestSingle];
  }

  private rawDiscount(promotion: Promotion, subtotal: number): number {
    if (promotion.percentOff !== null) {
      return subtotal * (Number(promotion.percentOff) / 100);
    }
    if (promotion.amountOff !== null) {
      return Number(promotion.amountOff);
    }
    if (
      promotion.type === PromotionType.BOGO &&
      promotion.buyQty !== null &&
      promotion.getQty !== null
    ) {
      const units = promotion.buyQty + promotion.getQty;
      return units <= 0 ? 0 : subtotal * (promotion.getQty / units);
    }
    return 0;
  }

  private isCreditType(type: PromotionType): boolean {
    return (CREDIT_PROMOTION_TYPES as readonly string[]).includes(type);
  }

  private async emitCouponExpiredIfPast(
    promotion: Promotion,
    userId: string,
    now: Date,
  ): Promise<void> {
    if (promotion.endsAt !== null && promotion.endsAt < now) {
      await this.eventBus.emit(
        DOMAIN_EVENTS.COUPON_EXPIRED,
        { promotionId: promotion.id, code: promotion.code, userId },
        { actorUserId: userId },
      );
    }
  }

  private isDomainEligible(promotion: Promotion, domain: PromotionDomain): boolean {
    return promotion.domains.length === 0 || promotion.domains.includes(domain);
  }

  private async creditWalletForRedemption(
    promotion: Promotion,
    redemption: PromotionRedemption,
    userId: string,
    amount: number,
    ownerType: WalletOwnerType,
    context: AuditContext,
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }
    const isCashback = promotion.type === PromotionType.CASHBACK;
    if (isCashback) {
      await this.walletService.cashback({
        ownerType,
        ownerId: userId,
        amount,
        referenceType: PROMOTION_WALLET_REFERENCE_TYPE,
        referenceId: redemption.id,
        description: `Promotion cashback (${promotion.code ?? promotion.name})`,
        context,
      });
      await this.eventBus.emit(
        DOMAIN_EVENTS.CASHBACK_AWARDED,
        { promotionId: promotion.id, redemptionId: redemption.id, userId, amount: String(amount) },
        { actorUserId: userId },
      );
      return;
    }
    await this.walletService.credit({
      ownerType,
      ownerId: userId,
      amount,
      referenceType: PROMOTION_WALLET_REFERENCE_TYPE,
      referenceId: redemption.id,
      description: `Promotion reward (${promotion.code ?? promotion.name})`,
      context,
    });
  }

  private async findActivePromotions(input: {
    merchantId?: string;
    couponCode?: string | null;
    domain?: PromotionDomain;
  }): Promise<Promotion[]> {
    const now = new Date();
    const couponCode = this.normalizeCode(input.couponCode);
    return await this.prisma.promotion.findMany({
      where: {
        deletedAt: null,
        status: { in: [PromotionStatus.ACTIVE, PromotionStatus.SCHEDULED] },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          {
            OR:
              input.merchantId === undefined
                ? [{ merchantId: null }]
                : [{ merchantId: input.merchantId }, { merchantId: null }],
          },
          {
            OR: couponCode === null ? [{ code: null }] : [{ code: couponCode }, { code: null }],
          },
          ...(input.domain !== undefined
            ? [{ OR: [{ domains: { isEmpty: true } }, { domains: { has: input.domain } }] }]
            : []),
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private isEligibleForSubtotal(promotion: Promotion, subtotal: number): boolean {
    return promotion.minOrderAmount === null || subtotal >= Number(promotion.minOrderAmount);
  }

  private async requireRedeemableOrder(
    orderId: string,
    userId: string,
  ): Promise<PromotionRedeemOrder> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, merchantId: true, subtotal: true },
    });
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    if (order.customerId !== userId) {
      throw new ForbiddenDomainException('Order does not belong to user');
    }
    return order;
  }

  private assertPromotionRedeemable(
    promotion: Promotion,
    order: PromotionRedeemOrder,
    now: Date,
  ): void {
    if (promotion.deletedAt !== null || promotion.status !== PromotionStatus.ACTIVE) {
      throw new ValidationDomainException('Promotion is not active');
    }
    if (promotion.startsAt !== null && promotion.startsAt > now) {
      throw new ValidationDomainException('Promotion is not active');
    }
    if (promotion.endsAt !== null && promotion.endsAt < now) {
      throw new ValidationDomainException('Promotion is expired');
    }
    if (promotion.merchantId !== null && promotion.merchantId !== order.merchantId) {
      throw new ValidationDomainException('Promotion is not valid for this merchant');
    }
    if (!this.isEligibleForSubtotal(promotion, this.roundMoney(Number(order.subtotal)))) {
      throw new ValidationDomainException('Promotion minimum order amount not met');
    }
  }

  private assertPromotionActiveForDomain(
    promotion: Promotion,
    domain: PromotionDomain,
    merchantId: string | null,
    subtotal: number,
    now: Date,
  ): void {
    if (promotion.deletedAt !== null || promotion.status !== PromotionStatus.ACTIVE) {
      throw new ValidationDomainException('Promotion is not active');
    }
    if (promotion.startsAt !== null && promotion.startsAt > now) {
      throw new ValidationDomainException('Promotion is not active');
    }
    if (promotion.endsAt !== null && promotion.endsAt < now) {
      throw new ValidationDomainException('Promotion is expired');
    }
    if (!this.isDomainEligible(promotion, domain)) {
      throw new ValidationDomainException('Promotion is not valid for this service');
    }
    if (promotion.merchantId !== null && promotion.merchantId !== merchantId) {
      throw new ValidationDomainException('Promotion is not valid for this merchant');
    }
    if (!this.isEligibleForSubtotal(promotion, subtotal)) {
      throw new ValidationDomainException('Promotion minimum order amount not met');
    }
  }

  private async lockPromotionForRedemption(
    tx: Prisma.TransactionClient,
    promotionId: string,
  ): Promise<void> {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM promotions WHERE id = ${promotionId}::uuid FOR UPDATE
    `;
  }

  private async requirePromotion(id: string): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, deletedAt: null },
    });
    if (!promotion) {
      throw new NotFoundDomainException('Promotion not found');
    }
    return promotion;
  }

  private async requirePromotionByCode(code: string | undefined): Promise<Promotion> {
    const normalized = this.normalizeCode(code);
    if (normalized === null) {
      throw new ValidationDomainException('couponCode is required');
    }
    const promotion = await this.prisma.promotion.findFirst({
      where: { code: normalized, deletedAt: null },
    });
    if (!promotion) {
      throw new NotFoundDomainException('Promotion not found');
    }
    return promotion;
  }

  private validatePromotionShape(dto: CreatePromotionDto | UpdatePromotionDto): void {
    if (dto.startsAt && dto.endsAt && new Date(dto.startsAt) >= new Date(dto.endsAt)) {
      throw new ValidationDomainException('startsAt must be before endsAt');
    }
    if (dto.type === PromotionType.BOGO && (dto.buyQty === undefined || dto.getQty === undefined)) {
      throw new ValidationDomainException('BOGO promotions require buyQty and getQty');
    }
    if (dto.type !== undefined && this.isCreditType(dto.type) && dto.creditAmount === undefined) {
      throw new ValidationDomainException('This promotion type requires creditAmount');
    }
    if (
      dto.type !== undefined &&
      dto.type !== PromotionType.BOGO &&
      !this.isCreditType(dto.type) &&
      dto.percentOff === undefined &&
      dto.amountOff === undefined
    ) {
      throw new ValidationDomainException('Promotion requires percentOff or amountOff');
    }
  }

  private toCreateData(dto: CreatePromotionDto, adminId: string): Prisma.PromotionCreateInput {
    return {
      code: this.normalizeCode(dto.code),
      name: dto.name.trim(),
      type: dto.type,
      status: dto.status ?? PromotionStatus.DRAFT,
      domains: dto.domains ?? [],
      percentOff: dto.percentOff ?? null,
      amountOff: dto.amountOff ?? null,
      creditAmount: dto.creditAmount ?? null,
      maxDiscount: dto.maxDiscount ?? null,
      buyQty: dto.buyQty ?? null,
      getQty: dto.getQty ?? null,
      priority: dto.priority ?? 0,
      stackable: dto.stackable ?? false,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      perDeviceLimit: dto.perDeviceLimit ?? null,
      minOrderAmount: dto.minOrderAmount ?? null,
      ...(dto.rules !== undefined ? { rules: dto.rules as unknown as Prisma.InputJsonValue } : {}),
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      merchantId: dto.merchantId ?? null,
      createdBy: adminId,
      ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
    };
  }

  private toUpdateData(dto: UpdatePromotionDto): Prisma.PromotionUpdateInput {
    return {
      ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.domains !== undefined ? { domains: dto.domains } : {}),
      ...(dto.percentOff !== undefined ? { percentOff: dto.percentOff } : {}),
      ...(dto.amountOff !== undefined ? { amountOff: dto.amountOff } : {}),
      ...(dto.creditAmount !== undefined ? { creditAmount: dto.creditAmount } : {}),
      ...(dto.maxDiscount !== undefined ? { maxDiscount: dto.maxDiscount } : {}),
      ...(dto.buyQty !== undefined ? { buyQty: dto.buyQty } : {}),
      ...(dto.getQty !== undefined ? { getQty: dto.getQty } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.stackable !== undefined ? { stackable: dto.stackable } : {}),
      ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
      ...(dto.perUserLimit !== undefined ? { perUserLimit: dto.perUserLimit } : {}),
      ...(dto.perDeviceLimit !== undefined ? { perDeviceLimit: dto.perDeviceLimit } : {}),
      ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
      ...(dto.rules !== undefined ? { rules: dto.rules as unknown as Prisma.InputJsonValue } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
      ...(dto.merchantId !== undefined ? { merchantId: dto.merchantId } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
    };
  }

  private handleCouponRedeemed(_event: DomainEvent): void {
    return undefined;
  }

  private normalizeCode(code: string | null | undefined): string | null {
    const normalized = code?.trim().toUpperCase();
    return normalized && normalized.length > 0 ? normalized : null;
  }

  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
