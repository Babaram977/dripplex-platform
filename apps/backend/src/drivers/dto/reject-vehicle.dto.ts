import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectVehicleDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public rejectedReason!: string;
}
