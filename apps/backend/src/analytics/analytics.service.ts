import { Injectable } from '@nestjs/common';
import {
  AnalyticsScopeType,
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TransactionStatus,
} from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { ANALYTICS_METRIC_KEYS } from './analytics.constants';
import {
  bucketDate,
  endOfUtcDay,
  listPeriodBuckets,
  startOfUtcDay,
  type AnalyticsPeriod,
} from './period.helper';

export interface AnalyticsOverview {
  range: { from: string; to: string; period: AnalyticsPeriod };
  kpis: {
    orders: number;
    revenue: number;
    aov: number;
    repeatCustomers: number;
    deliveryTimeAvgSeconds: number;
    failedPayments: number;
    cancelledOrders: number;
    refunds: number;
  };
  series: { period: string; orders: number; revenue: number }[];
  preAggregated: {
    date: string;
    key: string;
    value: number;
    scopeType: AnalyticsScopeType;
    scopeId: string | null;
  }[];
}

export interface TopProductDto {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopMerchantDto {
  merchantId: string;
  orders: number;
  revenue: number;
}

export interface TopRiderDto {
  riderId: string;
  deliveries: number;
  deliveryTimeAvgSeconds: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  public async recordMetric(input: {
    date: Date;
    scopeType: AnalyticsScopeType;
    scopeId?: string | null;
    key: string;
    value: number | string | Prisma.Decimal;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    const metricDate = startOfUtcDay(input.date);
    const metricValue = new Prisma.Decimal(input.value);
    const where = {
      metricDate,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      metricKey: input.key,
    };
    const existing = await this.prisma.analyticsDailyMetric.findFirst({ where });
    if (existing) {
      await this.prisma.analyticsDailyMetric.update({
        where: { id: existing.id },
        data: {
          metricValue: { increment: metricValue },
          metadata: input.metadata ?? Prisma.JsonNull,
        },
      });
      return;
    }

    await this.prisma.analyticsDailyMetric.create({
      data: {
        metricDate,
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
        metricKey: input.key,
        metricValue,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  public async getMerchantOverview(
    merchantUserId: string,
    input: { from?: string; to?: string; period?: AnalyticsPeriod },
  ): Promise<AnalyticsOverview> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    const range = this.resolveRange(input);
    return await this.buildOverview(range, profile.id);
  }

  /**
   * `Order.merchantId` (and the analytics scope built from it) is
   * `MerchantProfile.id`, never the merchant's `User.id` — same split
   * established across Orders/Reviews/Merchants. `getMerchantOverview` is
   * always called with the authenticated user's `User.id`, so it must be
   * resolved here before being used as an `Order.merchantId` filter.
   */
  private async requireMerchantProfile(userId: string): Promise<{ id: string }> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }
    return profile;
  }

  public async getAdminOverview(input: {
    from?: string;
    to?: string;
    period?: AnalyticsPeriod;
  }): Promise<AnalyticsOverview> {
    const range = this.resolveRange(input);
    return await this.buildOverview(range);
  }

  public async topProducts(input: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<TopProductDto[]> {
    const range = this.resolveRange(input);
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId', 'snapshotName'],
      where: {
        order: {
          createdAt: { gte: range.from, lte: range.to },
          paymentStatus: PaymentStatus.PAID,
        },
      },
      _sum: { quantity: true, subtotal: true },
      take: input.limit ?? 10,
      orderBy: { _sum: { quantity: 'desc' } },
    });

    return rows.map((row) => ({
      productId: row.productId,
      name: row.snapshotName,
      quantity: row._sum.quantity ?? 0,
      revenue: Number(row._sum.subtotal ?? 0),
    }));
  }

  public async topMerchants(input: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<TopMerchantDto[]> {
    const range = this.resolveRange(input);
    const rows = await this.prisma.order.groupBy({
      by: ['merchantId'],
      where: {
        createdAt: { gte: range.from, lte: range.to },
        paymentStatus: PaymentStatus.PAID,
      },
      _sum: { total: true },
      _count: { _all: true },
      take: input.limit ?? 10,
      orderBy: { _sum: { total: 'desc' } },
    });

    return rows.map((row) => ({
      merchantId: row.merchantId,
      orders: row._count._all,
      revenue: Number(row._sum.total ?? 0),
    }));
  }

  public async topRiders(input: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<TopRiderDto[]> {
    const range = this.resolveRange(input);
    const rows = await this.prisma.deliveryJob.groupBy({
      by: ['riderId'],
      where: {
        riderId: { not: null },
        status: DeliveryStatus.DELIVERED,
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
      _avg: { estimatedDurationSeconds: true },
      take: input.limit ?? 10,
      orderBy: { _count: { riderId: 'desc' } },
    });

    return rows
      .filter((row): row is typeof row & { riderId: string } => row.riderId !== null)
      .map((row) => ({
        riderId: row.riderId,
        deliveries: row._count._all,
        deliveryTimeAvgSeconds: Math.round(row._avg.estimatedDurationSeconds ?? 0),
      }));
  }

  public async incrementOrderPaidMetrics(input: {
    occurredAt: Date;
    merchantId?: string;
    amount?: number;
  }): Promise<void> {
    const amount = input.amount ?? 0;
    await Promise.all([
      this.recordMetric({
        date: input.occurredAt,
        scopeType: AnalyticsScopeType.PLATFORM,
        key: ANALYTICS_METRIC_KEYS.ORDERS_PAID,
        value: 1,
      }),
      this.recordMetric({
        date: input.occurredAt,
        scopeType: AnalyticsScopeType.PLATFORM,
        key: ANALYTICS_METRIC_KEYS.REVENUE,
        value: amount,
      }),
      ...(input.merchantId
        ? [
            this.recordMetric({
              date: input.occurredAt,
              scopeType: AnalyticsScopeType.MERCHANT,
              scopeId: input.merchantId,
              key: ANALYTICS_METRIC_KEYS.ORDERS_PAID,
              value: 1,
            }),
            this.recordMetric({
              date: input.occurredAt,
              scopeType: AnalyticsScopeType.MERCHANT,
              scopeId: input.merchantId,
              key: ANALYTICS_METRIC_KEYS.REVENUE,
              value: amount,
            }),
          ]
        : []),
    ]);
  }

  public async incrementSimpleMetric(input: {
    occurredAt: Date;
    key: string;
    merchantId?: string;
    riderId?: string;
  }): Promise<void> {
    await Promise.all([
      this.recordMetric({
        date: input.occurredAt,
        scopeType: AnalyticsScopeType.PLATFORM,
        key: input.key,
        value: 1,
      }),
      ...(input.merchantId
        ? [
            this.recordMetric({
              date: input.occurredAt,
              scopeType: AnalyticsScopeType.MERCHANT,
              scopeId: input.merchantId,
              key: input.key,
              value: 1,
            }),
          ]
        : []),
      ...(input.riderId
        ? [
            this.recordMetric({
              date: input.occurredAt,
              scopeType: AnalyticsScopeType.RIDER,
              scopeId: input.riderId,
              key: input.key,
              value: 1,
            }),
          ]
        : []),
    ]);
  }

  private async buildOverview(
    range: { from: Date; to: Date; period: AnalyticsPeriod },
    merchantId?: string,
  ): Promise<AnalyticsOverview> {
    const orderWhere = {
      createdAt: { gte: range.from, lte: range.to },
      ...(merchantId ? { merchantId } : {}),
    };
    const paidOrderWhere = { ...orderWhere, paymentStatus: PaymentStatus.PAID };

    const [
      orderCount,
      revenue,
      repeatCustomerGroups,
      deliveryTime,
      failedPayments,
      cancelledOrders,
      refunds,
      paidOrderGroups,
      preAggregated,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.aggregate({
        where: paidOrderWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: paidOrderWhere,
        _count: { _all: true },
      }),
      this.prisma.deliveryJob.aggregate({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: DeliveryStatus.DELIVERED,
          ...(merchantId ? { merchantId } : {}),
        },
        _avg: { estimatedDurationSeconds: true },
      }),
      this.prisma.paymentTransaction.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: TransactionStatus.FAILED,
          ...(merchantId ? { merchantId } : {}),
        },
      }),
      this.prisma.order.count({
        where: { ...orderWhere, status: OrderStatus.CANCELLED },
      }),
      this.prisma.paymentTransaction.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: TransactionStatus.REFUNDED,
          ...(merchantId ? { merchantId } : {}),
        },
      }),
      this.prisma.order.groupBy({
        by: ['createdAt'],
        where: paidOrderWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.analyticsDailyMetric.findMany({
        where: {
          metricDate: { gte: startOfUtcDay(range.from), lte: startOfUtcDay(range.to) },
          scopeType: merchantId ? AnalyticsScopeType.MERCHANT : AnalyticsScopeType.PLATFORM,
          scopeId: merchantId ?? null,
        },
        orderBy: [{ metricDate: 'asc' }, { metricKey: 'asc' }],
      }),
    ]);

