import { Injectable, Logger } from '@nestjs/common';

import { isSyntheticEmail } from '../auth/utils/synthetic-email.util';
import { AppConfigService } from '../config/app-config.service';

import { LoggingNotificationService } from './logging-notification.service';
import { ResendEmailSender } from './providers/resend-email.sender';
import { TermiiSmsSender } from './providers/termii-sms.sender';

import type {
  DeliveryLifecycleNotificationInput,
  DriverLifecycleNotificationInput,
  EmailOtpNotificationInput,
  EmailVerificationNotificationInput,
  MerchantLifecycleNotificationInput,
  NotificationService,
  OrderCreatedNotificationInput,
  OrderLifecycleNotificationInput,
  PasswordChangedNotificationInput,
  PasswordResetNotificationInput,
  PaymentResultNotificationInput,
  PhoneOtpNotificationInput,
  RideEarningNotificationInput,
  RideLifecycleNotificationInput,
} from './notification.service';

/**
 * Real production notification adapter — replaces LoggingNotificationService
 * as the NOTIFICATION_SERVICE binding once Termii/Resend credentials exist
 * (see notifications.module.ts). Each channel activates independently:
 * SMS goes through TermiiSmsSender only when TERMII_API_KEY is set, email
 * through ResendEmailSender only when RESEND_API_KEY is set — whichever
 * channel isn't configured yet falls back to LoggingNotificationService's
 * exact log-only behavior, so partial rollout (e.g. SMS live, email still
 * pending) never regresses to a worse state than before this class existed.
 *
 * Delivery is best-effort: a real provider failure (network error, bad
 * request, carrier rejection) is logged at 'warn' and swallowed, never
 * thrown. The OTP/token this is delivering is already persisted (Redis or
 * the identity-verification table) before this runs, so a transient send
 * failure doesn't lose it — the user can request a resend, same recovery
 * path as if the SMS/email had bounced after leaving Termii/Resend.
 */
@Injectable()
export class ProductionNotificationService implements NotificationService {
  private readonly logger = new Logger(ProductionNotificationService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly smsSender: TermiiSmsSender,
    private readonly emailSender: ResendEmailSender,
    private readonly fallback: LoggingNotificationService,
  ) {}

  public async sendPasswordReset(input: PasswordResetNotificationInput): Promise<void> {
    const minutes = Math.ceil(input.expiresInSeconds / 60);
    await this.sendEmail(
      input.email,
      'Reset your DrippleX password',
      this.wrapEmail(
        'Reset your password',
        `<p>Use this code to reset your DrippleX password:</p>
         <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${input.otp}</p>
         <p>This code expires in ${String(minutes)} minute${minutes === 1 ? '' : 's'}. If you didn't request this, you can safely ignore this email.</p>`,
      ),
      () => this.fallback.sendPasswordReset(input),
    );
  }

  public async sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void> {
    await this.sendEmail(
      input.email,
      'Your DrippleX password was changed',
      this.wrapEmail(
        'Password changed',
        `<p>Your DrippleX account password was just changed. If this wasn't you, please contact support immediately.</p>`,
      ),
      () => this.fallback.sendPasswordChanged(input),
    );
  }

  public async sendEmailVerification(input: EmailVerificationNotificationInput): Promise<void> {
    const minutes = Math.ceil(input.expiresInSeconds / 60);
    const verifyUrl = `${this.config.customerAppUrl}/verify-email?token=${encodeURIComponent(input.verificationToken)}`;
    await this.sendEmail(
      input.email,
      'Verify your DrippleX email',
      this.wrapEmail(
        'Verify your email',
        `<p>Confirm your email address to finish setting up your DrippleX account:</p>
         <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:8px;">Verify email</a></p>
         <p>This link expires in ${String(minutes)} minute${minutes === 1 ? '' : 's'}.</p>`,
      ),
      () => this.fallback.sendEmailVerification(input),
    );
  }

  public async sendEmailOtp(input: EmailOtpNotificationInput): Promise<void> {
    const minutes = Math.ceil(input.expiresInSeconds / 60);
    await this.sendEmail(
      input.email,
      'Your DrippleX verification code',
      this.wrapEmail(
        'Verify your email',
        `<p>Use this code to verify your DrippleX email address:</p>
         <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${input.otp}</p>
         <p>This code expires in ${String(minutes)} minute${minutes === 1 ? '' : 's'}.</p>`,
      ),
      () => this.fallback.sendEmailOtp(input),
    );
  }

  public async sendPhoneOtp(input: PhoneOtpNotificationInput): Promise<void> {
    const minutes = Math.ceil(input.expiresInSeconds / 60);
    await this.sendSms(
      input.phone,
      `Your DrippleX verification code is ${input.otp}. It expires in ${String(minutes)} minute${minutes === 1 ? '' : 's'}. Don't share this code.`,
      () => this.fallback.sendPhoneOtp(input),
    );
  }

