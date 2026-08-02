import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  CampaignAnalyticsQueryDto,
  CloneCampaignDto,
  CreatePromotionDto,
  ListPromotionsQueryDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';
import { PROMOTION_PERMISSIONS } from './promotion.constants';
import { PromotionsService } from './promotions.service';

import type {
  PromotionAnalyticsDto,
  PromotionDto,
  PromotionLeaderboardEntryDto,
} from './promotion.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request, Response } from 'express';

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

  @Get('analytics/top')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async topCampaigns(
    @Query() query: CampaignAnalyticsQueryDto,
  ): Promise<ApiSuccessResponse<PromotionLeaderboardEntryDto[]>> {
    const data = await this.promotionsService.getTopCampaigns(query);
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

  @Get(':id/analytics')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async analytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CampaignAnalyticsQueryDto,
  ): Promise<ApiSuccessResponse<PromotionAnalyticsDto>> {
    const data = await this.promotionsService.getCampaignAnalytics(id, query);
    return { success: true, data };
  }

  @Get(':id/export')
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  @Header('Content-Type', 'text/csv')
  public async exportCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const csv = await this.promotionsService.exportRedemptionsCsv(id);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="promotion-${id}-redemptions.csv"`,
    );
    return csv;
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

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.pause(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.resume(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.archive(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/force-expire')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async forceExpire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.forceExpire(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PROMOTION_PERMISSIONS.ADMIN_MANAGE)
  public async clone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneCampaignDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PromotionDto>> {
    const data = await this.promotionsService.clone(
      user.id,
      id,
      dto,
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
