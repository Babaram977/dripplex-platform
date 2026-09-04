import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationResponseDto,
} from '../dtos/integration.dto';

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
