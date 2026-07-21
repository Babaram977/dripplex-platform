import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ADDRESS_PERMISSIONS } from './address.constants';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type {
  AddressListResponse,
  CustomerAddressDto,
  DefaultAddressResponse,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerAddressDto>> {
    const data = await this.addressService.create(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<AddressListResponse>> {
    const data = await this.addressService.list(user.id);
    return { success: true, data };
  }

  @Get('default')
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async getDefault(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DefaultAddressResponse>> {
    const data = await this.addressService.getDefault(user.id);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerAddressDto>> {
    const data = await this.addressService.get(user.id, id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerAddressDto>> {
    const data = await this.addressService.update(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.addressService.delete(user.id, id, this.auditContext(request, user.id));
  }

  @Patch(':id/default')
  @RequirePermissions(ADDRESS_PERMISSIONS.MANAGE)
  public async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerAddressDto>> {
    const data = await this.addressService.setDefault(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
