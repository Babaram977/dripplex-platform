import type {
  FraudListEntryDto,
  FraudSignalDto,
  FraudThresholdDto,
  PaginatedResult,
} from '@dripplex/types';
import type { FraudListEntry, FraudSignal, FraudThreshold } from '@prisma/client';

function nullableDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toFraudSignalDto(signal: FraudSignal): FraudSignalDto {
  return {
    id: signal.id,
    userId: signal.userId,
    orderId: signal.orderId,
    paymentId: signal.paymentId,
    signalType: signal.signalType,
    riskScore: signal.riskScore,
    riskLevel: signal.riskLevel,
    details: signal.details,
    ipAddress: signal.ipAddress,
    deviceFingerprint: signal.deviceFingerprint,
    status: signal.status,
    reviewedBy: signal.reviewedBy,
    reviewedAt: nullableDate(signal.reviewedAt),
    createdAt: signal.createdAt.toISOString(),
    updatedAt: signal.updatedAt.toISOString(),
    deletedAt: nullableDate(signal.deletedAt),
  };
}

export function toPaginatedFraudSignals(
  items: FraudSignal[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<FraudSignalDto> {
  return {
    items: items.map(toFraudSignalDto),
    meta: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function toFraudThresholdDto(threshold: FraudThreshold): FraudThresholdDto {
  return {
    id: threshold.id,
    key: threshold.key,
    value: threshold.value,
    description: threshold.description,
    updatedAt: threshold.updatedAt.toISOString(),
  };
}

export function toFraudListEntryDto(entry: FraudListEntry): FraudListEntryDto {
  return {
    id: entry.id,
    listType: entry.listType,
    matchType: entry.matchType,
    matchValue: entry.matchValue,
    reason: entry.reason,
    active: entry.active,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    deletedAt: nullableDate(entry.deletedAt),
  };
}
