import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

function toNumber({ value }: { value: unknown }): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class SmartSearchQueryDto {
  @IsString()
  @MaxLength(255)
  public query!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lat?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  public lng?: number;

  @IsOptional()
  @IsString()
  public cursor?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(100)
  public limit?: number;
}
