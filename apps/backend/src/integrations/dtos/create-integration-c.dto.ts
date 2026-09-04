import {
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  IsEmail,
  IsObject,
} from 'class-validator';

/**
 * MKT-INT-001-C: Create Integration DTO
 *
 * API Contract per C-PLAN.md - Endpoint 1 (POST /api/v1/integrations)
 *
 * Accepts vendor information and optional configuration.
 * Authentication: JWT Bearer token (required)
 * Authorization: Authenticated merchant context required
 */
export class CreateIntegrationCDto {
  /**
   * Vendor name (required)
   * Example: "Square", "Toast", "Custom POS"
   * Constraint: non-empty, ≤100 characters
   */
  @IsString({ message: 'vendorName must be a string' })
  @MinLength(1, { message: 'vendorName must not be empty' })
  @MaxLength(100, { message: 'vendorName must not exceed 100 characters' })
  public readonly vendorName!: string;

  /**
   * Vendor version (optional)
   * Example: "v2.1.0", "Latest", "2024-Q3"
   */
  @IsOptional()
  @IsString({ message: 'vendorVersion must be a string' })
  @MaxLength(100, { message: 'vendorVersion must not exceed 100 characters' })
  public readonly vendorVersion?: string;

  /**
   * Merchant contact email (optional)
   * Used for integration notifications and support
   * Example: "contact@merchant.com"
   */
  @IsOptional()
  @IsEmail({}, { message: 'merchantContactEmail must be a valid email address' })
  public readonly merchantContactEmail?: string;

  /**
   * Webhook URL (optional)
   * HTTP/HTTPS endpoint where DrippleX sends integration events
   * Example: "https://api.merchant.com/webhooks/dripplex"
   * Note: Must be valid HTTP/HTTPS URL, HTTPS recommended for production
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'webhookUrl must be a valid HTTP or HTTPS URL' },
  )
  public readonly webhookUrl?: string;

  /**
   * Integration metadata (optional)
   * JSON-serializable custom data for this integration
   * Example: { "branch": "nyc-1", "environment": "production" }
   */
  @IsOptional()
  @IsObject({ message: 'metadata must be a JSON object' })
  public readonly metadata?: Record<string, unknown>;
}
