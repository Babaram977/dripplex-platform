import { IncidentReportStatus, IncidentSeverity } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListIncidentReportsQueryDto {
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
  @IsEnum(IncidentReportStatus)
  public status?: IncidentReportStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  public severity?: IncidentSeverity;
}