  public async notifyMerchantLifecycle(input: MerchantLifecycleNotificationInput): Promise<void> {
    const { subject, body } = this.merchantLifecycleContent(input);
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyMerchantLifecycle(input),
    );
  }

  public async notifyOrderCreated(input: OrderCreatedNotificationInput): Promise<void> {
    const subject =
      input.audience === 'customer'
        ? `Order ${input.orderNumber} confirmed`
        : `New order ${input.orderNumber} received`;
    const body =
      input.audience === 'customer'
        ? `<p>Thanks for your order! Order <strong>${input.orderNumber}</strong> (${this.formatMoney(input.total, input.currency)}) has been placed.</p>`
        : `<p>You've received a new order <strong>${input.orderNumber}</strong> (${this.formatMoney(input.total, input.currency)}). Please review and accept it in your merchant portal.</p>`;
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyOrderCreated(input),
    );
  }

  public async notifyOrderLifecycle(input: OrderLifecycleNotificationInput): Promise<void> {
    const { subject, body } = this.orderLifecycleContent(input);
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyOrderLifecycle(input),
    );
  }

  public async notifyPaymentResult(input: PaymentResultNotificationInput): Promise<void> {
    const subject = input.success
      ? `Payment received for order ${input.orderNumber}`
      : `Payment failed for order ${input.orderNumber}`;
    const body = input.success
      ? `<p>We've received your payment of ${this.formatMoney(input.amount, input.currency)} for order <strong>${input.orderNumber}</strong> (ref ${input.reference}).</p>`
      : `<p>Your payment of ${this.formatMoney(input.amount, input.currency)} for order <strong>${input.orderNumber}</strong> could not be completed (ref ${input.reference}). Please try again.</p>`;
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyPaymentResult(input),
    );
  }

  public async notifyDeliveryLifecycle(input: DeliveryLifecycleNotificationInput): Promise<void> {
    const { subject, body } = this.deliveryLifecycleContent(input);
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyDeliveryLifecycle(input),
    );
  }

  public async notifyDriverLifecycle(input: DriverLifecycleNotificationInput): Promise<void> {
    const { subject, body } = this.driverLifecycleContent(input);
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyDriverLifecycle(input),
    );
  }

  public async notifyRideLifecycle(input: RideLifecycleNotificationInput): Promise<void> {
    const { subject, body } = this.rideLifecycleContent(input);
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyRideLifecycle(input),
    );
  }

  public async notifyRideEarning(input: RideEarningNotificationInput): Promise<void> {
    const subject = 'You earned a ride payout';
    const body = `<p>You earned ${this.formatMoney(input.amount, input.currency)} from your ride.</p>`;
    await this.sendEmail(input.email, subject, this.wrapEmail(subject, body), () =>
      this.fallback.notifyRideEarning(input),
    );
  }

  // ---- dispatch helpers ----------------------------------------------

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    fallback: () => Promise<void>,
  ): Promise<void> {
    // A phone-only registration is stored with a synthetic placeholder
    // address (see auth/utils/synthetic-email.util.ts) -- there's no real
    // inbox behind it, so every email path (this one included) silently
    // no-ops for it rather than attempting a send or even logging one.
    if (isSyntheticEmail(to)) {
      return;
    }
    if (!this.config.resendConfigured) {
      await fallback();
      return;
    }
    const result = await this.emailSender.send(to, subject, html);
    if (!result.success) {
      this.logger.warn(
        `Email delivery failed for ${to}: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }

  private async sendSms(
    phone: string,
    message: string,
    fallback: () => Promise<void>,
  ): Promise<void> {
    if (!this.config.termiiConfigured) {
      await fallback();
      return;
    }
    const result = await this.smsSender.send(phone, message);
    if (!result.success) {
      this.logger.warn(
        `SMS delivery failed for ${phone}: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }

  // ---- content builders -------------------------------------------------

  private merchantLifecycleContent(input: MerchantLifecycleNotificationInput): {
    subject: string;
    body: string;
  } {
    const name = input.businessName ?? 'Your business';
    switch (input.event) {
      case 'business_submitted':
        return {
          subject: 'Business profile submitted',
          body: `<p>${name} has been submitted for review.</p>`,
        };
      case 'kyc_submitted':
        return {
          subject: 'KYC documents submitted',
          body: `<p>Your KYC submission is under review.</p>`,
        };
      case 'merchant_approved':
        return {
          subject: `${name} is approved`,
          body: `<p>Congratulations! ${name} has been approved and can now go live on DrippleX.</p>`,
        };
      case 'merchant_rejected':
        return {
          subject: `${name} was not approved`,
          body: `<p>Your merchant application was not approved.${input.reason ? ` Reason: ${input.reason}` : ''}</p>`,
        };
      case 'merchant_suspended':
        return {
          subject: `${name} has been suspended`,
          body: `<p>Your store has been suspended.${input.reason ? ` Reason: ${input.reason}` : ''} Contact support for details.</p>`,
        };
      case 'merchant_reactivated':
        return {
          subject: `${name} is active again`,
          body: `<p>Your store has been reactivated.</p>`,
        };
    }
  }

  private orderLifecycleContent(input: OrderLifecycleNotificationInput): {
    subject: string;
    body: string;
  } {
    const order = `order <strong>${input.orderNumber}</strong>`;
    switch (input.event) {
      case 'order_accepted':
        return {
          subject: `Order ${input.orderNumber} accepted`,
          body: `<p>Your ${order} was accepted and is being prepared.</p>`,
        };
      case 'order_rejected':
        return {
          subject: `Order ${input.orderNumber} was declined`,
          body: `<p>Your ${order} was declined.${input.reason ? ` Reason: ${input.reason}` : ''}</p>`,
        };
      case 'order_ready':
        return {
          subject: `Order ${input.orderNumber} is ready`,
          body: `<p>Your ${order} is ready.</p>`,
        };
      case 'order_delayed':
        return {
          subject: `Order ${input.orderNumber} is delayed`,
          body: `<p>Your ${order} is delayed.${input.reason ? ` Reason: ${input.reason}` : ''}</p>`,
        };
      case 'order_cancelled':
        return {
          subject: `Order ${input.orderNumber} was cancelled`,
          body: `<p>Your ${order} was cancelled.${input.reason ? ` Reason: ${input.reason}` : ''}</p>`,
        };
    }
  }

  private deliveryLifecycleContent(input: DeliveryLifecycleNotificationInput): {
    subject: string;
    body: string;
  } {
    const order = `order <strong>${input.orderNumber}</strong>`;
    switch (input.event) {
      case 'rider_assigned':
        return {
          subject: `A rider is on the way — ${input.orderNumber}`,
          body: `<p>A rider has been assigned to ${order}.</p>`,
        };
      case 'picked_up':
        return {
          subject: `Your order is on the way — ${input.orderNumber}`,
          body: `<p>${order} has been picked up and is on the way.</p>`,
        };
      case 'arriving':
        return {
          subject: `Your rider is arriving — ${input.orderNumber}`,
          body: `<p>Your rider for ${order} is arriving shortly.</p>`,
        };
      case 'delivered':
        return {
          subject: `Order ${input.orderNumber} delivered`,
          body: `<p>${order} has been delivered. Enjoy!</p>`,
        };
      case 'new_assignment':
        return {
          subject: `New delivery job — ${input.orderNumber}`,
          body: `<p>You've been assigned a new delivery for ${order}.</p>`,
        };
    }
  }

  private driverLifecycleContent(input: DriverLifecycleNotificationInput): {
    subject: string;
    body: string;
  } {
    switch (input.event) {
      case 'kyc_submitted':
        return {
          subject: 'Driver KYC submitted',
          body: `<p>Your driver KYC submission is under review.</p>`,
        };
      case 'driver_approved':
        return {
          subject: 'You are approved to drive',
          body: `<p>Congratulations! Your driver application has been approved.</p>`,
        };
      case 'driver_rejected':
        return {
          subject: 'Driver application update',
          body: `<p>Your driver application was not approved.${input.reason ? ` Reason: ${input.reason}` : ''}</p>`,
        };
      case 'driver_suspended':
        return {
          subject: 'Your driver account has been suspended',
          body: `<p>Your driver account has been suspended.${input.reason ? ` Reason: ${input.reason}` : ''} Contact support for details.</p>`,
        };
      case 'driver_reactivated':
        return {
          subject: 'Your driver account is active again',
          body: `<p>Your driver account has been reactivated.</p>`,
        };
    }
  }

  private rideLifecycleContent(input: RideLifecycleNotificationInput): {
    subject: string;
    body: string;
  } {
    switch (input.event) {
      case 'ride_offered':
        return { subject: 'New ride offer', body: `<p>You have a new ride offer.</p>` };
      case 'ride_assigned':
        return {
          subject: 'Driver assigned to your ride',
          body: `<p>A driver has been assigned to your ride.</p>`,
        };
      case 'ride_no_drivers_found':
        return {
          subject: 'No drivers available',
          body: `<p>We couldn't find a driver for your ride. Please try again.</p>`,
        };
      case 'ride_arrived':
        return {
          subject: 'Your driver has arrived',
          body: `<p>Your driver has arrived at the pickup point.</p>`,
        };
      case 'ride_started':
        return { subject: 'Your ride has started', body: `<p>Your ride is now in progress.</p>` };
      case 'ride_completed':
        return {
          subject: 'Ride completed',
          body: `<p>Your ride has been completed. Thanks for riding with DrippleX!</p>`,
        };
      case 'ride_cancelled':
        return { subject: 'Ride cancelled', body: `<p>Your ride was cancelled.</p>` };
      case 'ride_payment_succeeded':
        return {
          subject: 'Ride payment received',
          body: `<p>Your ride payment was successful.</p>`,
        };
      case 'ride_payment_failed':
        return {
          subject: 'Ride payment failed',
          body: `<p>Your ride payment could not be completed. Please try again.</p>`,
        };
    }
  }

  private formatMoney(amount: number, currency: string): string {
    return `${currency} ${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private wrapEmail(title: string, bodyHtml: string): string {
    return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F172A;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:32px;color:#64748B;font-size:12px;">DrippleX</p>
    </body></html>`;
  }
}
