import { RideProblemCategory, RideProblemStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportRideProblemDto {
  @IsEnum(RideProblemCategory)
  public category!: RideProblemCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public description?: string;
}

export class ListRideProblemReportsQueryDto {
  @IsOptional()
  @IsEnum(RideProblemStatus)
  public status?: RideProblemStatus;
}
