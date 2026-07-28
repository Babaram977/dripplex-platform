import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { SmartSearchQueryDto } from '../../common/search/dto/smart-search-query.dto';

import { CustomerMerchantsService } from './customer-merchants.service';
import { BrowseMerchantsQueryDto } from './dto/browse-merchants-query.dto';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  CursorPaginatedResult,
  MerchantDetailDto,
  MerchantSummaryDto,
  SmartSearchResult,
} from '@dripplex/types';

@Controller()
@Public()
export class CustomerMerchantsController {
  constructor(private readonly merchantsService: CustomerMerchantsService) {}

  @Get('merchants')
  public async browse(
    @Query() query: BrowseMerchantsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<MerchantSummaryDto>>> {
    const data = await this.merchantsService.browse(query);
    return { success: true, data };
  }

  @Get('merchants/smart-search')
  public async smartSearch(
    @Query() query: SmartSearchQueryDto,
  ): Promise<ApiSuccessResponse<SmartSearchResult<MerchantSummaryDto>>> {
    const data = await this.merchantsService.smartSearch(query);
    return { success: true, data };
  }

  @Get('merchants/:id')
  public async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ): Promise<ApiSuccessResponse<MerchantDetailDto>> {
    const fromLocation =
      lat !== undefined &&
      lng !== undefined &&
      !Number.isNaN(Number(lat)) &&
      !Number.isNaN(Number(lng))
        ? { lat: Number(lat), lng: Number(lng) }
        : undefined;
    const data = await this.merchantsService.getMerchantDetail(id, fromLocation);
    return { success: true, data };
  }
}
