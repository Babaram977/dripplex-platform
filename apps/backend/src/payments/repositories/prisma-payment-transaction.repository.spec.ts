import { PaymentProvider, TransactionStatus } from '@prisma/client';

import { PrismaPaymentTransactionRepository } from './prisma-payment-transaction.repository';

import type { PrismaService } from '../../prisma/prisma.service';

describe('PrismaPaymentTransactionRepository', () => {
  const prisma = {
    paymentTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const repository = new PrismaPaymentTransactionRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates pending transactions', async () => {
    (prisma.paymentTransaction.create as jest.Mock).mockResolvedValue({ id: 't1' });
    await repository.create({
      orderId: 'o1',
      customerId: 'c1',
      merchantId: 'm1',
      provider: PaymentProvider.PAYSTACK,
      providerReference: 'ref',
      amount: 100,
      currency: 'NGN',
    });
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TransactionStatus.PENDING }),
      }),
    );
  });

  it('marks success only when not already successful', async () => {
    (prisma.paymentTransaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue({
      id: 't1',
      status: TransactionStatus.SUCCESS,
    });
    const result = await repository.markSuccess({
      id: 't1',
      verifiedAt: new Date(),
    });
    expect(result?.status).toBe(TransactionStatus.SUCCESS);
    expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: TransactionStatus.SUCCESS },
        }),
      }),
    );
  });

  it('finds by provider reference', async () => {
    (prisma.paymentTransaction.findUnique as jest.Mock).mockResolvedValue({ id: 't1' });
    await repository.findByReference('ref');
    expect(prisma.paymentTransaction.findUnique).toHaveBeenCalledWith({
      where: { providerReference: 'ref' },
    });
  });
});
