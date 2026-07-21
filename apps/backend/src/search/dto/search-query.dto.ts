import { SearchEntityType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SEARCH_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'rating_desc',
  'newest',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public q?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(SearchEntityType)
  public type?: SearchEntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number = 20;

  @IsOptional()
  @IsIn(SEARCH_SORTS)
  public sort?: SearchSort = 'relevance';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  public minRating?: number;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsUUID()
  public categoryId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  public available?: boolean;
}

export class AutocompleteQueryDto {
  @IsString()
  @MaxLength(255)
  public q!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(SearchEntityType)
  public type?: SearchEntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  public limit?: number = 10;
}

export class SuggestionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  public limit?: number = 10;
}
