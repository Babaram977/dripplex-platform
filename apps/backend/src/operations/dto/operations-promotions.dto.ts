import { CampaignParticipantType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

/**
 * DPX-PROMO-REF-001 — adding a promoter to a campaign.
 *
 * Exactly one of `rewardAmountNgn` and `rewardPoints`. Refused three times over
 * and deliberately: class-validator cannot express "one or the other", so the
 * service checks it and the database enforces it with a CHECK constraint. The
 * shape is documented here so an operator sees the rule before they submit,
 * rather than after.
 *
 * Point values are entered directly and converted for display through the
 * canonical `loyalty_settings.points_per_naira` (100 since 2026-09-12). Nothing
 * here hardcodes a second rate.
 */
export class AddCampaignPromoterDto {
  /** An existing DrippleX user. Promoters are chosen, never created here. */
  @IsUUID()
  public userId!: string;

  @IsEnum(CampaignParticipantType)
  public participantType!: CampaignParticipantType;

  /** Naira per qualified acquisition. Omit when paying in DX Points. */
  @IsOptional()
  @IsPositive()
  public rewardAmountNgn?: number;

  /** DX Points per qualified acquisition. Omit when paying cash. */
  @IsOptional()
  @IsInt()
  @Min(1)
  public rewardPoints?: number;
}
