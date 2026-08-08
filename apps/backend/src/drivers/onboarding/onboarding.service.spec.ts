import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { OnboardingService } from './onboarding.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OnboardingService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OnboardingService;
  let driverId: string;
  const context = {};

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
    service = new OnboardingService(prisma, auditService);

    const driver = await prisma.user.create({
      data: {
        email: `onboarding-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({ data: { userId: driver.id } });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a DRAFT onboarding record on first read', async () => {
    if (!databaseAvailable) return;

    const onboarding = await service.getOwnOnboarding(driverId);

    expect(onboarding.driverId).toBe(driverId);
    expect(onboarding.status).toBe('DRAFT');
  });

  it('blocks submission until emergency contact, agreement, and KYC are all present', async () => {
    if (!databaseAvailable) return;

    await expect(service.submitForReview(driverId, context)).rejects.toThrow(
      'Onboarding is incomplete',
    );
  });

  it('submits successfully once all prerequisites are met', async () => {
    if (!databaseAvailable) return;

    await service.submitEmergencyContact(
      driverId,
      {
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '+2348012345678',
        emergencyContactRelationship: 'Spouse',
      },
      context,
    );
    await service.acceptAgreement(driverId, { agreementVersion: 'v1' }, context);
    await prisma.driverKyc.create({
      data: {
        driverId,
        documentType: 'DRIVER_LICENSE',
        documentNumber: 'ONB-1',
        frontImage: 'https://example.com/x.jpg',
      },
    });

    const submitted = await service.submitForReview(driverId, context);

    expect(submitted.status).toBe('SUBMITTED');
  });

  it('rejects re-submitting an already-submitted onboarding', async () => {
    if (!databaseAvailable) return;

    await expect(service.submitForReview(driverId, context)).rejects.toThrow(
      'already been submitted',
    );
  });
});
