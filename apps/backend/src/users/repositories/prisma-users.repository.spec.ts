import { UserStatus } from '@prisma/client';

import { makeSyntheticEmail } from '../../auth/utils/synthetic-email.util';

import { PrismaUsersRepository } from './prisma-users.repository';

import type { PrismaService } from '../../prisma/prisma.service';
import type { User } from '@prisma/client';

describe('PrismaUsersRepository', () => {
  const baseUser = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: UserStatus.PENDING_VERIFICATION,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
  } as unknown as User;

  function buildRepository(): {
    repository: PrismaUsersRepository;
    prisma: { user: { findFirst: jest.Mock; update: jest.Mock } };
  } {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const repository = new PrismaUsersRepository(prisma as unknown as PrismaService);

    return { repository, prisma };
  }

  describe('activateIfVerificationsComplete', () => {
    it('treats a synthetic placeholder email as trivially verified', async () => {
      const { repository, prisma } = buildRepository();
      const phoneOnlyUser = {
        ...baseUser,
        email: makeSyntheticEmail('+2348012345678'),
        phoneVerifiedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValue(phoneOnlyUser);
      prisma.user.update.mockResolvedValue({ ...phoneOnlyUser, status: UserStatus.ACTIVE });

      const result = await repository.activateIfVerificationsComplete(baseUser.id, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { status: UserStatus.ACTIVE },
      });
      expect(result.status).toBe(UserStatus.ACTIVE);
    });

    it('does not activate a real email that has not been verified', async () => {
      const { repository, prisma } = buildRepository();
      const realEmailUser = { ...baseUser, email: 'ada@example.com' };
      prisma.user.findFirst.mockResolvedValue(realEmailUser);

      const result = await repository.activateIfVerificationsComplete(baseUser.id, false);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.status).toBe(UserStatus.PENDING_VERIFICATION);
    });

    it('still requires phone verification when the portal demands it, synthetic email notwithstanding', async () => {
      const { repository, prisma } = buildRepository();
      const phoneUnverifiedUser = {
        ...baseUser,
        email: makeSyntheticEmail('+2348012345678'),
        phoneVerifiedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(phoneUnverifiedUser);

      const result = await repository.activateIfVerificationsComplete(baseUser.id, true);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.status).toBe(UserStatus.PENDING_VERIFICATION);
    });
  });
});
