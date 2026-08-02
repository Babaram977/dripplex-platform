import { DevicePlatform } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { DeviceRegistryService } from './device-registry.service';

import type { PrismaService } from '../prisma/prisma.service';

const userId = '22222222-2222-4222-8222-222222222222';
const deviceTokenId = '44444444-4444-4444-8444-444444444444';

describe('DeviceRegistryService', () => {
  let prisma: {
    deviceToken: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: DeviceRegistryService;

  beforeEach(() => {
    prisma = {
      deviceToken: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new DeviceRegistryService(prisma as unknown as PrismaService);
  });

  it('upserts on (userId, platform, token) so re-registering the same device reactivates it', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({ id: 'd1' });

    await service.register(userId, { platform: DevicePlatform.ANDROID, token: 'tok-1' });

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: {
        userId_platform_token: { userId, platform: DevicePlatform.ANDROID, token: 'tok-1' },
      },
      update: { active: true, lastSeenAt: expect.any(Date) },
      create: { userId, platform: DevicePlatform.ANDROID, token: 'tok-1', active: true },
    });
  });

  it('lists only active devices for the user, most recent first', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([]);

    await service.list(userId);

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: { userId, active: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  });

  it('deactivates a device only if it belongs to the requesting user', async () => {
    prisma.deviceToken.findFirst.mockResolvedValue({ id: deviceTokenId });
    prisma.deviceToken.update.mockResolvedValue({ id: deviceTokenId, active: false });

    await service.deactivate(userId, deviceTokenId);

    expect(prisma.deviceToken.findFirst).toHaveBeenCalledWith({
      where: { id: deviceTokenId, userId },
      select: { id: true },
    });
    expect(prisma.deviceToken.update).toHaveBeenCalledWith({
      where: { id: deviceTokenId },
      data: { active: false },
    });
  });

  it('throws when deactivating a device that does not belong to the user', async () => {
    prisma.deviceToken.findFirst.mockResolvedValue(null);

    await expect(service.deactivate(userId, deviceTokenId)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
    expect(prisma.deviceToken.update).not.toHaveBeenCalled();
  });
});
