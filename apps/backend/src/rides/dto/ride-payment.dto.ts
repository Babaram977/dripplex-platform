import { RidePaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class InitiateRidePaymentDto {
  @IsEnum(RidePaymentMethod)
  public method!: RidePaymentMethod;

  @IsOptional()
  @IsUrl({ require_tld: false })
  public callbackUrl?: string;
}

export class VerifyRidePaymentDto {
  @IsOptional()
  @IsString()
  public reference?: string;
}

/// DPX-D4 — admin/operations-initiated full ride refund. Mirrors
/// RefundOrderDto: a reason only, no amount (D4 is full-refund-only; partial
/// refunds are deferred).
export class RefundRideDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}
