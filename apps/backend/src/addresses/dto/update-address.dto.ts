import { AddressLabel } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsEnum(AddressLabel)
  public label?: AddressLabel;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public recipientName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must be 7–15 digits, optionally prefixed with +',
  })
  public phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  public addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public landmark?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public state?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  public postalCode?: string;

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
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  public isActive?: boolean;
}
