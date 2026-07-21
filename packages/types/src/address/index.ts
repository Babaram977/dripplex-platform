export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

export interface CoordinatesDto {
  latitude: number;
  longitude: number;
}

export interface CustomerAddressDto {
  id: string;
  customerId: string;
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  isActive: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressDto {
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
  isDefault?: boolean;
}

export interface UpdateAddressDto {
  label?: AddressLabel;
  recipientName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface AddressListResponse {
  items: CustomerAddressDto[];
  total: number;
}

export interface DefaultAddressResponse {
  address: CustomerAddressDto | null;
}

export interface DeliveryZoneResult {
  allowed: boolean;
  reason: string | null;
  provider: string;
}

export const ADDRESS_AUDIT_ACTIONS = {
  CREATED: 'customer.address.created',
  UPDATED: 'customer.address.updated',
  DELETED: 'customer.address.deleted',
  DEFAULT_CHANGED: 'customer.address.default_changed',
} as const;

export type AddressAuditAction = (typeof ADDRESS_AUDIT_ACTIONS)[keyof typeof ADDRESS_AUDIT_ACTIONS];
