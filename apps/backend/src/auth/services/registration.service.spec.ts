import { RegistrationChannel, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';

import { RegistrationService } from './registration.service';

import type { OtpService } from './otp.service';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationService } from '../../notifications/notification.service';
import type { ReferralsService } from '../../referrals/referrals.service';
import type { UsersService } from '../../users/users.service';
import type { RegistrationRepository } from '../repositories/registration.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('RegistrationService', () => {
  const registrationRepository = {
    registerPortalUser: jest.fn(),
  } as unknown as jest.Mocked<RegistrationRepository>;

  const usersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const otpService = {
    generateStoreAndDispatch: jest.fn(),
  } as unknown as jest.Mocked<OtpService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    bcryptSaltRounds: 12,
  } as unknown as AppConfigService;

  const notificationService = {
    sendEmailOtp: jest.fn(),
    sendPhoneOtp: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const service = new RegistrationService(
    registrationRepository,
    usersService,
    otpService,
    auditService,
    appConfig,
    notificationService,
  );

  const baseDto = {
    email: 'ada@example.com',
    password: 'Password1',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  const registrationResult = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    status: UserStatus.PENDING_VERIFICATION,
    profileId: '22222222-2222-2222-2222-222222222222',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
    (usersService.findByPhone as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (registrationRepository.registerPortalUser as jest.Mock).mockResolvedValue(registrationResult);
    (otpService.generateStoreAndDispatch as jest.Mock).mockResolvedValue({
      expiresInSeconds: 600,
      channel: 'email',
      otp: '123456',
    });
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
  });

  it('registers a customer without phone OTP', async () => {
    const result = await service.registerCustomer(baseDto, { ipAddress: '127.0.0.1' });

    expect(result.userId).toBe(registrationResult.userId);
    expect(result.verification.emailOtpSent).toBe(true);
    expect(result.verification.phoneOtpSent).toBe(false);
    expect(registrationRepository.registerPortalUser).toHaveBeenCalledWith(
      expect.objectContaining({
        portal: 'customer',
        registrationChannel: RegistrationChannel.CUSTOMER_WEB,
        roleName: 'customer',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
      expect.objectContaining({ userId: registrationResult.userId }),
      expect.any(Object),
    );
  });

  it('registers a merchant and sends phone OTP when phone is provided', async () => {
    const result = await service.registerMerchant({ ...baseDto, phone: '+2348012345678' }, {});

    expect(result.verification.phoneOtpSent).toBe(true);
    expect(otpService.generateStoreAndDispatch).toHaveBeenCalledWith(
      'phone_verification',
      '+2348012345678',
      {},
      expect.any(Function),
      registrationResult.userId,
    );
  });

  it('dispatches the generated email OTP through the notification service', async () => {
    (otpService.generateStoreAndDispatch as jest.Mock).mockImplementation(
      async (purpose: string, _identifier: string, _context: unknown, dispatch) => {
        if (purpose === 'email_verification') {
          await dispatch('654321', 600);
        }
        return { expiresInSeconds: 600, channel: 'email', otp: '654321' };
      },
    );

    await service.registerCustomer(baseDto, {});

    expect(notificationService.sendEmailOtp).toHaveBeenCalledWith({
      email: baseDto.email,
      otp: '654321',
      expiresInSeconds: 600,
    });
  });

  it('dispatches the generated phone OTP through the notification service', async () => {
    (otpService.generateStoreAndDispatch as jest.Mock).mockImplementation(
      async (purpose: string, _identifier: string, _context: unknown, dispatch) => {
        if (purpose === 'phone_verification') {
          await dispatch('112233', 600);
        }
        return {
          expiresInSeconds: 600,
          channel: purpose === 'phone_verification' ? 'sms' : 'email',
        };
      },
    );

    await service.registerMerchant({ ...baseDto, phone: '+2348012345678' }, {});

    expect(notificationService.sendPhoneOtp).toHaveBeenCalledWith({
      phone: '+2348012345678',
      otp: '112233',
      expiresInSeconds: 600,
    });
  });

  it('registers a rider with required phone', async () => {
    const result = await service.registerRider({ ...baseDto, phone: '+2348012345678' }, {});

    expect(result.profileId).toBe(registrationResult.profileId);
    expect(otpService.generateStoreAndDispatch).toHaveBeenCalledTimes(2);
  });

  it('registers a driver with required phone', async () => {
    await service.registerDriver({ ...baseDto, phone: '+2348098765432' }, {});

    expect(registrationRepository.registerPortalUser).toHaveBeenCalledWith(
      expect.objectContaining({
        portal: 'driver',
        registrationChannel: RegistrationChannel.DRIVER_PORTAL,
      }),
    );
  });

  it('rejects duplicate email', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: 'existing' });

    await expect(service.registerCustomer(baseDto, {})).rejects.toBeInstanceOf(
      ConflictDomainException,
    );
  });

  it('rejects duplicate phone', async () => {
    await expect(
      service.registerRider({ ...baseDto, phone: '+2348012345678' }, {}),
    ).resolves.toBeDefined();

    (usersService.findByPhone as jest.Mock).mockResolvedValue({ id: 'existing' });

    await expect(
      service.registerRider({ ...baseDto, phone: '+2348012345678' }, {}),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });

  it('requires phone for rider registration', async () => {
    await expect(service.registerRider(baseDto, {})).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  describe('referral code redemption', () => {
    const referralsService = {
      tryRedeemAtRegistration: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ReferralsService>;

    const serviceWithReferrals = new RegistrationService(
      registrationRepository,
      usersService,
      otpService,
      auditService,
      appConfig,
      notificationService,
      undefined,
      referralsService,
    );

    it('redeems a referral code for customer registration when present', async () => {
      await serviceWithReferrals.registerCustomer({ ...baseDto, referralCode: 'FRIEND01' }, {});

      expect(referralsService.tryRedeemAtRegistration).toHaveBeenCalledWith(
        registrationResult.userId,
        'FRIEND01',
        expect.objectContaining({ userId: registrationResult.userId }),
      );
    });

    it('does not attempt redemption when no referral code is given', async () => {
      await serviceWithReferrals.registerCustomer(baseDto, {});

      expect(referralsService.tryRedeemAtRegistration).not.toHaveBeenCalled();
    });

    it('does not attempt redemption for non-customer portals', async () => {
      await serviceWithReferrals.registerMerchant({ ...baseDto, referralCode: 'FRIEND01' }, {});

      expect(referralsService.tryRedeemAtRegistration).not.toHaveBeenCalled();
    });
  });
});
