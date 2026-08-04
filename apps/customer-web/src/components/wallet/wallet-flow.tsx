'use client';

import { toast } from '@dripplex/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { AddBankAccountScreen } from './screens/add-bank-account-screen';
import { PaymentMethodsScreen } from './screens/payment-methods-screen';
import { RewardsScreen } from './screens/rewards-screen';
import { SetWalletPinScreen } from './screens/set-wallet-pin-screen';
import { TopUpScreen } from './screens/top-up-screen';
import { TransactionHistoryScreen } from './screens/transaction-history-screen';
import { TransferScreen } from './screens/transfer-screen';
import { WalletGatewayPaymentScreen } from './screens/wallet-gateway-payment-screen';
import { WalletHomeScreen } from './screens/wallet-home-screen';
import { WithdrawScreen } from './screens/withdraw-screen';

type WalletFlowScreen =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'transfer' }
  | { name: 'topup' }
  | { name: 'topupGateway'; authorizationUrl: string; verifying: boolean }
  | { name: 'rewards' }
  | { name: 'paymentMethods' }
  | { name: 'withdraw' }
  | { name: 'addBankAccount' }
  | { name: 'setPin' };

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
          onRewards={() => {
            setScreen({ name: 'rewards' });
          }}
          onWithdraw={() => {
            setScreen({ name: 'withdraw' });
          }}
        />
      );
    case 'history':
      return <TransactionHistoryScreen onBack={goHome} />;
    case 'rewards':
      return <RewardsScreen onBack={goHome} />;
    case 'paymentMethods':
      return <PaymentMethodsScreen onBack={goHome} />;
    case 'withdraw':
      return (
        <WithdrawScreen
          onBack={goHome}
          onManageBankAccounts={() => {
            setScreen({ name: 'addBankAccount' });
          }}
          onSetPin={() => {
            setScreen({ name: 'setPin' });
          }}
          onWithdrawn={() => {
            toast({
              title: 'Withdrawal submitted',
              description: 'Your withdrawal is being processed.',
            });
            goHome();
          }}
        />
      );
    case 'addBankAccount':
      return (
        <AddBankAccountScreen
          onBack={() => {
            setScreen({ name: 'withdraw' });
          }}
          onAdded={() => {
            setScreen({ name: 'withdraw' });
          }}
        />
      );
    case 'setPin':
      return (
        <SetWalletPinScreen
          onBack={() => {
            setScreen({ name: 'withdraw' });
          }}
          onSet={() => {
            setScreen({ name: 'withdraw' });
          }}
        />
      );
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
          onManagePaymentMethods={() => {
            setScreen({ name: 'paymentMethods' });
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
