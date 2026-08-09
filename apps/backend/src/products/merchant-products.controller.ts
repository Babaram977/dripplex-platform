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
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { MerchantModuleEnabledGuard } from '../merchants/guards/merchant-module-enabled.guard';

import { AddProductImageDto } from './dto/add-product-image.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListMerchantProductsQueryDto } from './dto/list-merchant-products-query.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { SetOutOfStockDto } from './dto/set-out-of-stock.dto';
import { UpdateProductInventoryDto } from './dto/update-product-inventory.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MerchantProductsService } from './merchant-products.service';
import { PRODUCT_PERMISSIONS } from './product.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult, ProductDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('merchant/products')
@RequirePermissions(PRODUCT_PERMISSIONS.MANAGE)
@UseGuards(MerchantModuleEnabledGuard)
export class MerchantProductsController {
  constructor(private readonly productsService: MerchantProductsService) {}

  @Get()
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMerchantProductsQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<ProductDto>>> {
    const data = await this.productsService.listOwnProducts(user.id, query);
    return { success: true, data };
  }

  @Get(':id')
  public async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.getOwnProduct(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.createProduct(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.updateProduct(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  public async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ deleted: true }>> {
    await this.productsService.deleteProduct(user.id, id, this.auditContext(request, user.id));
    return { success: true, data: { deleted: true } };
  }

  @Post(':id/publish')
  public async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.publishProduct(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/unpublish')
  public async unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.unpublishProduct(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  public async addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProductImageDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.addImage(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id/images/:imageId')
  public async removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.removeImage(
      user.id,
      id,
      imageId,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/images/reorder')
  public async reorderImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderProductImagesDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.reorderImages(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/variants')
  @HttpCode(HttpStatus.CREATED)
  public async createVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductVariantDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.createVariant(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/variants/:variantId')
  public async updateVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.updateVariant(
      user.id,
      id,
      variantId,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id/variants/:variantId')
  public async removeVariant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.removeVariant(
      user.id,
      id,
      variantId,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/inventory')
  public async updateInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductInventoryDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.updateInventory(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/stock-status')
  public async setOutOfStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOutOfStockDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ProductDto>> {
    const data = await this.productsService.setOutOfStock(
      user.id,
      id,
      dto.outOfStock,
      this.auditContext(request, user.id),
    );
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
