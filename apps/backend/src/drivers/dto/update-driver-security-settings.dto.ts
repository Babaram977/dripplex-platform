import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

/**
 * Driver-001 Security Standard — admin-editable risk-engine policy.
 * All fields optional: a PATCH only touches the fields it sends.
 */
export class UpdateDriverSecuritySettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  public idleHours?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  public gpsAnomalySpeedKmh?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  public lockoutThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public spotCheckDenominator?: number;

  @IsOptional()
  @IsBoolean()
  public newDeviceVerificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  public adminForceVerificationEnabled?: boolean;
}
