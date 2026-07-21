import { PrismaAddressRepository } from './prisma-address.repository';

import type { PrismaService } from '../../prisma/prisma.service';
import type { CustomerAddress } from '@prisma/client';

describe('PrismaAddressRepository', () => {
  const address = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    isDefault: true,
  } as unknown as CustomerAddress;

  const tx = {
    customerAddress: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => await fn(tx)),
    customerAddress: {
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  const repository = new PrismaAddressRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates first address as default', async () => {
    tx.customerAddress.count.mockResolvedValue(0);
    tx.customerAddress.updateMany.mockResolvedValue({ count: 0 });
    tx.customerAddress.create.mockResolvedValue(address);

    const result = await repository.create({
      customerId: address.customerId,
      label: 'HOME',
      recipientName: 'Ada',
      phone: '+2348012345678',
      addressLine1: '12 Allen',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      latitude: 6.6,
      longitude: 3.3,
      isDefault: false,
    });

    expect(result.isDefault).toBe(true);
    expect(tx.customerAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: true }),
      }),
    );
  });

  it('clears previous defaults when setting default', async () => {
    tx.customerAddress.updateMany.mockResolvedValue({ count: 1 });
    tx.customerAddress.update.mockResolvedValue(address);

    await repository.setDefault(address.customerId, address.id);

    expect(tx.customerAddress.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isDefault: false },
      }),
    );
    expect(tx.customerAddress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isDefault: true, isActive: true },
      }),
    );
  });

  it('lists only non-deleted addresses for a customer', async () => {
    (prisma.customerAddress.findMany as jest.Mock).mockResolvedValue([address]);
    const result = await repository.listByCustomerId(address.customerId);
    expect(result).toHaveLength(1);
    expect(prisma.customerAddress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: address.customerId, deletedAt: null },
      }),
    );
  });

  it('soft deletes and promotes next default when needed', async () => {
    tx.customerAddress.findUnique.mockResolvedValue({
      ...address,
      isDefault: true,
    });
    tx.customerAddress.update.mockResolvedValueOnce({
      ...address,
      isDefault: false,
      isActive: false,
      deletedAt: new Date(),
    });
    tx.customerAddress.findFirst.mockResolvedValue({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      customerId: address.customerId,
    });
    tx.customerAddress.update.mockResolvedValueOnce({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      isDefault: true,
    });

    await repository.softDelete(address.id);

    expect(tx.customerAddress.update).toHaveBeenCalledTimes(2);
  });
});
