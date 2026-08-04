import { RideType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class UpdateDriverAvailabilityDto {
  @IsBoolean()
  public online!: boolean;

  @IsBoolean()
  public acceptingRides!: boolean;

  @IsEnum(RideType)
  public vehicleType!: RideType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLongitude()
  public longitude?: number;

  /** Client-supplied device identifier, used only for Driver-001's
   * "new device" identity-verification risk check — see
   * docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md. Not required; a
   * request with no deviceId simply skips that one risk-engine check. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public deviceId?: string;
}
