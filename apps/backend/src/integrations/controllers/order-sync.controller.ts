import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/permissions.decorator';
import { RequireIntegrationScope } from '../decorators/integration-scope.decorator';
import { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import {
  IntegrationCredentialGuard,
  type IntegrationAuthenticatedRequest,
} from '../guards/integration-credential.guard';
import { IDEMPOTENCY_KEY_HEADER, requireIdempotencyKey } from '../idempotency-key';
import {
  MAX_POS_ORDER_PAGE_SIZE,
  ORDERS_READ_SCOPE,
  ORDERS_WRITE_SCOPE,
} from '../order-sync.constants';
import { OrderStatusIngestionService } from '../services/order-status-ingestion.service';

import type {
  OrderStatusSyncResult,
  PosOrderPage,
  PosOrderView,
} from '../services/order-status-ingestion.service';

/**
 * Order synchronisation with an external POS (MKT-INT-001-L, inbound half).
 *
 * Every route here is POS-facing and authenticates with an integration
 * credential. There is no merchant-facing route on this controller: a merchant
 * reads their own orders through the merchant portal, which shows them
 * everything, while these responses are deliberately narrowed to what a third
 * party may see.
 *
 * `main.ts` calls `setGlobalPrefix('api/v1')`, so the prefix must NOT be
 * repeated here — doing so previously mounted an entire controller at
 * `/api/v1/api/v1/...`, where it answered 401 rather than 404 and so looked
 * alive while being unreachable.
 */
@ApiTags('Integrations')
@Controller('integrations/orders')
export class OrderSyncController {
  constructor(private readonly orders: OrderStatusIngestionService) {}

  /**
   * Report that the POS has moved an order along.
   *
   * The order is named by its DrippleX order number — the only identifier the
   * two systems share today. Only `PREPARING` and `READY` are accepted; every
   * other transition is DrippleX's, and `CANCELLED` refunds a customer.
   */
  @Put(':orderNumber/status')
  // JwtAuthGuard is a global APP_GUARD (app.module.ts). A POS holds an
  // integration credential, never a JWT, so without this the global guard
  // refuses every push before IntegrationCredentialGuard is ever consulted.
  // @Public() steps the JWT guard aside; it does NOT make the route
  // unauthenticated, because the credential guard below still has to pass.
  @Public()
  @UseGuards(IntegrationCredentialGuard)
  @RequireIntegrationScope(ORDERS_WRITE_SCOPE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report a POS-side order status change' })
  @ApiResponse({ status: 200, description: 'Transition applied, or already in that status' })
  @ApiResponse({ status: 400, description: 'Missing or malformed Idempotency-Key header' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or insufficiently scoped credential',
  })
  @ApiResponse({ status: 404, description: 'No such order for this integration' })
  @ApiResponse({ status: 409, description: "The order's current status does not allow it" })
  public async updateStatus(
    @Req() request: IntegrationAuthenticatedRequest,
    @Param('orderNumber') orderNumber: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string | undefined,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<{ success: true; data: OrderStatusSyncResult }> {
    const integration = this.requireIntegration(request);
    const key = requireIdempotencyKey(idempotencyKey);
    const data = await this.orders.applyStatus(integration, orderNumber, dto, key);
    return { success: true, data };
  }

  @Get(':orderNumber')
  @Public()
  @UseGuards(IntegrationCredentialGuard)
  @RequireIntegrationScope(ORDERS_READ_SCOPE)
  @ApiOperation({ summary: 'Read one order, narrowed to what a POS may see' })
  @ApiResponse({ status: 200, description: 'The order' })
  @ApiResponse({ status: 404, description: 'No such order for this integration' })
  public async getOrder(
    @Req() request: IntegrationAuthenticatedRequest,
    @Param('orderNumber') orderNumber: string,
  ): Promise<{ success: true; data: PosOrderView }> {
    const integration = this.requireIntegration(request);
    const data = await this.orders.getOrder(integration, orderNumber);
    return { success: true, data };
  }

  @Get()
  @Public()
  @UseGuards(IntegrationCredentialGuard)
  @RequireIntegrationScope(ORDERS_READ_SCOPE)
  @ApiOperation({ summary: "List this merchant's orders, newest first" })
  @ApiResponse({ status: 200, description: 'One page of orders' })
  public async listOrders(
    @Req() request: IntegrationAuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(MAX_POS_ORDER_PAGE_SIZE), ParseIntPipe)
    pageSize: number,
  ): Promise<{ success: true; data: PosOrderPage }> {
    const integration = this.requireIntegration(request);
    const data = await this.orders.listOrders(integration, page, pageSize);
    return { success: true, data };
  }

  /**
   * Unreachable while the guard is attached, and that is exactly why it is
   * here: if someone ever removes the guard, these routes fail closed with a
   * 401 instead of handing a merchant's order book to an anonymous caller.
   */
  private requireIntegration(
    request: IntegrationAuthenticatedRequest,
  ): NonNullable<IntegrationAuthenticatedRequest['integration']> {
    const integration = request.integration;
    if (!integration) {
      throw new UnauthorizedException('Integration credentials required');
    }
    return integration;
  }
}
