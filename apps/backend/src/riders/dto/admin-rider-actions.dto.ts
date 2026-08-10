import { IsString, MaxLength, MinLength } from 'class-validator';

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
