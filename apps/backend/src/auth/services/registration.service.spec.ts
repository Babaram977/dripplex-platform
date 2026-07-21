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
    generateAndStore: jest.fn(),
  } as unknown as jest.Mocked<OtpService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    bcryptSaltRounds: 12,
  } as unknown as AppConfigService;

  const service = new RegistrationService(
    registrationRepository,
    usersService,
    otpService,
    auditService,
    appConfig,
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
    (otpService.generateAndStore as jest.Mock).mockResolvedValue({
      expiresInSeconds: 600,
      channel: 'email',
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
    expect(otpService.generateAndStore).toHaveBeenCalledWith(
      'phone_verification',
      '+2348012345678',
      {},
      registrationResult.userId,
    );
  });

  it('registers a rider with required phone', async () => {
    const result = await service.registerRider({ ...baseDto, phone: '+2348012345678' }, {});

    expect(result.profileId).toBe(registrationResult.profileId);
    expect(otpService.generateAndStore).toHaveBeenCalledTimes(2);
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
});
