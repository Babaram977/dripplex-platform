import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { ADDRESS_PERMISSIONS } from './address.constants';
import { toCustomerAddressDto } from './address.mapper';
import { ADDRESS_REPOSITORY, type AddressRepository } from './repositories/address.repository';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CustomerAddressDto } from '@dripplex/types';

/**
 * Admin read-only address access. No create/update/delete in S1-C9.
 */
@Controller('admin/addresses')
export class AdminAddressesController {
  constructor(
    @Inject(ADDRESS_REPOSITORY)
    private readonly addressRepository: AddressRepository,
  ) {}

  @Get(':id')
  @RequirePermissions(ADDRESS_PERMISSIONS.ADMIN_READ)
  public async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerAddressDto>> {
    const address = await this.addressRepository.findById(id);
    if (!address) {
      throw new NotFoundDomainException('Address not found');
    }
    return { success: true, data: toCustomerAddressDto(address) };
  }
}
