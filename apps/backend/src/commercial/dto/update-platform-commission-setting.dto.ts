import { IsNumber, Max, Min } from 'class-validator';

export class UpdatePlatformCommissionSettingDto {
  /**
   * Decimal fraction, e.g. 0.10 = 10%. Matches
   * PlatformCommissionSetting.commissionRate's Decimal(5,4) column. Bounded to
   * [0, 1] — a rate outside this range is never a sensible commission.
   */
  @IsNumber()
  @Min(0)
  @Max(1)
  public commissionRate!: number;
}
