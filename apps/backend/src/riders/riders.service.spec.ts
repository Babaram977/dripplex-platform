import { RiderStatus } from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { RidersService } from './riders.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageAssetService } from '../uploads/storage-asset.service';

describe('RidersService', () => {
  const prisma = {
    riderProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    riderOnboarding: {
      updateMany: jest.fn(),
    },
    riderKyc: {
      create: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const storageAssets = {
    assertOwned: jest.fn(),
    assertOwnedOptional: jest.fn(),
    toSignedGetUrl: jest.fn((url: string) => Promise.resolve(`${url}?signed`)),
    toSignedGetUrlOptional: jest.fn((url: string | null) =>
      Promise.resolve(url ? `${url}?signed` : null),
    ),
  } as unknown as jest.Mocked<StorageAssetService>;

  const service = new RidersService(prisma, auditService, storageAssets);

  const ADMIN_ID = '99999999-9999-9999-9999-999999999999';
  const RIDER_ID = '11111111-1111-1111-1111-111111111111';

  const user = {
    id: RIDER_ID,
    email: 'rider@example.com',
    phone: '+2348012345678',
    firstName: 'Tunde',
    lastName: 'Balogun',
    riderKycDocuments: [],
  };

  const baseProfile = {
    id: '22222222-2222-2222-2222-222222222222',
    userId: RIDER_ID,
    status: RiderStatus.PENDING,
    companyName: null,
    isApproved: false,
    approvedAt: null,
    approvedBy: null,
    rejectedReason: null,
    suspendedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    deletedAt: null,
  };

  const profileWith = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    ...baseProfile,
    ...overrides,
    user,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (prisma.riderOnboarding.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('approves a pending rider and records an audit entry', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(profileWith({}));
    (prisma.riderProfile.update as jest.Mock).mockResolvedValue({
      ...baseProfile,
      status: RiderStatus.APPROVED,
      isApproved: true,
      approvedAt: new Date('2026-08-10T00:00:00.000Z'),
      approvedBy: ADMIN_ID,
    });

    const result = await service.approveRider(RIDER_ID, ADMIN_ID, {});

    expect(result.status).toBe(RiderStatus.APPROVED);
    expect(result.approvedBy).toBe(ADMIN_ID);
    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: RIDER_ID },
        data: expect.objectContaining({ status: RiderStatus.APPROVED, isApproved: true }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      'rider.approved',
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.any(Object),
    );
  });

  it('rejects approving a rider that is already approved', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(
      profileWith({ status: RiderStatus.APPROVED, isApproved: true }),
    );

    await expect(service.approveRider(RIDER_ID, ADMIN_ID, {})).rejects.toBeInstanceOf(
      ConflictDomainException,
    );
    expect(prisma.riderProfile.update).not.toHaveBeenCalled();
  });

  it('rejects a rider with a reason', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(profileWith({}));
    (prisma.riderProfile.update as jest.Mock).mockResolvedValue({
      ...baseProfile,
      status: RiderStatus.REJECTED,
      rejectedReason: 'Incomplete documents',
      approvedBy: ADMIN_ID,
    });

    const result = await service.rejectRider(RIDER_ID, ADMIN_ID, 'Incomplete documents', {});

    expect(result.status).toBe(RiderStatus.REJECTED);
    expect(result.rejectedReason).toBe('Incomplete documents');
  });

  it('suspends only an approved rider', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(
      profileWith({ status: RiderStatus.PENDING }),
    );

    await expect(
      service.suspendRider(RIDER_ID, ADMIN_ID, 'Policy breach', {}),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('reactivates only a suspended rider', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(
      profileWith({ status: RiderStatus.APPROVED, isApproved: true }),
    );

    await expect(service.reactivateRider(RIDER_ID, ADMIN_ID, {})).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('reactivates a suspended rider back to approved', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(
      profileWith({ status: RiderStatus.SUSPENDED, suspendedAt: new Date() }),
    );
    (prisma.riderProfile.update as jest.Mock).mockResolvedValue({
      ...baseProfile,
      status: RiderStatus.APPROVED,
      isApproved: true,
      approvedAt: new Date('2026-08-10T00:00:00.000Z'),
      approvedBy: ADMIN_ID,
    });

    const result = await service.reactivateRider(RIDER_ID, ADMIN_ID, {});

    expect(result.status).toBe(RiderStatus.APPROVED);
    expect(auditService.record).toHaveBeenCalledWith(
      'rider.reactivated',
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.any(Object),
    );
  });

  it('throws NotFound for an unknown rider profile', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getRiderProfile(RIDER_ID)).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('lists riders with pagination meta', async () => {
    (prisma.riderProfile.findMany as jest.Mock).mockResolvedValue([profileWith({})]);
    (prisma.riderProfile.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listRiders({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.riderId).toBe(RIDER_ID);
    expect(result.items[0]?.companyName).toBeNull();
    expect(result.items[0]?.kyc).toEqual([]);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  // DPX-RIDER-002 — self-service KYC + company name.
  it('submits a rider KYC document with an ownership assertion and audit entry', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(profileWith({}));
    (prisma.riderKyc.create as jest.Mock).mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      riderId: RIDER_ID,
      documentType: 'GUARANTOR_ID',
      documentNumber: 'GID-1',
      frontImage: 'https://storage/kyc-documents/front.jpg',
      backImage: null,
      verificationStatus: 'PENDING',
      reviewedBy: null,
      reviewedAt: null,
      remarks: null,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
    });

    const result = await service.submitRiderKyc(
      RIDER_ID,
      {
        documentType: 'GUARANTOR_ID',
        documentNumber: 'GID-1',
        frontImage: 'https://storage/kyc-documents/front.jpg',
      },
      {},
    );

    expect(storageAssets.assertOwned).toHaveBeenCalledWith(
      'https://storage/kyc-documents/front.jpg',
      {
        folder: 'kyc-documents',
        ownerId: RIDER_ID,
      },
    );
    expect(result.documentType).toBe('GUARANTOR_ID');
    // KYC images are returned as signed GET URLs.
    expect(result.frontImage).toBe('https://storage/kyc-documents/front.jpg?signed');
    expect(auditService.record).toHaveBeenCalledWith(
      'rider.kyc_submitted',
      expect.objectContaining({ userId: RIDER_ID }),
      expect.any(Object),
    );
  });

  it('updates the rider company name and records an audit entry', async () => {
    (prisma.riderProfile.findUnique as jest.Mock).mockResolvedValue(profileWith({}));
    (prisma.riderProfile.update as jest.Mock).mockResolvedValue(profileWith({}));

    await service.updateOwnProfile(RIDER_ID, { companyName: '  Jumia Logistics  ' }, {});

    expect(prisma.riderProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: RIDER_ID },
        data: expect.objectContaining({ companyName: 'Jumia Logistics' }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      'rider.profile_updated',
      expect.objectContaining({ userId: RIDER_ID }),
      expect.any(Object),
    );
  });
});
