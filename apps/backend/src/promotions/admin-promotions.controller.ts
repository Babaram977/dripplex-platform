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
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';
import { PROMOTION_PERMISSIONS } from './promotion.constants';
import { PromotionsService } from './promotions.service';

import type { PromotionDto } from './promotion.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.create(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async list(
    @Query() query: ListPromotionsQueryDto,
  ): Promise<ApiSuccessResponse<PromotionDto[]>> {
    const data = await this.promotionsService.list(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.get(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.update(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.delete(
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
