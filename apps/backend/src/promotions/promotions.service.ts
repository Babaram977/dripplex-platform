import { Injectable, OnModuleInit } from '@nestjs/common';
import { PromotionStatus, PromotionType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { PROMOTION_AUDIT_ACTIONS } from './promotion.constants';
import {
  toPromotionDto,
  toPromotionRedemptionDto,
  type PromotionDiscountDto,
  type PromotionDto,
  type PromotionEvaluationDto,
  type PromotionRedemptionDto,
} from './promotion.mapper';

import type {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  RedeemPromotionDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';
import type { Prisma, Promotion } from '@prisma/client';

@Injectable()
export class PromotionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
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
      data: this.toCreateData(dto),
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
        ...(query.merchantId !== undefined
          ? { OR: [{ merchantId: query.merchantId }, { merchantId: null }] }
          : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return promotions.map(toPromotionDto);
  }

  public async listActive(merchantId?: string): Promise<PromotionDto[]> {
    const input: { merchantId?: string } = {};
    if (merchantId !== undefined) {
      input.merchantId = merchantId;
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

  public async evaluateForCart(input: {
    subtotal: number;
    merchantId?: string;
    userId: string;
    couponCode?: string;
  }): Promise<PromotionEvaluationDto> {
    const subtotal = this.roundMoney(input.subtotal);
    const couponCode = this.normalizeCode(input.couponCode);
    const activeInput: { merchantId?: string; couponCode?: string | null } = { couponCode };
    if (input.merchantId !== undefined) {
      activeInput.merchantId = input.merchantId;
    }
    const promotions = await this.findActivePromotions(activeInput);
    const eligible: PromotionDiscountDto[] = [];

    for (const promotion of promotions) {
      if (!this.isEligibleForSubtotal(promotion, subtotal)) {
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
      const discountAmount = this.calculateDiscount(promotion, subtotal);
      if (discountAmount <= 0) {
        continue;
      }
      eligible.push({
        promotionId: promotion.id,
        code: promotion.code,
        name: promotion.name,
        type: promotion.type,
        priority: promotion.priority,
        stackable: promotion.stackable,
        discountAmount,
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

  public async redeem(
    userId: string,
    dto: RedeemPromotionDto,
    context: AuditContext,
  ): Promise<PromotionRedemptionDto> {
    if (!dto.promotionId && !dto.couponCode) {
      throw new ValidationDomainException('promotionId or couponCode is required');
    }
    const promotion = dto.promotionId
      ? await this.requirePromotion(dto.promotionId)
      : await this.requirePromotionByCode(dto.couponCode);

    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
      throw new ValidationDomainException('Promotion usage limit reached');
    }
    if (promotion.perUserLimit !== null) {
      const userUses = await this.prisma.promotionRedemption.count({
        where: { promotionId: promotion.id, userId },
      });
      if (userUses >= promotion.perUserLimit) {
        throw new ValidationDomainException('Promotion user limit reached');
      }
    }

    const redemption = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotionRedemption.create({
        data: {
          promotionId: promotion.id,
          userId,
          orderId: dto.orderId ?? null,
          amountSaved: this.roundMoney(dto.amountSaved),
        },
      });
      await tx.promotion.update({
        where: { id: promotion.id },
        data: { usageCount: { increment: 1 } },
      });
      return created;
    });

    await this.auditService.record(
      PROMOTION_AUDIT_ACTIONS.REDEEMED,
      { ...context, userId },
      {
        resource: 'promotion',
        resourceId: promotion.id,
        metadata: { orderId: dto.orderId ?? null, amountSaved: dto.amountSaved },
      },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.COUPON_REDEEMED,
      {
        promotionId: promotion.id,
        code: promotion.code,
        userId,
        orderId: dto.orderId ?? null,
        amountSaved: this.roundMoney(dto.amountSaved),
      },
      { actorUserId: userId },
    );

    return toPromotionRedemptionDto(redemption);
  }

  public calculateDiscount(promotion: Promotion, subtotal: number): number {
    if (promotion.percentOff !== null) {
      return this.roundMoney(Math.min(subtotal, subtotal * (Number(promotion.percentOff) / 100)));
    }
    if (promotion.amountOff !== null) {
      return this.roundMoney(Math.min(subtotal, Number(promotion.amountOff)));
    }
    if (
      promotion.type === PromotionType.BOGO &&
      promotion.buyQty !== null &&
      promotion.getQty !== null
    ) {
      const units = promotion.buyQty + promotion.getQty;
      return units <= 0
        ? 0
        : this.roundMoney(Math.min(subtotal, subtotal * (promotion.getQty / units)));
    }
    return 0;
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

  private async findActivePromotions(input: {
    merchantId?: string;
    couponCode?: string | null;
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
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private isEligibleForSubtotal(promotion: Promotion, subtotal: number): boolean {
    return promotion.minOrderAmount === null || subtotal >= Number(promotion.minOrderAmount);
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
    if (
      dto.type !== undefined &&
      dto.type !== PromotionType.BOGO &&
      dto.percentOff === undefined &&
      dto.amountOff === undefined
    ) {
      throw new ValidationDomainException('Promotion requires percentOff or amountOff');
    }
  }

  private toCreateData(dto: CreatePromotionDto): Prisma.PromotionCreateInput {
    return {
      code: this.normalizeCode(dto.code),
      name: dto.name.trim(),
      type: dto.type,
      status: dto.status ?? PromotionStatus.DRAFT,
      percentOff: dto.percentOff ?? null,
      amountOff: dto.amountOff ?? null,
      buyQty: dto.buyQty ?? null,
      getQty: dto.getQty ?? null,
      priority: dto.priority ?? 0,
      stackable: dto.stackable ?? false,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      minOrderAmount: dto.minOrderAmount ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      merchantId: dto.merchantId ?? null,
      ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
    };
  }

  private toUpdateData(dto: UpdatePromotionDto): Prisma.PromotionUpdateInput {
    return {
      ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.percentOff !== undefined ? { percentOff: dto.percentOff } : {}),
      ...(dto.amountOff !== undefined ? { amountOff: dto.amountOff } : {}),
      ...(dto.buyQty !== undefined ? { buyQty: dto.buyQty } : {}),
      ...(dto.getQty !== undefined ? { getQty: dto.getQty } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.stackable !== undefined ? { stackable: dto.stackable } : {}),
      ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
      ...(dto.perUserLimit !== undefined ? { perUserLimit: dto.perUserLimit } : {}),
      ...(dto.minOrderAmount !== undefined ? { minOrderAmount: dto.minOrderAmount } : {}),
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
