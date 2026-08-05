import { IsNumber, Max, Min } from 'class-validator';

export class UpdateMerchantCommissionSettingsDto {
  /** Decimal fraction, e.g. 0.10 = 10%. Matches
   * MerchantCommissionSetting.commissionRate's Decimal(5,4) column. */
  @IsNumber()
  @Min(0)
  @Max(1)
  public commissionRate!: number;
}
