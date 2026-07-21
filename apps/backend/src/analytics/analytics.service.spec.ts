import {
  AnalyticsScopeType,
  DeliveryStatus,
  PaymentStatus,
  Prisma,
  TransactionStatus,
} from '@prisma/client';

import { ANALYTICS_METRIC_KEYS } from './analytics.constants';
import { AnalyticsService } from './analytics.service';

import type { PrismaService } from '../prisma/prisma.service';

const from = '2026-07-01';
const to = '2026-07-03';
const merchantId = '11111111-1111-4111-8111-111111111111';

describe('AnalyticsService', () => {
  let prisma: {
    analyticsDailyMetric: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    order: { count: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
    paymentTransaction: { count: jest.Mock };
    deliveryJob: { aggregate: jest.Mock; groupBy: jest.Mock };
    orderItem: { groupBy: jest.Mock };
  };
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = {
      analyticsDailyMetric: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      order: {
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      paymentTransaction: {
        count: jest.fn(),
      },
      deliveryJob: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      orderItem: {
        groupBy: jest.fn(),
      },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  it('creates a metric when none exists', async () => {
    prisma.analyticsDailyMetric.findFirst.mockResolvedValue(null);

    await service.recordMetric({
      date: new Date('2026-07-21T15:00:00.000Z'),
      scopeType: AnalyticsScopeType.PLATFORM,
      key: ANALYTICS_METRIC_KEYS.ORDERS_PAID,
      value: 1,
    });

    expect(prisma.analyticsDailyMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metricDate: new Date('2026-07-21T00:00:00.000Z'),
        scopeType: AnalyticsScopeType.PLATFORM,
        scopeId: null,
        metricKey: ANALYTICS_METRIC_KEYS.ORDERS_PAID,
      }),
    });
  });

  it('increments an existing metric', async () => {
    prisma.analyticsDailyMetric.findFirst.mockResolvedValue({ id: 'metric-id' });

    await service.recordMetric({
      date: new Date('2026-07-21T15:00:00.000Z'),
      scopeType: AnalyticsScopeType.MERCHANT,
      scopeId: merchantId,
      key: ANALYTICS_METRIC_KEYS.REVENUE,
      value: 125,
    });

    expect(prisma.analyticsDailyMetric.update).toHaveBeenCalledWith({
      where: { id: 'metric-id' },
      data: expect.objectContaining({ metricValue: { increment: new Prisma.Decimal(125) } }),
    });
  });

  it('shapes admin overview KPIs and series', async () => {
    prisma.order.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.order.aggregate.mockResolvedValue({
      _sum: { total: new Prisma.Decimal(600) },
      _count: { _all: 2 },
    });
    prisma.order.groupBy
      .mockResolvedValueOnce([
        { customerId: 'c1', _count: { _all: 2 } },
        { customerId: 'c2', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: new Date('2026-07-01T10:00:00.000Z'),
          _sum: { total: new Prisma.Decimal(400) },
          _count: { _all: 1 },
        },
        {
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          _sum: { total: new Prisma.Decimal(200) },
          _count: { _all: 1 },
        },
      ]);
    prisma.deliveryJob.aggregate.mockResolvedValue({ _avg: { estimatedDurationSeconds: 1_800 } });
    prisma.paymentTransaction.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    prisma.analyticsDailyMetric.findMany.mockResolvedValue([
      {
        metricDate: new Date('2026-07-01T00:00:00.000Z'),
        metricKey: 'orders_paid',
        metricValue: new Prisma.Decimal(2),
        scopeType: AnalyticsScopeType.PLATFORM,
        scopeId: null,
      },
    ]);

    const result = await service.getAdminOverview({ from, to, period: 'daily' });

    expect(result.kpis).toEqual({
      orders: 3,
      revenue: 600,
      aov: 300,
      repeatCustomers: 1,
      deliveryTimeAvgSeconds: 1_800,
      failedPayments: 4,
      cancelledOrders: 1,
      refunds: 1,
    });
    expect(result.series).toEqual([
      { period: '2026-07-01', orders: 1, revenue: 400 },
      { period: '2026-07-02', orders: 0, revenue: 0 },
      { period: '2026-07-03', orders: 1, revenue: 200 },
    ]);
  });

  it('adds merchant filters for merchant overview', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: null }, _count: { _all: 0 } });
    prisma.order.groupBy.mockResolvedValue([]);
    prisma.deliveryJob.aggregate.mockResolvedValue({ _avg: { estimatedDurationSeconds: null } });
    prisma.paymentTransaction.count.mockResolvedValue(0);
    prisma.analyticsDailyMetric.findMany.mockResolvedValue([]);

    await service.getMerchantOverview(merchantId, { from, to });

    expect(prisma.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ merchantId }),
    });
    expect(prisma.paymentTransaction.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ merchantId, status: TransactionStatus.FAILED }),
    });
  });

  it('returns top products from grouped order items', async () => {
    prisma.orderItem.groupBy.mockResolvedValue([
      {
        productId: 'product-id',
        snapshotName: 'Raincoat',
        _sum: { quantity: 3, subtotal: new Prisma.Decimal(900) },
      },
    ]);

    await expect(service.topProducts({ from, to, limit: 5 })).resolves.toEqual([
      { productId: 'product-id', name: 'Raincoat', quantity: 3, revenue: 900 },
    ]);
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
        }),
      }),
    );
  });

  it('returns top merchants from grouped orders', async () => {
    prisma.order.groupBy.mockResolvedValue([
      { merchantId, _sum: { total: new Prisma.Decimal(1_000) }, _count: { _all: 4 } },
    ]);

    await expect(service.topMerchants({ from, to })).resolves.toEqual([
      { merchantId, orders: 4, revenue: 1_000 },
    ]);
  });

  it('returns top riders and filters null rider ids', async () => {
    prisma.deliveryJob.groupBy.mockResolvedValue([
      { riderId: null, _count: { _all: 1 }, _avg: { estimatedDurationSeconds: 900 } },
      {
        riderId: 'rider-id',
        _count: { _all: 5 },
        _avg: { estimatedDurationSeconds: 1_200 },
      },
    ]);

    await expect(service.topRiders({ from, to })).resolves.toEqual([
      { riderId: 'rider-id', deliveries: 5, deliveryTimeAvgSeconds: 1_200 },
    ]);
    expect(prisma.deliveryJob.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: DeliveryStatus.DELIVERED }),
      }),
    );
  });
});
