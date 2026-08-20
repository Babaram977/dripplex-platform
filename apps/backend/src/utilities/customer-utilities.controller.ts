import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  CreateUtilityPurchaseDto,
  UtilityPlansQueryDto,
  UtilityPurchaseHistoryQueryDto,
  VerifyBettingCustomerDto,
  VerifyCableCustomerDto,
  VerifyElectricityCustomerDto,
} from './dto/utilities.dto';
import { UTILITIES_PERMISSIONS } from './utilities.constants';
import {
  UtilitiesService,
  type InitiateUtilityPurchaseResult,
  type UtilityCatalogueDto,
  type UtilityPurchaseDto,
} from './utilities.service';

import type {
  UtilityCablePlan,
  UtilityCustomerLookup,
  UtilityDataPlan,
  UtilityEducationPlan,
  UtilityElectricityDisco,
  UtilityNetwork,
} from './providers/utility-provider.port';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/utilities')
export class CustomerUtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  /** What the tab can offer, and whether it can offer anything at all. The
   * client badges the tile from `available` rather than looking live and
   * failing once a customer has chosen a bundle. */
  @Get()
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public getCatalogue(): ApiSuccessResponse<UtilityCatalogueDto> {
    return { success: true, data: this.utilitiesService.getCatalogue() };
  }

  @Get('airtime/networks')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getAirtimeNetworks(): Promise<ApiSuccessResponse<UtilityNetwork[]>> {
    return { success: true, data: await this.utilitiesService.listAirtimeNetworks() };
  }

  @Get('data/networks')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getDataNetworks(): Promise<ApiSuccessResponse<UtilityNetwork[]>> {
    return { success: true, data: await this.utilitiesService.listDataNetworks() };
  }

  @Get('data/plans')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getDataPlans(
    @Query() query: UtilityPlansQueryDto,
  ): Promise<ApiSuccessResponse<UtilityDataPlan[]>> {
    return { success: true, data: await this.utilitiesService.listDataPlans(query.provider) };
  }

  @Get('cable/providers')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getCableProviders(): Promise<ApiSuccessResponse<UtilityNetwork[]>> {
    return { success: true, data: await this.utilitiesService.listCableProviders() };
  }

  @Get('cable/plans')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getCablePlans(
    @Query() query: UtilityPlansQueryDto,
  ): Promise<ApiSuccessResponse<UtilityCablePlan[]>> {
    return { success: true, data: await this.utilitiesService.listCablePlans(query.provider) };
  }

  @Get('electricity/providers')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getElectricityDiscos(): Promise<ApiSuccessResponse<UtilityElectricityDisco[]>> {
    return { success: true, data: await this.utilitiesService.listElectricityDiscos() };
  }

  @Get('betting/providers')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getBettingCompanies(): Promise<ApiSuccessResponse<UtilityNetwork[]>> {
    return { success: true, data: await this.utilitiesService.listBettingCompanies() };
  }

  /** Exam PINs come as one flat list — Peyflex files them all under a single
   * `education` provider, so there is no provider to choose first. */
  @Get('education/plans')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async getEducationPlans(): Promise<ApiSuccessResponse<UtilityEducationPlan[]>> {
    return { success: true, data: await this.utilitiesService.listEducationPlans() };
  }

  /**
   * Confirm whose betting account this is before any money moves.
   *
   * The purchase re-verifies server-side regardless — this endpoint exists so
   * the customer sees the account holder's name and can stop before paying,
   * not as the check the money path relies on.
   */
  @Post('betting/verify')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async verifyBetting(
    @Body() dto: VerifyBettingCustomerDto,
  ): Promise<ApiSuccessResponse<UtilityCustomerLookup>> {
    const data = await this.utilitiesService.verifyBettingCustomer(dto.provider, dto.customerId);
    return { success: true, data };
  }

  /** Confirm whose smartcard this is before any money moves. */
  @Post('cable/verify')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async verifyCable(
    @Body() dto: VerifyCableCustomerDto,
  ): Promise<ApiSuccessResponse<UtilityCustomerLookup>> {
    const data = await this.utilitiesService.verifyCableCustomer(dto.provider, dto.smartcardNumber);
    return { success: true, data };
  }

  /** Same for a meter. Peyflex verifies cable by POST and electricity by GET;
   * DrippleX presents both as a POST so the client has one shape. */
  @Post('electricity/verify')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async verifyElectricity(
    @Body() dto: VerifyElectricityCustomerDto,
  ): Promise<ApiSuccessResponse<UtilityCustomerLookup>> {
    const data = await this.utilitiesService.verifyElectricityCustomer(
      dto.provider,
      dto.meterNumber,
      dto.meterType,
    );
    return { success: true, data };
  }

  @Post('purchase')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_PURCHASE)
  public async purchase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUtilityPurchaseDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InitiateUtilityPurchaseResult>> {
    const data = await this.utilitiesService.initiatePurchase(
      user.id,
      dto,
      this.auditContext(request, user.id),
      dto.callbackUrl,
    );
    return { success: true, data };
  }

  /** Card path only: called after the customer returns from the gateway. */
  @Post('purchase/:id/confirm')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_PURCHASE)
  public async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<UtilityPurchaseDto>> {
    const data = await this.utilitiesService.confirmCardPurchase(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('purchases')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: UtilityPurchaseHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<UtilityPurchaseDto>>> {
    const data = await this.utilitiesService.listCustomerPurchases(
      user.id,
      query.page,
      query.pageSize,
      query.serviceType,
    );
    return { success: true, data };
  }

  /** Re-reading a receipt is how a customer recovers an electricity token
   * after closing the app. Not a nicety — the token is the thing they
   * bought. */
  @Get('purchases/:id')
  @RequirePermissions(UTILITIES_PERMISSIONS.CUSTOMER_READ)
  public async receipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<UtilityPurchaseDto>> {
    const data = await this.utilitiesService.getCustomerPurchase(user.id, id);
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
