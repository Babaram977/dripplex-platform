import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DeviceRegistryService } from './device-registry.service';
import { RegisterDeviceTokenDto } from './dto/device-token.dto';
import { NOTIFICATION_CENTER_PERMISSIONS } from './notification-center.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { DeviceToken } from '@prisma/client';

/** Same customer-scoped permissions as the rest of notification-center — device
 * registration is a facet of managing your own notification settings, not a
 * distinct permission surface. */
@Controller('customer/devices')
export class CustomerDevicesController {
  constructor(private readonly deviceRegistry: DeviceRegistryService) {}

  @Post()
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<ApiSuccessResponse<DeviceToken>> {
    const data = await this.deviceRegistry.register(user.id, dto);
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DeviceToken[]>> {
    const data = await this.deviceRegistry.list(user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deviceRegistry.deactivate(user.id, id);
  }
}
