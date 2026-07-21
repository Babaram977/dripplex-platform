import 'reflect-metadata';

import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  ReviewTargetType,
  SearchEntityType,
  WalletOwnerType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateNotificationPreferencesDto } from './notification-center/dto/notification-preference.dto';
import { ListNotificationsQueryDto } from './notification-center/dto/notification.dto';
import { RedeemPromotionDto } from './promotions/dto/promotion.dto';
import { ListReviewsQueryDto } from './reviews/dto/list-reviews-query.dto';
import {
  AutocompleteQueryDto,
  SearchQueryDto,
  SuggestionsQueryDto,
} from './search/dto/search-query.dto';
import {
  AdminWalletMutationDto,
  TransferWalletDto,
  WalletReconciliationQueryDto,
} from './wallet/dto/wallet.dto';
import { MoveWishlistToCartDto } from './wishlist/dto/wishlist.dto';

describe('platform stabilization request DTO contracts', () => {
  it('accepts authenticated search filters with backend query names', async () => {
    const dto = plainToInstance(SearchQueryDto, {
      q: 'rice',
      type: 'product',
      page: '2',
      limit: '25',
      available: 'true',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.type).toBe(SearchEntityType.PRODUCT);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
    expect(dto.available).toBe(true);
  });

  it('rejects search page limits above the backend cap', async () => {
    const dto = plainToInstance(SearchQueryDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects unsupported search sort values', async () => {
    const dto = plainToInstance(SearchQueryDto, { sort: 'distance' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('accepts search autocomplete type and limit filters', async () => {
    const dto = plainToInstance(AutocompleteQueryDto, {
      q: 'ric',
      type: 'store',
      limit: '10',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.type).toBe(SearchEntityType.STORE);
    expect(dto.limit).toBe(10);
  });

  it('rejects autocomplete limits above twenty', async () => {
    const dto = plainToInstance(AutocompleteQueryDto, { q: 'rice', limit: 21 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('accepts suggestion limits at the backend maximum', async () => {
    const dto = plainToInstance(SuggestionsQueryDto, { q: 'rice', limit: '20' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it('accepts notification list filters and unreadOnly conversion', async () => {
    const dto = plainToInstance(ListNotificationsQueryDto, {
      status: NotificationStatus.SENT,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.PROMOTION,
      unreadOnly: 'false',
      page: '3',
      limit: '10',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.unreadOnly).toBe(false);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
  });

  it('rejects notification list limits above one hundred', async () => {
    const dto = plainToInstance(ListNotificationsQueryDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('accepts notification preference updates as an array body', async () => {
    const dto = plainToInstance(UpdateNotificationPreferencesDto, {
      preferences: [
        {
          channel: NotificationChannel.EMAIL,
          type: NotificationType.PROMOTION,
          enabled: false,
        },
      ],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects malformed notification preference entries', async () => {
    const dto = plainToInstance(UpdateNotificationPreferencesDto, {
      preferences: [{ channel: 'FAX', type: NotificationType.PROMOTION, enabled: false }],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'preferences')).toBe(true);
  });

  it('accepts public review query target filters', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, {
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      page: '2',
      pageSize: '10',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(10);
  });

  it('rejects review page sizes above one hundred', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, { pageSize: 101 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'pageSize')).toBe(true);
  });

  it('rejects invalid review target types', async () => {
    const dto = plainToInstance(ListReviewsQueryDto, { targetType: 'ORDER' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'targetType')).toBe(true);
  });

  it('accepts promotion redemption bodies with required order id', async () => {
    const dto = plainToInstance(RedeemPromotionDto, {
      couponCode: 'SAVE10',
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.orderId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('requires promotion redemption order id while savings are calculated server-side', async () => {
    const dto = plainToInstance(RedeemPromotionDto, { couponCode: 'SAVE10' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'orderId')).toBe(true);
  });

  it('accepts wallet transfer bodies addressed by customer user id', async () => {
    const dto = plainToInstance(TransferWalletDto, {
      toUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      amount: '500',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.amount).toBe(500);
    expect(dto.currency).toBe('NGN');
  });

  it('rejects wallet transfers without a user recipient id', async () => {
    const dto = plainToInstance(TransferWalletDto, { amount: 500 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'toUserId')).toBe(true);
  });

  it('accepts admin wallet mutation bodies with optional references', async () => {
    const dto = plainToInstance(AdminWalletMutationDto, {
      amount: '250',
      referenceType: 'manual_adjustment',
      referenceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.amount).toBe(250);
    expect(dto.currency).toBe('NGN');
  });

  it('accepts admin wallet reconciliation owner filters', async () => {
    const dto = plainToInstance(WalletReconciliationQueryDto, {
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      currency: 'NGN',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts wishlist move-to-cart product metadata', async () => {
    const dto = plainToInstance(MoveWishlistToCartDto, {
      products: [
        {
          productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          merchantId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          productName: 'Rice',
          unitPrice: '1200',
          quantity: '2',
        },
      ],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.products?.[0]?.unitPrice).toBe(1200);
    expect(dto.products?.[0]?.quantity).toBe(2);
  });
});
