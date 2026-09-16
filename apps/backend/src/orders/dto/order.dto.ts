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
  MinLength,
  Min,
} from 'class-validator';

export enum CheckoutFulfillmentType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export enum CheckoutOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
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

export class RaiseOrderDisputeDto {
  @IsString()
  @MaxLength(1000)
  public reason!: string;
}

export class ResolveOrderDisputeDto {
  @IsString()
  @MaxLength(1000)
  public resolution!: string;
}

/// DPX-ORDER-8D-C ops visibility — validation enums for the exception queue.
/// Declared here rather than imported from @prisma/client because class-validator
/// needs a real enum object at runtime, and this is how every other query DTO in
/// this file does it.
export enum OrderExceptionTypeFilter {
  STALLED_CONFIRMED = 'STALLED_CONFIRMED',
}

export enum OrderExceptionStatusFilter {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

/**
 * Filters for the operations exception queue. Read-only: there is no field here
 * that changes anything, and deliberately no `orderId` — a single order is
 * already reachable through `GET admin/orders/:id`.
 */
/// DPX-ORDER-8D-RECOVERY Increment 2 — validation enums for the recovery queue.
export enum OrderRecoveryStatusFilter {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_FINANCIAL_RETRY = 'AWAITING_FINANCIAL_RETRY',
  AWAITING_INVESTIGATION = 'AWAITING_INVESTIGATION',
  CLOSED = 'CLOSED',
}

export enum OrderRecoveryTriggerFilter {
  OPERATOR = 'OPERATOR',
  AUTOMATIC = 'AUTOMATIC',
}

export class AdminOrderRecoveryListQueryDto {
  @IsOptional()
  @IsEnum(OrderRecoveryStatusFilter)
  public status?: OrderRecoveryStatusFilter;

  @IsOptional()
  @IsEnum(OrderRecoveryTriggerFilter)
  public trigger?: OrderRecoveryTriggerFilter;

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

/**
 * A recovery cancellation must carry a reason.
 *
 * Required, not optional: this cancellation is attributed to ADMIN on the
 * order, so without a stated reason neither the customer nor a later reviewer
 * can tell why the platform cancelled someone's order.
 */
export class OperatorRecoveryCancelDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public reason!: string;
}

export class AdminOrderExceptionListQueryDto {
  @IsOptional()
  @IsEnum(OrderExceptionStatusFilter)
  public status?: OrderExceptionStatusFilter;

  @IsOptional()
  @IsEnum(OrderExceptionTypeFilter)
  public type?: OrderExceptionTypeFilter;

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
