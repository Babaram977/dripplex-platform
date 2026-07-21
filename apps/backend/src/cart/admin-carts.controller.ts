import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { CART_PERMISSIONS } from './cart.constants';
import { toCartDto } from './cart.mapper';
import { CART_REPOSITORY, type CartRepository } from './repositories/cart.repository';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CartDto } from '@dripplex/types';

/** Admin read-only cart access. No mutations in S1-C10. */
@Controller('admin/carts')
export class AdminCartsController {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepository,
  ) {}

  @Get(':id')
  @RequirePermissions(CART_PERMISSIONS.ADMIN_READ)
  public async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CartDto>> {
    const cart = await this.cartRepository.findById(id);
    if (!cart) {
      throw new NotFoundDomainException('Cart not found');
    }
    return { success: true, data: toCartDto(cart) };
  }
}
