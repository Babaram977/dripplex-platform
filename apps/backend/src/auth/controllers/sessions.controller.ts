import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SessionManagementService } from '../services/session-management.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { AuthenticatedUser } from '../auth.types';
import type { ListSessionsResponse } from '@dripplex/types';
import type { Request } from 'express';

@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessionManagementService: SessionManagementService) {}

  @Get()
  @RequirePermissions('auth:sessions:read')
  public async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ListSessionsResponse>> {
    const data = await this.sessionManagementService.listSessions(
      user.id,
      user.sid,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('auth:sessions:revoke')
  public async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.sessionManagementService.revokeSession(
      user.id,
      sessionId,
      this.auditContext(request, user.id),
    );
  }

  @Delete()
  @RequirePermissions('auth:sessions:revoke')
  public async revokeAllExceptCurrent(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ revokedCount: number }>> {
    const data = await this.sessionManagementService.revokeAllExceptCurrent(
      user.id,
      user.sid,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId: string,
  ): { ipAddress?: string; userAgent?: string; userId: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
    const userAgent = request.headers['user-agent'];

    return {
      userId,
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}
