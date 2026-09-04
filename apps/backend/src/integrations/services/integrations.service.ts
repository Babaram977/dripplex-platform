import { Injectable } from '@nestjs/common';
import { Prisma, MerchantIntegration } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationResponseDto,
  CreateIntegrationCDto,
  UpdateIntegrationCDto,
  TestIntegrationResponseCDto,
} from '../dtos';

import { SsrfProtectionService } from './ssrf-protection.service';

/**
 * Integration management service with merchant isolation and soft-delete support.
 *
 * CRITICAL REQUIREMENT: All queries must verify merchantId.
 * Every operation returns 403 Forbidden (not 404) when merchant doesn't have access.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ssrfProtection: SsrfProtectionService,
  ) {}

  /**
   * List all active integrations for a merchant.
   */
  public async listIntegrations(
    merchantId: string,
    includeArchived = false,
  ): Promise<IntegrationResponseDto[]> {
    const where: Prisma.MerchantIntegrationWhereInput = { merchantId };

    if (!includeArchived) {
      where.archivedAt = null;
    }

    const integrations = await this.prisma.merchantIntegration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map(this.toResponseDto);
  }

  /**
   * Get a single integration (merchant-scoped).
   *
   * @throws ForbiddenDomainException if merchant doesn't have access (not NotFoundException!)
   */
  public async getIntegration(
    merchantId: string,
    integrationId: string,
  ): Promise<IntegrationResponseDto> {
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: {
        id: integrationId,
        merchantId, // ← CRITICAL: Always verify merchant
        archivedAt: null, // Only return active integrations
      },
    });

    if (!integration) {
      // Return 403, not 404, to prevent enumeration attacks
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    return this.toResponseDto(integration);
  }

  /**
   * Create a new integration for a merchant.
   *
   * @param merchantId Verified merchant ID from request context
   * @param input Integration creation data
   * @param idempotencyKey Optional idempotency key for safe retries
   */
  public async createIntegration(
    merchantId: string,
    input: CreateIntegrationDto,
    idempotencyKey?: string,
  ): Promise<IntegrationResponseDto> {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.prisma.merchantIntegration.findFirst({
        where: {
          merchantId,
          integrationName: input.integrationName,
          posProvider: input.posProvider,
          // Simple idempotency: same merchant, same name, same provider
        },
      });

      if (existing && !existing.archivedAt) {
        // Already exists
        return this.toResponseDto(existing);
      }
    }

    // Create integration (merchantId is forced, not user-controlled)
    const integration = await this.prisma.merchantIntegration.create({
      data: {
        merchantId, // ← Force from context
        integrationName: input.integrationName,
        posProvider: input.posProvider,
        webhookUrl: input.webhookUrl ?? null,
        status: 'ACTIVE',
      },
    });

    // Audit
    await this.auditService.record(
      'integration.created',
      {
        userId: merchantId,
      },
      {
        resource: 'integration',
        resourceId: integration.id,
        metadata: {
          integrationName: integration.integrationName,
          posProvider: integration.posProvider,
        },
      },
    );

    return this.toResponseDto(integration);
  }

  /**
   * Update integration status or webhook URL.
   */
  public async updateIntegration(
    merchantId: string,
    integrationId: string,
    input: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    // Verify access before update
    await this.getIntegration(merchantId, integrationId);

    // Build update data (only include provided fields)
    const data: Prisma.MerchantIntegrationUpdateInput = {};
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.webhookUrl !== undefined) {
      data.webhookUrl = input.webhookUrl;
    }

    // Update
    const integration = await this.prisma.merchantIntegration.update({
      where: { id: integrationId },
      data,
    });

    // Audit
    await this.auditService.record(
      'integration.updated',
      {
        userId: merchantId,
      },
      {
        resource: 'integration',
        resourceId: integration.id,
        metadata: Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      },
    );

    return this.toResponseDto(integration);
  }

  /**
   * Soft-delete an integration (archive it).
   *
   * This prevents the integration from being used but preserves audit history.
   * All related credentials are also archived.
   */
  public async disconnectIntegration(merchantId: string, integrationId: string): Promise<void> {
    // Verify access
    await this.getIntegration(merchantId, integrationId);

    // Archive integration
    await this.prisma.merchantIntegration.update({
      where: { id: integrationId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    // Archive all credentials
    await this.prisma.integrationCredential.updateMany({
      where: { integrationId },
      data: { archivedAt: new Date() },
    });

    // Audit
    await this.auditService.record(
      'integration.disconnected',
      {
        userId: merchantId,
      },
      {
        resource: 'integration',
        resourceId: integrationId,
        metadata: { merchantId },
      },
    );
  }

  /**
   * Check if an integration is active (not archived, not expired).
   */
  public async isIntegrationActive(integrationId: string): Promise<boolean> {
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: {
        id: integrationId,
        archivedAt: null,
        status: 'ACTIVE',
      },
    });

    return !!integration;
  }

  /**
   * Verify merchant access to an integration (throws if no access).
   */
  public async verifyMerchantAccess(merchantId: string, integrationId: string): Promise<void> {
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Access denied');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // MKT-INT-001-C: Integration CRUD API Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * MKT-INT-001-C: Create integration with C API contract
   *
   * Creates integration record with vendorName, vendorVersion, etc.
   * Does NOT create credentials (caller handles credential generation via CredentialsService).
   */
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  public async createIntegrationC(merchantId: string, input: CreateIntegrationCDto): Promise<any> {
    const createData: any = {
      merchantId,
      vendorName: input.vendorName,
      // Legacy fields (will be deprecated)
      integrationName: input.vendorName,
      posProvider: input.vendorVersion ?? 'CUSTOM',
      status: 'ACTIVE',
    };

    if (input.vendorVersion) {
      createData.vendorVersion = input.vendorVersion;
    }
    if (input.merchantContactEmail) {
      createData.merchantContactEmail = input.merchantContactEmail;
    }
    if (input.webhookUrl) {
      // Validate webhook URL for SSRF protection
      this.ssrfProtection.validateUrl(input.webhookUrl);
      createData.webhookUrl = input.webhookUrl;
    }
    if (input.metadata) {
      createData.metadata = input.metadata;
    }

    const integration = await this.prisma.merchantIntegration.create({
      data: createData,
    });

    await this.auditService.record(
      'integration.created',
      { userId: merchantId },
      {
        resource: 'integration',
        resourceId: integration.id,
        metadata: {
          vendorName: input.vendorName,
          vendorVersion: input.vendorVersion,
        },
      },
    );

    return integration;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

  /**
   * MKT-INT-001-C: Get integration with C API contract
   *
   * Returns the integration if it exists and belongs to the merchant.
   * Returns null if merchant doesn't own this integration.
   * By default, excludes archived (soft-deleted) integrations. Set includeArchived=true
   * to include archived items (e.g., for retrieving deleted integration data).
   */
  public async getIntegrationC(
    merchantId: string,
    integrationId: string,
    includeArchived = false,
  ): Promise<MerchantIntegration | null> {
    const where: Prisma.MerchantIntegrationWhereInput = {
      id: integrationId,
      merchantId,
    };

    // Only filter for active items if not including archived
    if (!includeArchived) {
      where.archivedAt = null;
    }

    return await this.prisma.merchantIntegration.findFirst({ where });
  }

  /**
   * Check if an integration exists globally (for distinguishing 404 vs 403 errors).
   * Returns true if the integration exists (regardless of merchant ownership),
   * false if it doesn't exist at all.
   * Excludes archived (soft-deleted) integrations by default.
   */

  public async integrationExists(integrationId: string, includeArchived = false): Promise<boolean> {
    const where: Prisma.MerchantIntegrationWhereInput = { id: integrationId };

    // Exclude archived integrations unless explicitly requested
    if (!includeArchived) {
      where.archivedAt = null;
    }

    const integration = await this.prisma.merchantIntegration.findFirst({
      where,
      select: { id: true },
    });
    return !!integration;
  }
   

  /**
   * MKT-INT-001-C: List integrations with C API contract
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  public async listIntegrationsC(
    merchantId: string,
    limit: number,
    offset: number,
    includeArchived: boolean,
    statusFilter?: string,
  ): Promise<{ integrations: any[]; total: number }> {
    const where: Prisma.MerchantIntegrationWhereInput = {
      merchantId,
    };

    if (!includeArchived) {
      where.archivedAt = null;
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    const [integrations, total] = await Promise.all([
      this.prisma.merchantIntegration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.merchantIntegration.count({ where }),
    ]);

    return { integrations, total };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * MKT-INT-001-C: Update integration with C API contract
   *
   * Returns null if merchant doesn't own this integration (caller should throw 403).
   */
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
  public async updateIntegrationC(
    merchantId: string,
    integrationId: string,
    input: UpdateIntegrationCDto,
  ): Promise<any> {
    // Verify merchant access
    const existing = await this.getIntegrationC(merchantId, integrationId);
    if (!existing) {
      return null;
    }

    const data: Prisma.MerchantIntegrationUpdateInput = {};

    // vendorName is readonly - cannot be updated after creation
    // if (input.vendorName !== undefined) {
    //   data.vendorName = input.vendorName;
    // }

    if (input.vendorVersion !== undefined) {
      data.vendorVersion = input.vendorVersion;
    }
    if (input.merchantContactEmail !== undefined) {
      data.merchantContactEmail = input.merchantContactEmail;
    }
    if (input.webhookUrl !== undefined) {
      // Validate webhook URL for SSRF protection
      this.ssrfProtection.validateUrl(input.webhookUrl);
      data.webhookUrl = input.webhookUrl;
    }
    if (input.metadata !== undefined) {
      data.metadata = input.metadata as any;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    const updated = await this.prisma.merchantIntegration.update({
      where: { id: integrationId },
      data,
    });

    await this.auditService.record(
      'integration.updated',
      { userId: merchantId },
      {
        resource: 'integration',
        resourceId: integrationId,
        metadata: Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      },
    );

    return updated;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

  /**
   * MKT-INT-001-C: Delete integration (soft-delete)
   *
   * Returns true if deleted, false if merchant doesn't own this integration.
   */
   
  public async deleteIntegrationC(merchantId: string, integrationId: string): Promise<boolean> {
    // Verify merchant access
    const existing = await this.getIntegrationC(merchantId, integrationId);
    if (!existing) {
      return false;
    }

    // Soft-delete integration
    await this.prisma.merchantIntegration.update({
      where: { id: integrationId },
      data: {
        archivedAt: new Date(),
        status: 'ARCHIVED',
      },
    });

    // Archive all credentials
    await this.prisma.integrationCredential.updateMany({
      where: { integrationId },
      data: { archivedAt: new Date() },
    });

    await this.auditService.record(
      'integration.deleted',
      { userId: merchantId },
      {
        resource: 'integration',
        resourceId: integrationId,
        metadata: { merchantId },
      },
    );

    return true;
  }
   

  /**
   * MKT-INT-001-C: Test integration connectivity
   *
   * Tests webhook connectivity by sending HTTP GET to configured webhook URL.
   * Returns null if merchant doesn't own this integration.
   *
   * SSRF Protection: Validates destination URL before making any request.
   * Blocks loopback, private IPs, cloud metadata endpoints, and other internal ranges.
   */
   
  public async testIntegrationC(
    merchantId: string,
    integrationId: string,
  ): Promise<TestIntegrationResponseCDto | null> {
    const integration = await this.getIntegrationC(merchantId, integrationId);
    if (!integration) {
      return null;
    }

    const testedAt = new Date();

    // If no webhook URL configured, return UNCONFIGURED
    if (!integration.webhookUrl) {
      await this.auditService.record(
        'integration.test',
        { userId: merchantId },
        {
          resource: 'integration',
          resourceId: integrationId,
          metadata: { status: 'UNCONFIGURED' },
        },
      );

      return {
        status: 'UNCONFIGURED',
        message: 'Webhook URL not configured for this integration',
        testedAt: testedAt.toISOString(),
      };
    }

    // SSRF Protection: Validate URL before making request
    try {
       
      this.ssrfProtection.validateUrl(integration.webhookUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'URL validation failed';

      await this.auditService.record(
        'integration.test',
        { userId: merchantId },
        {
          resource: 'integration',
          resourceId: integrationId,
          metadata: {
            status: 'BLOCKED',
            error: 'ssrf_protection',
            reason: errorMessage,
          },
        },
      );

      return {
        status: 'FAILED',
        message: `Webhook validation failed: ${errorMessage}`,
        testedAt: testedAt.toISOString(),
      };
    }

    // Test webhook connectivity
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000); // 5 second timeout

       
      const response = await fetch(integration.webhookUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isSuccess = response.status >= 200 && response.status < 300;

      await this.auditService.record(
        'integration.test',
        { userId: merchantId },
        {
          resource: 'integration',
          resourceId: integrationId,
          metadata: {
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            httpStatus: response.status,
            latencyMs,
          },
        },
      );

      const status = response.status;
      return {
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        message: isSuccess
          ? `Webhook responded successfully (HTTP ${String(status)})`
          : `Webhook returned HTTP ${String(status)}`,
        latencyMs,
        httpStatus: status,
        testedAt: testedAt.toISOString(),
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';

      await this.auditService.record(
        'integration.test',
        { userId: merchantId },
        {
          resource: 'integration',
          resourceId: integrationId,
          metadata: {
            status: 'FAILED',
            error: isTimeout ? 'timeout' : 'connection_error',
          },
        },
      );

      return {
        status: 'FAILED',
        message: isTimeout
          ? 'Webhook unreachable: request timeout after 5 seconds'
          : 'Webhook unreachable: connection error',
        testedAt: testedAt.toISOString(),
      };
    }
  }
   

  /**
   * Internal: Convert database model to DTO
   */
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  private readonly toResponseDto = (integration: any): IntegrationResponseDto => {
    return {
      id: integration.id,
      merchantId: integration.merchantId,
      integrationName: integration.integrationName,
      posProvider: integration.posProvider,
      status: integration.status,
      webhookUrl: integration.webhookUrl,
      lastSyncedAt: integration.lastSyncedAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  };
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
}
