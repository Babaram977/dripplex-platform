import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum CheckoutFulfillmentType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export enum CheckoutOrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum CheckoutPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
}

export class CheckoutDto {
  @IsOptional()
  @IsUUID()
  public cartId?: string;

  @IsOptional()
  @IsEnum(CheckoutFulfillmentType)
  public fulfillmentType?: CheckoutFulfillmentType = CheckoutFulfillmentType.DELIVERY;

  @IsOptional()
  @IsUUID()
  public deliveryAddressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  public couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public notes?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class AdminOrderListQueryDto {
  @IsOptional()
  @IsEnum(CheckoutOrderStatus)
  public status?: CheckoutOrderStatus;

  @IsOptional()
  @IsEnum(CheckoutPaymentStatus)
  public paymentStatus?: CheckoutPaymentStatus;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsUUID()
  public customerId?: string;

  @IsOptional()
  @IsDateString()
  public createdFrom?: string;

  @IsOptional()
  @IsDateString()
  public createdTo?: string;

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

export class CustomerOrderListQueryDto {
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
