import { AddressLabel } from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { ADDRESS_AUDIT_ACTIONS, MAX_CUSTOMER_ADDRESSES } from './address.constants';
import { AddressService } from './address.service';

import type { AuditService } from '../audit/audit.service';
import type { AddressRepository } from './repositories/address.repository';
import type { DeliveryZoneService } from './zones/delivery-zone.service';
import type { CustomerAddress } from '@prisma/client';

const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const addressId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const otherAddressId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const sampleAddress = {
  id: addressId,
  customerId,
  label: AddressLabel.HOME,
  recipientName: 'Ada Customer',
  phone: '+2348012345678',
  addressLine1: '12 Allen Avenue',
  addressLine2: null,
  landmark: 'Near Ikeja City Mall',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  postalCode: '100271',
  latitude: 6.6018,
  longitude: 3.3515,
  isDefault: true,
  isActive: true,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as unknown as CustomerAddress;

const createDto = {
  label: AddressLabel.HOME,
  recipientName: 'Ada Customer',
  phone: '+2348012345678',
  addressLine1: '12 Allen Avenue',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
  latitude: 6.6018,
  longitude: 3.3515,
};

describe('AddressService', () => {
  const repository: jest.Mocked<AddressRepository> = {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByIdForCustomer: jest.fn(),
    listByCustomerId: jest.fn(),
    countByCustomerId: jest.fn(),
    findDefault: jest.fn(),
    setDefault: jest.fn(),
  };

  const deliveryZoneService: jest.Mocked<DeliveryZoneService> = {
    isPointInsidePolygon: jest.fn(),
    isWithinMerchantRadius: jest.fn(),
    validateDeliveryZone: jest.fn().mockReturnValue({
      allowed: true,
      reason: null,
      provider: 'stub',
    }),
    calculateDistanceKm: jest.fn().mockReturnValue(1.2),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const service = new AddressService(repository, deliveryZoneService, auditService);
  const context = { userId: customerId, ipAddress: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    deliveryZoneService.validateDeliveryZone.mockReturnValue({
      allowed: true,
      reason: null,
      provider: 'stub',
    });
  });

  describe('create', () => {
    it('creates an address, audits, and validates zone', async () => {
      repository.countByCustomerId.mockResolvedValue(0);
      repository.create.mockResolvedValue(sampleAddress);

      const result = await service.create(customerId, createDto, context);

      expect(result.id).toBe(addressId);
      expect(deliveryZoneService.validateDeliveryZone).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        ADDRESS_AUDIT_ACTIONS.CREATED,
        expect.any(Object),
        expect.objectContaining({ resource: 'customer_address' }),
      );
    });

    it('rejects when max address limit is reached', async () => {
      repository.countByCustomerId.mockResolvedValue(MAX_CUSTOMER_ADDRESSES);

      await expect(service.create(customerId, createDto, context)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    it('rejects invalid coordinates', async () => {
      await expect(
        service.create(customerId, { ...createDto, latitude: 120 }, context),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects when delivery zone is not allowed', async () => {
      deliveryZoneService.validateDeliveryZone.mockReturnValue({
        allowed: false,
        reason: 'Outside service area',
        provider: 'stub',
      });

      await expect(service.create(customerId, createDto, context)).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });
  });

  describe('list / get', () => {
    it('lists addresses', async () => {
      repository.listByCustomerId.mockResolvedValue([sampleAddress]);
      const result = await service.list(customerId);
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe(addressId);
    });

    it('gets an owned address', async () => {
      repository.findByIdForCustomer.mockResolvedValue(sampleAddress);
      const result = await service.get(customerId, addressId);
      expect(result.recipientName).toBe('Ada Customer');
    });

    it('rejects access to another customer address', async () => {
      repository.findByIdForCustomer.mockResolvedValue(null);
      await expect(service.get(customerId, otherAddressId)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });

  describe('update', () => {
    it('updates editable fields', async () => {
      repository.findByIdForCustomer.mockResolvedValue(sampleAddress);
      repository.update.mockResolvedValue({
        ...sampleAddress,
        recipientName: 'Bola Customer',
      });

      const result = await service.update(
        customerId,
        addressId,
        { recipientName: 'Bola Customer' },
        context,
      );

      expect(result.recipientName).toBe('Bola Customer');
      expect(auditService.record).toHaveBeenCalledWith(
        ADDRESS_AUDIT_ACTIONS.UPDATED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('delete (soft)', () => {
    it('soft deletes an owned address', async () => {
      repository.findByIdForCustomer.mockResolvedValue(sampleAddress);
      repository.softDelete.mockResolvedValue({
        ...sampleAddress,
        deletedAt: new Date(),
        isActive: false,
        isDefault: false,
      });

      await service.delete(customerId, addressId, context);

      expect(repository.softDelete).toHaveBeenCalledWith(addressId);
      expect(auditService.record).toHaveBeenCalledWith(
        ADDRESS_AUDIT_ACTIONS.DELETED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('default switching', () => {
    it('sets default and audits', async () => {
      repository.findByIdForCustomer.mockResolvedValue({
        ...sampleAddress,
        isDefault: false,
      });
      repository.setDefault.mockResolvedValue(sampleAddress);

      const result = await service.setDefault(customerId, addressId, context);

      expect(result.isDefault).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        ADDRESS_AUDIT_ACTIONS.DEFAULT_CHANGED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('returns default address response', async () => {
      repository.findDefault.mockResolvedValue(sampleAddress);
      const result = await service.getDefault(customerId);
      expect(result.address?.id).toBe(addressId);
    });

    it('returns null when no default exists', async () => {
      repository.findDefault.mockResolvedValue(null);
      const result = await service.getDefault(customerId);
      expect(result.address).toBeNull();
    });
  });

  describe('helpers', () => {
    it('delegates distance calculation', () => {
      const km = service.calculateDistanceKm(
        { latitude: 6.6, longitude: 3.3 },
        { latitude: 6.5, longitude: 3.4 },
      );
      expect(km).toBe(1.2);
      expect(deliveryZoneService.calculateDistanceKm).toHaveBeenCalled();
    });
  });
});
