import type { AddressLabel, CustomerAddress } from '@prisma/client';

export interface CreateAddressInput {
  customerId: string;
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

export interface UpdateAddressInput {
  label?: AddressLabel;
  recipientName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface AddressRepository {
  create(input: CreateAddressInput): Promise<CustomerAddress>;
  update(id: string, input: UpdateAddressInput): Promise<CustomerAddress>;
  softDelete(id: string): Promise<CustomerAddress>;
  findById(id: string): Promise<CustomerAddress | null>;
  findByIdForCustomer(id: string, customerId: string): Promise<CustomerAddress | null>;
  listByCustomerId(customerId: string): Promise<CustomerAddress[]>;
  countByCustomerId(customerId: string): Promise<number>;
  findDefault(customerId: string): Promise<CustomerAddress | null>;
  setDefault(customerId: string, addressId: string): Promise<CustomerAddress>;
}

export const ADDRESS_REPOSITORY = Symbol('ADDRESS_REPOSITORY');
