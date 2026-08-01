import { IsNumber, Max, Min } from 'class-validator';

export class TipDriverDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  public amount!: number;
}
