import { Injectable } from '@nestjs/common';
import { Prisma, RideStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import type { AdminCustomerDto } from '@dripplex/types';

/**
 * DPX-OPS — Operations Console customer roster. Read-only over the existing
 * `User` records; a "customer" is a `User` holding the `customer` role. Per
 * page, each customer's `tripsCount` and `totalSpent` are aggregated from their
 * own COMPLETED rides (sum of `Ride.totalFare`) in a single grouped query, so
 * the roster never fabricates activity for a customer who has taken no trips.
 */
@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  public async listCustomers(query: ListCustomersQueryDto): Promise<{
    items: AdminCustomerDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { some: { role: { name: 'customer' } } },
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Batch the trips/spend aggregate for just this page's customers.
    const customerIds = users.map((user) => user.id);
    const rideAggregates =
      customerIds.length > 0
        ? await this.prisma.ride.groupBy({
            by: ['customerId'],
            where: { customerId: { in: customerIds }, status: RideStatus.COMPLETED },
            _count: { _all: true },
            _sum: { totalFare: true },
          })
        : [];
    const aggregateByCustomer = new Map(
      rideAggregates.map((agg) => [
        agg.customerId,
        { trips: agg._count._all, spent: Number(agg._sum.totalFare ?? 0) },
      ]),
    );

    const items: AdminCustomerDto[] = users.map((user) => {
      const agg = aggregateByCustomer.get(user.id);
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        status: user.status,
        tripsCount: agg?.trips ?? 0,
        totalSpent: agg?.spent ?? 0,
        createdAt: user.createdAt.toISOString(),
      };
    });

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
