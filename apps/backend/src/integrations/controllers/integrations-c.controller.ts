import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MerchantScoped } from '../decorators/merchant-scoped.decorator';
import {
  CreateIntegrationCDto,
  UpdateIntegrationCDto,
  IntegrationResponseCDto,
  CreateIntegrationResponseCDto,
  ListIntegrationsResponseCDto,
  TestIntegrationResponseCDto,
} from '../dtos';
import { CredentialsService } from '../services/credentials.service';
import { IntegrationsService } from '../services/integrations.service';

/**
 * MKT-INT-001-C: Integration Management API
 *
 * Six REST endpoints for creating, reading, updating, and deleting merchant integrations.
 *
 * All endpoints require JWT authentication and enforce merchant isolation.
 * Merchant scoping is automatic via @MerchantScoped decorator.
 *
 * Routes:
 * - POST   /api/v1/integrations             (create new integration + generate API key)
 * - GET    /api/v1/integrations             (list merchant's integrations)
 * - GET    /api/v1/integrations/{id}        (get single integration details)
 * - PUT    /api/v1/integrations/{id}        (update integration metadata)
 * - DELETE /api/v1/integrations/{id}        (soft-delete integration)
 * - GET    /api/v1/integrations/{id}/test   (test webhook connectivity)
 *
 * IMPORTANT: This controller uses the correct NestJS pattern:
 * @Controller('integrations')  // NOT @Controller('api/v1/integrations')
 *
 * The global prefix 'api/v1' is applied automatically via app.setGlobalPrefix()
 * in main.ts. Using 'api/v1/integrations' here would create /api/v1/api/v1/integrations (double prefix).
 */