    const revenueValue = Number(revenue._sum.total ?? 0);
    const paidOrders = revenue._count._all;
    const series = this.shapeSeries(range, paidOrderGroups);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        period: range.period,
      },
      kpis: {
        orders: orderCount,
        revenue: revenueValue,
        aov: paidOrders > 0 ? round(revenueValue / paidOrders) : 0,
        repeatCustomers: repeatCustomerGroups.filter((row) => row._count._all > 1).length,
        deliveryTimeAvgSeconds: Math.round(deliveryTime._avg.estimatedDurationSeconds ?? 0),
        failedPayments,
        cancelledOrders,
        refunds,
      },
      series,
      preAggregated: preAggregated.map((metric) => ({
        date: metric.metricDate.toISOString().slice(0, 10),
        key: metric.metricKey,
        value: Number(metric.metricValue),
        scopeType: metric.scopeType,
        scopeId: metric.scopeId,
      })),
    };
  }

  private shapeSeries(
    range: { from: Date; to: Date; period: AnalyticsPeriod },
    rows: { createdAt: Date; _sum: { total: Prisma.Decimal | null }; _count: { _all: number } }[],
  ): { period: string; orders: number; revenue: number }[] {
    const buckets = new Map(
      listPeriodBuckets(range.from, range.to, range.period).map((bucket) => [
        bucket.key,
        { period: bucket.key, orders: 0, revenue: 0 },
      ]),
    );

    for (const row of rows) {
      const key = bucketDate(row.createdAt, range.period);
      const current = buckets.get(key);
      if (!current) {
        continue;
      }
      current.orders += row._count._all;
      current.revenue = round(current.revenue + Number(row._sum.total ?? 0));
    }

    return [...buckets.values()];
  }

  private resolveRange(input: { from?: string; to?: string; period?: AnalyticsPeriod }): {
    from: Date;
    to: Date;
    period: AnalyticsPeriod;
  } {
    const now = new Date();
    const to = input.to ? endOfUtcDay(new Date(input.to)) : endOfUtcDay(now);
    const from = input.from
      ? startOfUtcDay(new Date(input.from))
      : startOfUtcDay(new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));
    return {
      from,
      to,
      period: input.period ?? 'daily',
    };
  }
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
