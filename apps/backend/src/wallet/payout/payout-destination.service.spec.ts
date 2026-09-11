import { PaymentProvider } from '@prisma/client';

import { PayoutDestinationService } from './payout-destination.service';

import type { StoredDestination } from './payout-destination.service';
import type { BankAccountResolver } from '../verification/bank-account-resolver.port';

/**
 * The check that makes a second payout rail safe to switch on.
 *
 * Bank codes are provider-specific and nothing about them says so. Paystack
 * calls Guaranty Trust "058"; Flutterwave publishes its own list with its own
 * codes. Handing one rail the other's code does not reliably fail — it can
 * name a different institution, and then a partner's earnings arrive in a
 * stranger's account. Every case below is about refusing to send rather than
 * sending something plausible.
 */
describe('PayoutDestinationService', () => {
  const stored: StoredDestination = {
    bankName: 'Guaranty Trust Bank',
    bankCode: '058',
    bankCodeProvider: 'PAYSTACK',
    accountNumber: '0123456789',
    accountName: 'AL AMIN TIJJANI UMAR',
  };

  function build(flutterwave: Partial<BankAccountResolver>): PayoutDestinationService {
    const paystack = {
      configured: true,
      listBanks: jest.fn(),
      resolveAccountName: jest.fn(),
    } as unknown as BankAccountResolver;

    return new PayoutDestinationService(paystack, {
      configured: true,
      listBanks: jest.fn(),
      resolveAccountName: jest.fn(),
      ...flutterwave,
    });
  }

  it('sends the stored code straight through when the rail matches', async () => {
    const listBanks = jest.fn();
    const service = build({ listBanks });

    const result = await service.resolveFor(PaymentProvider.PAYSTACK, stored);

    expect(result).toEqual({
      bankCode: '058',
      accountNumber: '0123456789',
      accountName: 'AL AMIN TIJJANI UMAR',
    });
    // The common case must not cost two extra provider calls per payout.
    expect(listBanks).not.toHaveBeenCalled();
  });

  it('re-resolves and re-confirms when the rail differs', async () => {
    const service = build({
      // Flutterwave spells it differently and codes it differently.
      listBanks: jest.fn().mockResolvedValue([{ name: 'GTBANK PLC', code: '044' }]),
      resolveAccountName: jest.fn().mockResolvedValue({ accountName: 'AL AMIN TIJJANI UMAR' }),
    });

    const result = await service.resolveFor(PaymentProvider.FLUTTERWAVE, {
      ...stored,
      bankName: 'GTBANK PLC',
    });

    // Flutterwave's code goes out, never the stored Paystack one.
    expect(result?.bankCode).toBe('044');
  });

  it('refuses when the other rail resolves a different account holder', async () => {
    // This is the case the whole service exists for: the bank matched by name
    // is not the bank this account is at, so the same ten digits belong to
    // somebody else there. Sending would pay a stranger.
    const service = build({
      listBanks: jest.fn().mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '044' }]),
      resolveAccountName: jest.fn().mockResolvedValue({ accountName: 'SOMEBODY ELSE ENTIRELY' }),
    });

    await expect(service.resolveFor(PaymentProvider.FLUTTERWAVE, stored)).resolves.toBeNull();
  });

  it('refuses when the other rail cannot confirm the account at all', async () => {
    const service = build({
      listBanks: jest.fn().mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '044' }]),
      resolveAccountName: jest.fn().mockRejectedValue(new Error('could not resolve')),
    });

    await expect(service.resolveFor(PaymentProvider.FLUTTERWAVE, stored)).resolves.toBeNull();
  });

  it('refuses when the other rail does not list the bank', async () => {
    const service = build({
      listBanks: jest.fn().mockResolvedValue([{ name: 'Some Other Bank', code: '999' }]),
    });

    await expect(service.resolveFor(PaymentProvider.FLUTTERWAVE, stored)).resolves.toBeNull();
  });

  it('refuses when the other rail is not configured', async () => {
    const service = build({ configured: false });

    await expect(service.resolveFor(PaymentProvider.FLUTTERWAVE, stored)).resolves.toBeNull();
  });

  it('ignores case and spacing differences in the confirmed name', async () => {
    // Providers disagree on casing and spacing for the same holder; that is not
    // a reason to refuse a payout the bank has confirmed.
    const service = build({
      listBanks: jest.fn().mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '044' }]),
      resolveAccountName: jest.fn().mockResolvedValue({ accountName: 'Al Amin  Tijjani Umar' }),
    });

    const result = await service.resolveFor(PaymentProvider.FLUTTERWAVE, stored);

    expect(result?.bankCode).toBe('044');
  });
});
