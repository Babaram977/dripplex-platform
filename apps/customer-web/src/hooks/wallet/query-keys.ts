import type { WalletHistoryQuery, WithdrawalHistoryQuery } from '@dripplex/types';

/** Centralized so every wallet hook invalidates/reads the same cache entries. */
export const walletQueryKeys = {
  balance: ['wallet', 'balance'] as const,
  transactions: (query: WalletHistoryQuery) => ['wallet', 'transactions', query] as const,
  recentRecipients: ['wallet', 'transfer', 'recipients', 'recent'] as const,
  bankAccounts: ['wallet', 'bank-accounts'] as const,
  pinStatus: ['wallet', 'pin', 'status'] as const,
  withdrawals: (query: WithdrawalHistoryQuery) => ['wallet', 'withdrawals', query] as const,
  statement: (month: number, year: number) => ['wallet', 'statement', month, year] as const,
};
