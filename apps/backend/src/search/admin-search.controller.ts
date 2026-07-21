import { Body, Controller, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { UpsertSearchDocumentDto } from './dto/upsert-search-document.dto';
import { SEARCH_PERMISSIONS } from './search.constants';
import { SearchService } from './search.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { SearchDocument } from '@prisma/client';
import type { Request } from 'express';

@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('documents')
  @RequirePermissions(SEARCH_PERMISSIONS.ADMIN_MANAGE)
  public async upsertDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSearchDocumentDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SearchDocument>> {
    const data = await this.searchService.upsertDocument(dto, this.auditContext(request, user.id));
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
