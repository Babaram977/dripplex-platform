import { IncidentCategory, IncidentSeverity } from '@prisma/client';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateIncidentReportDto {
  @IsEnum(IncidentCategory)
  public category!: IncidentCategory;

  @IsEnum(IncidentSeverity)
  public severity!: IncidentSeverity;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public description!: string;

  @IsOptional()
  @IsUUID()
  public rideId?: string;

  @IsOptional()
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @IsLongitude()
  public longitude?: number;
}
