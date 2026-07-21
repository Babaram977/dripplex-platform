import { WishlistItemType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  AddWishlistItemDto,
  CreateWishlistDto,
  MoveWishlistToCartDto,
  UpdateWishlistItemDto,
} from './dto/wishlist.dto';

describe('Wishlist DTO validation', () => {
  it('accepts valid wishlist names', async () => {
    const dto = plainToInstance(CreateWishlistDto, { name: 'Favorites' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects empty wishlist names', async () => {
    const dto = plainToInstance(CreateWishlistDto, { name: '' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('accepts product wishlist items with notification flags', async () => {
    const dto = plainToInstance(AddWishlistItemDto, {
      itemType: WishlistItemType.PRODUCT,
      itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      targetPrice: '500',
      notifyPriceDrop: true,
      notifyBackInStock: true,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.targetPrice).toBe(500);
  });

  it('rejects invalid wishlist item types', async () => {
    const dto = plainToInstance(AddWishlistItemDto, {
      itemType: 'BRAND',
      itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'itemType')).toBe(true);
  });

  it('validates target price updates', async () => {
    const dto = plainToInstance(UpdateWishlistItemDto, { targetPrice: 0 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'targetPrice')).toBe(true);
  });

  it('accepts nested move-to-cart product metadata', async () => {
    const dto = plainToInstance(MoveWishlistToCartDto, {
      products: [
        {
          productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          merchantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          productName: 'Rice',
          unitPrice: '1200',
          quantity: '2',
        },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.products?.[0]?.unitPrice).toBe(1200);
  });
});
