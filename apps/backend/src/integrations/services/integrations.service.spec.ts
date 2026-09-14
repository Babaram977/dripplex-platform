/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
import { Test, type TestingModule } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import { IntegrationsService } from './integrations.service';
import { SsrfProtectionService } from './ssrf-protection.service';

import type { Server } from 'node:http';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;

  const merchantA = 'merchant-a-' + String(Date.now());
  const merchantB = 'merchant-b-' + String(Date.now());

  beforeEach(async () => {
    prisma = {
      merchantIntegration: {
        findMany: jest.fn() as any,
        findFirst: jest.fn() as any,
        create: jest.fn() as any,
        update: jest.fn() as any,
      },
      integrationCredential: {
        updateMany: jest.fn() as any,
      },
    } as unknown as jest.Mocked<PrismaService>;

    audit = {
      // @ts-ignore
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // SsrfProtectionService became a constructor dependency of
        // IntegrationsService when SSRF validation was added, and this module
        // was never updated — so every test here failed at compile() with
        // "Nest can't resolve dependencies". It is a real provider rather than
        // a mock: it performs no I/O, it only validates URLs.
        SsrfProtectionService,
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Merchant Isolation — Authorization', () => {
    it('should deny Merchant A access to Merchant B integrations', async () => {
      const integrationB = {
        id: 'integration-b-' + String(Date.now()),
        merchantId: merchantB,
        integrationName: 'B POS',
        posProvider: 'SQUARE',
        status: 'ACTIVE',
        archivedAt: null,
      };

      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null); // Merchant A cannot see B's integration

      // Merchant A attempts to access Merchant B's integration
      await expect(service.getIntegration(merchantA, integrationB.id)).rejects.toThrow(
        ForbiddenDomainException,
      );

      // Verify the query was correctly scoped
      expect(prisma.merchantIntegration.findFirst).toHaveBeenCalledWith({
        where: {
          id: integrationB.id,
          merchantId: merchantA, // ← Query scoped to merchantA
          archivedAt: null,
        },
      });
    });

    it('should allow Merchant A to access only their own integrations', async () => {
      const integrationA = {
        id: 'integration-a-' + String(Date.now()),
        merchantId: merchantA,
        integrationName: 'A POS',
        posProvider: 'SQUARE',
        status: 'ACTIVE',
        archivedAt: null,
        webhookUrl: null,
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(integrationA);

      const result = await service.getIntegration(merchantA, integrationA.id);

      expect(result.id).toBe(integrationA.id);
      expect(result.merchantId).toBe(merchantA);

      // Verify merchantId was verified in query
      expect(prisma.merchantIntegration.findFirst).toHaveBeenCalledWith({
        where: {
          id: integrationA.id,
          merchantId: merchantA,
          archivedAt: null,
        },
      });
    });

    it('should enforce merchant scoping on list operations', async () => {
      const integrationsA = [
        {
          id: 'int-a1',
          merchantId: merchantA,
          integrationName: 'A1',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
          archivedAt: null,
        },
      ];

      // @ts-ignore
      prisma.merchantIntegration.findMany.mockResolvedValue(integrationsA as any);

      await service.listIntegrations(merchantA);

      // Verify the query included merchantId filter
      expect(prisma.merchantIntegration.findMany).toHaveBeenCalledWith({
        where: { merchantId: merchantA, archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should force merchantId on create (not user-controlled)', async () => {
      const newIntegration = {
        id: 'new-int',
        merchantId: merchantA, // ← Forced from context
        integrationName: 'New POS',
        posProvider: 'SHOPIFY',
        status: 'ACTIVE',
        archivedAt: null,
        webhookUrl: null,
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.create.mockResolvedValue(newIntegration);

      await service.createIntegration(merchantA, {
        integrationName: 'New POS',
        posProvider: 'SHOPIFY' as any,
      });

      // Verify merchantId was forced from context, not from input
      expect(prisma.merchantIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchantId: merchantA, // ← Forced
          integrationName: 'New POS',
          posProvider: 'SHOPIFY',
        }),
      });
    });
  });

  describe('getIntegration', () => {
    it('should return 403 (not 404) when integration not found', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null);

      // Attempt to access a non-existent integration (or one from another merchant)
      const error = (await service
        .getIntegration(merchantA, 'nonexistent-id')
        .catch((e: unknown) => e)) as any;

      expect(error).toBeInstanceOf(ForbiddenDomainException);
      expect(error.statusCode).toBe(403); // Not 404
    });

    it('should only return active integrations', async () => {
      const archivedIntegration = {
        id: 'archived-int',
        merchantId: merchantA,
        integrationName: 'Old POS',
        posProvider: 'SQUARE',
        status: 'ARCHIVED',
        archivedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null); // Archived not returned

      await expect(service.getIntegration(merchantA, archivedIntegration.id)).rejects.toThrow(
        ForbiddenDomainException,
      );
    });
  });

  describe('createIntegration', () => {
    it('should create integration with merchantId from context', async () => {
      const newInt = {
        id: 'new-int',
        merchantId: merchantA,
        integrationName: 'Store POS',
        posProvider: 'SHOPIFY',
        status: 'ACTIVE',
        archivedAt: null,
        webhookUrl: 'https://example.com/webhook',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.create.mockResolvedValue(newInt);

      const result = await service.createIntegration(merchantA, {
        integrationName: 'Store POS',
        posProvider: 'SHOPIFY' as any,
        webhookUrl: 'https://example.com/webhook',
      });

      expect(result.merchantId).toBe(merchantA);
      expect(audit.record).toHaveBeenCalledWith(
        'integration.created',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should support idempotent creates', async () => {
      const existingInt = {
        id: 'int-1',
        merchantId: merchantA,
        integrationName: 'Duplicate POS',
        posProvider: 'SQUARE',
        status: 'ACTIVE',
        archivedAt: null,
        webhookUrl: null,
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate: same merchant, same name, same provider already exists
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(existingInt);

      const result = await service.createIntegration(
        merchantA,
        {
          integrationName: 'Duplicate POS',
          posProvider: 'SQUARE' as any,
        },
        'idempotency-key-123',
      );

      expect(result.id).toBe('int-1'); // Returns existing, not creating new
      // Should not create since it exists
      expect(prisma.merchantIntegration.create).not.toHaveBeenCalled();
    });
  });

  describe('disconnectIntegration', () => {
    it('should soft-delete (archive) integration and credentials', async () => {
      const integration = {
        id: 'int-1',
        merchantId: merchantA,
        integrationName: 'POS',
        posProvider: 'SQUARE',
        status: 'ACTIVE',
        archivedAt: null,
        webhookUrl: null,
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(integration);
      // @ts-ignore
      prisma.merchantIntegration.update.mockResolvedValue({
        ...integration,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      });

      await service.disconnectIntegration(merchantA, 'int-1');

      // Verify integration was archived
      expect(prisma.merchantIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-1' },
        data: {
          status: 'ARCHIVED',
          archivedAt: expect.any(Date),
        },
      });

      // Verify credentials were also archived
      expect(prisma.integrationCredential.updateMany).toHaveBeenCalledWith({
        where: { integrationId: 'int-1' },
        data: { archivedAt: expect.any(Date) },
      });

      // Verify audit logged
      expect(audit.record).toHaveBeenCalledWith(
        'integration.disconnected',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should enforce merchant access before disconnecting', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null); // Different merchant

      await expect(service.disconnectIntegration(merchantA, 'someone-elses-int')).rejects.toThrow(
        ForbiddenDomainException,
      );

      // Should not attempt to update credentials
      expect(prisma.integrationCredential.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Soft-Delete Pattern', () => {
    it('should exclude archived integrations from list', async () => {
      const activeInt = {
        merchantId: merchantA,
        integrationName: 'Active',
        archivedAt: null,
      };

      // @ts-ignore
      prisma.merchantIntegration.findMany.mockResolvedValue([activeInt] as any);

      await service.listIntegrations(merchantA);

      // Verify archived are excluded
      expect(prisma.merchantIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: null,
          }),
        }),
      );
    });

    it('should allow includeArchived=true to show archived integrations', async () => {
      const archivedInt = {
        merchantId: merchantA,
        integrationName: 'Archived',
        archivedAt: new Date(),
      };

      // @ts-ignore
      prisma.merchantIntegration.findMany.mockResolvedValue([archivedInt] as any);

      await service.listIntegrations(merchantA, true);

      // Verify archived are NOT filtered
      expect(prisma.merchantIntegration.findMany).toHaveBeenCalledWith({
        where: { merchantId: merchantA },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('isIntegrationActive', () => {
    it('should return true for active integrations', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: 'int-1',
        status: 'ACTIVE',
        archivedAt: null,
      } as any);

      const isActive = await service.isIntegrationActive('int-1');
      expect(isActive).toBe(true);
    });

    it('should return false for archived integrations', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null);

      const isActive = await service.isIntegrationActive('int-archived');
      expect(isActive).toBe(false);
    });
  });
});

/**
 * B2 — a validated webhook URL must not become an unvalidated one via a redirect.
 *
 * `validateUrl` inspects the merchant-supplied URL and nothing else. With
 * fetch's default `redirect: 'follow'`, a merchant could point the webhook at
 * a host they control, answer `302 Location: http://<internal>/`, and have
 * DrippleX issue that second request from inside the production network —
 * defeating the guard entirely.
 *
 * The assertion is the security invariant itself: **the redirect target is
 * never contacted**. It deliberately does not assert a status code or anything
 * about how the HTTP client represents a redirect, so it keeps holding if the
 * runtime's representation changes; it fails only if someone makes DrippleX
 * follow the hop again.
 *
 * `SsrfProtectionService` is stubbed here so the test can use loopback servers
 * — the real validator rejects 127.0.0.1, which would refuse the URL before
 * the redirect is ever exercised. What is under test is what happens to a URL
 * that has *already passed* validation.
 */
describe('IntegrationsService — webhook test does not follow redirects (B2)', () => {
  let service: IntegrationsService;
  let target: Server;
  let redirector: Server;
  let targetHits = 0;
  let entryUrl = '';

  beforeEach(async () => {
    const http = await import('node:http');

    targetHits = 0;
    target = http.createServer((_req, res) => {
      targetHits += 1;
      res.writeHead(200);
      res.end('internal');
    });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const targetPort = (target.address() as { port: number }).port;

    redirector = http.createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${String(targetPort)}/internal` });
      res.end();
    });
    await new Promise<void>((resolve) => redirector.listen(0, '127.0.0.1', resolve));
    entryUrl = `http://127.0.0.1:${String((redirector.address() as { port: number }).port)}/hook`;

    const prisma = {
      merchantIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'int-1',
          merchantId: 'merchant-1',
          vendorName: 'Probe POS',
          webhookUrl: entryUrl,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
          credentials: [],
        }) as any,
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: SsrfProtectionService, useValue: { validateUrl: jest.fn() } },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) =>
      target.close(() => {
        resolve();
      }),
    );
    await new Promise<void>((resolve) =>
      redirector.close(() => {
        resolve();
      }),
    );
  });

  it('B2-001 · never issues a request to the redirect target', async () => {
    const result = await service.testIntegrationC('merchant-1', 'int-1');

    // The whole point: the second hop was never made.
    expect(targetHits).toBe(0);
    // And the merchant is told the check did not succeed, rather than being
    // shown a green tick earned by an endpoint they did not nominate.
    expect(result?.status).not.toBe('SUCCESS');
  });
});
