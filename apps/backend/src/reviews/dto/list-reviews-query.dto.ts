import { ReviewStatus, ReviewTargetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListReviewsQueryDto {
  @IsOptional()
  @IsEnum(ReviewTargetType)
  public targetType?: ReviewTargetType;

  @IsOptional()
  @IsUUID()
  public targetId?: string;

  @IsOptional()
  @IsEnum(ReviewStatus)
  public status?: ReviewStatus;

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
