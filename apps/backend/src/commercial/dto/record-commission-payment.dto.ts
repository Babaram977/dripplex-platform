import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordCommissionPaymentDto {
  @IsNumber()
  @Min(0.01)
  public amount!: number;

  @IsOptional()
  @IsString()
  public description?: string;
}
