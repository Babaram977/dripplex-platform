import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../common/decorators/permissions.decorator';

import { CmsService } from './cms.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CmsContentDto } from '@dripplex/types';

@Controller('cms')
export class CmsPublicController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages/:slug')
  @Public()
  public async getPage(@Param('slug') slug: string): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.getPublishedPageBySlug(slug);
    return { success: true, data };
  }

  @Get('banners')
  @Public()
  public async getBanners(): Promise<ApiSuccessResponse<CmsContentDto[]>> {
    const data = await this.cmsService.getPublishedBanners();
    return { success: true, data };
  }
}
