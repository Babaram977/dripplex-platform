import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateFraudListEntryDto,
  FraudListEntryQueryDto,
  FraudQueueQueryDto,
  ReviewFraudSignalDto,
  UpdateFraudListEntryDto,
  UpsertFraudThresholdDto,
} from './dto/fraud.dto';
import { FRAUD_PERMISSIONS } from './fraud.constants';
import { FraudService } from './fraud.service';

import type { AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type {
  FraudListEntryDto,
  FraudSignalDto,
  FraudThresholdDto,
  PaginatedResult,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/fraud')
export class AdminFraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('queue')
  @RequirePermissions(FRAUD_PERMISSIONS.SUPPORT_REVIEW)
  public async listQueue(
    @Query() query: FraudQueueQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<FraudSignalDto>>> {
    const data = await this.fraudService.listQueue(query);
    return { success: true, data };
  }

  @Post('signals/:id/review')
  @RequirePermissions(FRAUD_PERMISSIONS.SUPPORT_REVIEW)
  public async reviewSignal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFraudSignalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudSignalDto>> {
    const data = await this.fraudService.reviewSignal(id, dto, user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('signals/:id/clear')
  @RequirePermissions(FRAUD_PERMISSIONS.SUPPORT_REVIEW)
  public async clearSignal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudSignalDto>> {
    const data = await this.fraudService.clearSignal(id, user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('signals/:id/confirm')
  @RequirePermissions(FRAUD_PERMISSIONS.SUPPORT_REVIEW)
  public async confirmSignal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudSignalDto>> {
    const data = await this.fraudService.confirmSignal(id, user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Get('thresholds')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_CONFIGURE)
  public async listThresholds(): Promise<ApiSuccessResponse<FraudThresholdDto[]>> {
    const data = await this.fraudService.listThresholds();
    return { success: true, data };
  }

  @Patch('thresholds/:key')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_CONFIGURE)
  public async upsertThreshold(
    @Param('key') key: string,
    @Body() dto: UpsertFraudThresholdDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudThresholdDto>> {
    const data = await this.fraudService.upsertThreshold(key, dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Get('list-entries')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_MANAGE)
  public async listEntries(
    @Query() query: FraudListEntryQueryDto,
  ): Promise<ApiSuccessResponse<FraudListEntryDto[]>> {
    const data = await this.fraudService.listEntries(query);
    return { success: true, data };
  }

  @Post('list-entries')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_MANAGE)
  public async createEntry(
    @Body() dto: CreateFraudListEntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudListEntryDto>> {
    const data = await this.fraudService.createEntry(dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Patch('list-entries/:id')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_MANAGE)
  public async updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFraudListEntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudListEntryDto>> {
    const data = await this.fraudService.updateEntry(id, dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Delete('list-entries/:id')
  @RequirePermissions(FRAUD_PERMISSIONS.ADMIN_MANAGE)
  public async deleteEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FraudListEntryDto>> {
    const data = await this.fraudService.deleteEntry(id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  private auditContext(request: Request, userId: string): AuditContext {
    return {
      userId,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
