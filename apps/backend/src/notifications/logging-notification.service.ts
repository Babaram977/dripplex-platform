import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import type {
  DeliveryLifecycleNotificationInput,
  DriverLifecycleNotificationInput,
  EmailVerificationNotificationInput,
  MerchantLifecycleNotificationInput,
  NotificationService,
  OrderCreatedNotificationInput,
  PasswordChangedNotificationInput,
  PasswordResetNotificationInput,
  PaymentResultNotificationInput,
  PhoneOtpNotificationInput,
} from './notification.service';

/**
 * Development/stub notification adapter. Logs intent without calling a provider.
 * Replace with SES/SendGrid/Termii adapters in a later infrastructure commit.
 */
@Injectable()
export class LoggingNotificationService implements NotificationService {
  constructor(private readonly logger: Logger) {}

  public sendPasswordReset(input: PasswordResetNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'password_reset',
        email: input.email,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Password reset notification dispatched',
    );
    return Promise.resolve();
  }

  public sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'password_changed',
        email: input.email,
      },
      'Password changed notification dispatched',
    );
    return Promise.resolve();
  }

  public sendEmailVerification(input: EmailVerificationNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'email_verification',
        email: input.email,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Email verification notification dispatched',
    );
    return Promise.resolve();
  }

  public sendPhoneOtp(input: PhoneOtpNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'sms',
        template: 'phone_otp',
        phone: input.phone,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Phone OTP notification dispatched',
    );
    return Promise.resolve();
  }

  public notifyMerchantLifecycle(input: MerchantLifecycleNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: `merchant_${input.event}`,
        email: input.email,
        merchantId: input.merchantId,
        businessName: input.businessName,
        documentType: input.documentType,
        reason: input.reason,
      },
      'Merchant lifecycle notification dispatched',
    );
    return Promise.resolve();
  }

  public notifyOrderCreated(input: OrderCreatedNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template:
          input.audience === 'customer' ? 'order_created_customer' : 'order_created_merchant',
        email: input.email,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        total: input.total,
        currency: input.currency,
      },
      'Order created notification dispatched',
    );
    return Promise.resolve();
  }

  public notifyPaymentResult(input: PaymentResultNotificationInput): Promise<void> {
    const template =
      input.audience === 'merchant'
        ? 'order_paid_merchant'
        : input.success
          ? 'payment_successful_customer'
          : 'payment_failed_customer';

    this.logger.log(
      {
        channel: 'email',
        template,
        email: input.email,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        success: input.success,
      },
      'Payment result notification dispatched',
    );
    return Promise.resolve();
  }

  public notifyDeliveryLifecycle(input: DeliveryLifecycleNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: `delivery_${input.event}_${input.audience}`,
        email: input.email,
        audience: input.audience,
        event: input.event,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        jobId: input.jobId,
      },
      'Delivery lifecycle notification dispatched',
    );
    return Promise.resolve();
  }

  public notifyDriverLifecycle(input: DriverLifecycleNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: `driver_${input.event}`,
        email: input.email,
        driverId: input.driverId,
        documentType: input.documentType,
        reason: input.reason,
      },
      'Driver lifecycle notification dispatched',
    );
    return Promise.resolve();
  }
}
