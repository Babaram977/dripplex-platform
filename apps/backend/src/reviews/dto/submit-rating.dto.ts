import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DPX-REVIEWS-001 — body for the target-derived rating endpoints
 * (customer→rider, merchant→rider). The target and author role are resolved
 * server-side from the route + authenticated user, so the client only sends
 * the rating, an optional comment, and preset tags. Tags are validated against
 * the direction's fixed set in ReviewsService.
 */
export class SubmitRatingDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(5)
  public rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  public tags?: string[];
}
