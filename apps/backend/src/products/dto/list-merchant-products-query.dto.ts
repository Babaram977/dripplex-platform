import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const PRODUCT_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export class ListMerchantProductsQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUS_VALUES)
  public status?: (typeof PRODUCT_STATUS_VALUES)[number];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}
