import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AddressesModule } from './addresses/addresses.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { CartModule } from './cart/cart.module';
import { CmsModule } from './cms/cms.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { DeliveryModule } from './delivery/delivery.module';
import { DriversModule } from './drivers/drivers.module';
import { EventsModule } from './events/events.module';
import { FraudModule } from './fraud/fraud.module';
import { HealthModule } from './health/health.module';
import { AppLoggerModule } from './logger/logger.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MerchantsModule } from './merchants/merchants.module';
import { NotificationCenterModule } from './notification-center/notification-center.module';
import { OperationsModule } from './operations/operations.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PromotionsModule } from './promotions/promotions.module';
import { RedisModule } from './redis/redis.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RidesModule } from './rides/rides.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { WalletFundingModule } from './wallet/wallet-funding.module';
import { WalletModule } from './wallet/wallet.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    PrismaModule,
    EventsModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => [
        {
          ttl: appConfig.throttleTtlMs,
          limit: appConfig.throttleLimit,
        },
      ],
    }),
    AuthModule,
    UsersModule,
    MerchantsModule,
    AddressesModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    DriversModule,
    RidesModule,
    ReviewsModule,
    WishlistModule,
    PromotionsModule,
    LoyaltyModule,
    WalletModule,
    WalletFundingModule,
    ReferralsModule,
    AnalyticsModule,
    NotificationCenterModule,
    SearchModule,
    CmsModule,
    FraudModule,
    HealthModule,
    OperationsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        validationError: { target: false, value: false },
      }),
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
