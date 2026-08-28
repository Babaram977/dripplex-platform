import { UserStatus } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { UsersService } from './users.service';

import type { UsersRepository } from './repositories/users.repository';

describe('UsersService', () => {
  const repository: jest.Mocked<UsersRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findByGoogleId: jest.fn(),
    findByIdWithRbac: jest.fn(),
    markLogin: jest.fn(),
    markEmailVerified: jest.fn(),
    markPhoneVerified: jest.fn(),
    activateIfVerificationsComplete: jest.fn(),
    recordLoginActivity: jest.fn(),
    updatePassword: jest.fn(),
    linkGoogleId: jest.fn(),
    updateProfile: jest.fn(),
    updatePhone: jest.fn(),
    updateEmail: jest.fn(),
    list: jest.fn(),
  };

  const service = new UsersService(repository);

  const sampleUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@dripplex.com',
    phone: null,
    passwordHash: 'hash',
    googleId: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    profilePhotoUrl: null,
    dateOfBirth: null,
    gender: null,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    lastLoginAt: null,
    lastActiveAt: null,
    registrationChannel: null,
    passwordChangedAt: null,
    blockedAt: null,
    blockedReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  it('lists users with pagination metadata', async () => {
    repository.list.mockResolvedValue({ items: [sampleUser], total: 1 });

    const result = await service.listUsers(1, 20);

    expect(repository.list).toHaveBeenCalledWith({ skip: 0, take: 20 });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.items[0]?.email).toBe('user@dripplex.com');
  });

  it('throws when user is missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getByIdOrThrow(sampleUser.id)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  // The soft-delete test moved to account-deletion.service.spec.ts along with
  // the behaviour. UsersService no longer has a delete: the old one set
  // deletedAt and nothing else, and deleting an account safely means checking
  // for trips in progress, releasing the email and phone, and leaving an audit
  // record — none of which belong behind a bare repository call.
});
