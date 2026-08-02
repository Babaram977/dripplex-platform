import { Injectable } from '@nestjs/common';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import type { RegisterDeviceTokenDto } from './dto/device-token.dto';
import type { DeviceToken } from '@prisma/client';

/**
 * DPX-CORE-001 device registry — a genuinely new capability, not an
 * extension of anything that existed before this pass (confirmed via
 * schema-wide audit: no device/push-token model existed anywhere). One
 * user can register several devices (phone, tablet, web); a push send
 * fans out to every `active` token for that user, not just the most
 * recent one.
 */
@Injectable()
export class DeviceRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  public async register(userId: string, dto: RegisterDeviceTokenDto): Promise<DeviceToken> {
    return await this.prisma.deviceToken.upsert({
      where: {
        userId_platform_token: { userId, platform: dto.platform, token: dto.token },
      },
      update: { active: true, lastSeenAt: new Date() },
      create: {
        userId,
        platform: dto.platform,
        token: dto.token,
        active: true,
      },
    });
  }

  public list(userId: string): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({
      where: { userId, active: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  public async deactivate(userId: string, deviceTokenId: string): Promise<void> {
    const device = await this.prisma.deviceToken.findFirst({
      where: { id: deviceTokenId, userId },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundDomainException('Device token not found', { deviceTokenId });
    }
    await this.prisma.deviceToken.update({
      where: { id: deviceTokenId },
      data: { active: false },
    });
  }
}
