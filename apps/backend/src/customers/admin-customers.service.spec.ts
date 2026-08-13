import { RideStatus, UserStatus } from '@prisma/client';

import { AdminCustomersService } from './admin-customers.service';

import type { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import type { PrismaService } from '../prisma/prisma.service';

describe('AdminCustomersService', () => {
  let prisma: {
    user: { findMany: jest.Mock; count: jest.Mock };
    ride: { groupBy: jest.Mock };
  };
  let service: AdminCustomersService;

  const query = (over: Partial<ListCustomersQueryDto> = {}): ListCustomersQueryDto => ({
    page: 1,
    limit: 20,
    ...over,
  });

  const user = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id,
    firstName: 'Ada',
    lastName: 'Obi',
    email: 'ada@example.com',
    phone: '+2348000000000',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), count: jest.fn() },
      ride: { groupBy: jest.fn() },
    };
    service = new AdminCustomersService(prisma as unknown as PrismaService);
  });

  it('scopes to non-deleted customers and returns paginated meta', async () => {
    prisma.user.findMany.mockResolvedValue([user('c1')]);
    prisma.user.count.mockResolvedValue(1);
    prisma.ride.groupBy.mockResolvedValue([]);

    const result = await service.listCustomers(query());

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.roles).toEqual({ some: { role: { name: 'customer' } } });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    // No completed rides → zeroed aggregates, never fabricated.
    expect(result.items[0]).toMatchObject({ id: 'c1', tripsCount: 0, totalSpent: 0 });
  });

  it('aggregates trips and spend from the customer’s COMPLETED rides only', async () => {
    prisma.user.findMany.mockResolvedValue([user('c1'), user('c2', { id: 'c2' })]);
    prisma.user.count.mockResolvedValue(2);
    prisma.ride.groupBy.mockResolvedValue([
      { customerId: 'c1', _count: { _all: 3 }, _sum: { totalFare: 4500 } },
    ]);

    const result = await service.listCustomers(query());

    // Only COMPLETED rides are aggregated.
    expect(prisma.ride.groupBy.mock.calls[0][0].where).toMatchObject({
      status: RideStatus.COMPLETED,
      customerId: { in: ['c1', 'c2'] },
    });
    expect(result.items[0]).toMatchObject({ id: 'c1', tripsCount: 3, totalSpent: 4500 });
    // c2 has no completed rides → 0/0, not omitted.
    expect(result.items[1]).toMatchObject({ id: 'c2', tripsCount: 0, totalSpent: 0 });
  });

  it('applies a case-insensitive search across name, email and phone', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listCustomers(query({ search: 'ada' }));

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { firstName: { contains: 'ada', mode: 'insensitive' } },
      { lastName: { contains: 'ada', mode: 'insensitive' } },
      { email: { contains: 'ada', mode: 'insensitive' } },
      { phone: { contains: 'ada', mode: 'insensitive' } },
    ]);
    // No customers → groupBy is skipped entirely.
    expect(prisma.ride.groupBy).not.toHaveBeenCalled();
  });

  it('passes the status filter through to the query', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await service.listCustomers(query({ status: UserStatus.SUSPENDED }));

    expect(prisma.user.findMany.mock.calls[0][0].where.status).toBe(UserStatus.SUSPENDED);
  });
});
