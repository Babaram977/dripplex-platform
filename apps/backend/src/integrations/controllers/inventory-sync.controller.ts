import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Public, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { INVENTORY_WRITE_SCOPE } from '../catalogue-ingestion.constants';
import { RequireIntegrationScope } from '../decorators/integration-scope.decorator';
import { MerchantScoped } from '../decorators/merchant-scoped.decorator';
import { UpdateInventoryDto } from '../dtos/update-inventory.dto';
import {
  IntegrationCredentialGuard,
  type IntegrationAuthenticatedRequest,
} from '../guards/integration-credential.guard';
import { IDEMPOTENCY_KEY_HEADER, requireIdempotencyKey } from '../idempotency-key';
import { IntegrationsService } from '../services/integrations.service';
import { InventoryIngestionService } from '../services/inventory-ingestion.service';

import type { InventoryLevel, InventorySyncSummary } from '../services/inventory-ingestion.service';

/**
 * Stock level synchronisation (MKT-INT-001-J).
 *
 * Separate from `CatalogueSyncController` because the two have different
 * audiences and different credential scopes: a catalogue push rewrites names,
 * prices and categories; a stock push moves numbers. A till that only reports
 * counts should not be able to reprice a merchant's shelf, which is why this
 * route requires `inventory:write` and the catalogue route requires
 * `catalog:write`.
 *
 * `main.ts` calls `setGlobalPrefix('api/v1')`, so the prefix must NOT be
 * repeated here — doing so previously mounted an entire controller at
 * `/api/v1/api/v1/...`, where it answered 401 rather than 404 and so looked
 * alive while being unreachable.
 */
@ApiTags('Integrations')
@Controller('integrations/inventory')
export class InventorySyncController {
  constructor(
    private readonly inventory: InventoryIngestionService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Push absolute stock levels from an external POS.
   *
   * Answers 200 with the per-item outcome, not the 202 the backlog sketched.
   * The work is finished by the time this returns — there is no queue behind
   * it — and 202 would promise a later result that never arrives. Recorded as
   * a divergence in docs/DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md.
   */
  // `sync`, not the bare controller path. `IntegrationsCController` registers
  // `PUT /integrations/:integrationId` first, and Express matches in
  // registration order, so a bare `PUT /integrations/inventory` was swallowed
  // by it — the CRUD route read "inventory" as an integration id and answered
  // 401, which looked exactly like this route refusing an unauthenticated
  // caller. Mirrors `catalogue/sync`, and a two-segment literal path cannot
  // collide with a one-segment parameter no matter what order anything is
  // registered in.
  @Put('sync')
  // JwtAuthGuard is a global APP_GUARD (app.module.ts). A POS holds an
  // integration credential, never a JWT, so without this the global guard
  // refuses every push before IntegrationCredentialGuard is ever consulted.
  // @Public() steps the JWT guard aside; it does NOT make the route
  // unauthenticated, because the credential guard below still has to pass.
  @Public()
  @UseGuards(IntegrationCredentialGuard)
  @RequireIntegrationScope(INVENTORY_WRITE_SCOPE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Push absolute stock levels from an external POS' })
  @ApiResponse({ status: 200, description: 'Batch processed; per-item outcome in the summary' })
  @ApiResponse({ status: 400, description: 'Missing or malformed Idempotency-Key header' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or insufficiently scoped credential',
  })
  public async push(
    @Req() request: IntegrationAuthenticatedRequest,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Body() dto: UpdateInventoryDto,
  ): Promise<{ success: true; data: InventorySyncSummary }> {
    const integration = request.integration;
    if (!integration) {
      // Unreachable while the guard is attached, and that is exactly why it is
      // checked: if someone ever removes the guard, this fails closed with a
      // 401 instead of moving an unauthenticated merchant's stock.
      throw new UnauthorizedException('Integration credentials required');
    }

    const batchKey = requireIdempotencyKey(idempotencyKey);

    // Empty context on purpose: no user did this, the actor is an integration.
    // Recording a fabricated userId here would put a lie in the audit trail,
    // and `userId` is optional precisely so a non-human actor can be honest.
    const data = await this.inventory.applyBatch(integration, dto.items, batchKey, {});

    return { success: true, data };
  }

  /**
   * A merchant's current stock levels for one integration's mapped SKUs.
   *
   * Merchant-facing, so it authenticates as a user and reuses the
   * `integrations:read` permission the rest of the module already uses.
   */
  // `levels/:integrationId` for the same reason, and for symmetry with
  // `catalogue/jobs/:integrationId`.
  @Get('levels/:integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'List current stock levels for an integration' })
  @ApiResponse({ status: 200, description: 'Stock levels by external SKU' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  public async listLevels(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
  ): Promise<{ success: true; data: InventoryLevel[] }> {
    // Ownership is checked before anything is read, so one merchant cannot
    // enumerate another's stock by guessing an integration id.
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    const data = await this.inventory.listLevels(integrationId);
    return { success: true, data };
  }
}
