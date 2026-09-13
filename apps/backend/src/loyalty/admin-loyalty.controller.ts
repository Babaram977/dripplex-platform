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

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  AdjustLoyaltyPointsDto,
  CreateLoyaltyAchievementDto,
  UpdateLoyaltyAchievementDto,
  UpdateLoyaltyEarningProgrammeDto,
  UpdateLoyaltySettingDto,
} from './dto/loyalty.dto';
import {
  LoyaltyEarningService,
  type LoyaltyEarningImpactDto,
  type LoyaltyEarningProgrammeDto,
} from './loyalty-earning.service';
import { LoyaltySettingsService, type LoyaltySettingDto } from './loyalty-settings.service';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';
import {
  LoyaltyService,
  type LoyaltyAccountOverview,
  type LoyaltyAchievementDto,
} from './loyalty.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { LoyaltyEarnerPersona } from '@prisma/client';
import type { Request } from 'express';

@Controller('admin/loyalty')
export class AdminLoyaltyController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly settings: LoyaltySettingsService,
    private readonly earning: LoyaltyEarningService,
  ) {}

  /**
   * Whether a partner persona earns DX Points, and for what.
   *
   * Every programme is off until somebody switches it on, which is what Nora's
   * "approved programme" and "where a campaign permits" both mean in practice.
   */
  @Get('earning-programmes')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async listEarningProgrammes(): Promise<ApiSuccessResponse<LoyaltyEarningProgrammeDto[]>> {
    const data = await this.earning.list();
    return { success: true, data };
  }

  /**
   * What switching each programme on would commit DrippleX to.
   *
   * Served beside the programmes rather than folded into them: an operator
   * about to switch DRIVER on is asking a different question from one adjusting
   * a point size, and the answer is expensive enough to count separately.
   */
  @Get('earning-programmes/impact')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async earningProgrammeImpact(): Promise<ApiSuccessResponse<LoyaltyEarningImpactDto[]>> {
    const data = await this.earning.impact();
    return { success: true, data };
  }

  @Patch('earning-programmes/:persona')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async updateEarningProgramme(
    @Param('persona') persona: LoyaltyEarnerPersona,
    @Body() dto: UpdateLoyaltyEarningProgrammeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyEarningProgrammeDto>> {
    const data = await this.earning.update(persona, dto, user.id, {
      ...this.auditContext(request),
      userId: user.id,
    });
    return { success: true, data };
  }

  /**
   * What DX Points convert to, and whether they may.
   *
   * Founder decision 2026-09-11: the cash-out stays exactly as shipped, but
   * every number behind it is an Operations setting rather than a deployment.
   */
  @Get('settings')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async getSettings(): Promise<ApiSuccessResponse<LoyaltySettingDto>> {
    const data = await this.settings.get();
    return { success: true, data };
  }

  @Patch('settings')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async updateSettings(
    @Body() dto: UpdateLoyaltySettingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltySettingDto>> {
    const data = await this.settings.update(dto, user.id, {
      ...this.auditContext(request),
      userId: user.id,
    });
    return { success: true, data };
  }

  /**
   * Move a holder's balance by hand.
   *
   * This happens today anyway — an engineer running SQL — which leaves no audit
   * trail and no state anybody can count. Giving it an endpoint and its own
   * ledger state makes it visible rather than making it possible.
   *
   * A positive adjustment deliberately does not raise lifetime points, so an
   * apology cannot hand somebody a tier they did not earn; a negative one is
   * floored at the balance, because a loyalty balance is not a debt.
   */
  @Post('accounts/:userId/adjust')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async adjustPoints(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdjustLoyaltyPointsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ applied: number; balance: number }>> {
    const data = await this.loyaltyService.adjustPoints({
      userId,
      points: dto.points,
      reason: dto.reason,
      adminUserId: user.id,
      context: { ...this.auditContext(request), userId: user.id },
    });
    return { success: true, data };
  }

  @Get('achievements')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async listAchievements(): Promise<ApiSuccessResponse<LoyaltyAchievementDto[]>> {
    const data = await this.loyaltyService.listAchievements();
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

  /**
   * Declared last on purpose. `:userId` matches any single segment, so every
   * literal GET under `admin/loyalty` must be registered before it or Nest
   * hands the request here instead — silently, and only in the deployed app:
   * the startup log still prints the swallowed route as `Mapped`.
   *
   * That is not hypothetical. It is why `GET /admin/loyalty/nope` answers 401
   * rather than 404, which in turn made a 401 on `earning-programmes` prove
   * nothing about whether that route was reachable at all. The literal routes
   * happened to be declared above this one; nothing enforced it.
   *
   * Keep this handler at the bottom of the controller. Add new GETs above it.
   */
  @Get(':userId')
  @RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
  public async getUserLoyalty(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiSuccessResponse<LoyaltyAccountOverview>> {
    const data = await this.loyaltyService.getCustomerOverview(userId);
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
