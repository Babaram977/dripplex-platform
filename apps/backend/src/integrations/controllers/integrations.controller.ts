import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Query,
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
  CreateIntegrationDto,
  UpdateIntegrationDto,
  CreateCredentialDto,
  RotateCredentialDto,
  IDEMPOTENCY_KEY_HEADER,
} from '../dtos/integration.dto';
import { CredentialsService } from '../services/credentials.service';
import { IntegrationsService } from '../services/integrations.service';

/**
 * Integration management API endpoints.
 *
 * All endpoints require JWT authentication and enforce merchant isolation.
 * Merchant scoping is automatic via @MerchantScoped decorator.
 */
@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly credentialsService: CredentialsService,
  ) {}

  /**
   * List all active integrations for the authenticated merchant.
   */
  @Get()
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'List integrations' })
  @ApiResponse({
    status: 200,
    description: 'List of active integrations',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/IntegrationResponseDto' } },
        count: { type: 'number' },
      },
    },
  })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  public async list(
    @MerchantScoped() merchantId: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<{ data: unknown[]; count: number }> {
    const data = await this.integrationsService.listIntegrations(
      merchantId,
      includeArchived === 'true',
    );
    return { data, count: data.length };
  }

  /**
   * Get a single integration by ID.
   */
  @Get(':id')
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'Get integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Not found' })
  public async getOne(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
  ): Promise<unknown> {
    return await this.integrationsService.getIntegration(merchantId, integrationId);
  }

  /**
   * Create a new integration.
   */
  @Post()
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create integration' })
  @ApiBody({ type: CreateIntegrationDto })
  @ApiResponse({ status: 201, description: 'Integration created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Idempotency conflict' })
  public async create(
    @MerchantScoped() merchantId: string,
    @Body() input: CreateIntegrationDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    const idempotencyKey = headers[IDEMPOTENCY_KEY_HEADER];
    return await this.integrationsService.createIntegration(
      merchantId,
      input,
      idempotencyKey as string | undefined,
    );
  }

  /**
   * Update integration (status, webhook URL).
   */
  @Patch(':id')
  @RequirePermissions('integrations:write')
  @ApiOperation({ summary: 'Update integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiBody({ type: UpdateIntegrationDto })
  @ApiResponse({ status: 200, description: 'Integration updated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Not found' })
  public async update(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
    @Body() input: UpdateIntegrationDto,
  ): Promise<unknown> {
    return await this.integrationsService.updateIntegration(merchantId, integrationId, input);
  }

  /**
   * Disconnect integration (soft-delete).
   */
  @Delete(':id')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({ status: 204, description: 'Integration disconnected' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Not found' })
  public async disconnect(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
  ): Promise<void> {
    await this.integrationsService.disconnectIntegration(merchantId, integrationId);
  }

  // ─────────────────────────────────────────────────────────────────
  // Credential Management Endpoints
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create or rotate a credential for an integration.
   */
  @Post(':id/credentials')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create credential' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiBody({ type: CreateCredentialDto })
  @ApiResponse({ status: 201, description: 'Credential created' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  public async createCredential(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
    @Body() input: CreateCredentialDto,
  ): Promise<unknown> {
    return await this.credentialsService.createCredential(merchantId, {
      integrationId,
      credentialType: input.credentialType,
      secret: input.secret,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      scopes: input.scopes,
    });
  }

  /**
   * List all active credentials for an integration.
   */
  @Get(':id/credentials')
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'List credentials' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'List of credentials',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/CredentialResponseDto' } },
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  public async listCredentials(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
  ): Promise<{ data: unknown[]; count: number }> {
    const data = await this.credentialsService.listCredentials(merchantId, integrationId);
    return { data, count: data.length };
  }

  /**
   * Rotate a credential (revoke old, create new).
   */
  @Post(':id/credentials/:credentialId/rotate')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Rotate credential' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiParam({ name: 'credentialId', description: 'Credential ID' })
  @ApiBody({ type: RotateCredentialDto })
  @ApiResponse({ status: 201, description: 'Credential rotated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Not found' })
  public async rotateCredential(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
    @Param('credentialId') _credentialId: string,
    @Body() input: RotateCredentialDto,
  ): Promise<unknown> {
    // Note: credentialId is for future use if we support multiple creds per type
    // For now, rotation is by type
    return await this.credentialsService.rotateCredential(
      merchantId,
      integrationId,
      input.credentialType,
      input.newSecret,
    );
  }

  /**
   * Revoke a credential (soft-delete).
   */
  @Delete(':id/credentials/:credentialId')
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke credential' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiParam({ name: 'credentialId', description: 'Credential ID' })
  @ApiResponse({ status: 204, description: 'Credential revoked' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Not found' })
  public async revokeCredential(
    @MerchantScoped() merchantId: string,
    @Param('id') integrationId: string,
    @Param('credentialId') _credentialId: string,
  ): Promise<void> {
    await this.credentialsService.revokeCredential(merchantId, integrationId, _credentialId);
  }
}
