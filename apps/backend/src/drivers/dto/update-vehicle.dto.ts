import { RideType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  public make?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  public model?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  public color?: string;

  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  public year?: number;

  @IsOptional()
  @IsEnum(RideType)
  public rideCategory?: RideType;

  // DPX-DRIVER-017 — passenger capacity.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  public seats?: number;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false }, { each: true })
  public photos?: string[];
}
