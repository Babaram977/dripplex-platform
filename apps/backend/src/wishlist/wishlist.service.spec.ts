import { WishlistItemType } from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';

import { WishlistService } from './wishlist.service';

import type { AuditService } from '../audit/audit.service';
import type { CartService } from '../cart/cart.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
import type { Wishlist, WishlistItem } from '@prisma/client';

const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const wishlistId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const itemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const productId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const merchantId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const now = new Date('2026-01-01T00:00:00.000Z');

const wishlistItem = (overrides: Partial<WishlistItem> = {}): WishlistItem => ({
  id: itemId,
  wishlistId,
  itemType: WishlistItemType.PRODUCT,
  itemId: productId,
  targetPrice: null,
  notifyPriceDrop: false,
  notifyBackInStock: false,
  addedAt: now,
  ...overrides,
});

const wishlist = (
  items: WishlistItem[] = [],
  overrides: Partial<Wishlist> = {},
): Wishlist & {
  items: WishlistItem[];
} => ({
  id: wishlistId,
  customerId,
  name: 'Favorites',
  shareToken: null,
  isPublic: false,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides,
  items,
});

describe('WishlistService', () => {
  const prisma = {
    wishlist: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    wishlistItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const cartService = {
    addItem: jest.fn().mockResolvedValue({ id: 'cart' }),
  } as unknown as jest.Mocked<CartService>;

  const eventBus = {
    on: jest.fn(),
  } as unknown as jest.Mocked<DomainEventBus>;

  const service = new WishlistService(
    prisma as unknown as PrismaService,
    auditService,
    cartService,
    eventBus,
  );
  const context = { userId: customerId };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to inventory changes on module init', () => {
    service.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith('InventoryChanged', expect.any(Function));
  });

  it('creates wishlists and audits', async () => {
    prisma.wishlist.create.mockResolvedValue(wishlist());
    const result = await service.create(customerId, { name: ' Favorites ' }, context);
    expect(result.name).toBe('Favorites');
    expect(auditService.record).toHaveBeenCalledWith(
      'wishlist.created',
      expect.any(Object),
      expect.objectContaining({ resource: 'wishlist' }),
    );
  });

  it('lists customer wishlists', async () => {
    prisma.wishlist.findMany.mockResolvedValue([wishlist()]);
    const result = await service.list(customerId);
    expect(result).toHaveLength(1);
  });

  it('gets an owned wishlist', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist([wishlistItem()]));
    const result = await service.get(customerId, wishlistId);
    expect(result.items[0]?.itemId).toBe(productId);
  });

  it('throws when wishlist is missing', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(null);
    await expect(service.get(customerId, wishlistId)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('updates wishlist name and public flag', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist());
    prisma.wishlist.findUnique.mockResolvedValue(null);
    prisma.wishlist.update.mockResolvedValue(
      wishlist([], { name: 'New', isPublic: true, shareToken: 't' }),
    );
    const result = await service.update(
      customerId,
      wishlistId,
      { name: 'New', isPublic: true },
      context,
    );
    expect(result.isPublic).toBe(true);
    expect(prisma.wishlist.update).toHaveBeenCalled();
  });

  it('soft deletes wishlists', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist());
    prisma.wishlist.update.mockResolvedValue(wishlist([], { deletedAt: now }));
    const result = await service.delete(customerId, wishlistId, context);
    expect(result.id).toBe(wishlistId);
  });

  it('adds wishlist items', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist());
    prisma.wishlistItem.create.mockResolvedValue(wishlistItem({ notifyBackInStock: true }));
    const result = await service.addItem(
      customerId,
      wishlistId,
      { itemType: WishlistItemType.PRODUCT, itemId: productId, notifyBackInStock: true },
      context,
    );
    expect(result.notifyBackInStock).toBe(true);
  });

  it('maps unique item violations to conflicts', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist());
    prisma.wishlistItem.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.addItem(
        customerId,
        wishlistId,
        { itemType: WishlistItemType.PRODUCT, itemId: productId },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });

  it('updates wishlist item notification flags', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue({ id: itemId });
    prisma.wishlistItem.update.mockResolvedValue(wishlistItem({ notifyPriceDrop: true }));
    const result = await service.updateItem(
      customerId,
      wishlistId,
      itemId,
      { notifyPriceDrop: true },
      context,
    );
    expect(result.notifyPriceDrop).toBe(true);
  });

  it('removes wishlist items', async () => {
    prisma.wishlistItem.findFirst.mockResolvedValue({ id: itemId });
    prisma.wishlistItem.delete.mockResolvedValue(wishlistItem());
    const result = await service.removeItem(customerId, wishlistId, itemId, context);
    expect(result.removed).toBe(true);
  });

  it('shares wishlists with a generated token', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist());
    prisma.wishlist.findUnique.mockResolvedValue(null);
    prisma.wishlist.update.mockResolvedValue(wishlist([], { shareToken: 'token', isPublic: true }));
    const result = await service.share(customerId, wishlistId, context);
    expect(result.shareToken).toBe('token');
  });

  it('loads shared public wishlists', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(
      wishlist([], { shareToken: 'token', isPublic: true }),
    );
    const result = await service.getShared('token');
    expect(result.isPublic).toBe(true);
  });

  it('returns product IDs without cart metadata', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist([wishlistItem()]));
    const result = await service.moveToCart(customerId, wishlistId, {}, context);
    expect(result.productIds).toEqual([productId]);
    expect(result.addedToCart).toEqual([]);
    expect(cartService.addItem).not.toHaveBeenCalled();
  });

  it('adds products to cart when metadata is provided', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(wishlist([wishlistItem()]));
    const result = await service.moveToCart(
      customerId,
      wishlistId,
      {
        products: [
          {
            productId,
            merchantId,
            productName: 'Rice',
            unitPrice: 1000,
            quantity: 2,
          },
        ],
      },
      context,
    );
    expect(result.addedToCart).toEqual([productId]);
    expect(cartService.addItem).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({ merchantId, productId, quantity: 2 }),
      context,
    );
  });

  it('finds price-drop notification candidates', async () => {
    prisma.wishlistItem.findMany.mockResolvedValue([
      wishlistItem({
        targetPrice: 900 as unknown as WishlistItem['targetPrice'],
        notifyPriceDrop: true,
      }),
    ]);
    const result = await service.checkPriceDrop(productId, 800);
    expect(result).toHaveLength(1);
  });
});
