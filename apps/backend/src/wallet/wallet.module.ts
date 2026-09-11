import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminWalletController } from './admin-wallet.controller';
import { BankAccountsService } from './bank-accounts.service';
import { AdminWithdrawalController } from './controllers/admin-withdrawal.controller';
import { CustomerBankAccountsController } from './controllers/customer-bank-accounts.controller';
import { CustomerWalletPinController } from './controllers/customer-wallet-pin.controller';
import { CustomerWithdrawalController } from './controllers/customer-withdrawal.controller';
import {
  DriverPayoutController,
  RiderPayoutController,
} from './controllers/partner-payout.controller';
import { CustomerWalletController } from './customer-wallet.controller';
import { DriverWalletController } from './driver-wallet.controller';
import { MerchantWalletController } from './merchant-wallet.controller';
import { FlutterwaveTransferWebhookController } from './payout/flutterwave-transfer-webhook.controller';
import { FlutterwaveTransferProvider } from './payout/flutterwave-transfer.provider';
import { PayoutDestinationService } from './payout/payout-destination.service';
import { PayoutFulfillmentService } from './payout/payout-fulfillment.service';
import { PAYOUT_PROVIDERS } from './payout/payout-provider.adapter';
import { PayoutReconciliationService } from './payout/payout-reconciliation.service';
import { PaystackTransferWebhookController } from './payout/paystack-transfer-webhook.controller';
import { PaystackTransferProvider } from './payout/paystack-transfer.provider';
import { RiderWalletController } from './rider-wallet.controller';
import { SettlementReportService } from './settlement-report.service';
import {
  BANK_ACCOUNT_RESOLVER,
  FLUTTERWAVE_BANK_ACCOUNT_RESOLVER,
} from './verification/bank-account-resolver.port';
import { FlutterwaveBankAccountResolver } from './verification/flutterwave-bank-account.resolver';
import { PaystackBankAccountResolver } from './verification/paystack-bank-account.resolver';
import { WalletEventsSubscriber } from './wallet-events.subscriber';
import { WalletPinService } from './wallet-pin.service';
import { WalletRecipientsService } from './wallet-recipients.service';
import { WalletService } from './wallet.service';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [PrismaModule, AuditModule, CommercialModule],
  controllers: [
    CustomerWalletController,
    CustomerBankAccountsController,
    CustomerWalletPinController,
    CustomerWithdrawalController,
    MerchantWalletController,
    RiderWalletController,
    DriverWalletController,
    AdminWalletController,
    AdminWithdrawalController,
    RiderPayoutController,
    DriverPayoutController,
    PaystackTransferWebhookController,
    FlutterwaveTransferWebhookController,
  ],
  providers: [
    WalletService,
    WalletEventsSubscriber,
    WalletRecipientsService,
    BankAccountsService,
    SettlementReportService,
    WalletPinService,
    WithdrawalService,
    PaystackTransferProvider,
    FlutterwaveTransferProvider,
    PaystackBankAccountResolver,
    FlutterwaveBankAccountResolver,
    PayoutDestinationService,
    PayoutReconciliationService,
    PayoutFulfillmentService,
    { provide: BANK_ACCOUNT_RESOLVER, useExisting: PaystackBankAccountResolver },
    {
      provide: FLUTTERWAVE_BANK_ACCOUNT_RESOLVER,
      useExisting: FlutterwaveBankAccountResolver,
    },
    {
      // Both rails are registered. Which one sends a given payout is read from
      // config per transfer, so one being unavailable — Paystack restricts
      // Transfers to registered businesses with a funded balance — does not
      // stop partners being paid.
      provide: PAYOUT_PROVIDERS,
      useFactory: (
        paystack: PaystackTransferProvider,
        flutterwave: FlutterwaveTransferProvider,
      ) => [paystack, flutterwave],
      inject: [PaystackTransferProvider, FlutterwaveTransferProvider],
    },
  ],
  exports: [
    WalletService,
    PAYOUT_PROVIDERS,
    BANK_ACCOUNT_RESOLVER,
    FLUTTERWAVE_BANK_ACCOUNT_RESOLVER,
    PayoutDestinationService,
  ],
})
export class WalletModule {}
