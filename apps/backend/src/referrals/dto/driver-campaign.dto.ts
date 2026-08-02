import { ReferralCampaignStatus, ReferralFraudCheckStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class CreateReferralCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public name!: string;

  @IsDateString()
  public periodStart!: string;

  @IsDateString()
  public periodEnd!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public requiredTripsPerPassenger?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public silverThreshold?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public silverRewardAmount?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public goldThreshold?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public goldRewardAmount?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  public goldQualificationRate?: number;
}

export class UpdateCampaignRewardsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public silverRewardAmount?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public goldRewardAmount?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public silverThreshold?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public goldThreshold?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  public goldQualificationRate?: number;
}

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(ReferralCampaignStatus)
  public status?: ReferralCampaignStatus;
}

export class RejectRewardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public reason!: string;
}

export class ReviewFraudCheckDto {
  @IsEnum(ReferralFraudCheckStatus)
  public status!: ReferralFraudCheckStatus;
}

export class ListFraudChecksQueryDto {
  @IsOptional()
  @IsEnum(ReferralFraudCheckStatus)
  public status?: ReferralFraudCheckStatus;
}
