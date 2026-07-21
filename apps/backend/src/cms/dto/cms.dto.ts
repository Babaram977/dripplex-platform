import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum CmsContentTypeDto {
  HOMEPAGE_BANNER = 'HOMEPAGE_BANNER',
  CATEGORY = 'CATEGORY',
  LANDING_PAGE = 'LANDING_PAGE',
  FAQ = 'FAQ',
  STATIC_PAGE = 'STATIC_PAGE',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  PROMO_BANNER = 'PROMO_BANNER',
  MARKETING_BLOCK = 'MARKETING_BLOCK',
}

export enum CmsContentStatusDto {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateCmsContentDto {
  @IsEnum(CmsContentTypeDto)
  public type!: CmsContentTypeDto;

  @IsString()
  @MaxLength(150)
  public slug!: string;

  @IsString()
  @MaxLength(255)
  public title!: string;

  @IsOptional()
  public body?: unknown;
}

export class UpdateCmsContentDto {
  @IsOptional()
  @IsEnum(CmsContentTypeDto)
  public type?: CmsContentTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  public slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public title?: string;

  @IsOptional()
  public body?: unknown;
}

export class ScheduleCmsContentDto {
  @IsDateString()
  public scheduledAt!: string;
}

export class CmsContentListQueryDto {
  @IsOptional()
  @IsEnum(CmsContentTypeDto)
  public type?: CmsContentTypeDto;

  @IsOptional()
  @IsEnum(CmsContentStatusDto)
  public status?: CmsContentStatusDto;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}
