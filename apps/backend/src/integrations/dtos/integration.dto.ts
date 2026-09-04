import {
  IsString,
  IsOptional,
  IsUrl,
  IsEnum,
  MinLength,
  MaxLength,
  IsArray,
  IsDateString,
} from 'class-validator';

export enum PosProvider {
  SQUARE = 'SQUARE',
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
  CUSTOM = 'CUSTOM',
}

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum CredentialType {
  INCOMING_API_KEY = 'INCOMING_API_KEY',
  INCOMING_SIGNATURE = 'INCOMING_SIGNATURE',
  OUTGOING_API_KEY = 'OUTGOING_API_KEY',
  OUTGOING_OAUTH_TOKEN = 'OUTGOING_OAUTH_TOKEN',
  OUTGOING_OAUTH_REFRESH = 'OUTGOING_OAUTH_REFRESH',
}

/**
 * Create Integration DTO
 */
export class CreateIntegrationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public readonly integrationName!: string;

  @IsEnum(PosProvider)
  public readonly posProvider!: PosProvider;

  @IsOptional()
  @IsUrl()
  public readonly webhookUrl?: string;
}

/**
 * Update Integration DTO (status, webhook)
 */
export class UpdateIntegrationDto {
  @IsOptional()
  @IsEnum(IntegrationStatus)
  public readonly status?: IntegrationStatus;

  @IsOptional()
  @IsUrl()
  public readonly webhookUrl?: string;
}

/**
 * Integration Response DTO
 */
export class IntegrationResponseDto {
  public readonly id!: string;
  public readonly merchantId!: string;
  public readonly integrationName!: string;
  public readonly posProvider!: string;
  public readonly status!: string;
  public readonly webhookUrl!: string | null;
  public readonly lastSyncedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

/**
 * Create Credential DTO
 */
export class CreateCredentialDto {
  @IsEnum(CredentialType)
  public readonly credentialType!: CredentialType;

  @IsString()
  @MinLength(8)
  public readonly secret!: string;

  @IsOptional()
  @IsDateString()
  public readonly expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public readonly scopes?: string[];
}

/**
 * Rotate Credential DTO
 */
export class RotateCredentialDto {
  @IsEnum(CredentialType)
  public readonly credentialType!: CredentialType;

  @IsString()
  @MinLength(8)
  public readonly newSecret!: string;
}

/**
 * Credential Response DTO
 */
export class CredentialResponseDto {
  public readonly id!: string;
  public readonly credentialType!: string;
  public readonly publicSuffix!: string;
  public readonly expiresAt!: Date | null;
  public readonly rotatedAt!: Date | null;
  public readonly status!: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  public readonly createdAt!: Date;
}

/**
 * Idempotency header constant
 */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
