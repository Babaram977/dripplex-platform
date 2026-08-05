import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DPX-MERCHANT-008 — unlike `ListReviewsQueryDto`, there is no
 * targetType/targetId here: `GET /merchant/reviews` always scopes to the
 * authenticated merchant's own store + products, resolved server-side.
 */
export class ListMerchantReviewsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize?: number;
}
