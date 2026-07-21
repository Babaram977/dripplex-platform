import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AddressRepository,
  CreateAddressInput,
  UpdateAddressInput,
} from './address.repository';
import type { CustomerAddress } from '@prisma/client';

@Injectable()
export class PrismaAddressRepository implements AddressRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateAddressInput): Promise<CustomerAddress> {
    return await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.customerAddress.count({
        where: { customerId: input.customerId, deletedAt: null },
      });

      const shouldDefault = input.isDefault || existingCount === 0;

      if (shouldDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: input.customerId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }

      return await tx.customerAddress.create({
        data: {
          customerId: input.customerId,
          label: input.label,
          recipientName: input.recipientName,
          phone: input.phone,
          addressLine1: input.addressLine1,
          city: input.city,
          state: input.state,
          country: input.country,
          latitude: input.latitude,
          longitude: input.longitude,
          isDefault: shouldDefault,
          isActive: true,
          ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
          ...(input.landmark !== undefined ? { landmark: input.landmark } : {}),
          ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        },
      });
    });
  }

  public async update(id: string, input: UpdateAddressInput): Promise<CustomerAddress> {
    return await this.prisma.customerAddress.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
        ...(input.landmark !== undefined ? { landmark: input.landmark } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  public async softDelete(id: string): Promise<CustomerAddress> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('Address not found');
      }

      const wasDefault = existing.isDefault;

      const deleted = await tx.customerAddress.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          isDefault: false,
        },
      });

      if (wasDefault) {
        const nextDefault = await tx.customerAddress.findFirst({
          where: {
            customerId: deleted.customerId,
            deletedAt: null,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (nextDefault) {
          await tx.customerAddress.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }

      return deleted;
    });
  }

  public async findById(id: string): Promise<CustomerAddress | null> {
    return await this.prisma.customerAddress.findFirst({
      where: { id, deletedAt: null },
    });
  }

  public async findByIdForCustomer(
    id: string,
    customerId: string,
  ): Promise<CustomerAddress | null> {
    return await this.prisma.customerAddress.findFirst({
      where: { id, customerId, deletedAt: null },
    });
  }

  public async listByCustomerId(customerId: string): Promise<CustomerAddress[]> {
    return await this.prisma.customerAddress.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  public async countByCustomerId(customerId: string): Promise<number> {
    return await this.prisma.customerAddress.count({
      where: { customerId, deletedAt: null },
    });
  }

  public async findDefault(customerId: string): Promise<CustomerAddress | null> {
    return await this.prisma.customerAddress.findFirst({
      where: { customerId, deletedAt: null, isDefault: true, isActive: true },
    });
  }

  public async setDefault(customerId: string, addressId: string): Promise<CustomerAddress> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      return await tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true, isActive: true },
      });
    });
  }
}
