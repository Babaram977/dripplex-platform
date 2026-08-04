import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DELIVERY_PERMISSIONS } from './delivery.constants';
import { DeliveryService } from './delivery.service';

import type { CustomerDeliveryDto, EtaDto, TrackingDto } from './delivery.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('customer/orders')
export class CustomerDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get(':id/delivery')
  @RequirePermissions(DELIVERY_PERMISSIONS.CUSTOMER_READ)
  public async getDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerDeliveryDto>> {
    const data = await this.deliveryService.getCustomerDelivery(user.id, id);
    return { success: true, data };
  }

  @Get(':id/tracking')
  @RequirePermissions(DELIVERY_PERMISSIONS.CUSTOMER_READ)
  public async getTracking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<TrackingDto[]>> {
    const data = await this.deliveryService.getCustomerTracking(user.id, id);
    return { success: true, data };
  }

  @Get(':id/eta')
  @RequirePermissions(DELIVERY_PERMISSIONS.CUSTOMER_READ)
  public async getEta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<EtaDto>> {
    const data = await this.deliveryService.getCustomerEta(user.id, id);
    return { success: true, data };
  }
}
