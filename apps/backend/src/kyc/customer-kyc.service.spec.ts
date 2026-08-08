import { CustomerKycStatus } from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';

import { CustomerKycService } from './customer-kyc.service';
import { KYC_AUDIT_ACTIONS } from './kyc.constants';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CustomerKyc } from '@prisma/client';

describe('CustomerKycService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const kycId = '22222222-2222-2222-2222-222222222222';
  const reviewerId = '33333333-3333-3333-3333-333333333333';

  const prisma = {
    customerKyc: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirstOrThrow: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

  const service = new CustomerKycService(prisma, auditService);

  const verifiedUser = {
    phoneVerifiedAt: new Date(),
    emailVerifiedAt: new Date(),
    email: 'ada@example.com',
  };

  const baseRecord: CustomerKyc = {
    id: kycId,
    userId,
    level: 'LEVEL_0',
    status: CustomerKycStatus.IN_PROGRESS,
    documentType: null,
    documentNumber: null,
    frontImageUrl: null,
    backImageUrl: null,
    selfieUrl: null,
    reviewedBy: null,
    reviewedAt: null,
    remarks: null,
    startedAt: new Date(),
    submittedAt: null,
    reviewStartedAt: null,
    verifiedAt: null,
    rejectedAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (prisma.user.findFirstOrThrow as jest.Mock).mockResolvedValue(verifiedUser);
  });

  describe('getMyStatus', () => {
    it('returns the NOT_STARTED/LEVEL_0 default when no record exists', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getMyStatus(userId);

      expect(result.status).toBe('NOT_STARTED');
      expect(result.level).toBe('LEVEL_0');
      expect(result.levelAccess).toEqual({ level0: true, level1: true });
    });

    it('reflects an existing record', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(baseRecord);

      const result = await service.getMyStatus(userId);

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.startedAt).toBe(baseRecord.startedAt?.toISOString());
    });
  });

  describe('start', () => {
    it('creates a new record on first start', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customerKyc.create as jest.Mock).mockResolvedValue(baseRecord);

      const result = await service.start(userId, {});

      expect(prisma.customerKyc.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, status: CustomerKycStatus.IN_PROGRESS }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        KYC_AUDIT_ACTIONS.CUSTOMER_KYC_STARTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('re-opens a REQUIRES_RESUBMISSION record without clearing startedAt', async () => {
      const resubmission = { ...baseRecord, status: CustomerKycStatus.REQUIRES_RESUBMISSION };
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(resubmission);
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...resubmission,
        status: CustomerKycStatus.IN_PROGRESS,
      });

      await service.start(userId, {});

      expect(prisma.customerKyc.update).toHaveBeenCalledWith({
        where: { id: kycId },
        data: { status: CustomerKycStatus.IN_PROGRESS, startedAt: resubmission.startedAt },
      });
    });

    it('rejects starting again while PENDING_REVIEW', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.PENDING_REVIEW,
      });

      await expect(service.start(userId, {})).rejects.toBeInstanceOf(ConflictDomainException);
      expect(prisma.customerKyc.update).not.toHaveBeenCalled();
      expect(prisma.customerKyc.create).not.toHaveBeenCalled();
    });

    it('rejects starting again once VERIFIED', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.VERIFIED,
      });

      await expect(service.start(userId, {})).rejects.toBeInstanceOf(ConflictDomainException);
    });
  });

  describe('submit', () => {
    const dto = {
      documentType: 'NATIONAL_ID' as const,
      frontImageUrl: 'https://cdn.example.com/front.jpg',
    };

    it('rejects submitting without first calling start', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.submit(userId, dto, {})).rejects.toBeInstanceOf(ConflictDomainException);
      expect(prisma.customerKyc.update).not.toHaveBeenCalled();
    });

    it('rejects submitting while already PENDING_REVIEW', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.PENDING_REVIEW,
      });

      await expect(service.submit(userId, dto, {})).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('moves IN_PROGRESS to PENDING_REVIEW and clears prior remarks', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(baseRecord);
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.PENDING_REVIEW,
        submittedAt: new Date(),
      });

      const result = await service.submit(userId, dto, {});

      expect(prisma.customerKyc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: kycId },
          data: expect.objectContaining({
            status: CustomerKycStatus.PENDING_REVIEW,
            remarks: null,
            documentType: dto.documentType,
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        KYC_AUDIT_ACTIONS.CUSTOMER_KYC_SUBMITTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('allows resubmission from REQUIRES_RESUBMISSION', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.REQUIRES_RESUBMISSION,
      });
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.PENDING_REVIEW,
      });

      await service.submit(userId, dto, {});

      expect(prisma.customerKyc.update).toHaveBeenCalled();
    });
  });

  describe('listPendingReview', () => {
    it('maps records to the admin list DTO shape', async () => {
      (prisma.customerKyc.findMany as jest.Mock).mockResolvedValue([
        {
          ...baseRecord,
          status: CustomerKycStatus.PENDING_REVIEW,
          submittedAt: new Date(),
          user: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
        },
      ]);

      const result = await service.listPendingReview();

      expect(prisma.customerKyc.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CustomerKycStatus.PENDING_REVIEW } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: kycId, userId, userFullName: 'Ada Lovelace' });
    });
  });

  describe('verify / reject / requestResubmission', () => {
    const pendingRecord = { ...baseRecord, status: CustomerKycStatus.PENDING_REVIEW };

    it('verify() throws NotFoundDomainException for an unknown id', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verify(kycId, reviewerId, undefined, {})).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });

    it('verify() throws ConflictDomainException when not PENDING_REVIEW', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue(baseRecord);

      await expect(service.verify(kycId, reviewerId, undefined, {})).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    it('verify() sets VERIFIED + verifiedAt + reviewStartedAt best-effort', async () => {
      (prisma.customerKyc.findFirst as jest.Mock)
        .mockResolvedValueOnce(pendingRecord) // requirePendingReview
        .mockResolvedValueOnce({ ...pendingRecord, status: CustomerKycStatus.VERIFIED }); // getForUser
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...pendingRecord,
        status: CustomerKycStatus.VERIFIED,
      });

      const result = await service.verify(kycId, reviewerId, 'looks good', {});

      expect(prisma.customerKyc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: kycId },
          data: expect.objectContaining({
            status: CustomerKycStatus.VERIFIED,
            reviewedBy: reviewerId,
            remarks: 'looks good',
          }),
        }),
      );
      const updateData = (prisma.customerKyc.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData.verifiedAt).toBeInstanceOf(Date);
      expect(updateData.reviewStartedAt).toBeInstanceOf(Date);
      expect(auditService.record).toHaveBeenCalledWith(
        KYC_AUDIT_ACTIONS.CUSTOMER_KYC_VERIFIED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.status).toBe('VERIFIED');
    });

    it('verify() preserves an already-set reviewStartedAt instead of overwriting it', async () => {
      const alreadyReviewing = {
        ...pendingRecord,
        reviewStartedAt: new Date('2026-01-01T00:00:00Z'),
      };
      (prisma.customerKyc.findFirst as jest.Mock)
        .mockResolvedValueOnce(alreadyReviewing)
        .mockResolvedValueOnce({ ...alreadyReviewing, status: CustomerKycStatus.VERIFIED });
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...alreadyReviewing,
        status: CustomerKycStatus.VERIFIED,
      });

      await service.verify(kycId, reviewerId, undefined, {});

      const updateData = (prisma.customerKyc.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData.reviewStartedAt).toBe(alreadyReviewing.reviewStartedAt);
    });

    it('reject() requires remarks to be recorded and sets rejectedAt', async () => {
      (prisma.customerKyc.findFirst as jest.Mock)
        .mockResolvedValueOnce(pendingRecord)
        .mockResolvedValueOnce({ ...pendingRecord, status: CustomerKycStatus.REJECTED });
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...pendingRecord,
        status: CustomerKycStatus.REJECTED,
      });

      const result = await service.reject(kycId, reviewerId, 'document unreadable', {});

      const updateData = (prisma.customerKyc.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData.status).toBe(CustomerKycStatus.REJECTED);
      expect(updateData.rejectedAt).toBeInstanceOf(Date);
      expect(updateData.remarks).toBe('document unreadable');
      expect(auditService.record).toHaveBeenCalledWith(
        KYC_AUDIT_ACTIONS.CUSTOMER_KYC_REJECTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.status).toBe('REJECTED');
    });

    it('reject() throws when the submission is not PENDING_REVIEW', async () => {
      (prisma.customerKyc.findFirst as jest.Mock).mockResolvedValue({
        ...baseRecord,
        status: CustomerKycStatus.VERIFIED,
      });

      await expect(service.reject(kycId, reviewerId, 'x', {})).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    it('requestResubmission() sets REQUIRES_RESUBMISSION without a verified/rejected timestamp', async () => {
      (prisma.customerKyc.findFirst as jest.Mock)
        .mockResolvedValueOnce(pendingRecord)
        .mockResolvedValueOnce({
          ...pendingRecord,
          status: CustomerKycStatus.REQUIRES_RESUBMISSION,
        });
      (prisma.customerKyc.update as jest.Mock).mockResolvedValue({
        ...pendingRecord,
        status: CustomerKycStatus.REQUIRES_RESUBMISSION,
      });

      const result = await service.requestResubmission(kycId, reviewerId, 'blurry selfie', {});

      const updateData = (prisma.customerKyc.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData.status).toBe(CustomerKycStatus.REQUIRES_RESUBMISSION);
      expect(updateData.verifiedAt).toBeUndefined();
      expect(updateData.rejectedAt).toBeUndefined();
      expect(auditService.record).toHaveBeenCalledWith(
        KYC_AUDIT_ACTIONS.CUSTOMER_KYC_RESUBMISSION_REQUESTED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result.status).toBe('REQUIRES_RESUBMISSION');
    });
  });
});
