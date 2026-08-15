import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DriverActivationService } from '../activation/driver-activation.service';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { DriversService } from '../drivers.service';
import { AcceptDriverAgreementDto } from '../dto/accept-driver-agreement.dto';
import { SubmitDriverKycDto } from '../dto/submit-driver-kyc.dto';
import { SubmitEmergencyContactDto } from '../dto/submit-emergency-contact.dto';
import { UpdateDriverProfileDto } from '../dto/update-driver-profile.dto';
import { OnboardingService } from '../onboarding/onboarding.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  DriverActivationEligibilityDto,
  DriverKycDto,
  DriverOnboardingDto,
  DriverPerformanceStatsDto,
  DriverProfileDto,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver')
export class DriverController {
  constructor(
    private readonly driversService: DriversService,
    private readonly onboardingService: OnboardingService,
    private readonly activationService: DriverActivationService,
  ) {}

  @Get('profile')
  @RequirePermissions(DRIVER_PERMISSIONS.KYC_MANAGE)
  public async getOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverProfileDto>> {
    const data = await this.driversService.getOwnProfile(user.id);
    return { success: true, data };
  }

  @Patch('profile')
  @RequirePermissions(DRIVER_PERMISSIONS.PROFILE_MANAGE)
  public async updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDriverProfileDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverProfileDto>> {
    const data = await this.driversService.updateOwnProfile(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('profile/performance')
  @RequirePermissions(DRIVER_PERMISSIONS.PROFILE_MANAGE)
  public async getOwnPerformanceStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverPerformanceStatsDto>> {
    const data = await this.driversService.getOwnPerformanceStats(user.id);
    return { success: true, data };
  }

  @Post('kyc')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(DRIVER_PERMISSIONS.KYC_MANAGE)
  public async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitDriverKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverKycDto>> {
    const data = await this.driversService.submitKyc(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('kyc')
  @RequirePermissions(DRIVER_PERMISSIONS.KYC_MANAGE)
  public async listOwnKyc(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverKycDto[]>> {
    const data = await this.driversService.listOwnKyc(user.id);
    return { success: true, data };
  }

  @Get('onboarding')
  @RequirePermissions(DRIVER_PERMISSIONS.ONBOARDING_MANAGE)
  public async getOwnOnboarding(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverOnboardingDto>> {
    const data = await this.onboardingService.getOwnOnboarding(user.id);
    return { success: true, data };
  }

  @Post('onboarding/emergency-contact')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.ONBOARDING_MANAGE)
  public async submitEmergencyContact(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitEmergencyContactDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverOnboardingDto>> {
    const data = await this.onboardingService.submitEmergencyContact(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('onboarding/agreement')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.ONBOARDING_MANAGE)
  public async acceptAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptDriverAgreementDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverOnboardingDto>> {
    const data = await this.onboardingService.acceptAgreement(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('onboarding/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.ONBOARDING_MANAGE)
  public async submitOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverOnboardingDto>> {
    const data = await this.onboardingService.submitForReview(
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('activation-eligibility')
  @RequirePermissions(DRIVER_PERMISSIONS.ONBOARDING_MANAGE)
  public async getOwnActivationEligibility(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverActivationEligibilityDto>> {
    const data = await this.activationService.checkEligibility(user.id);
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
