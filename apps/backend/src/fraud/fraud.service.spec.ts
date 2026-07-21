import {
  FraudListType,
  FraudMatchType,
  FraudReviewStatus,
  FraudRiskLevel,
  TransactionStatus,
} from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { FRAUD_AUDIT_ACTIONS, FRAUD_PERMISSIONS } from './fraud.constants';
import { FraudService } from './fraud.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { FraudListEntry, FraudSignal, FraudThreshold } from '@prisma/client';

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const signalId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const entryId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const reviewerId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const now = new Date('2026-07-21T12:00:00.000Z');

function signal(overrides: Partial<FraudSignal> = {}): FraudSignal {
  return {
    id: signalId,
    userId,
    orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    paymentId: null,
    signalType: 'ORDER_RISK',
    riskScore: 0,
    riskLevel: FraudRiskLevel.LOW,
    details: { reasons: [] },
    ipAddress: '8.8.8.8',
    deviceFingerprint: 'device-1',
    status: FraudReviewStatus.OPEN,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function listEntry(overrides: Partial<FraudListEntry> = {}): FraudListEntry {
  return {
    id: entryId,
    listType: FraudListType.BLACKLIST,
    matchType: FraudMatchType.IP,
    matchValue: '8.8.8.8',
    reason: 'Known abuse',
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function threshold(overrides: Partial<FraudThreshold> = {}): FraudThreshold {
  return {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    key: 'score_high',
    value: 70,
    description: 'High score',
    updatedAt: now,
    ...overrides,
  };
}

describe('FraudService', () => {
  const prisma = {
    fraudThreshold: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    fraudListEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentTransaction: {
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    fraudSignal: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const service = new FraudService(prisma, auditService);
  const context = { userId: reviewerId };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.fraudThreshold.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.fraudListEntry.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.paymentTransaction.count as jest.Mock).mockResolvedValue(0);
    (prisma.order.count as jest.Mock).mockResolvedValue(0);
    (prisma.fraudSignal.count as jest.Mock).mockResolvedValue(0);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) => Promise.resolve(signal(data)),
    );
  });

  it('defines fraud permissions', () => {
    expect(FRAUD_PERMISSIONS.ADMIN_MANAGE).toBe('admin:fraud:manage');
    expect(FRAUD_PERMISSIONS.ADMIN_CONFIGURE).toBe('admin:fraud:configure');
    expect(FRAUD_PERMISSIONS.SUPPORT_REVIEW).toBe('support:fraud:review');
  });

  it('records a low risk signal for ordinary orders', async () => {
    const result = await service.evaluateOrderRisk({
      userId,
      amount: 2500,
      ipAddress: '8.8.8.8',
      deviceFingerprint: 'device-1',
    });

    expect(result.riskLevel).toBe(FraudRiskLevel.LOW);
    expect(result.blocked).toBe(false);
    expect(prisma.fraudSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signalType: 'ORDER_RISK', riskScore: 0 }),
      }),
    );
  });

  it('records critical risk for blacklist matches without blocking (observational)', async () => {
    (prisma.fraudListEntry.findMany as jest.Mock).mockResolvedValue([listEntry()]);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 100, riskLevel: FraudRiskLevel.CRITICAL })),
    );

    const result = await service.evaluateOrderRisk({ userId, ipAddress: '8.8.8.8' });

    expect(result.blocked).toBe(false);
    expect(result.riskScore).toBe(100);
    expect(result.reasons).toContain('blacklisted_ip');
    expect(prisma.fraudSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({ blocked: false }),
        }),
      }),
    );
  });

  it('short-circuits risk for whitelist matches', async () => {
    (prisma.fraudListEntry.findMany as jest.Mock).mockResolvedValue([
      listEntry({
        listType: FraudListType.WHITELIST,
        matchType: FraudMatchType.USER,
        matchValue: userId,
      }),
    ]);

    const result = await service.evaluateOrderRisk({
      userId,
      amount: 999999,
      billingCountry: 'NG',
      shippingCountry: 'GH',
    });

    expect(result.riskScore).toBe(0);
    expect(result.reasons).toContain('whitelisted_user');
    expect(prisma.paymentTransaction.count).not.toHaveBeenCalled();
  });

  it('adds a high-value order reason', async () => {
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 30, riskLevel: FraudRiskLevel.LOW })),
    );

    const result = await service.evaluateOrderRisk({ userId, amount: 500000 });

    expect(result.riskScore).toBe(30);
    expect(result.reasons).toContain('high_value_order');
  });

  it('scores failed payment velocity', async () => {
    (prisma.paymentTransaction.count as jest.Mock).mockResolvedValue(3);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 55, riskLevel: FraudRiskLevel.MEDIUM })),
    );

    const result = await service.evaluateOrderRisk({ userId, amount: 500000 });

    expect(result.riskLevel).toBe(FraudRiskLevel.MEDIUM);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['high_value_order', 'failed_payment_velocity']),
    );
    expect(prisma.paymentTransaction.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: userId, status: TransactionStatus.FAILED }),
      }),
    );
  });

  it('scores order velocity', async () => {
    (prisma.paymentTransaction.count as jest.Mock).mockResolvedValue(3);
    (prisma.order.count as jest.Mock).mockResolvedValue(5);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 75, riskLevel: FraudRiskLevel.HIGH })),
    );

    const result = await service.evaluateOrderRisk({ userId, amount: 500000 });

    expect(result.riskLevel).toBe(FraudRiskLevel.HIGH);
    expect(result.reasons).toContain('order_velocity');
  });

  it('scores repeated device fingerprints', async () => {
    (prisma.fraudSignal.count as jest.Mock).mockResolvedValue(4);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 15, riskLevel: FraudRiskLevel.LOW })),
    );

    const result = await service.evaluateOrderRisk({ deviceFingerprint: 'device-1' });

    expect(result.reasons).toContain('device_velocity');
    expect(prisma.fraudSignal.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deviceFingerprint: 'device-1', deletedAt: null }),
      }),
    );
  });

  it('scores suspicious IP and geo mismatch', async () => {
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 25, riskLevel: FraudRiskLevel.LOW })),
    );

    const result = await service.evaluateOrderRisk({
      ipAddress: '10.0.0.5',
      billingCountry: 'NG',
      shippingCountry: 'GH',
    });

    expect(result.reasons).toEqual(expect.arrayContaining(['suspicious_ip', 'geo_mismatch']));
  });

  it('uses configured threshold values', async () => {
    (prisma.fraudThreshold.findMany as jest.Mock).mockResolvedValue([
      threshold({ key: 'score_critical', value: 25 }),
    ]);
    (prisma.fraudSignal.create as jest.Mock).mockImplementation(
      ({ data }: { data: Partial<FraudSignal> }) =>
        Promise.resolve(signal({ ...data, riskScore: 30, riskLevel: FraudRiskLevel.CRITICAL })),
    );

    const result = await service.evaluateOrderRisk({ amount: 500000 });

    expect(result.riskLevel).toBe(FraudRiskLevel.CRITICAL);
  });

  it('lists open and under-review queue items by default', async () => {
    (prisma.fraudSignal.findMany as jest.Mock).mockResolvedValue([signal()]);
    (prisma.fraudSignal.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listQueue({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(prisma.fraudSignal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [FraudReviewStatus.OPEN, FraudReviewStatus.UNDER_REVIEW] },
        }),
      }),
    );
  });

  it('reviews a signal with reviewer metadata and note', async () => {
    (prisma.fraudSignal.findFirst as jest.Mock).mockResolvedValue(signal());
    (prisma.fraudSignal.update as jest.Mock).mockResolvedValue(
      signal({ status: FraudReviewStatus.UNDER_REVIEW, reviewedBy: reviewerId }),
    );

    const result = await service.reviewSignal(
      signalId,
      { status: FraudReviewStatus.UNDER_REVIEW, note: 'Checking docs' },
      reviewerId,
      context,
    );

    expect(result.status).toBe(FraudReviewStatus.UNDER_REVIEW);
    expect(prisma.fraudSignal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewer: { connect: { id: reviewerId } },
          details: expect.any(Object),
        }),
      }),
    );
  });

  it('clears a signal', async () => {
    (prisma.fraudSignal.findFirst as jest.Mock).mockResolvedValue(signal());
    (prisma.fraudSignal.update as jest.Mock).mockResolvedValue(
      signal({ status: FraudReviewStatus.CLEARED, reviewedBy: reviewerId }),
    );

    const result = await service.clearSignal(signalId, reviewerId, context);

    expect(result.status).toBe(FraudReviewStatus.CLEARED);
    expect(auditService.record).toHaveBeenCalledWith(
      FRAUD_AUDIT_ACTIONS.SIGNAL_CLEARED,
      context,
      expect.any(Object),
    );
  });

  it('confirms a fraud signal', async () => {
    (prisma.fraudSignal.findFirst as jest.Mock).mockResolvedValue(signal());
    (prisma.fraudSignal.update as jest.Mock).mockResolvedValue(
      signal({ status: FraudReviewStatus.CONFIRMED_FRAUD, reviewedBy: reviewerId }),
    );

    const result = await service.confirmSignal(signalId, reviewerId, context);

    expect(result.status).toBe(FraudReviewStatus.CONFIRMED_FRAUD);
  });

  it('throws when reviewing a missing signal', async () => {
    (prisma.fraudSignal.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reviewSignal(signalId, { status: FraudReviewStatus.CLEARED }, reviewerId, context),
    ).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('lists thresholds', async () => {
    (prisma.fraudThreshold.findMany as jest.Mock).mockResolvedValue([threshold()]);

    const result = await service.listThresholds();

    expect(result[0]?.key).toBe('score_high');
  });

  it('upserts thresholds and audits configuration changes', async () => {
    (prisma.fraudThreshold.upsert as jest.Mock).mockResolvedValue(
      threshold({ key: 'high_value_order_amount', value: 750000 }),
    );

    const result = await service.upsertThreshold(
      'high_value_order_amount',
      { value: 750000, description: 'VIP order review' },
      context,
    );

    expect(result.value).toBe(750000);
    expect(auditService.record).toHaveBeenCalledWith(
      FRAUD_AUDIT_ACTIONS.THRESHOLD_UPDATED,
      context,
      expect.any(Object),
    );
  });

  it('lists blacklist and whitelist entries with filters', async () => {
    (prisma.fraudListEntry.findMany as jest.Mock).mockResolvedValue([listEntry()]);

    const result = await service.listEntries({
      listType: FraudListType.BLACKLIST,
      matchType: FraudMatchType.IP,
      active: true,
    });

    expect(result).toHaveLength(1);
    expect(prisma.fraudListEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          listType: FraudListType.BLACKLIST,
          matchType: FraudMatchType.IP,
          active: true,
        },
      }),
    );
  });

  it('creates a list entry', async () => {
    (prisma.fraudListEntry.create as jest.Mock).mockResolvedValue(listEntry());

    const result = await service.createEntry(
      {
        listType: FraudListType.BLACKLIST,
        matchType: FraudMatchType.IP,
        matchValue: ' 8.8.8.8 ',
        reason: 'Known abuse',
      },
      context,
    );

    expect(result.matchValue).toBe('8.8.8.8');
    expect(prisma.fraudListEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ matchValue: '8.8.8.8' }) }),
    );
  });

  it('updates a list entry', async () => {
    (prisma.fraudListEntry.findFirst as jest.Mock).mockResolvedValue({ id: entryId });
    (prisma.fraudListEntry.update as jest.Mock).mockResolvedValue(
      listEntry({ active: false, reason: 'Expired' }),
    );

    const result = await service.updateEntry(
      entryId,
      { active: false, reason: 'Expired' },
      context,
    );

    expect(result.active).toBe(false);
    expect(result.reason).toBe('Expired');
  });

  it('soft deletes a list entry', async () => {
    (prisma.fraudListEntry.findFirst as jest.Mock).mockResolvedValue({ id: entryId });
    (prisma.fraudListEntry.update as jest.Mock).mockResolvedValue(
      listEntry({ active: false, deletedAt: now }),
    );

    const result = await service.deleteEntry(entryId, context);

    expect(result.active).toBe(false);
    expect(result.deletedAt).toBe(now.toISOString());
  });

  it('throws when updating a missing list entry', async () => {
    (prisma.fraudListEntry.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.updateEntry(entryId, { active: false }, context)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });
});
