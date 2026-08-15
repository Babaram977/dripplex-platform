import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectRiderDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class SuspendRiderDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

/**
 * DPX-RIDER-003 — admin review of a rider's submitted KYC document. Mirrors
 * ReviewDriverKycDto/RejectDriverKycDto: remarks are optional when verifying
 * (nothing to explain) and required when rejecting (the rider must be told why).
 */
export class ReviewRiderKycDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks?: string;
}

export class RejectRiderKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}
