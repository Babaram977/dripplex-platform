import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectDriverDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class SuspendDriverDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class ReviewDriverKycDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks?: string;
}

export class RejectDriverKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}
