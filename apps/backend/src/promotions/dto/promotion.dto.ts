import { PromotionStatus, PromotionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromotionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  public code?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public name!: string;

  @IsEnum(PromotionType)
  public type!: PromotionType;

  @IsOptional()
  @IsEnum(PromotionStatus)
  public status?: PromotionStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  public percentOff?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public amountOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public buyQty?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public getQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  public priority?: number;

  @IsOptional()
  @IsBoolean()
  public stackable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  public usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public perUserLimit?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public minOrderAmount?: number;

  @IsOptional()
  @IsDateString()
  public startsAt?: string;

  @IsOptional()
  @IsDateString()
  public endsAt?: string;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  public code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public name?: string;

  @IsOptional()
  @IsEnum(PromotionType)
  public type?: PromotionType;

  @IsOptional()
  @IsEnum(PromotionStatus)
  public status?: PromotionStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  public percentOff?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public amountOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public buyQty?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public getQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  public priority?: number;

  @IsOptional()
  @IsBoolean()
  public stackable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  public usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public perUserLimit?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public minOrderAmount?: number;

  @IsOptional()
  @IsDateString()
  public startsAt?: string;

  @IsOptional()
  @IsDateString()
  public endsAt?: string;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}

export class ListPromotionsQueryDto {
  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  public status?: PromotionStatus;
}

export class ValidatePromotionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public subtotal!: number;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  public couponCode?: string;
}

export class RedeemPromotionDto {
  @IsOptional()
  @IsUUID()
  public promotionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  public couponCode?: string;

  @IsOptional()
  @IsUUID()
  public orderId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public amountSaved!: number;
}
