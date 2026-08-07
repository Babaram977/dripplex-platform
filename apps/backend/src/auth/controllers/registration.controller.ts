import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/permissions.decorator';
import { PortalRegistrationDto, RiderDriverRegistrationDto } from '../dto/portal-registration.dto';
import { RegistrationService } from '../services/registration.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RegistrationResponse } from '../auth-registration.types';
import type { AuthenticatedUser } from '../auth.types';
import type { Request } from 'express';

@Controller('auth/register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Public()
  @Post('customer')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async registerCustomer(
    @Body() dto: PortalRegistrationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RegistrationResponse>> {
    const data = await this.registrationService.registerCustomer(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('merchant')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async registerMerchant(
    @Body() dto: PortalRegistrationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RegistrationResponse>> {
    const data = await this.registrationService.registerMerchant(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('rider')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async registerRider(
    @Body() dto: RiderDriverRegistrationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RegistrationResponse>> {
    const data = await this.registrationService.registerRider(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('driver')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async registerDriver(
    @Body() dto: RiderDriverRegistrationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RegistrationResponse>> {
    const data = await this.registrationService.registerDriver(dto, this.auditContext(request));
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;

    const userAgent = request.headers['user-agent'];
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}

/**
 * "Become a Driver" / "Become a Merchant" -- authenticated (no `@Public()`),
 * unlike every endpoint above. Grants a role to the CURRENT user's existing
 * account rather than creating a new one. This is the Super App's
 * single-account, multi-role model: a customer becomes a driver without a
 * second account, second login, or losing their existing profile/wallet.
 * See `RegistrationService.addRole` for why the always-new-account
 * `/auth/register/*` endpoints above can't do this (they reject on
 * already-registered email/phone).
 */
@Controller('auth/roles')
export class RoleGrantController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('driver')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async becomeDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ role: string; profileId: string; onboardingId: string }>> {
    const data = await this.registrationService.addRole(
      user.id,
      'driver',
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Post('merchant')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async becomeMerchant(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ role: string; profileId: string; onboardingId: string }>> {
    const data = await this.registrationService.addRole(
      user.id,
      'merchant',
      this.auditContext(request),
    );
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;

    const userAgent = request.headers['user-agent'];
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}
