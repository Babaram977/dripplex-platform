import { IsDateString, IsNumberString, IsOptional } from 'class-validator';

/** DPX-OPS-001 Slice 4 — every analytics endpoint requires a `from`/`to`
 * range; per the founder's explicit instruction, time-range filtering is
 * fundamental, not optional. `operations-console` always computes concrete
 * timestamps for "Today"/"Last 7 days"/"Last 30 days"/custom before
 * calling. `cellSizeDegrees` is only read by the geographic-demand
 * endpoint. */
export class AnalyticsRangeQueryDto {
  @IsDateString()
  public from!: string;

  @IsDateString()
  public to!: string;

  @IsOptional()
  @IsNumberString()
  public cellSizeDegrees?: string;
}
