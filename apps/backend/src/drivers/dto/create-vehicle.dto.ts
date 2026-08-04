import { RideType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
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

export class CreateVehicleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  public plateNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  public make!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  public model!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(30)
  public color!: string;

  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  public year!: number;

  @IsEnum(RideType)
  public rideCategory!: RideType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false }, { each: true })
  public photos?: string[];
}
