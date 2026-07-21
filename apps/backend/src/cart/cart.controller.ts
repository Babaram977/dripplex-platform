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

import { CART_PERMISSIONS } from './cart.constants';
import { CartService } from './cart.service';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CartDto, CartSummaryDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async getCart(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CartDto | null>> {
    const data = await this.cartService.getActiveCart(user.id);
    return { success: true, data };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCartItemDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CartDto>> {
    const data = await this.cartService.addItem(user.id, dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Patch('items/:id')
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CartDto>> {
    const data = await this.cartService.updateItem(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete('items/:id')
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CartDto>> {
    const data = await this.cartService.removeItem(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete()
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async clearCart(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CartSummaryDto>> {
    const data = await this.cartService.clearCart(user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('recalculate')
  @RequirePermissions(CART_PERMISSIONS.MANAGE)
  public async recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CartDto>> {
    const data = await this.cartService.recalculate(user.id, this.auditContext(request, user.id));
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
