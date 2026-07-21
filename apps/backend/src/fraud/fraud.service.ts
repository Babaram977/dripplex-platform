import { Injectable } from '@nestjs/common';
import {
  FraudListType,
  FraudMatchType,
  FraudReviewStatus,
  FraudRiskLevel,
  Prisma,
  TransactionStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { FRAUD_AUDIT_ACTIONS, FRAUD_THRESHOLD_DEFAULTS } from './fraud.constants';
import {
  toFraudListEntryDto,
  toFraudSignalDto,
  toFraudThresholdDto,
  toPaginatedFraudSignals,
} from './fraud.mapper';

import type {
  CreateFraudListEntryRequest,
  EvaluateOrderRiskInput,
  FraudEvaluationResult,
  FraudListEntryDto,
  FraudListEntryQuery,
  FraudQueueQuery,
  FraudSignalDto,
  FraudThresholdDto,
  PaginatedResult,
  ReviewFraudSignalRequest,
  UpdateFraudListEntryRequest,
  UpsertFraudThresholdRequest,
} from '@dripplex/types';
import type { FraudListEntry } from '@prisma/client';

type ThresholdKey = keyof typeof FRAUD_THRESHOLD_DEFAULTS;
interface FraudMatchCandidate {
  matchType: FraudMatchType;
  matchValue: string;
}

/**
 * Fraud evaluation is intentionally observational in S1-C14→C23.
 * Signals and risk scores are recorded for admin review, but checkout/payment
 * are never blocked here. Enforcement belongs to a later phase.
 */
@Injectable()
export class FraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async evaluateOrderRisk(input: EvaluateOrderRiskInput): Promise<FraudEvaluationResult> {
    const thresholds = await this.getThresholds();
    const matches = await this.findListMatches(input);
    const whitelist = matches.find((entry) => entry.listType === FraudListType.WHITELIST);
    const blacklist = matches.find((entry) => entry.listType === FraudListType.BLACKLIST);

    const reasons: string[] = [];
    const checks: Record<string, unknown> = {
      listMatches: matches.map((entry) => ({
        listType: entry.listType,
        matchType: entry.matchType,
        matchValue: entry.matchValue,
        reason: entry.reason,
      })),
    };

    let score = 0;
    // Observational mode: never block checkout/payment from this service.
    const blocked = false;

    if (whitelist) {
      reasons.push(`whitelisted_${whitelist.matchType.toLowerCase()}`);
      score = 0;
    } else if (blacklist) {
      reasons.push(`blacklisted_${blacklist.matchType.toLowerCase()}`);
      score = 100;
    } else {
      if ((input.amount ?? 0) >= thresholds.high_value_order_amount) {
        score += 30;
        reasons.push('high_value_order');
      }

      const windowStart = new Date(Date.now() - thresholds.velocity_window_minutes * 60 * 1000);
      if (input.userId !== undefined) {
        const [failedPayments, recentOrders] = await Promise.all([
          this.prisma.paymentTransaction.count({
            where: {
              customerId: input.userId,
              status: TransactionStatus.FAILED,
              createdAt: { gte: windowStart },
            },
          }),
          this.prisma.order.count({
            where: {
              customerId: input.userId,
              createdAt: { gte: windowStart },
            },
          }),
        ]);
        checks['failedPaymentVelocity'] = failedPayments;
        checks['orderVelocity'] = recentOrders;

        if (failedPayments >= thresholds.failed_payment_velocity_count) {
          score += 25;
          reasons.push('failed_payment_velocity');
        }
        if (recentOrders >= thresholds.order_velocity_count) {
          score += 20;
          reasons.push('order_velocity');
        }
      }

      if (input.deviceFingerprint !== undefined) {
        const recentDeviceSignals = await this.prisma.fraudSignal.count({
          where: {
            deviceFingerprint: input.deviceFingerprint,
            createdAt: { gte: windowStart },
            deletedAt: null,
          },
        });
        checks['deviceVelocity'] = recentDeviceSignals;
        if (recentDeviceSignals >= thresholds.device_velocity_count) {
          score += 15;
          reasons.push('device_velocity');
        }
      }

      if (this.isSuspiciousIp(input.ipAddress)) {
        score += 10;
        reasons.push('suspicious_ip');
      }

      if (this.hasGeoMismatch(input)) {
        score += 15;
        reasons.push('geo_mismatch');
      }
    }

    const riskLevel = this.riskLevelForScore(score, thresholds);
    const signal = await this.prisma.fraudSignal.create({
      data: {
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
        ...(input.paymentId !== undefined ? { paymentId: input.paymentId } : {}),
        signalType: 'ORDER_RISK',
        riskScore: Math.min(100, score),
        riskLevel,
        details: {
          amount: input.amount ?? null,
          currency: input.currency ?? null,
          reasons,
          checks,
          whitelisted: whitelist !== undefined,
          blocked,
        } as Prisma.InputJsonObject,
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.deviceFingerprint !== undefined
          ? { deviceFingerprint: input.deviceFingerprint }
          : {}),
      },
    });

    return {
      riskScore: signal.riskScore,
      riskLevel: signal.riskLevel,
      blocked,
      reasons,
      signal: toFraudSignalDto(signal),
    };
  }

  public async listQueue(query: FraudQueueQuery = {}): Promise<PaginatedResult<FraudSignalDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.FraudSignalWhereInput = { deletedAt: null };

    if (query.status !== undefined) {
      where.status = query.status;
    } else {
      where.status = { in: [FraudReviewStatus.OPEN, FraudReviewStatus.UNDER_REVIEW] };
    }
    if (query.riskLevel !== undefined) {
      where.riskLevel = query.riskLevel;
    }
    if (query.userId !== undefined) {
      where.userId = query.userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.fraudSignal.findMany({
        where,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fraudSignal.count({ where }),
    ]);

    return toPaginatedFraudSignals(items, total, page, pageSize);
  }

  public async reviewSignal(
    id: string,
    dto: ReviewFraudSignalRequest,
    reviewerId: string,
    context: AuditContext,
  ): Promise<FraudSignalDto> {
    const existing = await this.requireSignal(id);
    const data: Prisma.FraudSignalUpdateInput = {
      status: dto.status,
      reviewer: { connect: { id: reviewerId } },
      reviewedAt: new Date(),
    };
    if (dto.note !== undefined) {
      data.details = this.withReviewNote(existing.details, dto.note);
    }

    const signal = await this.prisma.fraudSignal.update({ where: { id }, data });
    await this.auditService.record(FRAUD_AUDIT_ACTIONS.SIGNAL_REVIEWED, context, {
      resource: 'fraud_signal',
      resourceId: signal.id,
      metadata: { status: signal.status },
    });
    return toFraudSignalDto(signal);
  }

  public clearSignal(
    id: string,
    reviewerId: string,
    context: AuditContext,
  ): Promise<FraudSignalDto> {
    return this.reviewWithAudit(
      id,
      { status: FraudReviewStatus.CLEARED },
      reviewerId,
      context,
      FRAUD_AUDIT_ACTIONS.SIGNAL_CLEARED,
    );
  }

  public confirmSignal(
    id: string,
    reviewerId: string,
    context: AuditContext,
  ): Promise<FraudSignalDto> {
    return this.reviewWithAudit(
      id,
      { status: FraudReviewStatus.CONFIRMED_FRAUD },
      reviewerId,
      context,
      FRAUD_AUDIT_ACTIONS.SIGNAL_CONFIRMED,
    );
  }

  public async listThresholds(): Promise<FraudThresholdDto[]> {
    const thresholds = await this.prisma.fraudThreshold.findMany({ orderBy: { key: 'asc' } });
    return thresholds.map(toFraudThresholdDto);
  }

  public async upsertThreshold(
    key: string,
    dto: UpsertFraudThresholdRequest,
    context: AuditContext,
  ): Promise<FraudThresholdDto> {
    const threshold = await this.prisma.fraudThreshold.upsert({
      where: { key },
      update: {
        value: dto.value,
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      create: {
        key,
        value: dto.value,
        description: dto.description ?? null,
      },
    });

    await this.auditService.record(FRAUD_AUDIT_ACTIONS.THRESHOLD_UPDATED, context, {
      resource: 'fraud_threshold',
      metadata: { key, value: threshold.value },
    });

    return toFraudThresholdDto(threshold);
  }

  public async listEntries(query: FraudListEntryQuery = {}): Promise<FraudListEntryDto[]> {
    const where: Prisma.FraudListEntryWhereInput = { deletedAt: null };
    if (query.listType !== undefined) {
      where.listType = query.listType;
    }
    if (query.matchType !== undefined) {
      where.matchType = query.matchType;
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }

    const entries = await this.prisma.fraudListEntry.findMany({
      where,
      orderBy: [{ listType: 'asc' }, { matchType: 'asc' }, { matchValue: 'asc' }],
    });
    return entries.map(toFraudListEntryDto);
  }

  public async createEntry(
    dto: CreateFraudListEntryRequest,
    context: AuditContext,
  ): Promise<FraudListEntryDto> {
    const entry = await this.prisma.fraudListEntry.create({
      data: {
        listType: dto.listType,
        matchType: dto.matchType,
        matchValue: this.normalizeMatchValue(dto.matchType, dto.matchValue),
        reason: dto.reason ?? null,
      },
    });

    await this.auditService.record(FRAUD_AUDIT_ACTIONS.LIST_ENTRY_CREATED, context, {
      resource: 'fraud_list_entry',
      resourceId: entry.id,
      metadata: { listType: entry.listType, matchType: entry.matchType },
    });

    return toFraudListEntryDto(entry);
  }

  public async updateEntry(
    id: string,
    dto: UpdateFraudListEntryRequest,
    context: AuditContext,
  ): Promise<FraudListEntryDto> {
    await this.requireEntry(id);
    const data: Prisma.FraudListEntryUpdateInput = {};

    if (dto.listType !== undefined) {
      data.listType = dto.listType;
    }
    if (dto.matchType !== undefined) {
      data.matchType = dto.matchType;
    }
    if (dto.matchValue !== undefined) {
      data.matchValue = this.normalizeMatchValue(dto.matchType, dto.matchValue);
    }
    if (dto.reason !== undefined) {
      data.reason = dto.reason;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    const entry = await this.prisma.fraudListEntry.update({ where: { id }, data });
    await this.auditService.record(FRAUD_AUDIT_ACTIONS.LIST_ENTRY_UPDATED, context, {
      resource: 'fraud_list_entry',
      resourceId: entry.id,
    });
    return toFraudListEntryDto(entry);
  }

  public async deleteEntry(id: string, context: AuditContext): Promise<FraudListEntryDto> {
    await this.requireEntry(id);
    const entry = await this.prisma.fraudListEntry.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    await this.auditService.record(FRAUD_AUDIT_ACTIONS.LIST_ENTRY_DELETED, context, {
      resource: 'fraud_list_entry',
      resourceId: entry.id,
    });
    return toFraudListEntryDto(entry);
  }

  private async reviewWithAudit(
    id: string,
    dto: ReviewFraudSignalRequest,
    reviewerId: string,
    context: AuditContext,
    action: string,
  ): Promise<FraudSignalDto> {
    const signal = await this.reviewSignal(id, dto, reviewerId, context);
    await this.auditService.record(action, context, {
      resource: 'fraud_signal',
      resourceId: signal.id,
      metadata: { status: signal.status },
    });
    return signal;
  }

  private async requireSignal(id: string): Promise<{ id: string; details: Prisma.JsonValue }> {
    const signal = await this.prisma.fraudSignal.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, details: true },
    });
    if (!signal) {
      throw new NotFoundDomainException('Fraud signal not found');
    }
    return signal;
  }

  private async requireEntry(id: string): Promise<void> {
    const entry = await this.prisma.fraudListEntry.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundDomainException('Fraud list entry not found');
    }
  }

  private async getThresholds(): Promise<Record<ThresholdKey, number>> {
    const values: Record<ThresholdKey, number> = { ...FRAUD_THRESHOLD_DEFAULTS };
    const rows = await this.prisma.fraudThreshold.findMany({
      where: { key: { in: Object.keys(FRAUD_THRESHOLD_DEFAULTS) } },
    });
    for (const row of rows) {
      if (row.key in values) {
        values[row.key as ThresholdKey] = row.value;
      }
    }
    return values;
  }

  private riskLevelForScore(
    score: number,
    thresholds: Record<ThresholdKey, number>,
  ): FraudRiskLevel {
    if (score >= thresholds.score_critical) {
      return FraudRiskLevel.CRITICAL;
    }
    if (score >= thresholds.score_high) {
      return FraudRiskLevel.HIGH;
    }
    if (score >= thresholds.score_medium) {
      return FraudRiskLevel.MEDIUM;
    }
    return FraudRiskLevel.LOW;
  }

  private async findListMatches(input: EvaluateOrderRiskInput): Promise<FraudListEntry[]> {
    const candidates: FraudMatchCandidate[] = [
      ...(input.userId !== undefined
        ? [{ matchType: FraudMatchType.USER, matchValue: input.userId }]
        : []),
      ...(input.ipAddress !== undefined
        ? [{ matchType: FraudMatchType.IP, matchValue: input.ipAddress }]
        : []),
      ...(input.deviceFingerprint !== undefined
        ? [{ matchType: FraudMatchType.DEVICE, matchValue: input.deviceFingerprint }]
        : []),
      ...(input.email !== undefined
        ? [{ matchType: FraudMatchType.EMAIL, matchValue: input.email.toLowerCase() }]
        : []),
    ];

    if (candidates.length === 0) {
      return [];
    }

    return await this.prisma.fraudListEntry.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: candidates.map((candidate) => ({
          matchType: candidate.matchType,
          matchValue: candidate.matchValue,
        })),
      },
    });
  }

  private isSuspiciousIp(ipAddress?: string): boolean {
    if (ipAddress === undefined) {
      return false;
    }
    return ipAddress === '0.0.0.0' || ipAddress === '127.0.0.1' || ipAddress.startsWith('10.');
  }

  private hasGeoMismatch(input: EvaluateOrderRiskInput): boolean {
    if (input.billingCountry === undefined || input.shippingCountry === undefined) {
      return false;
    }
    return input.billingCountry.toUpperCase() !== input.shippingCountry.toUpperCase();
  }

  private withReviewNote(details: Prisma.JsonValue, note: string): Prisma.InputJsonObject {
    const base =
      details !== null && typeof details === 'object' && !Array.isArray(details) ? details : {};
    return {
      ...base,
      reviewNote: note,
    };
  }

  private normalizeMatchValue(matchType: FraudMatchType | undefined, value: string): string {
    const normalized = value.trim();
    return matchType === FraudMatchType.EMAIL ? normalized.toLowerCase() : normalized;
  }
}
