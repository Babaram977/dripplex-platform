import { Controller, Get, Param } from '@nestjs/common';

import { CmsService } from '../../cms/cms.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { CmsContentDto } from '@dripplex/types';

/** Driver Slice 2 item 7 — Help Centre (founder-scoped 2026-08-04): reuses
 * the existing Cms module rather than a new content system — read-only
 * here, authoring stays on the existing AdminCmsController
 * (`admin:cms:manage`). See `CmsContentType.DRIVER_FAQ`/
 * `DRIVER_STATIC_PAGE`'s schema doc comment for the content shape. */
@Controller('driver/help')
@RequirePermissions(DRIVER_PERMISSIONS.HELP_READ)
export class DriverHelpController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  public async list(): Promise<ApiSuccessResponse<CmsContentDto[]>> {
    const data = await this.cmsService.getPublishedDriverHelp();
    return { success: true, data };
  }

  @Get(':slug')
  public async getBySlug(@Param('slug') slug: string): Promise<ApiSuccessResponse<CmsContentDto>> {
    const data = await this.cmsService.getPublishedPageBySlug(slug);
    return { success: true, data };
  }
}
