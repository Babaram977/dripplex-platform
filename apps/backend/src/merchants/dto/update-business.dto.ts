import { BusinessType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { BUSINESS_NAME_MAX_LENGTH, BUSINESS_NAME_MIN_LENGTH } from '../merchant.constants';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(BUSINESS_NAME_MIN_LENGTH)
  @MaxLength(BUSINESS_NAME_MAX_LENGTH)
  public businessName?: string;

  @IsOptional()
  @IsEnum(BusinessType)
  public businessType?: BusinessType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  public registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public description?: string;

  @IsOptional()
  @IsEmail()
  public email?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  public phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public country?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public state?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public city?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  public address?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  public latitude?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  public longitude?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public logoUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public coverPhotoUrl?: string;
}