@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsCController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly credentialsService: CredentialsService,
  ) {}

  /**
   * Endpoint 1: Create Integration
   *
   * POST /api/v1/integrations
   *
   * Creates a new integration and generates an initial API key credential.
   * The plaintext key is returned ONCE in the response.
   * Subsequent requests return only the masked publicSuffix.
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param input CreateIntegrationCDto with vendorName (required) and optional fields
   * @param headers Request headers (used to extract idempotency key if present)
   * @returns CreateIntegrationResponseCDto with plaintext apiKey, credential, and default scopes
   */
  @Post()
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create integration',
    description: 'Creates a new merchant integration and generates an initial API key credential',
  })
  @ApiBody({ type: CreateIntegrationCDto })
  @ApiResponse({
    status: 201,
    description: 'Integration created with plaintext API key',
    type: CreateIntegrationResponseCDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Merchant context missing' })
  public async create(
    @MerchantScoped() merchantId: string,
    @Body() input: CreateIntegrationCDto,
  ): Promise<CreateIntegrationResponseCDto> {
    // Create integration record in database
    const integration = await this.integrationsService.createIntegrationC(merchantId, input);

    // Generate API key credential for this integration
    // Default scopes per C-PLAN
    const defaultScopes = [
      'catalog:read',
      'catalog:write',
      'inventory:read',
      'inventory:write',
      'orders:read',
      'orders:write',
    ];

    // Generate plaintext key
    const plaintextKey = `drx_${randomUUID()}`;

    // Call B.1 CredentialsService to create hashed/encrypted credential
    const credential = await this.credentialsService.createCredential(merchantId, {
      integrationId: integration.id,
      credentialType: 'OUTGOING_API_KEY',
      secret: plaintextKey,
      scopes: defaultScopes,
    });

    // Build response with plaintext key (returned once only)
    const response: CreateIntegrationResponseCDto = {
      integrationId: integration.id,
      merchantId: integration.merchantId,
      vendorName: integration.vendorName,
      status: integration.status as 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'ERROR',
      createdAt: integration.createdAt.toISOString(),
      credentials: [
        {
          id: credential.id,
          createdAt: credential.createdAt.toISOString(),
          status: credential.status as 'ACTIVE' | 'REVOKED',
          publicSuffix: credential.publicSuffix,
          scopes: credential.scopes,
        },
      ],
      apiKey: plaintextKey, // ← PLAINTEXT KEY returned once only
      scopes: defaultScopes,
      credential: {
        id: credential.id,
        createdAt: credential.createdAt.toISOString(),
        scopes: defaultScopes,
      },
    };

    // Add optional fields if they have values
    if (integration.vendorVersion) {
      response.vendorVersion = integration.vendorVersion;
    }
    if (integration.merchantContactEmail) {
      response.merchantContactEmail = integration.merchantContactEmail;
    }
    if (integration.webhookUrl) {
      response.webhookUrl = integration.webhookUrl;
    }
    if (integration.metadata) {
      response.metadata = integration.metadata as Record<string, unknown>;
    }
    if (integration.updatedAt) {
      response.updatedAt = integration.updatedAt.toISOString();
    }
    if (integration.archivedAt) {
      response.archivedAt = integration.archivedAt.toISOString();
    } else {
      response.archivedAt = null;
    }

    return response;
  }

  /**
   * Endpoint 2: List Integrations
   *
   * GET /api/v1/integrations
   *
   * Lists all active integrations for the authenticated merchant.
   * Supports pagination and filtering.
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param includeArchived If "true", include soft-deleted integrations (admin only)
   * @param limit Page size (1-100, default 20)
   * @param offset Page offset (default 0)
   * @param status Optional status filter
   * @returns ListIntegrationsResponseCDto with paginated integrations
   */
  @Get()
  @RequirePermissions('integrations:read')
  @ApiOperation({
    summary: 'List integrations',
    description: "Lists all authenticated merchant's integrations with pagination",
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted integrations (admin only)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (1-100, default 20)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Page offset (default 0)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status (ACTIVE, PAUSED, REVOKED, ERROR)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of integrations with pagination',
    type: ListIntegrationsResponseCDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Merchant context missing or includeArchived unauthorized',
  })
  public async list(
    @MerchantScoped() merchantId: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ): Promise<ListIntegrationsResponseCDto> {
    const pageLimit = Math.min(Math.max(parseInt(limit ?? '20', 10), 1), 100);
    const pageOffset = Math.max(parseInt(offset ?? '0', 10), 0);
    const archived = includeArchived === 'true';

    const result = await this.integrationsService.listIntegrationsC(
      merchantId,
      pageLimit,
      pageOffset,
      archived,
      status,
    );

    return {
      data: result.integrations.map((i) => this.toResponseDto(i)),
      pagination: {
        total: result.total,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + pageLimit < result.total,
      },
    };
  }

  /**
   * Endpoint 3: Get Single Integration
   *
   * GET /api/v1/integrations/{integrationId}
   *
   * Retrieves a single integration with full details including credentials.
   * Returns 403 Forbidden (not 404) if merchant doesn't own this integration.
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param integrationId UUID path parameter
   * @returns IntegrationResponseCDto with full integration details
   */
  @Get(':integrationId')
  @RequirePermissions('integrations:read')
  @ApiOperation({
    summary: 'Get integration',
    description: 'Retrieves a single integration with full details and credentials',
  })
  @ApiParam({
    name: 'integrationId',
    description: 'Integration UUID',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted (archived) integrations in results',
  })
  @ApiResponse({
    status: 200,
    description: 'Integration details',
    type: IntegrationResponseCDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Cross-merchant access attempt (per CRIT-006)',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  public async getOne(
    @MerchantScoped() merchantId: string,
    @Param('integrationId') integrationId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<IntegrationResponseCDto> {
    const include = includeArchived === 'true' || includeArchived === '1';
    let integration;
    try {
      integration = await this.integrationsService.getIntegrationC(
        merchantId,
        integrationId,
        include,
      );
    } catch (_error) {
      // Prisma errors on invalid UUID format or other DB issues
      throw new ForbiddenException('Integration not found or access denied');
    }

    if (!integration) {
      // Check if the integration exists globally to distinguish 404 vs 403
      try {
        const exists = await this.integrationsService.integrationExists(integrationId);
        if (exists) {
          // Integration exists but belongs to a different merchant (cross-merchant access)
          throw new ForbiddenException('Integration not found or access denied');
        } else {
          // Integration doesn't exist at all
          throw new NotFoundException('Integration not found');
        }
      } catch (error) {
        // If it's a NotFoundException or ForbiddenException, re-throw it
        if (error instanceof NotFoundException || error instanceof ForbiddenException) {
          throw error;
        }
        // For any other error, default to 403
        throw new ForbiddenException('Integration not found or access denied');
      }
    }

    // Load credentials for this integration (including archived if requested)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let credentials: any[] = [];
    try {
      credentials = await this.credentialsService.listCredentials(
        merchantId,
        integrationId,
        include,
      );
    } catch (_error) {
      // If credential loading fails, continue with empty credentials
      credentials = [];
    }

    return this.toResponseDtoWithCredentials(integration, credentials);
  }

  /**
   * Endpoint 4: Update Integration
   *
   * PUT /api/v1/integrations/{integrationId}
   *
   * Updates integration metadata (vendorName, webhookUrl, status, etc.)
   * Credentials are NOT modified here (D phase responsibility).
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param integrationId UUID path parameter
   * @param input UpdateIntegrationCDto with optional fields to update
   * @returns IntegrationResponseCDto with updated values
   */
  @Put(':integrationId')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update integration',
    description: 'Updates integration metadata (vendorName, webhookUrl, status, etc.)',
  })
  @ApiParam({
    name: 'integrationId',
    description: 'Integration UUID',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateIntegrationCDto })
  @ApiResponse({
    status: 200,
    description: 'Integration updated',
    type: IntegrationResponseCDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Cross-merchant update attempt',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  public async update(
    @MerchantScoped() merchantId: string,
    @Param('integrationId') integrationId: string,
    @Body() input: UpdateIntegrationCDto,
  ): Promise<IntegrationResponseCDto> {
    const integration = await this.integrationsService.updateIntegrationC(
      merchantId,
      integrationId,
      input,
    );

    if (!integration) {
      throw new ForbiddenException('Integration not found or access denied');
    }

    return this.toResponseDto(integration);
  }

  /**
   * Endpoint 5: Delete Integration (Soft-Delete)
   *
   * DELETE /api/v1/integrations/{integrationId}
   *
   * Soft-deletes an integration (sets archivedAt timestamp).
   * Also revokes all associated credentials.
   * Does NOT perform destructive DELETE.
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param integrationId UUID path parameter
   * @returns 204 No Content
   */
  @Delete(':integrationId')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete integration',
    description: 'Soft-deletes an integration and revokes all associated credentials',
  })
  @ApiParam({
    name: 'integrationId',
    description: 'Integration UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Integration soft-deleted',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Cross-merchant delete attempt',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  public async delete(
    @MerchantScoped() merchantId: string,
    @Param('integrationId') integrationId: string,
  ): Promise<void> {
    const success = await this.integrationsService.deleteIntegrationC(merchantId, integrationId);

    if (!success) {
      throw new ForbiddenException('Integration not found or access denied');
    }
  }

  /**
   * Endpoint 6: Test Integration Connectivity
   *
   * GET /api/v1/integrations/{integrationId}/test
   *
   * Tests webhook connectivity by sending an HTTP GET request to the configured webhook URL.
   * Measures latency and captures response status.
   *
   * Test behavior:
   * - If webhookUrl configured: HTTP GET with 5-second timeout
   *   - Measure latency, capture status code
   *   - Return status=SUCCESS for HTTP 2xx, status=FAILED otherwise
   * - If webhookUrl NOT configured: Return status=UNCONFIGURED
   *
   * @param merchantId Extracted from JWT context via @MerchantScoped
   * @param integrationId UUID path parameter
   * @returns TestIntegrationResponseCDto with test result
   */
  @Get(':integrationId/test')
  @RequirePermissions('integrations:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test integration',
    description: 'Tests webhook connectivity and returns latency/status',
  })
  @ApiParam({
    name: 'integrationId',
    description: 'Integration UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Test result',
    type: TestIntegrationResponseCDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({
    status: 403,
    description: 'Cross-merchant test attempt',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiResponse({ status: 504, description: 'Webhook unreachable after 5-second timeout' })
  public async test(
    @MerchantScoped() merchantId: string,
    @Param('integrationId') integrationId: string,
  ): Promise<TestIntegrationResponseCDto> {
    const result = await this.integrationsService.testIntegrationC(merchantId, integrationId);

    if (!result) {
      throw new ForbiddenException('Integration not found or access denied');
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal Helper Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Convert database integration record to IntegrationResponseCDto with credentials
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private toResponseDtoWithCredentials(
    integration: {
      id: string;
      merchantId: string;
      vendorName: string;
      vendorVersion: string | null;
      merchantContactEmail: string | null;
      status: string;
      webhookUrl: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    },
    credentials: any[],
  ): IntegrationResponseCDto {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const response: IntegrationResponseCDto = {
      integrationId: integration.id,
      merchantId: integration.merchantId,
      vendorName: integration.vendorName,
      status: integration.status as 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'ERROR',
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
      credentials: credentials.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        status: c.status as 'ACTIVE' | 'REVOKED',
        publicSuffix: c.publicSuffix,
        scopes: c.scopes,
      })),
    };

    // Add optional fields if they have values
    if (integration.vendorVersion) {
      response.vendorVersion = integration.vendorVersion;
    }
    if (integration.merchantContactEmail) {
      response.merchantContactEmail = integration.merchantContactEmail;
    }
    if (integration.webhookUrl) {
      response.webhookUrl = integration.webhookUrl;
    }
    if (integration.metadata) {
      response.metadata = integration.metadata;
    }
    if (integration.archivedAt) {
      response.archivedAt = integration.archivedAt.toISOString();
    } else {
      response.archivedAt = null;
    }

    return response;
  }

  /**
   * Convert database integration record to IntegrationResponseCDto
   */
  private toResponseDto(integration: {
    id: string;
    merchantId: string;
    vendorName: string;
    vendorVersion: string | null;
    merchantContactEmail: string | null;
    status: string;
    webhookUrl: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }): IntegrationResponseCDto {
    const response: IntegrationResponseCDto = {
      integrationId: integration.id,
      merchantId: integration.merchantId,
      vendorName: integration.vendorName,
      status: integration.status as 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'ERROR',
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
      credentials: [],
    };

    // Add optional fields if they have values
    if (integration.vendorVersion) {
      response.vendorVersion = integration.vendorVersion;
    }
    if (integration.merchantContactEmail) {
      response.merchantContactEmail = integration.merchantContactEmail;
    }
    if (integration.webhookUrl) {
      response.webhookUrl = integration.webhookUrl;
    }
    if (integration.metadata) {
      response.metadata = integration.metadata;
    }
    if (integration.archivedAt) {
      response.archivedAt = integration.archivedAt.toISOString();
    } else {
      response.archivedAt = null;
    }

    return response;
  }
}
