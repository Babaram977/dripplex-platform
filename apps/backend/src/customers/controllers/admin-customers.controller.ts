import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AdminCustomersService } from '../admin-customers.service';
import { CUSTOMER_PERMISSIONS } from '../customer.constants';
import { ListCustomersQueryDto } from '../dto/list-customers-query.dto';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { AdminCustomerDto } from '@dripplex/types';

/**
 * DPX-OPS — Operations Console customer roster. Same `@Controller('admin')`
 * surface as the driver/rider/merchant approval desks; gated by the existing
 * `users:read` permission (already held by operations_staff), so the directory
 * surfaces in the Operations Console without any RBAC change.
 */
@Controller('admin')
export class AdminCustomersController {
  constructor(private readonly customersService: AdminCustomersService) {}

  @Get('customers')
  @RequirePermissions(CUSTOMER_PERMISSIONS.READ)
  public async listCustomers(@Query() query: ListCustomersQueryDto): Promise<
    ApiSuccessResponse<{
      items: AdminCustomerDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.customersService.listCustomers(query);
    return { success: true, data };
  }
}
