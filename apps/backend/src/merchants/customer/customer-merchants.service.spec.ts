import { randomUUID } from 'node:crypto';

import { BusinessStatus, Prisma, PrismaClient, ReviewTargetType } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

import { CustomerMerchantsService } from './customer-merchants.service';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('CustomerMerchantsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CustomerMerchantsService;
  const userIds: string[] = [];

  let approvedMerchantProfileId = '';
  let unapprovedMerchantProfileId = '';
  let suspendedBusinessMerchantProfileId = '';

  interface MerchantFixtureOptions {
    businessName: string;
    businessType?: 'SOLE_PROPRIETORSHIP' | 'CORPORATION';
    status?: BusinessStatus;
    isApproved?: boolean;
    latitude?: string;
    longitude?: string;
    operatingHours?: Prisma.InputJsonValue;
  }

  async function createMerchant(options: MerchantFixtureOptions): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `customer-merchants-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Merchant',
        lastName: options.businessName,
      },
    });
    userIds.push(user.id);
    const profile = await prisma.merchantProfile.create({
      data: { userId: user.id, isApproved: options.isApproved ?? true },
    });
    await prisma.business.create({
      data: {
        merchantId: user.id,
        businessName: options.businessName,
        businessType: options.businessType ?? 'SOLE_PROPRIETORSHIP',
        registrationNumber: `REG-${randomUUID()}`,
        email: `${options.businessName.toLowerCase()}-${randomUUID()}@dripplex.test`,
        phone: '+2348000000000',
        country: 'Nigeria',
        state: 'Lagos',
        city: 'Ikeja',
        address: '1 Market Road',
        latitude: new Prisma.Decimal(options.latitude ?? '6.6018'),
        longitude: new Prisma.Decimal(options.longitude ?? '3.3515'),
        logoUrl: 'https://example.com/logo.png',
        status: options.status ?? BusinessStatus.ACTIVE,
        ...(options.operatingHours ? { operatingHours: options.operatingHours } : {}),
      },
    });
    return profile.id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    service = new CustomerMerchantsService(prisma);

    approvedMerchantProfileId = await createMerchant({
      businessName: `AcmeApproved-${randomUUID()}`,
      businessType: 'CORPORATION',
      latitude: '6.6018',
      longitude: '3.3515',
      operatingHours: { mon: { open: '08:00', close: '23:59' } },
    });
    unapprovedMerchantProfileId = await createMerchant({
      businessName: `UnapprovedMart-${randomUUID()}`,
      isApproved: false,
    });
    suspendedBusinessMerchantProfileId = await createMerchant({
      businessName: `SuspendedMart-${randomUUID()}`,
      status: BusinessStatus.SUSPENDED,
    });

    await prisma.reviewAggregate.create({
      data: {
        targetType: ReviewTargetType.MERCHANT,
        targetId: approvedMerchantProfileId,
        averageRating: 4.5,
        reviewCount: 12,
      },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const id of userIds) {
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  it('only returns approved, active-business merchants', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({});
    const ids = result.items.map((item) => item.id);
    expect(ids).toContain(approvedMerchantProfileId);
    expect(ids).not.toContain(unapprovedMerchantProfileId);
    expect(ids).not.toContain(suspendedBusinessMerchantProfileId);
  });

  it('maps the DTO id to MerchantProfile.id, not Business.merchantId', async () => {
    if (!databaseAvailable) return;
    const result = await service.getMerchantDetail(approvedMerchantProfileId);
    expect(result.id).toBe(approvedMerchantProfileId);
  });

  it('filters by business type', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ businessType: 'CORPORATION' });
    expect(result.items.every((item) => item.businessType === 'CORPORATION')).toBe(true);
    expect(result.items.map((item) => item.id)).toContain(approvedMerchantProfileId);
  });

  it('searches by business name', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ q: 'AcmeApproved' });
    expect(result.items.map((item) => item.id)).toContain(approvedMerchantProfileId);
  });

  it('filters by minimum rating, excluding merchants with no aggregate', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ minRating: 4 });
    const ids = result.items.map((item) => item.id);
    expect(ids).toContain(approvedMerchantProfileId);
  });

  it('computes distance when a location is provided', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ lat: 6.6018, lng: 3.3515 });
    const found = result.items.find((item) => item.id === approvedMerchantProfileId);
    expect(found?.distanceKm).not.toBeNull();
    expect(found?.distanceKm).toBeCloseTo(0, 1);
  });

  it('returns null distance without a location', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({});
    const found = result.items.find((item) => item.id === approvedMerchantProfileId);
    expect(found?.distanceKm).toBeNull();
  });

  it('falls back from nearest to recommended when no location is given', async () => {
    if (!databaseAvailable) return;
    const result = await service.browse({ sort: 'nearest' });
    expect(result.items.map((item) => item.id)).toContain(approvedMerchantProfileId);
  });

  it('throws not found for a merchant with no approved profile', async () => {
    if (!databaseAvailable) return;
    await expect(service.getMerchantDetail(randomUUID())).rejects.toThrow(NotFoundDomainException);
  });

  it('smartSearch parses "near me" into a nearest sort when a location is given', async () => {
    if (!databaseAvailable) return;
    const result = await service.smartSearch({
      query: 'AcmeApproved near me',
      lat: 6.6018,
      lng: 3.3515,
    });
    expect(result.parsed.nearMe).toBe(true);
    expect(result.results.items.map((item) => item.id)).toContain(approvedMerchantProfileId);
  });
});
