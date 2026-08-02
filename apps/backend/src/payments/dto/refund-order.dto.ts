import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefundOrderDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}
