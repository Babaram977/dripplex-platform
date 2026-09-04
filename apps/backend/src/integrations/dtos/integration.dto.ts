import { IsString, IsOptional, IsUrl, IsEnum, MinLength, MaxLength, IsArray, IsDateString } from 'class-validator';

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
  integrationName: string;

  @IsEnum(PosProvider)
  posProvider: PosProvider;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}

/**
 * Update Integration DTO (status, webhook)
 */
export class UpdateIntegrationDto {
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}

/**
 * Integration Response DTO
 */
export class IntegrationResponseDto {
  id: string;
  merchantId: string;
  integrationName: string;
  posProvider: string;
  status: string;
  webhookUrl: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Credential DTO
 */
export class CreateCredentialDto {
  @IsEnum(CredentialType)
  credentialType: CredentialType;

  @IsString()
  @MinLength(8)
  secret: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

/**
 * Rotate Credential DTO
 */
export class RotateCredentialDto {
  @IsEnum(CredentialType)
  credentialType: CredentialType;

  @IsString()
  @MinLength(8)
  newSecret: string;
}

/**
 * Credential Response DTO
 */
export class CredentialResponseDto {
  id: string;
  credentialType: string;
  publicSuffix: string;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: Date;
}

/**
 * Idempotency header constant
 */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
