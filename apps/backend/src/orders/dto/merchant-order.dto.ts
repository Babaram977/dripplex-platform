import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { CheckoutOrderStatus } from './order.dto';

export class AcceptOrderDto {
  @IsOptional()
  @IsDateString()
  public estimatedReadyAt?: string;
}

export class RejectOrderDto {
  @IsString()
  @MaxLength(500)
  public reason!: string;
}

export class DelayOrderDto {
  @IsDateString()
  public estimatedReadyAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class MerchantCancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class MerchantOrderListQueryDto {
  @IsOptional()
  @IsEnum(CheckoutOrderStatus)
  public status?: CheckoutOrderStatus;

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
