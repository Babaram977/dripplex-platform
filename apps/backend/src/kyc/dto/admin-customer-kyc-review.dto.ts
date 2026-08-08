import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Approve remarks are optional (a decision needs no justification to accept). */
export class VerifyCustomerKycDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks?: string;
}

/** Reject/resubmission remarks are required -- the customer needs to know what to fix. */
export class RejectCustomerKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}

export class RequestResubmissionCustomerKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}
