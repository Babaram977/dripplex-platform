import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { AnalyticsPeriod } from '../period.helper';

export enum AnalyticsPeriodDtoEnum {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class AnalyticsOverviewQueryDto {
  @IsOptional()
  @IsDateString()
  public from?: string;

  @IsOptional()
  @IsDateString()
  public to?: string;

  @IsOptional()
  @IsEnum(AnalyticsPeriodDtoEnum)
  public period: AnalyticsPeriod = AnalyticsPeriodDtoEnum.DAILY;
}

export class AnalyticsTopListQueryDto extends AnalyticsOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 10;
}
