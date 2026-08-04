import { IncidentReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateIncidentReportDto {
  @IsOptional()
  @IsEnum(IncidentReportStatus)
  public status?: IncidentReportStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public adminNotes?: string;
}
