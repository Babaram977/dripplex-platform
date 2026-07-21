import type { CustomerAddressDto } from '@dripplex/types';
import type { CustomerAddress } from '@prisma/client';

export function toCustomerAddressDto(address: CustomerAddress): CustomerAddressDto {
  return {
    id: address.id,
    customerId: address.customerId,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    isDefault: address.isDefault,
    isActive: address.isActive,
    verifiedAt: address.verifiedAt ? address.verifiedAt.toISOString() : null,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}
