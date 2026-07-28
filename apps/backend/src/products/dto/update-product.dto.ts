import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
} from '../product.constants';

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  public categoryId?: string;

  @IsOptional()
  @IsUUID()
  public brandId?: string;

  @IsOptional()
  @IsString()
  @MinLength(PRODUCT_NAME_MIN_LENGTH)
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX_LENGTH)
  public description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public basePrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  public currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  public sku?: string;

  @IsOptional()
  @IsBoolean()
  public isFeatured?: boolean;
}
