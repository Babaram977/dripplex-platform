import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AddProductImageDto } from './add-product-image.dto';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { CreateProductDto } from './create-product.dto';
import { ReorderProductImagesDto } from './reorder-product-images.dto';
import { UpdateProductInventoryDto } from './update-product-inventory.dto';

describe('Product DTO validation', () => {
  it('accepts a valid create-product payload', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Jollof Rice Mix',
      basePrice: '2500',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.basePrice).toBe(2500);
  });

  it('rejects a non-positive base price', async () => {
    const dto = plainToInstance(CreateProductDto, { name: 'Free Item', basePrice: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'basePrice')).toBe(true);
  });

  it('rejects a name that is too short', async () => {
    const dto = plainToInstance(CreateProductDto, { name: 'A', basePrice: 10 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a malformed image url', async () => {
    const dto = plainToInstance(AddProductImageDto, { url: 'not a url at all' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });

  it('accepts a valid image payload', async () => {
    const dto = plainToInstance(AddProductImageDto, {
      url: 'https://example.com/rice.jpg',
      position: 2,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.position).toBe(2);
  });

  it('rejects a reorder payload with duplicate ids', async () => {
    const dto = plainToInstance(ReorderProductImagesDto, {
      imageIds: [
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
      ],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'imageIds')).toBe(true);
  });

  it('rejects an empty variant name', async () => {
    const dto = plainToInstance(CreateProductVariantDto, { name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('allows an explicit null to clear the low-stock alert', async () => {
    const dto = plainToInstance(UpdateProductInventoryDto, { lowStockAlert: null });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lowStockAlert).toBeNull();
  });

  it('rejects a negative inventory quantity', async () => {
    const dto = plainToInstance(UpdateProductInventoryDto, { quantity: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });
});
