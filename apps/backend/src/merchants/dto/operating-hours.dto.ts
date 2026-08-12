import 'reflect-metadata';

import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One day's open/close pair in 24-hour "HH:MM" wall-clock time. Matches the
 * customer-facing OperatingHoursDayDto contract (@dripplex/types) that the
 * marketplace `isOpenNow` check reads.
 */
export class OperatingHoursDayDto {
  @IsString()
  @Matches(HHMM, { message: 'open must be a 24-hour HH:MM time' })
  public open!: string;

  @IsString()
  @Matches(HHMM, { message: 'close must be a 24-hour HH:MM time' })
  public close!: string;
}

/**
 * Store operating hours keyed by day (mon–sun), each an { open, close } pair or
 * null for a closed day. This is the established persisted shape of the
 * Business.operatingHours Json column (see OperatingHoursDto in @dripplex/types);
 * the merchant Store Setup writes it and the customer marketplace reads it.
 */
export class BusinessOperatingHoursDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public mon?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public tue?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public wed?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public thu?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public fri?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public sat?: OperatingHoursDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursDayDto)
  public sun?: OperatingHoursDayDto | null;
}
