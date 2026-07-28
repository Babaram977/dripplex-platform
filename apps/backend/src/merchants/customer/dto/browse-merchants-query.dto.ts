import { MERCHANT_SORTS } from '@dripplex/types';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import type { BusinessType, MerchantSort } from '@dripplex/types';

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
