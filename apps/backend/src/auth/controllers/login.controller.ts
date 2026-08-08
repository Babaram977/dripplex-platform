import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/permissions.decorator';
import { PortalLoginDto } from '../dto/portal-login.dto';
import { LoginService } from '../services/login.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PortalLoginResponse } from '../auth-login.types';
import type { Request } from 'express';

@Controller('auth/login')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post('customer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginCustomer(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginCustomer(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('merchant')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginMerchant(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginMerchant(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('rider')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginRider(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginRider(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('driver')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginDriver(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginDriver(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('admin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginAdmin(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginAdmin(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('operations')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async loginOperations(
    @Body() dto: PortalLoginDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.loginService.loginOperations(dto, this.auditContext(request));
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
