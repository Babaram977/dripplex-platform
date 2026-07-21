import { Controller, Get, Param } from '@nestjs/common';

import { WishlistService } from './wishlist.service';

import type { WishlistDto } from './wishlist.mapper';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('shared')
export class SharedWishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get(':token')
  public async getShared(@Param('token') token: string): Promise<ApiSuccessResponse<WishlistDto>> {
    const data = await this.wishlistService.getShared(token);
    return { success: true, data };
  }
}
