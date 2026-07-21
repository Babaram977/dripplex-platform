import { SearchEntityType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertSearchDocumentDto {
  @IsEnum(SearchEntityType)
  public entityType!: SearchEntityType;

  @IsUUID()
  public entityId!: string;

  @IsString()
  @MaxLength(255)
  public title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public keywords?: string[];

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  public rankingScore?: number;

  @IsOptional()
  @IsBoolean()
  public available?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  public rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  public latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  public longitude?: number;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsUUID()
  public categoryId?: string;

  @IsOptional()
  @IsUUID()
  public brandId?: string;
}
