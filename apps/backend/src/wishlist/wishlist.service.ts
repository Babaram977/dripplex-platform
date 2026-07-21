import { randomBytes } from 'node:crypto';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { WishlistItemType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { WISHLIST_AUDIT_ACTIONS } from './wishlist.constants';
import {
  toWishlistDto,
  toWishlistItemDto,
  type MoveWishlistToCartResultDto,
  type WishlistDto,
  type WishlistItemDto,
  type WishlistWithItems,
} from './wishlist.mapper';

import type {
  AddWishlistItemDto,
  CreateWishlistDto,
  MoveWishlistToCartDto,
  UpdateWishlistDto,
  UpdateWishlistItemDto,
} from './dto/wishlist.dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class WishlistService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cartService: CartService,
    private readonly eventBus: DomainEventBus,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.INVENTORY_CHANGED, (event) =>
      this.handleInventoryChanged(event),
    );
  }

  public async create(
    customerId: string,
    dto: CreateWishlistDto,
    context: AuditContext,
  ): Promise<WishlistDto> {
    const wishlist = await this.prisma.wishlist.create({
      data: {
        customerId,
        name: dto.name.trim(),
      },
      include: { items: true },
    });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.CREATED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist',
        resourceId: wishlist.id,
      },
    );
    return toWishlistDto(wishlist);
  }

  public async list(customerId: string): Promise<WishlistDto[]> {
    const wishlists = await this.prisma.wishlist.findMany({
      where: { customerId, deletedAt: null },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    });
    return wishlists.map(toWishlistDto);
  }

  public async get(customerId: string, wishlistId: string): Promise<WishlistDto> {
    return toWishlistDto(await this.requireOwnedWishlist(customerId, wishlistId));
  }

  public async update(
    customerId: string,
    wishlistId: string,
    dto: UpdateWishlistDto,
    context: AuditContext,
  ): Promise<WishlistDto> {
    await this.requireOwnedWishlist(customerId, wishlistId);

    const data: Prisma.WishlistUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.isPublic !== undefined) {
      data.isPublic = dto.isPublic;
      if (dto.isPublic) {
        data.shareToken = await this.generateShareToken();
      }
    }

    if (Object.keys(data).length === 0) {
      throw new ValidationDomainException('At least one wishlist field must be updated');
    }

    const updated = await this.prisma.wishlist.update({
      where: { id: wishlistId },
      data,
      include: { items: true },
    });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.UPDATED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist',
        resourceId: wishlistId,
      },
    );
    return toWishlistDto(updated);
  }

  public async delete(
    customerId: string,
    wishlistId: string,
    context: AuditContext,
  ): Promise<WishlistDto> {
    await this.requireOwnedWishlist(customerId, wishlistId);
    const deleted = await this.prisma.wishlist.update({
      where: { id: wishlistId },
      data: { deletedAt: new Date(), isPublic: false },
      include: { items: true },
    });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.DELETED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist',
        resourceId: wishlistId,
      },
    );
    return toWishlistDto(deleted);
  }

  public async addItem(
    customerId: string,
    wishlistId: string,
    dto: AddWishlistItemDto,
    context: AuditContext,
  ): Promise<WishlistItemDto> {
    await this.requireOwnedWishlist(customerId, wishlistId);
    try {
      const item = await this.prisma.wishlistItem.create({
        data: {
          wishlistId,
          itemType: dto.itemType,
          itemId: dto.itemId,
          targetPrice: dto.targetPrice ?? null,
          notifyPriceDrop: dto.notifyPriceDrop ?? false,
          notifyBackInStock: dto.notifyBackInStock ?? false,
        },
      });
      await this.auditService.record(
        WISHLIST_AUDIT_ACTIONS.ITEM_ADDED,
        { ...context, userId: customerId },
        {
          resource: 'wishlist_item',
          resourceId: item.id,
          metadata: { wishlistId, itemType: item.itemType, itemId: item.itemId },
        },
      );
      return toWishlistItemDto(item);
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictDomainException('Wishlist item already exists');
      }
      throw error;
    }
  }

  public async updateItem(
    customerId: string,
    wishlistId: string,
    itemId: string,
    dto: UpdateWishlistItemDto,
    context: AuditContext,
  ): Promise<WishlistItemDto> {
    await this.requireOwnedItem(customerId, wishlistId, itemId);
    const item = await this.prisma.wishlistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.targetPrice !== undefined ? { targetPrice: dto.targetPrice } : {}),
        ...(dto.notifyPriceDrop !== undefined ? { notifyPriceDrop: dto.notifyPriceDrop } : {}),
        ...(dto.notifyBackInStock !== undefined
          ? { notifyBackInStock: dto.notifyBackInStock }
          : {}),
      },
    });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.ITEM_UPDATED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist_item',
        resourceId: itemId,
      },
    );
    return toWishlistItemDto(item);
  }

  public async removeItem(
    customerId: string,
    wishlistId: string,
    itemId: string,
    context: AuditContext,
  ): Promise<{ removed: true; itemId: string }> {
    await this.requireOwnedItem(customerId, wishlistId, itemId);
    await this.prisma.wishlistItem.delete({ where: { id: itemId } });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.ITEM_REMOVED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist_item',
        resourceId: itemId,
      },
    );
    return { removed: true, itemId };
  }

  public async share(
    customerId: string,
    wishlistId: string,
    context: AuditContext,
  ): Promise<WishlistDto> {
    await this.requireOwnedWishlist(customerId, wishlistId);
    const updated = await this.prisma.wishlist.update({
      where: { id: wishlistId },
      data: {
        isPublic: true,
        shareToken: await this.generateShareToken(),
      },
      include: { items: true },
    });
    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.SHARED,
      { ...context, userId: customerId },
      {
        resource: 'wishlist',
        resourceId: wishlistId,
        metadata: { shareToken: updated.shareToken },
      },
    );
    return toWishlistDto(updated);
  }

  public async getShared(shareToken: string): Promise<WishlistDto> {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { shareToken, isPublic: true, deletedAt: null },
      include: { items: true },
    });
    if (!wishlist) {
      throw new NotFoundDomainException('Shared wishlist not found');
    }
    return toWishlistDto(wishlist);
  }

  public async moveToCart(
    customerId: string,
    wishlistId: string,
    dto: MoveWishlistToCartDto,
    context: AuditContext,
  ): Promise<MoveWishlistToCartResultDto> {
    const wishlist = await this.requireOwnedWishlist(customerId, wishlistId);
    const productIds = wishlist.items
      .filter((item) => item.itemType === WishlistItemType.PRODUCT)
      .map((item) => item.itemId);
    const metadataByProductId = new Map(
      (dto.products ?? []).map((product) => [product.productId, product] as const),
    );
    const addedToCart: string[] = [];

    for (const productId of productIds) {
      const product = metadataByProductId.get(productId);
      if (!product) {
        continue;
      }
      await this.cartService.addItem(
        customerId,
        {
          merchantId: product.merchantId,
          productId: product.productId,
          ...(product.variantId !== undefined ? { variantId: product.variantId } : {}),
          productName: product.productName,
          ...(product.sku !== undefined ? { sku: product.sku } : {}),
          ...(product.imageUrl !== undefined ? { imageUrl: product.imageUrl } : {}),
          unitPrice: product.unitPrice,
          quantity: product.quantity ?? 1,
          ...(product.currency !== undefined ? { currency: product.currency } : {}),
        },
        context,
      );
      addedToCart.push(productId);
    }

    await this.auditService.record(
      WISHLIST_AUDIT_ACTIONS.MOVED_TO_CART,
      { ...context, userId: customerId },
      {
        resource: 'wishlist',
        resourceId: wishlistId,
        metadata: { productIds, addedToCart },
      },
    );

    return { wishlistId, productIds, addedToCart };
  }

  public async checkPriceDrop(productId: string, currentPrice: number): Promise<WishlistItemDto[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: {
        itemType: WishlistItemType.PRODUCT,
        itemId: productId,
        notifyPriceDrop: true,
        targetPrice: { not: null, gte: currentPrice },
        wishlist: { deletedAt: null },
      },
    });
    return items.map(toWishlistItemDto);
  }

  private async handleInventoryChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { productId?: string; available?: boolean; inStock?: boolean };
    const available = payload.available ?? payload.inStock;
    if (!payload.productId || available !== true) {
      return;
    }
    await this.prisma.wishlistItem.findMany({
      where: {
        itemType: WishlistItemType.PRODUCT,
        itemId: payload.productId,
        notifyBackInStock: true,
        wishlist: { deletedAt: null },
      },
      select: { id: true },
    });
  }

  private async requireOwnedWishlist(
    customerId: string,
    wishlistId: string,
  ): Promise<WishlistWithItems> {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, customerId, deletedAt: null },
      include: { items: true },
    });
    if (!wishlist) {
      throw new NotFoundDomainException('Wishlist not found');
    }
    return wishlist;
  }

  private async requireOwnedItem(
    customerId: string,
    wishlistId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.prisma.wishlistItem.findFirst({
      where: {
        id: itemId,
        wishlistId,
        wishlist: { customerId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundDomainException('Wishlist item not found');
    }
  }

  private async generateShareToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(24).toString('hex');
      const existing = await this.prisma.wishlist.findUnique({ where: { shareToken: token } });
      if (!existing) {
        return token;
      }
    }
    throw new ConflictDomainException('Could not generate wishlist share token');
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
