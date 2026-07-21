import { Injectable } from '@nestjs/common';
import { OnboardingStatus } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import type {
  PortalRegistrationInput,
  PortalRegistrationResult,
  RegistrationRepository,
} from './registration.repository';

@Injectable()
export class PrismaRegistrationRepository implements RegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async registerPortalUser(
    input: PortalRegistrationInput,
  ): Promise<PortalRegistrationResult> {
    const role = await this.prisma.role.findFirst({
      where: { name: input.roleName, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundDomainException(`Role ${input.roleName} is not configured`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          status: input.status,
          registrationChannel: input.registrationChannel,
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          roles: {
            create: {
              roleId: role.id,
            },
          },
        },
      });

      let profileId: string | undefined;
      let onboardingId: string | undefined;

      switch (input.portal) {
        case 'customer': {
          const profile = await tx.customerProfile.create({
            data: { userId: user.id },
          });
          profileId = profile.id;
          break;
        }
        case 'merchant': {
          const profile = await tx.merchantProfile.create({
            data: { userId: user.id },
          });
          const onboarding = await tx.merchantOnboarding.create({
            data: {
              merchantProfileId: profile.id,
              status: OnboardingStatus.DRAFT,
            },
          });
          profileId = profile.id;
          onboardingId = onboarding.id;
          break;
        }
        case 'rider': {
          const profile = await tx.riderProfile.create({
            data: { userId: user.id },
          });
          const onboarding = await tx.riderOnboarding.create({
            data: {
              riderProfileId: profile.id,
              status: OnboardingStatus.DRAFT,
            },
          });
          profileId = profile.id;
          onboardingId = onboarding.id;
          break;
        }
        case 'driver': {
          const profile = await tx.driverProfile.create({
            data: { userId: user.id },
          });
          const onboarding = await tx.driverOnboarding.create({
            data: {
              driverProfileId: profile.id,
              status: OnboardingStatus.DRAFT,
            },
          });
          profileId = profile.id;
          onboardingId = onboarding.id;
          break;
        }
      }

      return {
        userId: user.id,
        email: user.email,
        status: user.status,
        profileId,
        ...(onboardingId !== undefined ? { onboardingId } : {}),
      };
    });
  }
}
