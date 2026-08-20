import { MERCHANT_CATEGORIES, MERCHANT_SORTS } from '@dripplex/types';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import type { BusinessType, MerchantCategory, MerchantSort } from '@dripplex/types';

const BUSINESS_TYPE_VALUES = [
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'LIMITED_LIABILITY',
  'CORPORATION',
  'OTHER',
] as const satisfies readonly BusinessType[];

function toNumber({ value }: { value: unknown }): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class BrowseMerchantsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public q?: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPE_VALUES)
  public businessType?: BusinessType;

  /**
   * What the merchant SELLS. This is what the marketplace's category chips
   * mean; `businessType` above is a legal structure and was never a category,
   * which is why those chips previously fell back to a name search.
   */
  @IsOptional()
  @IsIn(MERCHANT_CATEGORIES)
  public category?: MerchantCategory;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(5)
  public minRating?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lat?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lng?: number;

  @IsOptional()
  @IsIn(MERCHANT_SORTS)
  public sort?: MerchantSort;

  @IsOptional()
  @IsString()
  public cursor?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(100)
  public limit?: number;
}
