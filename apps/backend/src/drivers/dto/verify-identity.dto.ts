import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DPX-DRIVER (task #15) — body for an operations reviewer manually marking a
 * driver's identity verified. The optional remark is recorded on the audit
 * trail (e.g. which document the reviewer matched against).
 */
export class VerifyIdentityDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public remarks?: string;
}
