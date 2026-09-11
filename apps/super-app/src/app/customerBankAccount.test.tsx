import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Linking a withdrawal destination from the customer wallet.
 *
 * This form shipped with a **mock resolver**. "Verify account" waited 1.2
 * seconds on a `setTimeout` and wrote the literal string 'DRIPPLEX USER' into
 * the account name, then displayed it in a green confirmation box. No bank was
 * ever asked. The typed bank name was posted with a placeholder code of '000'.
 *
 * So the screen showed a verification that had not happened, for a payout
 * destination nobody had checked. These tests drive the real screen and assert
 * against the calls it makes, because that is the only place the difference
 * between a real enquiry and a convincing green box is visible.
 */

const getBankAccounts = vi.fn();
const getWallet = vi.fn();
const listBanks = vi.fn();
const resolveBankAccount = vi.fn();
const addBankAccount = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    wallet: {
      getBankAccounts: () => getBankAccounts(),
      get: () => getWallet(),
      listBanks: () => listBanks(),
      resolveBankAccount: (bankCode: string, accountNumber: string) =>
        resolveBankAccount(bankCode, accountNumber),
      addBankAccount: (body: unknown) => addBankAccount(body),
      requestWithdrawal: vi.fn(),
    },
  },
}));

import { WithdrawScreen } from './walletScreen';

const BANKS = [
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'OPay Digital Services Limited (OPay)', code: '999992' },
];

const RESOLVED = {
  accountName: 'HALIMA YUSUF MUHAMMAD',
  bankName: 'Guaranty Trust Bank',
  bankCode: '058',
};

async function openAddBankForm(): Promise<void> {
  render(<WithdrawScreen />);
  fireEvent.click(await screen.findByText('+ Add bank'));
  await screen.findByText('Add Bank Account');
}

describe('customer withdrawal destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBankAccounts.mockResolvedValue([]);
    getWallet.mockResolvedValue({ availableBalance: 50_000 });
    listBanks.mockResolvedValue(BANKS);
    resolveBankAccount.mockResolvedValue(RESOLVED);
    addBankAccount.mockResolvedValue({ id: 'acct-1' });
  });

  it('asks the bank, instead of inventing a name after a timer', async () => {
    await openAddBankForm();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN number'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByText('Verify account'));

    await waitFor(() => {
      expect(resolveBankAccount).toHaveBeenCalledWith('058', '0123456789');
    });
    expect(await screen.findByText('HALIMA YUSUF MUHAMMAD')).toBeInTheDocument();
    // The string the mock used to produce, in the same green box.
    expect(screen.queryByText('DRIPPLEX USER')).not.toBeInTheDocument();
  });

  it('sends the real bank code, never the placeholder 000', async () => {
    await openAddBankForm();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN number'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByText('Verify account'));
    await screen.findByText('HALIMA YUSUF MUHAMMAD');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(addBankAccount).toHaveBeenCalledWith({
        bankName: 'Guaranty Trust Bank',
        bankCode: '058',
        accountNumber: '0123456789',
      });
    });
    // The backend stores the bank's answer and ignores anything sent here;
    // supplying one only invites the two to disagree.
    expect(addBankAccount.mock.calls[0]?.[0]).not.toHaveProperty('accountName');
  });

  it('will not save a destination the bank has not confirmed', async () => {
    resolveBankAccount.mockRejectedValue(new Error('Could not resolve account name'));
    await openAddBankForm();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit NUBAN number'), {
      target: { value: '0000000000' },
    });
    fireEvent.click(screen.getByText('Verify account'));

    expect(await screen.findByText('Could not resolve account name')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save'));
    expect(addBankAccount).not.toHaveBeenCalled();
  });

  it('drops a confirmed name the moment the number is edited', async () => {
    await openAddBankForm();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '058' } });
    const field = screen.getByPlaceholderText('10-digit NUBAN number');
    fireEvent.change(field, { target: { value: '0123456789' } });
    fireEvent.click(screen.getByText('Verify account'));
    await screen.findByText('HALIMA YUSUF MUHAMMAD');

    // Otherwise the previous account's holder stays on screen as apparent
    // confirmation of a number that was never checked.
    fireEvent.change(field, { target: { value: '0123456780' } });
    expect(screen.queryByText('HALIMA YUSUF MUHAMMAD')).not.toBeInTheDocument();
  });

  it('caps the account number at ten digits and ignores non-digits', async () => {
    await openAddBankForm();

    const field = screen.getByPlaceholderText('10-digit NUBAN number');
    fireEvent.change(field, { target: { value: '01a2345678901234' } });

    expect(field).toHaveValue('0123456789');
  });

  it('says so when bank verification is unavailable rather than offering free text', async () => {
    // The backend refuses to link anything in this state, so a free-text
    // fallback would be a form that cannot succeed.
    listBanks.mockResolvedValue([]);
    await openAddBankForm();

    expect(await screen.findByText(/Bank verification is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
