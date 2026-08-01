import { RideType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

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
}
