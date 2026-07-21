import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCartItemDto } from './create-cart-item.dto';
import { UpdateCartItemDto } from './update-cart-item.dto';

describe('Cart DTO validation', () => {
  it('accepts a valid add-item payload', async () => {
    const dto = plainToInstance(CreateCartItemDto, {
      merchantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      productId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      productName: 'Jollof Rice',
      unitPrice: '2500',
      quantity: '2',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.unitPrice).toBe(2500);
    expect(dto.quantity).toBe(2);
  });

  it('rejects invalid quantity', async () => {
    const dto = plainToInstance(UpdateCartItemDto, { quantity: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('requires merchant and product ids', async () => {
    const dto = plainToInstance(CreateCartItemDto, {
      productName: 'X',
      unitPrice: 10,
      quantity: 1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'merchantId')).toBe(true);
    expect(errors.some((e) => e.property === 'productId')).toBe(true);
  });
});
