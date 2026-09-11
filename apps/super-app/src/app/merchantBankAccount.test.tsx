import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The merchant settlement account — where every payout this merchant earns is
 * sent.
 *
 * The form used to ask for bank, account number and account name as three free
 * text fields, which matched nothing the backend does. `POST
 * /merchant/bank-account` requires the bank to match the payment provider's
 * list, requires exactly ten digits, performs name enquiry, and stores the
 * bank's answer rather than whatever was typed. So the typed account name was
 * discarded, a typed bank name mostly produced "Choose a valid Nigerian bank"
 * with no list to choose from, and the form accepted 8-20 digits that the
 * server would always reject.
 *
 * These tests drive the real screen and assert on what is actually sent,
 * because the failure is invisible in the UI: a wrong or unverified settlement
 * destination looks saved and simply never pays out.
 */

const listBankAccounts = vi.fn();
const listBanks = vi.fn();
const resolveBankAccount = vi.fn();
const createBankAccount = vi.fn();
const getCommissionTerms = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    merchant: {
      listBankAccounts: () => listBankAccounts(),
      listBanks: () => listBanks(),
      resolveBankAccount: (bankCode: string, accountNumber: string) =>
        resolveBankAccount(bankCode, accountNumber),
      createBankAccount: (body: unknown) => createBankAccount(body),
      getCommissionTerms: () => getCommissionTerms(),
    },
  },
  uploadFile: vi.fn(),
  MERCHANT_CATEGORY_LABEL: {},
}));

import { BankAccountPage } from './merchantScreen';

const BANKS = [
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'OPay Digital Services Limited (OPay)', code: '999992' },
];

/** What the bank says the account is — deliberately not what a merchant would
 *  think to type for themselves. */
const RESOLVED = {
  accountName: 'ADAMU SALISU ENTERPRISES',
  bankName: 'Guaranty Trust Bank',
  bankCode: '058',
};

