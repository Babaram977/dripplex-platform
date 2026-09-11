import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class LoyaltyHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}

export class RedeemPointsDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public points!: number;
}

export class CreateLoyaltyAchievementDto {
  @IsString()
  @Matches(/^[A-Z0-9_:-]+$/)
  @MaxLength(100)
  public code!: string;

  @IsString()
  @MaxLength(150)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  public pointsReward = 0;

  @IsOptional()
  @IsBoolean()
  public active = true;
}

export class UpdateLoyaltyAchievementDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  public pointsReward?: number;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

export class IssueRedemptionCodeDto {
  /** Omit, or send 0, for a coupon-only code. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  public points?: number;

  /** A coupon to spend at the same counter, on the same code. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public couponCode?: string;
}

export class RedeemStoreCodeDto {
  /**
   * The bill total, required when the code carries a coupon — a percentage
   * discount is meaningless without something to take it off, and guessing
   * would either short the merchant or overpay them.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public billAmount?: number;

  /**
   * The code the holder is showing. Sent in a body rather than a path so it
   * does not end up in access logs or browser history — it is a bearer
   * authorisation over somebody's points until it is used.
   */
  @IsString()
  @MaxLength(32)
  public code!: string;
}

export class RedeemRewardDto {
  /**
   * The caller's own key, unique per holder. It is what makes a retry safe: two
   * taps on a slow connection are one redemption rather than two, enforced by a
   * unique index rather than by hope.
   */
  @IsString()
  @MaxLength(100)
  public idempotencyKey!: string;
}

export class AdvanceFulfilmentDto {
  @IsIn([
    'FULFILMENT_PENDING',
    'PROCESSING',
    'READY_FOR_COLLECTION',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
  ])
  public status!:
    | 'FULFILMENT_PENDING'
    | 'PROCESSING'
    | 'READY_FOR_COLLECTION'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}
