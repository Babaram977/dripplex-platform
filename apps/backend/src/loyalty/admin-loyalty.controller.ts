import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CreateLoyaltyAchievementDto, UpdateLoyaltyAchievementDto } from './dto/loyalty.dto';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';
import {
  LoyaltyService,
  type LoyaltyAccountOverview,
  type LoyaltyAchievementDto,
} from './loyalty.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('admin/loyalty')
export class AdminLoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('achievements')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async listAchievements(): Promise<ApiSuccessResponse<LoyaltyAchievementDto[]>> {
    const data = await this.loyaltyService.listAchievements();
    return { success: true, data };
  }

  @Get(':userId')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async getUserLoyalty(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiSuccessResponse<LoyaltyAccountOverview>> {
    const data = await this.loyaltyService.getCustomerOverview(userId);
    return { success: true, data };
  }

  @Post('achievements')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async createAchievement(
    @Body() dto: CreateLoyaltyAchievementDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyAchievementDto>> {
    const data = await this.loyaltyService.createAchievement({
      code: dto.code,
      name: dto.name,
      pointsReward: dto.pointsReward,
      active: dto.active,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      context: this.auditContext(request),
    });
    return { success: true, data };
  }

  @Patch('achievements/:id')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async updateAchievement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoyaltyAchievementDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyAchievementDto>> {
    const data = await this.loyaltyService.updateAchievement(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.pointsReward !== undefined ? { pointsReward: dto.pointsReward } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      context: this.auditContext(request),
    });
    return { success: true, data };
  }

  @Delete('achievements/:id')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async deleteAchievement(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ deleted: true }>> {
    const data = await this.loyaltyService.deleteAchievement(id, this.auditContext(request));
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