describe('merchant settlement account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBankAccounts.mockResolvedValue([]);
    listBanks.mockResolvedValue(BANKS);
    getCommissionTerms.mockResolvedValue({
      commissionRate: 0.075,
      merchantShareRate: 0.925,
      standingRate: 0.1,
      negotiatedRate: null,
      platformRate: 0.1,
      campaignId: 'campaign-1',
      campaignName: 'Ramadan partner rate',
    });
    resolveBankAccount.mockResolvedValue(RESOLVED);
    createBankAccount.mockResolvedValue({
      id: 'bank-1',
      merchantId: 'merchant-1',
      bankName: RESOLVED.bankName,
      accountName: RESOLVED.accountName,
      accountNumber: '0123456789',
      currency: 'NGN',
      isDefault: true,
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  });

  it('offers the provider’s bank list instead of asking the merchant to spell one', async () => {
    render(<BankAccountPage />);

    // The provider's own spelling, which nobody would type: this is the whole
    // reason a picker exists rather than a text box.
    expect(
      await screen.findByRole('option', { name: 'OPay Digital Services Limited (OPay)' }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type your bank name')).not.toBeInTheDocument();
  });

  it('sends the bank’s answer, not anything typed, and includes the bank code', async () => {
    render(<BankAccountPage />);

    await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN account number'), {
      target: { value: '0123456789' },
    });

    // Shown for confirmation rather than typed — a transposed digit is a valid
    // looking number belonging to somebody else, and this is what catches it.
    expect(await screen.findByText('ADAMU SALISU ENTERPRISES')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Account'));

    await waitFor(() => {
      expect(createBankAccount).toHaveBeenCalledWith({
        bankName: 'Guaranty Trust Bank',
        // Without this the settlement path has to re-derive the bank from a
        // display name at the moment it moves money.
        bankCode: '058',
        accountName: 'ADAMU SALISU ENTERPRISES',
        accountNumber: '0123456789',
        isDefault: true,
      });
    });
  });

  it('will not save an account the bank has not confirmed', async () => {
    // The bank does not know this number.
    resolveBankAccount.mockRejectedValue(new Error('Could not resolve account name'));
    render(<BankAccountPage />);

    await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN account number'), {
      target: { value: '0000000000' },
    });

    expect(await screen.findByText('Could not resolve account name')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Account'));
    // Saving an unconfirmed destination is how money goes to the wrong person.
    expect(createBankAccount).not.toHaveBeenCalled();
  });

  it('does not ask the bank until there are ten digits', async () => {
    render(<BankAccountPage />);

    await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    // NUBAN is exactly ten. The old form accepted 8-20 and let the merchant
    // submit lengths the server always rejected.
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN account number'), {
      target: { value: '012345678' },
    });

    expect(resolveBankAccount).not.toHaveBeenCalled();
  });

  it('caps the account number at ten digits', async () => {
    render(<BankAccountPage />);

    await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
    const field = screen.getByPlaceholderText('10-digit NUBAN account number');
    fireEvent.change(field, { target: { value: '01234567890123' } });

    expect(field).toHaveValue('0123456789');
  });

  it('says so plainly when bank verification is unavailable, rather than offering a form that cannot succeed', async () => {
    // `create` refuses outright when no resolver is configured, so a free-text
    // fallback here would be a form that always fails.
    listBanks.mockResolvedValue([]);
    render(<BankAccountPage />);

    expect(await screen.findByText(/Bank verification is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('tells a merchant whose account is unverified that payouts are on hold', async () => {
    // Bank settlement skips any account without `verifiedAt`, so this is not a
    // cosmetic badge — it is the difference between being paid and not.
    listBankAccounts.mockResolvedValue([
      {
        id: 'bank-legacy',
        merchantId: 'merchant-1',
        bankName: 'UBA',
        accountName: 'Typed By Hand',
        accountNumber: '0123456789',
        currency: 'NGN',
        isDefault: true,
        verifiedAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<BankAccountPage />);

    expect(await screen.findByText(/payouts are on hold/)).toBeInTheDocument();
  });

  // Saeed, 2026-09-11: "connect to negotiated approved value from ops console".
  // The Payout Information card printed "Commission 10% (set by Operations)"
  // and "Net to merchant 90%" as static text. Operations can change the
  // standing rate without a redeploy, and a commission campaign can target
  // named merchants, so a merchant on any other rate was reading a number the
  // platform had stopped standing behind.
  describe('payout information', () => {
    it('shows the rate this merchant is actually charged, not a compiled-in 10%', async () => {
      render(<BankAccountPage />);

      expect(await screen.findByText('7.5% (Ramadan partner rate)')).toBeInTheDocument();
      expect(await screen.findByText('92.5% of order value')).toBeInTheDocument();
      expect(screen.queryByText('10% (set by Operations)')).not.toBeInTheDocument();
      expect(screen.queryByText('90% of order value')).not.toBeInTheDocument();
    });

    it('names no campaign when the merchant is simply on the standing rate', async () => {
      getCommissionTerms.mockResolvedValue({
        commissionRate: 0.1,
        merchantShareRate: 0.9,
        standingRate: 0.1,
        negotiatedRate: null,
        platformRate: 0.1,
        campaignId: null,
        campaignName: null,
      });
      render(<BankAccountPage />);

      expect(await screen.findByText('10%')).toBeInTheDocument();
      expect(await screen.findByText('90% of order value')).toBeInTheDocument();
    });

    // DPX-MERCHANT-016 — a merchant who negotiated a rate should be able to see
    // that it is the one being applied, rather than take it on trust.
    it('says when the rate is one this merchant agreed', async () => {
      getCommissionTerms.mockResolvedValue({
        commissionRate: 0.06,
        merchantShareRate: 0.94,
        standingRate: 0.06,
        negotiatedRate: 0.06,
        platformRate: 0.1,
        campaignId: null,
        campaignName: null,
      });
      render(<BankAccountPage />);

      expect(await screen.findByText('6% (your agreed rate)')).toBeInTheDocument();
      expect(await screen.findByText('94% of order value')).toBeInTheDocument();
    });

    // A campaign outranks an agreement for the window it runs, so it is the
    // thing to name — calling a campaign rate "your agreed rate" would tell the
    // merchant their agreement had changed when it had not.
    it('names the campaign, not the agreement, while a campaign is running', async () => {
      getCommissionTerms.mockResolvedValue({
        commissionRate: 0.03,
        merchantShareRate: 0.97,
        standingRate: 0.06,
        negotiatedRate: 0.06,
        platformRate: 0.1,
        campaignId: 'campaign-2',
        campaignName: 'Launch week',
      });
      render(<BankAccountPage />);

      expect(await screen.findByText('3% (Launch week)')).toBeInTheDocument();
      expect(screen.queryByText(/your agreed rate/)).not.toBeInTheDocument();
    });

    it('shows a dash rather than a confident wrong number when the rate cannot be read', async () => {
      getCommissionTerms.mockRejectedValue(new Error('offline'));
      render(<BankAccountPage />);

      // Falling back to the old hardcoded pair here would be the original bug
      // with extra steps: a confident number the platform cannot stand behind.
      await screen.findByText('Payout Information');
      await waitFor(() => {
        expect(screen.queryByText('90% of order value')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('10%')).not.toBeInTheDocument();
      expect(screen.queryByText('10% (set by Operations)')).not.toBeInTheDocument();
    });
  });
});
