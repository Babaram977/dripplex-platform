import { RidePaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

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
