import { IsString, MinLength } from 'class-validator';

export class GoogleExchangeDto {
  @IsString()
  @MinLength(32)
  public code!: string;
}
