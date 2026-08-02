import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PauseStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}
