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
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  AddWishlistItemDto,
  CreateWishlistDto,
  MoveWishlistToCartDto,
  UpdateWishlistDto,
  UpdateWishlistItemDto,
} from './dto/wishlist.dto';
import { WISHLIST_PERMISSIONS } from './wishlist.constants';
import { WishlistService } from './wishlist.service';

import type { MoveWishlistToCartResultDto, WishlistDto, WishlistItemDto } from './wishlist.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/wishlists')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWishlistDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.create(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WishlistDto[]>> {
    const data = await this.wishlistService.list(user.id);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.get(user.id, id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWishlistDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.update(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.delete(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddWishlistItemDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistItemDto>> {
    const data = await this.wishlistService.addItem(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateWishlistItemDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistItemDto>> {
    const data = await this.wishlistService.updateItem(
      user.id,
      id,
      itemId,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ removed: true; itemId: string }>> {
    const data = await this.wishlistService.removeItem(
      user.id,
      id,
      itemId,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/share')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.share(user.id, id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post(':id/move-to-cart')
  @RequirePermissions(WISHLIST_PERMISSIONS.CUSTOMER_MANAGE)
  public async moveToCart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveWishlistToCartDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MoveWishlistToCartResultDto>> {
    const data = await this.wishlistService.moveToCart(
      user.id,
      id,
      dto,
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
