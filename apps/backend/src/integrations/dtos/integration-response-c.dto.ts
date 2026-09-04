/**
 * MKT-INT-001-C: Integration Response DTO
 *
 * API Contract per C-PLAN.md
 * Used in responses for GET, PUT endpoints and in POST 201 response
 */
export class IntegrationResponseCDto {
  // ─────────────────────────────────────────────────────────────────
  // Core Fields
  // ─────────────────────────────────────────────────────────────────

  /** Integration UUID */
  public integrationId!: string;

  /** Merchant UUID (for verification) */
  public merchantId!: string;

  /** Vendor name (required) */
  public vendorName!: string;

  /** Vendor version (optional) */
  public vendorVersion?: string;

  /** Merchant contact email (optional) */
  public merchantContactEmail?: string;

  /** Integration status: ACTIVE | PAUSED | REVOKED | ERROR */
  public status!: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'ERROR';

  /** Webhook URL (optional) */
  public webhookUrl?: string;

  /** Custom metadata (optional) */
  public metadata?: Record<string, unknown>;

  /** ISO8601 timestamp of creation */
  public createdAt!: string;

  /** ISO8601 timestamp of last update */
  public updatedAt?: string;

  /** ISO8601 timestamp of soft-delete (null if active) */
  public archivedAt?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Credential Information
  // ─────────────────────────────────────────────────────────────────

  /**
   * Array of credentials associated with this integration
   * Each credential object contains:
   * - id: credential UUID
   * - createdAt: ISO8601 timestamp
   * - status: ACTIVE | REVOKED
   * - publicSuffix: masked credential (e.g., "****...abc123")
   * - scopes: array of permission scopes
   * - lastUsedAt: ISO8601 timestamp of last usage (optional)
   */
  public credentials!: Array<{
    id: string;
    createdAt: string;
    status: 'ACTIVE' | 'REVOKED';
    publicSuffix: string;
    scopes: string[];
    lastUsedAt?: string;
  }>;

  // ─────────────────────────────────────────────────────────────────
  // Last Sync Information (optional)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Last synchronization details (if available)
   * Contains:
   * - type: catalog | inventory | orders
   * - status: PENDING | IN_PROGRESS | COMPLETED | FAILED
   * - completedAt: ISO8601 timestamp (if completed)
   */
  public lastSync?: {
    type: 'catalog' | 'inventory' | 'orders';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    completedAt?: string;
  };
}

/**
 * Create Integration Response DTO (POST 201)
 *
 * Extends IntegrationResponseCDto to include the plaintext API key
 * returned ONLY once at creation time
 */
export class CreateIntegrationResponseCDto extends IntegrationResponseCDto {
  /**
   * Plaintext API key (returned ONLY once at creation)
   * Subsequent GETs return masked publicSuffix only
   *
   * Security: This is the ONLY time the plaintext key is revealed.
   * The merchant MUST save it; DrippleX cannot retrieve it.
   */
  public apiKey!: string;

  /**
   * Default scopes assigned to this integration's credential
   * Example: ["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write"]
   */
  public scopes!: string[];

  /**
   * Credential metadata (mirrors the credential object structure)
   * Contains: id, createdAt, scopes
   */
  public credential!: {
    id: string;
    createdAt: string;
    scopes: string[];
  };
}

/**
 * List Integrations Response DTO (GET /api/v1/integrations)
 *
 * Paginated response containing merchant's integrations
 */
export class ListIntegrationsResponseCDto {
  /** Array of integration objects */
  public data!: IntegrationResponseCDto[];

  /** Pagination metadata */
  public pagination!: {
    /** Total number of integrations (excluding archived if not requested) */
    total: number;
    /** Page size (limit parameter used) */
    limit: number;
    /** Offset used in query */
    offset: number;
    /** Whether more results exist beyond this page */
    hasMore: boolean;
  };
}

/**
 * Test Integration Response DTO (GET /api/v1/integrations/{id}/test)
 *
 * Result of testing webhook connectivity
 */
export class TestIntegrationResponseCDto {
  /** Test result: SUCCESS | FAILED | UNCONFIGURED */
  public status!: 'SUCCESS' | 'FAILED' | 'UNCONFIGURED';

  /** Human-readable message describing the result */
  public message!: string;

  /** HTTP response latency in milliseconds (if tested) */
  public latencyMs?: number;

  /** HTTP status code returned by webhook (if tested) */
  public httpStatus?: number;

  /** ISO8601 timestamp of when test was performed */
  public testedAt!: string;
}
