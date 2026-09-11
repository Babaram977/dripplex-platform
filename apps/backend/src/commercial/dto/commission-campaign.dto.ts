import { CommissionCampaignStatus, CommissionScope } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PromotionRulesDto } from '../../promotions/promotion-rules';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class CreateCommissionCampaignDto {
  @IsString()
  @MaxLength(150)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  public description?: string;

  @IsEnum(CommissionScope)
  public scope!: CommissionScope;

  /**
   * Fraction, not percent — 0.07 is 7%, matching
   * `CommissionCampaign.commissionRate`'s Decimal(5,4) column and the two
   * standing commission settings. Bounded below 1: a rate of 1 or more would
   * take everything the partner earned, or more.
   */
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  @Max(0.9999)
  public commissionRate!: number;

  /** Highest priority wins when two campaigns cover the same transaction. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  @Max(1_000)
  public priority = 0;

  @Type(() => Date)
  @IsDate()
  public startsAt!: Date;

  @Type(() => Date)
  @IsDate()
  public endsAt!: Date;

  /**
   * Optional eligibility conditions, in the same vocabulary the promotions
   * engine uses. "Weekend orders" is `{ "weekdays": [0, 6] }`.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionRulesDto)
  public rules?: PromotionRulesDto;

  /** Whether the affected partners are told when this goes live. */
  @IsOptional()
  @IsBoolean()
  public announce = true;
}

export class UpdateCommissionCampaignDto {
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
  @IsNumber()
  @Min(0)
  @Max(0.9999)
  public commissionRate?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  @Max(1_000)
  public priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public endsAt?: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionRulesDto)
  public rules?: PromotionRulesDto;

  @IsOptional()
  @IsBoolean()
  public announce?: boolean;
}

export class ListCommissionCampaignsQueryDto {
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

  @IsOptional()
  @IsEnum(CommissionScope)
  public scope?: CommissionScope;

  @IsOptional()
  @IsEnum(CommissionCampaignStatus)
  public status?: CommissionCampaignStatus;
}
