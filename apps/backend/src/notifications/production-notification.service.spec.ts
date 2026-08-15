import { SYNTHETIC_EMAIL_DOMAIN } from '../auth/utils/synthetic-email.util';

import { ProductionNotificationService } from './production-notification.service';

import type { LoggingNotificationService } from './logging-notification.service';
import type { ResendEmailSender } from './providers/resend-email.sender';
import type { TermiiSmsSender } from './providers/termii-sms.sender';
import type { AppConfigService } from '../config/app-config.service';

describe('ProductionNotificationService', () => {
  function buildService(config: { termiiConfigured: boolean; resendConfigured: boolean }): {
    service: ProductionNotificationService;
    smsSender: jest.Mocked<Pick<TermiiSmsSender, 'send'>>;
    emailSender: jest.Mocked<Pick<ResendEmailSender, 'send'>>;
    fallback: jest.Mocked<LoggingNotificationService>;
  } {
    const smsSender = { send: jest.fn() } as jest.Mocked<Pick<TermiiSmsSender, 'send'>>;
    const emailSender = { send: jest.fn() } as jest.Mocked<Pick<ResendEmailSender, 'send'>>;
    const fallback = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendPhoneOtp: jest.fn().mockResolvedValue(undefined),
      notifyMerchantLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyOrderCreated: jest.fn().mockResolvedValue(undefined),
      notifyOrderLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyPaymentResult: jest.fn().mockResolvedValue(undefined),
      notifyDeliveryLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyDriverLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRiderLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideEarning: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoggingNotificationService>;

    const appConfig = {
      termiiConfigured: config.termiiConfigured,
      resendConfigured: config.resendConfigured,
      customerAppUrl: 'https://www.dripplex.com',
    } as unknown as AppConfigService;

    const service = new ProductionNotificationService(
      appConfig,
      smsSender as unknown as TermiiSmsSender,
      emailSender as unknown as ResendEmailSender,
      fallback,
    );

    return { service, smsSender, emailSender, fallback };
  }

  describe('when neither provider is configured', () => {
    it('falls back to logging for phone OTP', async () => {
      const { service, smsSender, fallback } = buildService({
        termiiConfigured: false,
        resendConfigured: false,
      });

      await service.sendPhoneOtp({ phone: '+2348012345678', otp: '123456', expiresInSeconds: 300 });

      expect(smsSender.send).not.toHaveBeenCalled();
      expect(fallback.sendPhoneOtp).toHaveBeenCalledWith({
        phone: '+2348012345678',
        otp: '123456',
        expiresInSeconds: 300,
      });
    });

    it('falls back to logging for password reset', async () => {
      const { service, emailSender, fallback } = buildService({
        termiiConfigured: false,
        resendConfigured: false,
      });

      await service.sendPasswordReset({
        email: 'a@b.com',
        resetToken: 'tok',
        otp: '654321',
        expiresInSeconds: 900,
      });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(fallback.sendPasswordReset).toHaveBeenCalled();
    });
  });

  describe('when Termii is configured', () => {
    it('sends the OTP via SMS instead of falling back', async () => {
      const { service, smsSender, fallback } = buildService({
        termiiConfigured: true,
        resendConfigured: false,
      });
      smsSender.send.mockResolvedValue({ success: true, providerMessageId: 'msg-1' });

      await service.sendPhoneOtp({ phone: '+2348012345678', otp: '123456', expiresInSeconds: 300 });

      expect(smsSender.send).toHaveBeenCalledWith(
        '+2348012345678',
        expect.stringContaining('123456'),
      );
      expect(fallback.sendPhoneOtp).not.toHaveBeenCalled();
    });

    it('does not call the fallback even when the real send fails (best-effort)', async () => {
      const { service, smsSender, fallback } = buildService({
        termiiConfigured: true,
        resendConfigured: false,
      });
      smsSender.send.mockResolvedValue({ success: false, errorMessage: 'carrier rejected' });

      await expect(
        service.sendPhoneOtp({ phone: '+2348012345678', otp: '123456', expiresInSeconds: 300 }),
      ).resolves.toBeUndefined();

      expect(fallback.sendPhoneOtp).not.toHaveBeenCalled();
    });
  });

  describe('when Resend is configured', () => {
    it('sends password reset via email with the OTP embedded', async () => {
      const { service, emailSender, fallback } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-1' });

      await service.sendPasswordReset({
        email: 'a@b.com',
        resetToken: 'tok',
        otp: '654321',
        expiresInSeconds: 900,
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'a@b.com',
        'Reset your DrippleX password',
        expect.stringContaining('654321'),
      );
      expect(fallback.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('embeds a verify-email link built from customerAppUrl', async () => {
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-2' });

      await service.sendEmailVerification({
        email: 'a@b.com',
        verificationToken: 'nonce.sig',
        expiresInSeconds: 600,
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'a@b.com',
        expect.any(String),
        expect.stringContaining('https://www.dripplex.com/verify-email?token=nonce.sig'),
      );
    });

    it('varies order-created copy by audience', async () => {
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-3' });

      await service.notifyOrderCreated({
        audience: 'merchant',
        email: 'merchant@b.com',
        orderId: 'o1',
        orderNumber: 'DPX-1',
        total: 5000,
        currency: 'NGN',
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'merchant@b.com',
        'New order DPX-1 received',
        expect.any(String),
      );
    });

    it('puts the rejection reason in the merchant email a partner actually reads', async () => {
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-4' });

      await service.notifyMerchantLifecycle({
        email: 'merchant@b.com',
        event: 'merchant_rejected',
        merchantId: 'm1',
        businessName: 'Ara Table Water',
        reason: 'Incomplete documentation',
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'merchant@b.com',
        'Ara Table Water was not approved',
        expect.stringContaining('Incomplete documentation'),
      );
    });

    it('names the document and the reason when ONE document is rejected', async () => {
      // A merchant holds several required documents, so a bare "KYC rejected"
      // leaves them guessing which one to replace.
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-5' });

      await service.notifyMerchantLifecycle({
        email: 'merchant@b.com',
        event: 'kyc_rejected',
        merchantId: 'm1',
        documentType: 'NATIONAL_ID',
        reason: 'Photo is blurred',
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'merchant@b.com',
        'National Id was rejected',
        expect.stringContaining('Photo is blurred'),
      );
    });

    it('emails a rejected rider the reason — riders previously got nothing', async () => {
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-6' });

      await service.notifyRiderLifecycle({
        email: 'rider@b.com',
        event: 'rider_rejected',
        riderId: 'r1',
        reason: 'Guarantor ID unreadable',
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'rider@b.com',
        'Delivery rider application update',
        expect.stringContaining('Guarantor ID unreadable'),
      );
    });

    it('emails a rejected driver document with its type and reason', async () => {
      const { service, emailSender } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });
      emailSender.send.mockResolvedValue({ success: true, providerMessageId: 'email-7' });

      await service.notifyDriverLifecycle({
        email: 'driver@b.com',
        event: 'kyc_rejected',
        driverId: 'd1',
        documentType: 'DRIVER_LICENSE',
        reason: 'Expired',
      });

      expect(emailSender.send).toHaveBeenCalledWith(
        'driver@b.com',
        'Driver License was rejected',
        expect.stringContaining('Expired'),
      );
    });
  });

  describe('when the recipient is a synthetic phone-only placeholder address', () => {
    it('no-ops instead of sending, even when Resend is configured', async () => {
      const { service, emailSender, fallback } = buildService({
        termiiConfigured: false,
        resendConfigured: true,
      });

      await service.sendEmailVerification({
        email: `2348012345678@${SYNTHETIC_EMAIL_DOMAIN}`,
        verificationToken: 'nonce.sig',
        expiresInSeconds: 600,
      });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(fallback.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('no-ops instead of falling back to logging when Resend is not configured', async () => {
      const { service, emailSender, fallback } = buildService({
        termiiConfigured: false,
        resendConfigured: false,
      });

      await service.sendEmailVerification({
        email: `2348012345678@${SYNTHETIC_EMAIL_DOMAIN}`,
        verificationToken: 'nonce.sig',
        expiresInSeconds: 600,
      });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(fallback.sendEmailVerification).not.toHaveBeenCalled();
    });
  });
});
