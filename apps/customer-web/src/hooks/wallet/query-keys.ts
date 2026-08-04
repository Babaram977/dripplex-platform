import type { WalletHistoryQuery } from '@dripplex/types';

/** Centralized so every wallet hook invalidates/reads the same cache entries. */
export const walletQueryKeys = {
  balance: ['wallet', 'balance'] as const,
  transactions: (query: WalletHistoryQuery) => ['wallet', 'transactions', query] as const,
  recentRecipients: ['wallet', 'transfer', 'recipients', 'recent'] as const,
};
