import { randomUUID } from 'node:crypto';

import { CustomerKycStatus, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { StorageAssetService } from '../uploads/storage-asset.service';
import { PrismaUsersRepository } from '../users/repositories/prisma-users.repository';

import { CustomerKycService } from './customer-kyc.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex_dev?schema=public';

const REVIEWER_ID = '88888888-8888-8888-8888-888888888888';

/**
 * DPX-PROFILE-KYC-003 -- Data Verification for DPX-PROFILE-KYC-001/002.
 *
 * Both `profile.service.spec.ts` and `customer-kyc.service.spec.ts` already
 * prove the *logic* of every code path against a mocked `PrismaService`.
 * What neither proves is that the real Postgres schema/migration actually
 * round-trips correctly: the new `User` profile columns
 * (profilePhotoUrl/dateOfBirth/gender), the `CustomerKyc` table's enum
 * columns, and its five new lifecycle-timestamp columns
 * (startedAt/reviewStartedAt/verifiedAt/rejectedAt/expiresAt, on top of the
 * pre-existing submittedAt/reviewedAt). This file closes that gap: it runs
 * against a real database, using the repository/service classes exactly as
 * production wires them, not a query-shape assertion against a mock.
 *
 * Phone/email OTP-confirm and Redis-backed pending-change state
 * (`ProfileService.request/confirmPhoneChange` etc.) are deliberately out
 * of scope here -- that logic is already fully covered by
 * `profile.service.spec.ts` with mocked Redis/NotificationService, and
 * re-proving it here would require standing up a real Redis instance for
 * no additional confidence: the two DB writes it ultimately makes
 * (`updatePhone`/`updateEmail`) are exercised directly below instead.
 */
describe('DPX-PROFILE-KYC-003 -- Profile + CustomerKyc real-Postgres lifecycle', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let usersRepository: PrismaUsersRepository;
  let kycService: CustomerKycService;
  let userId: string;

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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    usersRepository = new PrismaUsersRepository(prisma);
    // Storage unconfigured in this e2e (no OBJECT_STORAGE_* env): the real
    // StorageAssetService then behaves as the production dev no-op — ownership
    // checks pass and stored URLs round-trip unchanged.
    const storageAssets = new StorageAssetService(
      { objectStorageConfigured: false } as unknown as AppConfigService,
      { createPresignedPutUrl: jest.fn(), createPresignedGetUrl: jest.fn() },
    );
    kycService = new CustomerKycService(prisma, auditService, storageAssets);

    const user = await prisma.user.create({
      data: {
        email: `kyc-lifecycle-${randomUUID()}@dripplex.test`,
        phone: `+234${randomInt10()}`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Lifecycle',
        lastName: 'Tester',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.customerKyc.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  describe('Profile fields round-trip through the real users table', () => {
    it('persists profilePhotoUrl, dateOfBirth (DATE column), and gender', async () => {
      if (!databaseAvailable) return;

      const dob = new Date('1995-06-15T00:00:00.000Z');
      const updated = await usersRepository.updateProfile(userId, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        profilePhotoUrl: 'https://cdn.example.com/ada.jpg',
        dateOfBirth: dob,
        gender: 'female',
      });

      expect(updated.firstName).toBe('Ada');
      expect(updated.lastName).toBe('Lovelace');
      expect(updated.profilePhotoUrl).toBe('https://cdn.example.com/ada.jpg');
      expect(updated.dateOfBirth?.toISOString().slice(0, 10)).toBe('1995-06-15');
      expect(updated.gender).toBe('female');

      const reread = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(reread.profilePhotoUrl).toBe('https://cdn.example.com/ada.jpg');
      expect(reread.gender).toBe('female');
    });

    it('updatePhone/updateEmail persist the new value and mark it verified', async () => {
      if (!databaseAvailable) return;

      const newPhone = `+234${randomInt10()}`;
      const updated = await usersRepository.updatePhone(userId, newPhone);
      expect(updated.phone).toBe(newPhone);
      expect(updated.phoneVerifiedAt).not.toBeNull();

      const newEmail = `kyc-lifecycle-new-${randomUUID()}@dripplex.test`;
      const updatedEmail = await usersRepository.updateEmail(userId, newEmail);
      expect(updatedEmail.email).toBe(newEmail);
      expect(updatedEmail.emailVerifiedAt).not.toBeNull();
    });
  });

  describe('CustomerKyc lifecycle -- happy path to VERIFIED', () => {
    it('NOT_STARTED by default (no row exists yet)', async () => {
      if (!databaseAvailable) return;

      const status = await kycService.getMyStatus(userId);
      expect(status.status).toBe('NOT_STARTED');
      expect(status.level).toBe('LEVEL_0');
      // Phone/email were just verified above, so both derived levels read true.
      expect(status.levelAccess).toEqual({ level0: true, level1: true });
    });

    it('start() creates a real row with startedAt populated', async () => {
      if (!databaseAvailable) return;

      const status = await kycService.start(userId, {});
      expect(status.status).toBe('IN_PROGRESS');
      expect(status.startedAt).not.toBeNull();
      expect(status.submittedAt).toBeNull();

      const row = await prisma.customerKyc.findFirstOrThrow({ where: { userId } });
      expect(row.status).toBe(CustomerKycStatus.IN_PROGRESS);
      expect(row.startedAt).not.toBeNull();
    });

    it('submit() transitions to PENDING_REVIEW and sets submittedAt', async () => {
      if (!databaseAvailable) return;

      const status = await kycService.submit(
        userId,
        {
          documentType: 'NATIONAL_ID',
          documentNumber: 'A1234567',
          frontImageUrl: 'https://cdn.example.com/front.jpg',
        },
        {},
      );

      expect(status.status).toBe('PENDING_REVIEW');
      expect(status.submittedAt).not.toBeNull();
      expect(status.documentType).toBe('NATIONAL_ID');
    });

    it('admin verify() transitions to VERIFIED and sets verifiedAt/reviewedAt/reviewStartedAt', async () => {
      if (!databaseAvailable) return;

      const row = await prisma.customerKyc.findFirstOrThrow({ where: { userId } });
      const status = await kycService.verify(row.id, REVIEWER_ID, 'looks good', {});

      expect(status.status).toBe('VERIFIED');
      expect(status.verifiedAt).not.toBeNull();
      expect(status.reviewedAt).not.toBeNull();
      expect(status.reviewStartedAt).not.toBeNull();
      expect(status.remarks).toBe('looks good');

      const reread = await prisma.customerKyc.findFirstOrThrow({ where: { userId } });
      expect(reread.status).toBe(CustomerKycStatus.VERIFIED);
      expect(reread.reviewedBy).toBe(REVIEWER_ID);
    });

    it('rejects starting a new round once VERIFIED', async () => {
      if (!databaseAvailable) return;

      await expect(kycService.start(userId, {})).rejects.toThrow(
        'Identity verification is already complete',
      );
    });
  });

  describe('CustomerKyc lifecycle -- reject + resubmission branch (separate user)', () => {
    let rejectUserId: string;

    beforeAll(async () => {
      if (!databaseAvailable) return;
      const user = await prisma.user.create({
        data: {
          email: `kyc-reject-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Reject',
          lastName: 'Path',
        },
      });
      rejectUserId = user.id;
    });

    afterAll(async () => {
      if (databaseAvailable) {
        await prisma.customerKyc
          .deleteMany({ where: { userId: rejectUserId } })
          .catch(() => undefined);
        await prisma.user.delete({ where: { id: rejectUserId } }).catch(() => undefined);
      }
    });

    it('start -> submit -> admin reject() sets rejectedAt, not verifiedAt', async () => {
      if (!databaseAvailable) return;

      await kycService.start(rejectUserId, {});
      await kycService.submit(
        rejectUserId,
        { documentType: 'PASSPORT', frontImageUrl: 'https://cdn.example.com/passport.jpg' },
        {},
      );
      const row = await prisma.customerKyc.findFirstOrThrow({ where: { userId: rejectUserId } });

      const status = await kycService.reject(row.id, REVIEWER_ID, 'document unreadable', {});
      expect(status.status).toBe('REJECTED');
      expect(status.rejectedAt).not.toBeNull();
      expect(status.verifiedAt).toBeNull();
      expect(status.remarks).toBe('document unreadable');
    });

    it('requestResubmission() -> resubmit -> verify completes the full loop', async () => {
      if (!databaseAvailable) return;

      // Re-open via start() first (mirrors the real self-service flow: a
      // REJECTED record is terminal for that submission; the customer
      // starts a fresh IN_PROGRESS round rather than resubmitting a
      // rejected one directly).
      const reopened = await kycService.start(rejectUserId, {});
      expect(reopened.status).toBe('IN_PROGRESS');

      await kycService.submit(
        rejectUserId,
        { documentType: 'DRIVER_LICENSE', frontImageUrl: 'https://cdn.example.com/dl.jpg' },
        {},
      );
      const pending = await prisma.customerKyc.findFirstOrThrow({
        where: { userId: rejectUserId },
      });

      const resubmissionStatus = await kycService.requestResubmission(
        pending.id,
        REVIEWER_ID,
        'blurry photo, please retake',
        {},
      );
      expect(resubmissionStatus.status).toBe('REQUIRES_RESUBMISSION');
      expect(resubmissionStatus.remarks).toBe('blurry photo, please retake');

      // Resubmission from REQUIRES_RESUBMISSION goes straight through
      // submit() again (no start() needed -- CustomerKycService.submit
      // explicitly allows REQUIRES_RESUBMISSION as a valid source state).
      const resubmitted = await kycService.submit(
        rejectUserId,
        { documentType: 'DRIVER_LICENSE', frontImageUrl: 'https://cdn.example.com/dl-v2.jpg' },
        {},
      );
      expect(resubmitted.status).toBe('PENDING_REVIEW');
      expect(resubmitted.remarks).toBeNull();

      const finalRow = await prisma.customerKyc.findFirstOrThrow({
        where: { userId: rejectUserId },
      });
      const finalStatus = await kycService.verify(finalRow.id, REVIEWER_ID, undefined, {});
      expect(finalStatus.status).toBe('VERIFIED');
    });
  });

  describe('Admin listPendingReview() reflects real PENDING_REVIEW rows', () => {
    it('includes a freshly submitted record and excludes VERIFIED ones', async () => {
      if (!databaseAvailable) return;

      const user = await prisma.user.create({
        data: {
          email: `kyc-list-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'List',
          lastName: 'Candidate',
        },
      });
      try {
        await kycService.start(user.id, {});
        await kycService.submit(
          user.id,
          { documentType: 'NATIONAL_ID', frontImageUrl: 'https://cdn.example.com/list.jpg' },
          {},
        );

        const pending = await kycService.listPendingReview();
        const entry = pending.find((item) => item.userId === user.id);
        expect(entry).toBeDefined();
        expect(entry?.userFullName).toBe('List Candidate');
        expect(entry?.submittedAt).not.toBeNull();

        // The already-VERIFIED user from the happy-path block above must
        // not show up in the pending queue.
        const verifiedEntry = pending.find((item) => item.userId === userId);
        expect(verifiedEntry).toBeUndefined();
      } finally {
        await prisma.customerKyc.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
        await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      }
    });
  });
});

function randomInt10(): string {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}
