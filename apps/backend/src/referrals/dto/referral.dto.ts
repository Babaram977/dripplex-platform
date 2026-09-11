import { ReferralRedemptionStatus, ReferralRejectionReason } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class AdminReferralRedemptionsQueryDto {
  @IsOptional()
  @IsEnum(ReferralRedemptionStatus)
  public status?: ReferralRedemptionStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}

/**
 * Every field optional: an operator changing only the hold must not have to
 * restate the amounts, and restating an amount is how one gets changed by
 * accident.
 */
export class UpdateReferralProgrammeDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public referrerRewardAmount?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public refereeRewardAmount?: number;

  /** Zero pays the moment a referral qualifies, which is what the platform did
   *  before the hold existed. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  @Max(365)
  public holdDays?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(1095)
  public qualificationWindowDays?: number;

  @IsOptional()
  @IsBoolean()
  public requireKycVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

export class RejectReferralRedemptionDto {
  @IsEnum(ReferralRejectionReason)
  public reason!: ReferralRejectionReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}

export class ApproveReferralRedemptionDto {
  /** Why the flag was cleared. Free text, because "her brother, same phone" is
   *  the answer and no enum will ever hold it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}

export class ReverseReferralRedemptionDto {
  @IsString()
  @MaxLength(500)
  public reason!: string;
}
