import { Inject, Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { ADDRESS_AUDIT_ACTIONS, MAX_CUSTOMER_ADDRESSES } from './address.constants';
import { toCustomerAddressDto } from './address.mapper';
import { ADDRESS_REPOSITORY, type AddressRepository } from './repositories/address.repository';
import { DELIVERY_ZONE_SERVICE, type DeliveryZoneService } from './zones/delivery-zone.service';

import type { CreateAddressDto } from './dto/create-address.dto';
import type { UpdateAddressDto } from './dto/update-address.dto';
import type {
  AddressListResponse,
  CustomerAddressDto,
  DefaultAddressResponse,
} from '@dripplex/types';
import type { CustomerAddress } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(
    @Inject(ADDRESS_REPOSITORY)
    private readonly addressRepository: AddressRepository,
    @Inject(DELIVERY_ZONE_SERVICE)
    private readonly deliveryZoneService: DeliveryZoneService,
    private readonly auditService: AuditService,
  ) {}

  public async create(
    customerId: string,
    dto: CreateAddressDto,
    context: AuditContext,
  ): Promise<CustomerAddressDto> {
    this.verifyCoordinates(dto.latitude, dto.longitude);
    this.validateDeliveryZone(dto.latitude, dto.longitude);

    const count = await this.addressRepository.countByCustomerId(customerId);
    if (count >= MAX_CUSTOMER_ADDRESSES) {
      throw new ConflictDomainException(
        `Maximum of ${String(MAX_CUSTOMER_ADDRESSES)} saved addresses reached`,
      );
    }

    const address = await this.addressRepository.create({
      customerId,
      label: dto.label,
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      addressLine1: dto.addressLine1.trim(),
      city: dto.city.trim(),
      state: dto.state.trim(),
      country: dto.country.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      isDefault: dto.isDefault ?? false,
      ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2.trim() } : {}),
      ...(dto.landmark !== undefined ? { landmark: dto.landmark.trim() } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode.trim() } : {}),
    });

    await this.auditService.record(
      ADDRESS_AUDIT_ACTIONS.CREATED,
      { ...context, userId: customerId },
      {
        resource: 'customer_address',
        resourceId: address.id,
        metadata: { label: address.label, isDefault: address.isDefault },
      },
    );

    if (address.isDefault) {
      await this.auditService.record(
        ADDRESS_AUDIT_ACTIONS.DEFAULT_CHANGED,
        { ...context, userId: customerId },
        {
          resource: 'customer_address',
          resourceId: address.id,
          metadata: { isDefault: true },
        },
      );
    }

    return toCustomerAddressDto(address);
  }

  public async list(customerId: string): Promise<AddressListResponse> {
    const items = await this.addressRepository.listByCustomerId(customerId);
    return {
      items: items.map(toCustomerAddressDto),
      total: items.length,
    };
  }

  public async get(customerId: string, addressId: string): Promise<CustomerAddressDto> {
    const address = await this.requireOwnedAddress(customerId, addressId);
    return toCustomerAddressDto(address);
  }

  public async update(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
    context: AuditContext,
  ): Promise<CustomerAddressDto> {
    await this.requireOwnedAddress(customerId, addressId);

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const existing = await this.addressRepository.findByIdForCustomer(addressId, customerId);
      const latitude = dto.latitude ?? Number(existing?.latitude);
      const longitude = dto.longitude ?? Number(existing?.longitude);
      this.verifyCoordinates(latitude, longitude);
      this.validateDeliveryZone(latitude, longitude);
    }

    const updated = await this.addressRepository.update(addressId, {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.recipientName !== undefined ? { recipientName: dto.recipientName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1.trim() } : {}),
      ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2.trim() } : {}),
      ...(dto.landmark !== undefined ? { landmark: dto.landmark.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode.trim() } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });

    await this.auditService.record(
      ADDRESS_AUDIT_ACTIONS.UPDATED,
      { ...context, userId: customerId },
      {
        resource: 'customer_address',
        resourceId: updated.id,
        metadata: { fields: Object.keys(dto) },
      },
    );

    return toCustomerAddressDto(updated);
  }

  public async delete(customerId: string, addressId: string, context: AuditContext): Promise<void> {
    await this.requireOwnedAddress(customerId, addressId);
    await this.addressRepository.softDelete(addressId);

    await this.auditService.record(
      ADDRESS_AUDIT_ACTIONS.DELETED,
      { ...context, userId: customerId },
      {
        resource: 'customer_address',
        resourceId: addressId,
      },
    );
  }

  public async setDefault(
    customerId: string,
    addressId: string,
    context: AuditContext,
  ): Promise<CustomerAddressDto> {
    const address = await this.requireOwnedAddress(customerId, addressId);
    if (!address.isActive) {
      throw new ValidationDomainException('Cannot set an inactive address as default');
    }

    const updated = await this.addressRepository.setDefault(customerId, addressId);

    await this.auditService.record(
      ADDRESS_AUDIT_ACTIONS.DEFAULT_CHANGED,
      { ...context, userId: customerId },
      {
        resource: 'customer_address',
        resourceId: updated.id,
        metadata: { isDefault: true },
      },
    );

    return toCustomerAddressDto(updated);
  }

  public async getDefault(customerId: string): Promise<DefaultAddressResponse> {
    const address = await this.addressRepository.findDefault(customerId);
    return {
      address: address ? toCustomerAddressDto(address) : null,
    };
  }

  public verifyCoordinates(latitude: number, longitude: number): void {
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ValidationDomainException('Invalid latitude/longitude coordinates');
    }
  }

  public validateDeliveryZone(latitude: number, longitude: number): void {
    const result = this.deliveryZoneService.validateDeliveryZone({ latitude, longitude });
    if (!result.allowed) {
      throw new ValidationDomainException(
        result.reason ?? 'Address is outside supported delivery zones',
      );
    }
  }

  public calculateDistanceKm(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
  ): number {
    return this.deliveryZoneService.calculateDistanceKm(from, to);
  }

  private async requireOwnedAddress(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress> {
    const address = await this.addressRepository.findByIdForCustomer(addressId, customerId);
    if (!address) {
      throw new NotFoundDomainException('Address not found');
    }
    return address;
  }
}
