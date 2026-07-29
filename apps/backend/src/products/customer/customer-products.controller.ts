import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { SmartSearchQueryDto } from '../../common/search/dto/smart-search-query.dto';

import { CustomerProductsService } from './customer-products.service';
import { BrowseProductsQueryDto } from './dto/browse-products-query.dto';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  BrandDto,
  CategoryDto,
  CursorPaginatedResult,
  ProductDetailDto,
  ProductSummaryDto,
  SmartSearchResult,
} from '@dripplex/types';

@Controller()
@Public()
export class CustomerProductsController {
  constructor(private readonly productsService: CustomerProductsService) {}

  @Get('products')
  public async browse(
    @Query() query: BrowseProductsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>> {
    const data = await this.productsService.browse(query);
    return { success: true, data };
  }

  @Get('products/featured')
  public async featured(
    @Query() query: BrowseProductsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>> {
    const data = await this.productsService.browse(query, {
      isFeatured: true,
      forceSort: 'newest',
    });
    return { success: true, data };
  }

  @Get('products/new-arrivals')
  public async newArrivals(
    @Query() query: BrowseProductsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>> {
    const data = await this.productsService.browse(query, { forceSort: 'newest' });
    return { success: true, data };
  }

  @Get('products/trending')
  public async trending(
    @Query() query: BrowseProductsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>> {
    const data = await this.productsService.browse(query, { forceSort: 'popular' });
    return { success: true, data };
  }

  @Get('products/recommended')
  public async recommended(
    @Query() query: BrowseProductsQueryDto,
  ): Promise<ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>> {
    const data = await this.productsService.browse(query, { forceSort: 'recommended' });
    return { success: true, data };
  }

  @Get('products/smart-search')
  public async smartSearch(
    @Query() query: SmartSearchQueryDto,
  ): Promise<ApiSuccessResponse<SmartSearchResult<ProductSummaryDto>>> {
    const data = await this.productsService.smartSearch(query);
    return { success: true, data };
  }

  @Get('categories')
  public async categories(): Promise<ApiSuccessResponse<CategoryDto[]>> {
    const data = await this.productsService.listCategories();
    return { success: true, data };
  }

  @Get('brands')
  public async brands(): Promise<ApiSuccessResponse<BrandDto[]>> {
    const data = await this.productsService.listBrands();
    return { success: true, data };
  }

  @Get('products/:id')
  public async detail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<ProductDetailDto>> {
    const data = await this.productsService.getProductDetail(id);
    return { success: true, data };
  }

  @Get('products/:id/similar')
  public async similar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<ProductSummaryDto[]>> {
    const data = await this.productsService.listSimilar(id);
    return { success: true, data };
  }
}
