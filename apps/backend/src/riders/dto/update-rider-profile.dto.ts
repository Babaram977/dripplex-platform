import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DPX-RIDER-002 — self-service update of the rider's own profile. Currently
 * just the company/organisation name (founder scope: name only, no further
 * company details).
 */
export class UpdateRiderProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public companyName?: string;
}
