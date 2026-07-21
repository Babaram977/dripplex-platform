import { generatePaymentReference, toPaymentTransactionDto } from './payment.mapper';

import type { PaymentTransaction } from '@prisma/client';

describe('payment.mapper', () => {
  it('maps payment transactions to DTOs', () => {
    const txn = {
      id: '55555555-5555-5555-5555-555555555555',
      orderId: '11111111-1111-1111-1111-111111111111',
      customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      merchantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      provider: 'PAYSTACK',
      providerReference: 'DPX-PAY-1',
      providerTransactionId: '9',
      status: 'SUCCESS',
      amount: 5000,
      currency: 'NGN',
      authorizationUrl: 'https://example.com',
      accessCode: 'abc',
      paidAt: new Date('2026-07-21T12:00:00.000Z'),
      verifiedAt: new Date('2026-07-21T12:00:00.000Z'),
      createdAt: new Date('2026-07-21T11:00:00.000Z'),
      updatedAt: new Date('2026-07-21T12:00:00.000Z'),
    } as unknown as PaymentTransaction;

    const dto = toPaymentTransactionDto(txn);
    expect(dto.amount).toBe(5000);
    expect(dto.paidAt).toBe('2026-07-21T12:00:00.000Z');
  });

  it('generates payment references', () => {
    expect(generatePaymentReference('DPX-20260721-ABC')).toMatch(/^DPX-PAY-/);
  });
});
