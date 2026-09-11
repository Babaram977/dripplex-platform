import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class UpdateDriverTierSettingDto {
  /** Fraction, not percent — 0.095 is 9.5%, matching the Decimal(5,4) column. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  @Max(0.9999)
  public commissionRate?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  public minCompletedTrips?: number;

  /**
   * How many ratings have to sit behind the average. Separate from the trip
   * count on purpose: three five-star trips make a 5.00 average and prove
   * nothing.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(0)
  public minRatedTrips?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  @Max(5)
  public minAverageRating?: number;

  /** Null clears the quality gate for this tier. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : toNumber(value)))
  @IsNumber()
  @Min(0)
  @Max(1)
  public maxCancellationRate?: number | null;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}
