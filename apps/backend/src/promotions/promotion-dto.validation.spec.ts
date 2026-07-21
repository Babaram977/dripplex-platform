import { PromotionStatus, PromotionType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreatePromotionDto,
  RedeemPromotionDto,
  UpdatePromotionDto,
  ValidatePromotionDto,
} from './dto/promotion.dto';

describe('Promotion DTO validation', () => {
  it('accepts percentage promotions', async () => {
    const dto = plainToInstance(CreatePromotionDto, {
      code: 'save10',
      name: 'Save 10',
      type: PromotionType.PERCENTAGE,
      status: PromotionStatus.ACTIVE,
      percentOff: '10',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.percentOff).toBe(10);
  });

  it('rejects percentages above 100', async () => {
    const dto = plainToInstance(CreatePromotionDto, {
      name: 'Bad',
      type: PromotionType.PERCENTAGE,
      percentOff: 101,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'percentOff')).toBe(true);
  });

  it('accepts fixed promotions', async () => {
    const dto = plainToInstance(CreatePromotionDto, {
      name: 'Fixed',
      type: PromotionType.FIXED,
      amountOff: '500',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.amountOff).toBe(500);
  });

  it('accepts partial promotion updates', async () => {
    const dto = plainToInstance(UpdatePromotionDto, { status: PromotionStatus.PAUSED });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('validates coupon validation payloads', async () => {
    const dto = plainToInstance(ValidatePromotionDto, {
      subtotal: '2500',
      couponCode: 'SAVE10',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.subtotal).toBe(2500);
  });

  it('rejects negative validation subtotals', async () => {
    const dto = plainToInstance(ValidatePromotionDto, { subtotal: -1 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'subtotal')).toBe(true);
  });

  it('validates redemption payload order id', async () => {
    const dto = plainToInstance(RedeemPromotionDto, {
      couponCode: 'SAVE10',
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('requires redemption payload order id', async () => {
    const dto = plainToInstance(RedeemPromotionDto, { couponCode: 'SAVE10' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'orderId')).toBe(true);
  });
});
