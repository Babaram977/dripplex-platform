import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { WalletPanel } from '@/components/campaign/wallet-panel';

export default function WalletPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your balance and transaction history, including referral campaign payouts.
          </p>
        </div>
        <WalletPanel />
      </div>
    </AppShell>
  );
}
