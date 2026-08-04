import { InspectionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListInspectionsQueryDto {
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
  public limit = 20;

  @IsOptional()
  @IsEnum(InspectionStatus)
  public status?: InspectionStatus;

  @IsOptional()
  @IsUUID()
  public centreId?: string;
}
