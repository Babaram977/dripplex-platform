import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BrowseProductsQueryDto } from './browse-products-query.dto';

describe('BrowseProductsQueryDto', () => {
  it('accepts an empty query (all filters optional)', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('coerces numeric query-string values', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, {
      minPrice: '100',
      maxPrice: '500',
      minRating: '4',
      limit: '10',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.minPrice).toBe(100);
    expect(dto.maxPrice).toBe(500);
    expect(dto.minRating).toBe(4);
    expect(dto.limit).toBe(10);
  });

  it('coerces the inStock boolean from a query string', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, { inStock: 'true' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.inStock).toBe(true);
  });

  it('rejects an unknown sort value', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, { sort: 'most-expensive' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('rejects a rating above the 0-5 scale', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, { minRating: 6 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'minRating')).toBe(true);
  });

  it('rejects a limit above the maximum', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, { limit: 500 });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects a non-UUID categoryId', async () => {
    const dto = plainToInstance(BrowseProductsQueryDto, { categoryId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'categoryId')).toBe(true);
  });
});
