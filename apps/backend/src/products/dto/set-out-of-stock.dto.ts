import { IsBoolean } from 'class-validator';

export class SetOutOfStockDto {
  @IsBoolean()
  public outOfStock!: boolean;
}
