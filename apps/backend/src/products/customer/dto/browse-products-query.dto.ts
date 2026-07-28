import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const CATALOG_SORT_VALUES = [
  'newest',
  'price_asc',
  'price_desc',
  'rating_desc',
  'popular',
  'recommended',
] as const;

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

function toNumber({ value }: { value: unknown }): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class BrowseProductsQueryDto {
  @IsOptional()
  @IsUUID()
  public categoryId?: string;

  @IsOptional()
  @IsUUID()
  public brandId?: string;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public minPrice?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public maxPrice?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(5)
  public minRating?: number;

  @IsOptional()
  @Transform(toBoolean)
  public inStock?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public q?: string;

  @IsOptional()
  @IsIn(CATALOG_SORT_VALUES)
  public sort?: (typeof CATALOG_SORT_VALUES)[number];

  @IsOptional()
  @IsString()
  public cursor?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(100)
  public limit?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lat?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lng?: number;
}
