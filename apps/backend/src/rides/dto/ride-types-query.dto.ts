import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Optional pickup point for `GET /customer/rides/types`.
 *
 * With no coordinates the endpoint returns the catalog exactly as before —
 * every ride type, no availability claim. With them, each entry also reports
 * whether a driver of that type is actually reachable, so the fare screen can
 * say "no Dx Comfort nearby" instead of letting the passenger book and wait
 * through every dispatch attempt.
 *
 * Both are required together: a latitude without a longitude is not a point,
 * and answering "in range" from half a coordinate would be a guess.
 */
export class RideTypesQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  public latitude?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  public longitude?: number;
}
