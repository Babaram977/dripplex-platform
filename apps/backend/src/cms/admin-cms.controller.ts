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

import { CMS_PERMISSIONS } from './cms.constants';
import { CmsService } from './cms.service';
import {
  CmsContentListQueryDto,
  CreateCmsContentDto,
  ScheduleCmsContentDto,
  UpdateCmsContentDto,
} from './dto/cms.dto';

import type { AuditContext } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CmsContentDto, PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/cms/contents')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async listContents(
    @Query() query: CmsContentListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<CmsContentDto>>> {
    const data = await this.cmsService.listContents(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async getContent(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.getContent(id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async createContent(
    @Body() dto: CreateCmsContentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.createContent(dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async updateContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCmsContentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.updateContent(id, dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post(':id/publish')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async publishContent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.publishContent(id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post(':id/schedule')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async scheduleContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.scheduleContent(id, dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post(':id/archive')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async archiveContent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.archiveContent(id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions(CMS_PERMISSIONS.ADMIN_MANAGE)
  public async deleteContent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.softDeleteContent(id, this.auditContext(request, user.id));
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
