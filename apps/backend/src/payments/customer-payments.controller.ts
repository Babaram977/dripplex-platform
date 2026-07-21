import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { InitializePaymentDto, VerifyPaymentDto } from './dto/payment.dto';
import { PAYMENT_PERMISSIONS } from './payment.constants';
import { PaymentService } from './payment.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type {
  InitializePaymentResponseDto,
  PaymentStatusDto,
  PaymentVerificationDto,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/orders')
export class CustomerPaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/pay')
  @RequirePermissions(PAYMENT_PERMISSIONS.PAY)
  public async pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitializePaymentDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InitializePaymentResponseDto>> {
    const data = await this.paymentService.initializePayment(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/verify')
  @RequirePermissions(PAYMENT_PERMISSIONS.PAY)
  public async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PaymentVerificationDto>> {
    const data = await this.paymentService.verifyPayment(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get(':id/payment')
  @RequirePermissions(PAYMENT_PERMISSIONS.PAY)
  public async getPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<PaymentStatusDto>> {
    const data = await this.paymentService.getPayment(user.id, id);
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
