import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';

import { PRODUCT_SKU_MAX_LENGTH } from '../product.constants';

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  public sku?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public priceOverride?: number;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}
