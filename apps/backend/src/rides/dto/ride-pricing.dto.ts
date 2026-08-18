import { RideSurchargeTrigger, RideSurchargeType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' || typeof value === 'number' ? Number(value) : value;

/**
 * A whole fare row for one ride type. Every field is required on update —
 * a partial fare table is not a fare table, and an operator who edits the
 * per-km rate should see the base fare and the minimum they are leaving in
 * place rather than have them silently persist.
 */
export class UpdateRideFareRateDto {
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  // A base fare above ₦1m is a typo, not a price. Generous ceilings
  // everywhere here: the console needs guard rails against a slipped
  // keystroke, not an opinion about what the business may charge.
  @Max(1_000_000)
  public baseFare!: number;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  public perKmRate!: number;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  public perMinuteRate!: number;

  /** Floor under the computed fare, not an addition. Founder-locked at ₦1,500
   * (2026-08-16) — changing it here is changing that decision. */
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  public minimumFare!: number;
}

export class CreateRideSurchargeZoneDto {
  @IsString()
  @Length(2, 120)
  public name!: string;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  public latitude!: number;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  public longitude!: number;

  /** 100m is the smallest circle worth drawing around a terminal building;
   * 50km is wider than any airport approach and still short of a city-scale
   * zone drawn by accident. */
  @Transform(toNumber)
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(50_000)
  public radiusMeters!: number;

  @IsEnum(RideSurchargeType)
  public surchargeType!: RideSurchargeType;

  /** Naira when FLAT, a factor when MULTIPLIER (1.25 = a quarter more). The
   * service rejects a multiplier below 1 and a negative flat amount — either
   * would quietly discount the fare. */
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  public amount!: number;

  @IsOptional()
  @IsEnum(RideSurchargeTrigger)
  public appliesTo: RideSurchargeTrigger = RideSurchargeTrigger.EITHER;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

/**
 * Every field optional — an operator switching a zone off should not have to
 * resubmit its geometry, and resubmitting geometry is how a coordinate gets
 * fat-fingered. The service validates the resulting type/amount pair rather
 * than the submitted fields, so changing only the type cannot leave an amount
 * that suits the other one.
 */
export class UpdateRideSurchargeZoneDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  public name?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  public latitude?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  public longitude?: number;

  @IsOptional()
  @Transform(toNumber)
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(50_000)
  public radiusMeters?: number;

  @IsOptional()
  @IsEnum(RideSurchargeType)
  public surchargeType?: RideSurchargeType;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1_000_000)
  public amount?: number;

  @IsOptional()
  @IsEnum(RideSurchargeTrigger)
  public appliesTo?: RideSurchargeTrigger;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}
