import { Injectable } from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CartRepository,
  CartWithItems,
  CreateCartInput,
  CreateCartItemInput,
  UpdateCartItemInput,
  UpdateCartTotalsInput,
} from './cart.repository';
import type { Cart, CartItem } from '@prisma/client';

@Injectable()
export class PrismaCartRepository implements CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findActiveByCustomerId(customerId: string): Promise<CartWithItems | null> {
    return await this.prisma.cart.findFirst({
      where: { customerId, status: CartStatus.ACTIVE },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  public async findById(id: string): Promise<CartWithItems | null> {
    return await this.prisma.cart.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  public async findByIdForCustomer(id: string, customerId: string): Promise<CartWithItems | null> {
    return await this.prisma.cart.findFirst({
      where: { id, customerId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  public async createCart(input: CreateCartInput): Promise<CartWithItems> {
    return await this.prisma.cart.create({
      data: {
        customerId: input.customerId,
        merchantId: input.merchantId,
        currency: input.currency,
        status: CartStatus.ACTIVE,
      },
      include: { items: true },
    });
  }

  public async addItem(input: CreateCartItemInput): Promise<CartItem> {
    return await this.prisma.cartItem.create({
      data: {
        cartId: input.cartId,
        productId: input.productId,
        productNameSnapshot: input.productNameSnapshot,
        unitPriceSnapshot: input.unitPriceSnapshot,
        quantity: input.quantity,
        subtotal: input.subtotal,
        ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
        ...(input.skuSnapshot !== undefined ? { skuSnapshot: input.skuSnapshot } : {}),
        ...(input.imageSnapshot !== undefined ? { imageSnapshot: input.imageSnapshot } : {}),
      },
    });
  }

  public async updateItem(id: string, input: UpdateCartItemInput): Promise<CartItem> {
    return await this.prisma.cartItem.update({
      where: { id },
      data: {
        quantity: input.quantity,
        subtotal: input.subtotal,
      },
    });
  }

  public async removeItem(id: string): Promise<void> {
    await this.prisma.cartItem.delete({ where: { id } });
  }

  public async findItemById(id: string): Promise<CartItem | null> {
    return await this.prisma.cartItem.findUnique({ where: { id } });
  }

  public async findDuplicateItem(
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<CartItem | null> {
    return await this.prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        variantId: variantId ?? null,
      },
    });
  }

  public async clearItems(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }

  public async updateTotals(cartId: string, totals: UpdateCartTotalsInput): Promise<Cart> {
    return await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
      },
    });
  }

  public async updateStatus(cartId: string, status: CartStatus): Promise<Cart> {
    return await this.prisma.cart.update({
      where: { id: cartId },
      data: { status },
    });
  }

  public async abandonActiveCarts(customerId: string): Promise<number> {
    const result = await this.prisma.cart.updateMany({
      where: { customerId, status: CartStatus.ACTIVE },
      data: { status: CartStatus.ABANDONED },
    });
    return result.count;
  }
}

export type { Prisma };
