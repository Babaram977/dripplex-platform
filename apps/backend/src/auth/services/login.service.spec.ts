import { RegistrationChannel, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  AccountBlockedDomainException,
  AccountSuspendedDomainException,
  EmailNotVerifiedDomainException,
  UnauthorizedDomainException,
  WrongPortalDomainException,
} from '../../common/exceptions/domain.exception';

import { LoginService } from './login.service';

import type { LoginAttemptService } from './login-attempt.service';
import type { SessionService } from './session.service';
import type { AuditService } from '../../audit/audit.service';
import type { UsersService } from '../../users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('LoginService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findByIdWithRbac: jest.fn(),
    recordLoginActivity: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const sessionService = {
    createPortalSession: jest.fn(),
  } as unknown as jest.Mocked<SessionService>;

  const loginAttemptService = {
    assertNotLocked: jest.fn(),
    recordFailure: jest.fn(),
    resetFailures: jest.fn(),
  } as unknown as jest.Mocked<LoginAttemptService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const service = new LoginService(usersService, sessionService, loginAttemptService, auditService);

  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    phone: '+2348012345678',
    passwordHash: 'hashed-password',
    firstName: 'Ada',
    lastName: 'Lovelace',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: new Date(),
    deletedAt: null,
    registrationChannel: RegistrationChannel.CUSTOMER_WEB,
  };

  const sessionMetadata = {
    id: '22222222-2222-2222-2222-222222222222',
    portal: 'customer' as const,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: '2026-07-21T08:00:00.000Z',
    lastActiveAt: '2026-07-21T08:00:00.000Z',
    expiresAt: '2026-07-28T08:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (loginAttemptService.assertNotLocked as jest.Mock).mockResolvedValue(undefined);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (usersService.findByEmail as jest.Mock).mockResolvedValue(activeUser);
    (usersService.findByIdWithRbac as jest.Mock).mockResolvedValue({
      ...activeUser,
      roles: [
        {
          role: {
            name: 'customer',
            permissions: [{ permission: { code: 'profile:read' } }],
          },
        },
      ],
    });
    (usersService.recordLoginActivity as jest.Mock).mockResolvedValue(activeUser);
    (loginAttemptService.resetFailures as jest.Mock).mockResolvedValue(undefined);
    (sessionService.createPortalSession as jest.Mock).mockResolvedValue(sessionMetadata);
  });

  it('logs in a customer successfully without JWT', async () => {
    const result = await service.loginCustomer(
      { email: 'ada@example.com', password: 'Password1' },
      { ipAddress: '127.0.0.1' },
    );

    expect(result.authentication.state).toBe('session_established');
    expect(result.session.id).toBe(sessionMetadata.id);
    expect(result.user.roles).toContain('customer');
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects wrong password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.loginCustomer({ email: 'ada@example.com', password: 'WrongPass1' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedDomainException);

    expect(loginAttemptService.recordFailure).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.LOGIN_FAILED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects unknown account with generic error', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.loginCustomer({ email: 'missing@example.com', password: 'Password1' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });

  it('rejects blocked accounts', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue({
      ...activeUser,
      status: UserStatus.BLOCKED,
    });

    await expect(
      service.loginCustomer({ email: 'ada@example.com', password: 'Password1' }, {}),
    ).rejects.toBeInstanceOf(AccountBlockedDomainException);
  });

  it('rejects suspended accounts', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue({
      ...activeUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.loginCustomer({ email: 'ada@example.com', password: 'Password1' }, {}),
    ).rejects.toBeInstanceOf(AccountSuspendedDomainException);
  });

  it('rejects pending verification accounts', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue({
      ...activeUser,
      status: UserStatus.PENDING_VERIFICATION,
    });

    await expect(
      service.loginCustomer({ email: 'ada@example.com', password: 'Password1' }, {}),
    ).rejects.toBeInstanceOf(EmailNotVerifiedDomainException);
  });

  it('rejects wrong portal role', async () => {
    (usersService.findByIdWithRbac as jest.Mock).mockResolvedValue({
      ...activeUser,
      roles: [{ role: { name: 'merchant', permissions: [] } }],
    });

    await expect(
      service.loginCustomer({ email: 'ada@example.com', password: 'Password1' }, {}),
    ).rejects.toBeInstanceOf(WrongPortalDomainException);
  });

  it('creates a session on successful login', async () => {
    await service.loginCustomer({ email: 'ada@example.com', password: 'Password1' }, {});

    expect(sessionService.createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: activeUser.id,
        portal: RegistrationChannel.CUSTOMER_WEB,
      }),
    );
    expect(usersService.recordLoginActivity).toHaveBeenCalledWith(activeUser.id);
    expect(loginAttemptService.resetFailures).toHaveBeenCalled();
  });
});
