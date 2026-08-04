import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { InspectionCentresService } from './inspection-centres.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const ADMIN_ID = '22222222-2222-2222-2222-222222222222';

describe('InspectionCentresService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: InspectionCentresService;
  let centreId: string;
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
    service = new InspectionCentresService(prisma, auditService);
  });

  afterAll(async () => {
    if (databaseAvailable && centreId) {
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates an active-by-default inspection centre', async () => {
    if (!databaseAvailable) return;

    const centre = await service.create(
      { name: `Test Centre ${randomUUID().slice(0, 6)}`, address: '1 Test Road', city: 'Lagos' },
      ADMIN_ID,
      context,
    );
    centreId = centre.id;

    expect(centre.isActive).toBe(true);
    expect(centre.city).toBe('Lagos');
  });

  it('excludes deactivated centres from listActive() but keeps them in listAll()', async () => {
    if (!databaseAvailable) return;

    await service.update(centreId, { isActive: false }, ADMIN_ID, context);

    const active = await service.listActive();
    const all = await service.listAll();

    expect(active.some((c) => c.id === centreId)).toBe(false);
    expect(all.some((c) => c.id === centreId)).toBe(true);
  });

  it('throws for an unknown centre', async () => {
    if (!databaseAvailable) return;

    await expect(service.get(randomUUID())).rejects.toThrow('Inspection centre not found');
  });
});
