import { RegistrationChannel, UserStatus } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

import { VerificationService } from './verification.service';

import type { OtpService } from './otp.service';
import type { UsersService } from '../../users/users.service';

describe('VerificationService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    markEmailVerified: jest.fn(),
    markPhoneVerified: jest.fn(),
    activateIfVerificationsComplete: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const otpService = {
    verify: jest.fn(),
  } as unknown as jest.Mocked<OtpService>;

  const service = new VerificationService(usersService, otpService);

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    phone: '+2348012345678',
    deletedAt: null,
    registrationChannel: RegistrationChannel.CUSTOMER_WEB,
    status: UserStatus.PENDING_VERIFICATION,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (otpService.verify as jest.Mock).mockResolvedValue(undefined);
  });

  it('verifies email without issuing tokens', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
    (usersService.markEmailVerified as jest.Mock).mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date('2026-07-21T08:00:00.000Z'),
    });
    (usersService.activateIfVerificationsComplete as jest.Mock).mockResolvedValue({
      ...user,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-07-21T08:00:00.000Z'),
    });

    const result = await service.verifyEmail('ada@example.com', '123456', {});

    expect(result.verified).toBe(true);
    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(otpService.verify).toHaveBeenCalledWith(
      'email_verification',
      'ada@example.com',
      '123456',
      {},
      user.id,
    );
  });

  it('verifies phone for rider channel', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue({
      ...user,
      registrationChannel: RegistrationChannel.RIDER_PORTAL,
    });
    (usersService.markPhoneVerified as jest.Mock).mockResolvedValue({
      ...user,
      phoneVerifiedAt: new Date('2026-07-21T08:00:00.000Z'),
    });
    (usersService.activateIfVerificationsComplete as jest.Mock).mockResolvedValue({
      ...user,
      status: UserStatus.PENDING_VERIFICATION,
      phoneVerifiedAt: new Date('2026-07-21T08:00:00.000Z'),
    });

    const result = await service.verifyPhone('+2348012345678', '123456', {});

    expect(result.verified).toBe(true);
    expect(usersService.activateIfVerificationsComplete).toHaveBeenCalledWith(user.id, true);
  });

  it('rejects verification for unknown email', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(service.verifyEmail('missing@example.com', '123456', {})).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });
});
