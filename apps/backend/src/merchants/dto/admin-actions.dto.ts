import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class SuspendMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class ReviewKycDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks?: string;
}

export class RejectKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}
