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
import { PAYOUT_PROVIDERS } from './payout/payout-provider.adapter';
import { PaystackTransferProvider } from './payout/paystack-transfer.provider';
import { RiderWalletController } from './rider-wallet.controller';
import { SettlementReportService } from './settlement-report.service';
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
    {
      provide: PAYOUT_PROVIDERS,
      useFactory: (paystack: PaystackTransferProvider) => [paystack],
      inject: [PaystackTransferProvider],
    },
  ],
  exports: [WalletService, PAYOUT_PROVIDERS],
})
export class WalletModule {}
