import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Public, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CATALOGUE_WRITE_SCOPE } from '../catalogue-ingestion.constants';
import { RequireIntegrationScope } from '../decorators/integration-scope.decorator';
import { MerchantScoped } from '../decorators/merchant-scoped.decorator';
import { UpsertCategoryMappingDto } from '../dtos/category-mapping.dto';
import { IngestCatalogueDto } from '../dtos/ingest-catalogue.dto';
import {
  IntegrationCredentialGuard,
  type IntegrationAuthenticatedRequest,
} from '../guards/integration-credential.guard';
import { CatalogueIngestionService } from '../services/catalogue-ingestion.service';
import { CategoryMappingService } from '../services/category-mapping.service';
import { IntegrationsService } from '../services/integrations.service';

import type { CatalogueSyncJobSummary } from '../services/catalogue-ingestion.service';

/**
 * Catalogue synchronisation endpoints.
 *
 * Two audiences, so two authentication schemes on one controller:
 *
 * - the POS pushes a catalogue, authenticating with an integration credential
 *   (`IntegrationCredentialGuard`) — it has no user and no JWT;
 * - the merchant reads their own sync history, authenticating as a signed-in
 *   user (`JwtAuthGuard` + `PermissionsGuard`) like every other route here.
 *
 * `main.ts` calls `setGlobalPrefix('api/v1')`, so the prefix must NOT be
 * repeated here — doing so previously mounted an entire controller at
 * `/api/v1/api/v1/...`, where it answered 401 rather than 404 and so looked
 * alive while being unreachable.
 */
@ApiTags('Integrations')
@Controller('integrations/catalogue')
export class CatalogueSyncController {
  constructor(
    private readonly ingestion: CatalogueIngestionService,
    private readonly integrationsService: IntegrationsService,
    private readonly categoryMappings: CategoryMappingService,
  ) {}

  /**
   * Push a catalogue batch from an external POS.
   *
   * Push-only for Phase 1 (decision #5): DrippleX never polls a POS, so there
   * is no scheduler and no outbound credential involved in catalogue sync.
   */
  @Post('sync')
  // JwtAuthGuard is a global APP_GUARD (app.module.ts). A POS holds an
  // integration credential, never a JWT, so without this the global guard
  // refuses every push with "Authentication required" before
  // IntegrationCredentialGuard is ever consulted — the endpoint is unreachable
  // by the only caller it exists for. @Public() steps the JWT guard aside; it
  // does NOT make the route unauthenticated, because IntegrationCredentialGuard
  // below still has to pass.
  @Public()
  @UseGuards(IntegrationCredentialGuard)
  // Was hard-coded inside the guard. Stated here instead so a second POS route
  // cannot inherit catalogue write by accident.
  @RequireIntegrationScope(CATALOGUE_WRITE_SCOPE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest a catalogue batch from an external POS' })
  @ApiResponse({ status: 200, description: 'Batch accepted; per-item outcome in the summary' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or insufficiently scoped credential',
  })
  public async sync(
    @Req() request: IntegrationAuthenticatedRequest,
    @Body() dto: IngestCatalogueDto,
  ): Promise<{ success: true; data: CatalogueSyncJobSummary }> {
    const integration = request.integration;
    if (!integration) {
      // Unreachable while the guard is attached, and that is exactly why it is
      // checked: if someone ever removes the guard, this fails closed with a
      // 401 instead of ingesting an unauthenticated catalogue.
      throw new UnauthorizedException('Integration credentials required');
    }

    // Empty context on purpose: no user did this, the actor is an integration.
    // Recording a fabricated userId here would put a lie in the audit trail, and
    // `userId` is optional precisely so a non-human actor can be honest.
    const data = await this.ingestion.ingest(integration, dto, {});

    return { success: true, data };
  }

  /**
   * List a merchant's own catalogue sync jobs.
   *
   * Merchant-facing, so it authenticates as a user and reuses the
   * `integrations:read` permission the rest of the module already uses.
   */
  @Get('jobs/:integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'List catalogue sync jobs for an integration' })
  @ApiResponse({ status: 200, description: 'Sync jobs, newest first' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  public async listJobs(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
  ): Promise<{ success: true; data: unknown[] }> {
    // Ownership is checked before anything is read, so one merchant cannot
    // enumerate another's sync history by guessing an integration id.
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    const data = await this.ingestion.listJobs(integrationId);
    return { success: true, data };
  }

  /**
   * Category mappings for one integration.
   *
   * Until these three routes existed, `CategoryMappingService` exposed only
   * `resolve()` and no controller referenced it, so there was no way for a
   * merchant to create a mapping through any API at all. Every POS category
   * therefore ingested unmapped and raised `CATEGORY_UNMAPPED` on every sync,
   * forever. The engine worked; the data it reads had no author.
   */
  @Get('mappings/:integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'List category mappings for an integration' })
  @ApiResponse({ status: 200, description: 'Mappings, by external category name' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  public async listMappings(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
  ): Promise<{ success: true; data: unknown[] }> {
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    const data = await this.categoryMappings.list(integrationId);
    return { success: true, data };
  }

  /**
   * Create or re-point one mapping. Idempotent by `(integration, name)`, so a
   * retry is not an error and re-pointing is the same call as first mapping.
   */
  @Put('mappings/:integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or replace a category mapping' })
  @ApiResponse({ status: 200, description: 'Mapping stored' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  @ApiResponse({ status: 404, description: 'Category does not exist' })
  public async upsertMapping(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body() dto: UpsertCategoryMappingDto,
  ): Promise<{ success: true; data: { externalCategoryName: string; categoryId: string } }> {
    // Ownership first, before the body is acted on: without this a merchant
    // could write mappings into another merchant's integration by supplying
    // its id, which is the one thing a per-integration key must not allow.
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    const mapping = await this.categoryMappings.upsert(
      integrationId,
      dto.externalCategoryName,
      dto.categoryId,
    );
    return {
      success: true,
      data: {
        externalCategoryName: mapping.externalCategoryName,
        categoryId: mapping.categoryId,
      },
    };
  }

  /**
   * Remove a mapping.
   *
   * The name travels as a query parameter rather than a path segment because a
   * POS category is free text — "Drinks / Mixers" would otherwise split the
   * route.
   */
  @Delete('mappings/:integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a category mapping' })
  @ApiResponse({ status: 200, description: 'Mapping removed' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  @ApiResponse({ status: 404, description: 'No such mapping' })
  public async removeMapping(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    // Typed optional because that is the truth at runtime: a caller who omits
    // the parameter gets undefined, and typing it `string` would have the
    // compiler believe a guard here is dead code.
    @Query('externalCategoryName') externalCategoryName: string | undefined,
  ): Promise<{ success: true }> {
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    await this.categoryMappings.remove(integrationId, externalCategoryName ?? '');
    return { success: true };
  }
}
