import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * A rate agreed with one merchant — DPX-MERCHANT-016.
 *
 * Mirrors `SetFleetNegotiatedRateDto`: the two express the same commercial
 * idea, and keeping the shapes identical is what stops one of them quietly
 * acquiring different bounds from the other.
 */
export class SetMerchantNegotiatedRateDto {
  /**
   * A fraction: 0.075 is 7.5%. Null clears the agreement and returns this
   * merchant to the platform-wide rate.
   *
   * Bounded strictly inside 0 and 1. Zero commission is not an agreement this
   * endpoint can express — a merchant DrippleX charges nothing is a decision
   * with no ceiling on its cost, and a campaign is the instrument for that.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Max(0.9999)
  public rate?: number | null;

  /** What was agreed, so the figure is readable months later by somebody who
   *  was not in the conversation. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}
