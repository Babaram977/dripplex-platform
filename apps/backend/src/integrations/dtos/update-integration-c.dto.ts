import { IsString, IsOptional, IsUrl, IsEnum, MaxLength, IsEmail, IsObject } from 'class-validator';

/**
 * MKT-INT-001-C: Update Integration DTO
 *
 * API Contract per C-PLAN.md - Endpoint 4 (PUT /api/v1/integrations/{integrationId})
 *
 * Accepts partial updates to integration metadata and configuration.
 * Credentials are NOT modified via this endpoint (D phase responsibility).
 * Status can only be set to ACTIVE or PAUSED (REVOKED/ERROR are system-only).
 */
export class UpdateIntegrationCDto {
  /**
   * Vendor name (optional)
   * Constraint: ≤100 characters
   */
  @IsOptional()
  @IsString({ message: 'vendorName must be a string' })
  @MaxLength(100, { message: 'vendorName must not exceed 100 characters' })
  public readonly vendorName?: string;

  /**
   * Vendor version (optional)
   * Constraint: ≤100 characters
   */
  @IsOptional()
  @IsString({ message: 'vendorVersion must be a string' })
  @MaxLength(100, { message: 'vendorVersion must not exceed 100 characters' })
  public readonly vendorVersion?: string;

  /**
   * Merchant contact email (optional)
   * Must be valid email format if provided
   */
  @IsOptional()
  @IsEmail({}, { message: 'merchantContactEmail must be a valid email address' })
  public readonly merchantContactEmail?: string;

  /**
   * Webhook URL (optional)
   * HTTPS endpoint where DrippleX sends integration events
   * Must be valid HTTPS URL if provided
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: 'webhookUrl must be a valid HTTPS URL' },
  )
  public readonly webhookUrl?: string;

  /**
   * Integration metadata (optional)
   * JSON-serializable custom data for this integration
   * Replaces existing metadata if provided
   */
  @IsOptional()
  @IsObject({ message: 'metadata must be a JSON object' })
  public readonly metadata?: Record<string, unknown>;

  /**
   * Integration status (optional)
   * Only ACTIVE and PAUSED are user-modifiable
   * REVOKED and ERROR are system-only status values
   */
  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED'], {
    message: 'status must be either "ACTIVE" or "PAUSED"',
  })
  public readonly status?: 'ACTIVE' | 'PAUSED';
}
