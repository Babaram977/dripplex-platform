import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
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
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public points!: number;
}

export class RedeemStoreCodeDto {
  /**
   * The code the holder is showing. Sent in a body rather than a path so it
   * does not end up in access logs or browser history — it is a bearer
   * authorisation over somebody's points until it is used.
   */
  @IsString()
  @MaxLength(32)
  public code!: string;
}
