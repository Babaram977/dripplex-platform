'use client';

import { toast } from '@dripplex/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { TopUpScreen } from './screens/top-up-screen';
import { TransactionHistoryScreen } from './screens/transaction-history-screen';
import { TransferScreen } from './screens/transfer-screen';
import { WalletGatewayPaymentScreen } from './screens/wallet-gateway-payment-screen';
import { WalletHomeScreen } from './screens/wallet-home-screen';

type WalletFlowScreen =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'transfer' }
  | { name: 'topup' }
  | { name: 'topupGateway'; authorizationUrl: string; verifying: boolean };

/** Resumes a gateway top-up redirect: /wallet?topupVerify=1 lands here after Paystack/Flutterwave/Moniepoint checkout. */
function useResumeScreen(): WalletFlowScreen | null {
  const searchParams = useSearchParams();
  return React.useMemo(() => {
    if (searchParams.get('topupVerify') === '1') {
      return { name: 'topupGateway', authorizationUrl: '', verifying: true };
    }
    return null;
  }, [searchParams]);
}

export function WalletFlow(): React.JSX.Element {
  const router = useRouter();
  const resumeScreen = useResumeScreen();
  const [screen, setScreen] = React.useState<WalletFlowScreen>(resumeScreen ?? { name: 'home' });

  const goHome = React.useCallback((): void => {
    setScreen({ name: 'home' });
  }, []);

  switch (screen.name) {
    case 'home':
      return (
        <WalletHomeScreen
          onBack={() => {
            router.push('/dashboard');
          }}
          onSeeAllTransactions={() => {
            setScreen({ name: 'history' });
          }}
          onTopUp={() => {
            setScreen({ name: 'topup' });
          }}
          onTransfer={() => {
            setScreen({ name: 'transfer' });
          }}
        />
      );
    case 'history':
      return <TransactionHistoryScreen onBack={goHome} />;
    case 'transfer':
      return (
        <TransferScreen
          onBack={goHome}
          onSent={() => {
            toast({ title: 'Transfer sent', description: 'Your wallet transfer was completed.' });
            goHome();
          }}
        />
      );
    case 'topup':
      return (
        <TopUpScreen
          onBack={goHome}
          onGatewayRedirect={(authorizationUrl) => {
            setScreen({ name: 'topupGateway', authorizationUrl, verifying: false });
          }}
        />
      );
    case 'topupGateway':
      return (
        <WalletGatewayPaymentScreen
          authorizationUrl={screen.authorizationUrl}
          verifying={screen.verifying}
          onBack={goHome}
          onVerified={() => {
            toast({
              title: 'Top-up successful',
              description: 'Your wallet balance has been updated.',
            });
            goHome();
          }}
        />
      );
  }
}
