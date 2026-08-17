import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CheckoutService } from './checkout.service';
import {
  CancelOrderDto,
  CheckoutDto,
  CustomerOrderListQueryDto,
  RaiseOrderDisputeDto,
} from './dto/order.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { OrderPaymentProofService } from './order-payment-proof.service';
import { ORDER_PERMISSIONS } from './order.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type {
  CheckoutResponseDto,
  CustomerMerchantBankDto,
  OrderDto,
  OrderPaymentProofDto,
  PaginatedResult,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer')
export class CustomerOrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly paymentProofs: OrderPaymentProofService,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(ORDER_PERMISSIONS.CHECKOUT)
  public async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CheckoutResponseDto>> {
    const data = await this.checkoutService.checkout(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('orders')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CustomerOrderListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderDto>>> {
    const data = await this.checkoutService.listCustomerOrders(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  @Get('orders/:id')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.getCustomerOrder(user.id, id);
    return { success: true, data };
  }

  /// Read-only exposure of the order merchant's default payout bank account so
  /// the "Pay to Merchant Bank" (MERCHANT_DIRECT) checkout option can show the
  /// customer where to transfer. Ownership is enforced in the service (the
  /// order must belong to the authenticated customer). No settlement/payment
  /// movement is triggered here.
  @Get('orders/:id/merchant-bank')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async getOrderMerchantBank(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerMerchantBankDto>> {
    const data = await this.checkoutService.getOrderMerchantBank(user.id, id);
    return { success: true, data };
  }

  @Post('orders/:id/cancel')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.cancelCustomerOrder(
      user.id,
      id,
      this.auditContext(request, user.id),
      dto.reason,
    );
    return { success: true, data };
  }

  @Post('orders/:id/dispute')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async raiseDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RaiseOrderDisputeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.raiseDispute(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /**
   * DPX-ORDER-PROOF-001 — file the bank receipt for a "Pay to Merchant Bank"
   * order. This does NOT mark the order paid: the merchant still confirms
   * receipt into their own account. It puts the customer's evidence on file.
   */
  @Post('orders/:id/payment-proof')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async submitPaymentProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPaymentProofDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderPaymentProofDto>> {
    const data = await this.paymentProofs.submit(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('orders/:id/payment-proofs')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async listPaymentProofs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderPaymentProofDto[]>> {
    const data = await this.paymentProofs.listForCustomer(user.id, id);
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
