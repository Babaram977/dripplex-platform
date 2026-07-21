import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum FraudRiskLevelDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FraudReviewStatusDto {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CLEARED = 'CLEARED',
  CONFIRMED_FRAUD = 'CONFIRMED_FRAUD',
}

export enum FraudListTypeDto {
  BLACKLIST = 'BLACKLIST',
  WHITELIST = 'WHITELIST',
}

export enum FraudMatchTypeDto {
  USER = 'USER',
  IP = 'IP',
  DEVICE = 'DEVICE',
  EMAIL = 'EMAIL',
}

export class FraudQueueQueryDto {
  @IsOptional()
  @IsEnum(FraudReviewStatusDto)
  public status?: FraudReviewStatusDto;

  @IsOptional()
  @IsEnum(FraudRiskLevelDto)
  public riskLevel?: FraudRiskLevelDto;

  @IsOptional()
  @IsUUID()
  public userId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}

export class ReviewFraudSignalDto {
  @IsEnum(FraudReviewStatusDto)
  public status!: FraudReviewStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public note?: string;
}

export class UpsertFraudThresholdDto {
  @IsNumber()
  public value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;
}

export class FraudListEntryQueryDto {
  @IsOptional()
  @IsEnum(FraudListTypeDto)
  public listType?: FraudListTypeDto;

  @IsOptional()
  @IsEnum(FraudMatchTypeDto)
  public matchType?: FraudMatchTypeDto;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  public active?: boolean;
}

export class CreateFraudListEntryDto {
  @IsEnum(FraudListTypeDto)
  public listType!: FraudListTypeDto;

  @IsEnum(FraudMatchTypeDto)
  public matchType!: FraudMatchTypeDto;

  @IsString()
  @MaxLength(255)
  public matchValue!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class UpdateFraudListEntryDto {
  @IsOptional()
  @IsEnum(FraudListTypeDto)
  public listType?: FraudListTypeDto;

  @IsOptional()
  @IsEnum(FraudMatchTypeDto)
  public matchType?: FraudMatchTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public matchValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}
