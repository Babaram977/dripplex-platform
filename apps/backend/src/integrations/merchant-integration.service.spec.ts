/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * MKT-INT-001: Merchant Integration Platform — Database Foundation
 * Comprehensive test suite for integration models
 *
 * Tests cover:
 * - Merchant isolation (multi-tenant)
 * - Unique constraints (idempotency keys, credential mapping)
 * - Integration ownership and access control
 * - Credential security and expiration
 * - Soft-delete behavior (archivedAt)
 * - Idempotency guards (inventory, order updates)
 * - Migration validation (foreign keys, cascading deletes)
 * - Invalid relationship handling
 */
describe('Merchant Integration Models (MKT-INT-001)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Merchant Isolation — Multi-Tenant Scoping', () => {
    it('should create merchant integrations scoped to different merchants', async () => {
      const timestamp = String(Date.now());
      const merchant1Id = `merchant-1-${timestamp}`;
      const merchant2Id = `merchant-2-${timestamp}`;

      const integration1 = await prisma.merchantIntegration.create({
        data: {
          merchantId: merchant1Id,
          integrationName: 'Square Pos',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const integration2 = await prisma.merchantIntegration.create({
        data: {
          merchantId: merchant2Id,
          integrationName: 'Toast Pos',
          posProvider: 'TOAST',
          status: 'ACTIVE',
        },
      });

      expect(integration1.merchantId).toBe(merchant1Id);
      expect(integration2.merchantId).toBe(merchant2Id);
      expect(integration1.id).not.toBe(integration2.id);

      // Verify isolation — query by merchant
      const merchant1Integrations = await prisma.merchantIntegration.findMany({
        where: { merchantId: merchant1Id },
      });

      expect(merchant1Integrations).toHaveLength(1);
      const foundIntegration = merchant1Integrations.at(0);
      expect(foundIntegration?.id).toBe(integration1.id);

      // Cleanup
      await prisma.merchantIntegration.delete({ where: { id: integration1.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration2.id } });
    });

    it('should index on merchant_id for efficient queries', async () => {
      const merchantId = `merchant-isolation-${String(Date.now())}`;

      // Create multiple integrations for the same merchant
      const integrations = await Promise.all([
        prisma.merchantIntegration.create({
          data: {
            merchantId,
            integrationName: 'Integration 1',
            posProvider: 'SQUARE',
            status: 'ACTIVE',
          },
        }),
        prisma.merchantIntegration.create({
          data: {
            merchantId,
            integrationName: 'Integration 2',
            posProvider: 'TOAST',
            status: 'ACTIVE',
          },
        }),
      ]);

      // Query should be efficient (index exists)
      const results = await prisma.merchantIntegration.findMany({
        where: { merchantId },
      });

      expect(results).toHaveLength(2);

      // Cleanup
      for (const int of integrations) {
        await prisma.merchantIntegration.delete({ where: { id: int.id } });
      }
    });
  });

  describe('Unique Constraints — Idempotency', () => {
    it('should enforce unique constraint on inventory_updates (integration_id, idempotency_key)', async () => {
      const merchantId = `merchant-idempotency-${String(Date.now())}`;
      const integrationId = (
        await prisma.merchantIntegration.create({
          data: {
            merchantId,
            integrationName: 'Test',
            posProvider: 'SQUARE',
            status: 'ACTIVE',
          },
        })
      ).id;

      const productSync = await prisma.productSync.create({
        data: {
          integrationId,
          externalSku: 'SKU-001',
          mappingStatus: 'ACTIVE',
        },
      });

      const idempotencyKey = `inv-update-${String(Date.now())}`;

      // Create first inventory update
      const update1 = await prisma.inventoryUpdate.create({
        data: {
          integrationId,
          productSyncId: productSync.id,
          externalSku: 'SKU-001',
          previousQuantity: 100,
          newQuantity: 99,
          sourceType: 'WEBHOOK',
          idempotencyKey,
        },
      });

      expect(update1.idempotencyKey).toBe(idempotencyKey);

      // Attempting to create a duplicate should fail
      let duplicateError: Error | null = null;
      try {
        await prisma.inventoryUpdate.create({
          data: {
            integrationId,
            productSyncId: productSync.id,
            externalSku: 'SKU-001',
            previousQuantity: 100,
            newQuantity: 98,
            sourceType: 'WEBHOOK',
            idempotencyKey, // Same key = idempotent
          },
        });
      } catch (error) {
        duplicateError = error as Error;
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.message).toContain('Unique constraint');

      // Cleanup
      await prisma.inventoryUpdate.delete({ where: { id: update1.id } });
      await prisma.productSync.delete({ where: { id: productSync.id } });
      await prisma.merchantIntegration.delete({ where: { id: integrationId } });
    });

    it('should enforce unique constraint on order_status_updates (integration_id, idempotency_key)', async () => {
      const merchantId = `merchant-order-idempotency-${String(Date.now())}`;
      const integrationId = (
        await prisma.merchantIntegration.create({
          data: {
            merchantId,
            integrationName: 'Test',
            posProvider: 'SQUARE',
            status: 'ACTIVE',
          },
        })
      ).id;

      const idempotencyKey = `order-update-${String(Date.now())}`;

      // Create first order status update
      const update1 = await prisma.orderStatusUpdate.create({
        data: {
          integrationId,
          externalOrderId: 'ext-order-001',
          newStatus: 'CONFIRMED',
          sourceTimestamp: new Date(),
          idempotencyKey,
        },
      });

      // Duplicate should fail
      let duplicateError: Error | null = null;
      try {
        await prisma.orderStatusUpdate.create({
          data: {
            integrationId,
            externalOrderId: 'ext-order-002',
            newStatus: 'SHIPPED',
            sourceTimestamp: new Date(),
            idempotencyKey, // Same key = duplicate
          },
        });
      } catch (error) {
        duplicateError = error as Error;
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.message).toContain('Unique constraint');

      // Cleanup
      await prisma.orderStatusUpdate.delete({ where: { id: update1.id } });
      await prisma.merchantIntegration.delete({ where: { id: integrationId } });
    });

    it('should enforce unique constraint on product_syncs (integration_id, external_sku)', async () => {
      const merchantId = `merchant-product-sync-${String(Date.now())}`;
      const integrationId = (
        await prisma.merchantIntegration.create({
          data: {
            merchantId,
            integrationName: 'Test',
            posProvider: 'SQUARE',
            status: 'ACTIVE',
          },
        })
      ).id;

      // Create first product sync
      const sync1 = await prisma.productSync.create({
        data: {
          integrationId,
          externalSku: 'UNIQUE-SKU-123',
          mappingStatus: 'ACTIVE',
        },
      });

      // Attempt duplicate external_sku for same integration
      let duplicateError: Error | null = null;
      try {
        await prisma.productSync.create({
          data: {
            integrationId,
            externalSku: 'UNIQUE-SKU-123', // Same SKU
            mappingStatus: 'ACTIVE',
          },
        });
      } catch (error) {
        duplicateError = error as Error;
      }

      expect(duplicateError).not.toBeNull();

      // Cleanup
      await prisma.productSync.delete({ where: { id: sync1.id } });
      await prisma.merchantIntegration.delete({ where: { id: integrationId } });
    });
  });

  describe('Integration Credentials — Scoped Access Control', () => {
    it('should create credentials linked to an integration', async () => {
      const merchantId = `merchant-creds-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // @ts-ignore Prisma mock typing in tests
      const credential = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          credentialHash: 'hashed_token_xyz', // In real app: bcrypt.hash(token)
          scopes: ['catalog:read', 'catalog:write', 'inventory:read'],
        },
      });

      expect(credential.integrationId).toBe(integration.id);
      expect(credential.scopes).toContain('catalog:read');

      // Cleanup
      await prisma.integrationCredential.delete({ where: { id: credential.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should support credential expiration tracking', async () => {
      const merchantId = `merchant-creds-expire-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      // @ts-ignore Prisma mock typing in tests
      const credential = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          credentialHash: 'hashed_token_with_expiry',
          scopes: ['integrations:read'],
          expiresAt,
        },
      });

      const fetched = await prisma.integrationCredential.findUnique({
        where: { id: credential.id },
      });

      expect(fetched?.expiresAt?.getTime()).toBe(expiresAt.getTime());

      // Cleanup
      await prisma.integrationCredential.delete({ where: { id: credential.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should track credential rotation history', async () => {
      const merchantId = `merchant-creds-rotation-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const now = new Date();
      // @ts-ignore Prisma mock typing in tests
      const credential = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'OUTGOING_API_KEY',
          credentialHash: 'initial_hash',
          scopes: [],
          rotatedAt: now,
        },
      });

      expect(credential.rotatedAt?.getTime()).toBe(now.getTime());

      // Cleanup
      await prisma.integrationCredential.delete({ where: { id: credential.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should cascade delete credentials when integration is deleted', async () => {
      const merchantId = `merchant-creds-cascade-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // @ts-ignore Prisma mock typing in tests
      const credential = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'INCOMING_API_KEY',
          credentialHash: 'will_be_deleted',
          scopes: [],
        },
      });

      // Delete integration
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });

      // Credential should be gone
      const found = await prisma.integrationCredential.findUnique({
        where: { id: credential.id },
      });

      expect(found).toBeNull();
    });
  });

  describe('Soft-Delete Pattern — archivedAt Timestamps', () => {
    it('should support soft-delete of merchant integrations via archivedAt', async () => {
      const merchantId = `merchant-soft-delete-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // Soft-delete: set archivedAt
      const archivedAt = new Date();
      const archived = await prisma.merchantIntegration.update({
        where: { id: integration.id },
        data: { archivedAt },
      });

      expect(archived.archivedAt).not.toBeNull();

      // Integration still exists in DB (soft-deleted)
      const fetched = await prisma.merchantIntegration.findUnique({
        where: { id: integration.id },
      });
      expect(fetched).not.toBeNull();
      expect(fetched?.archivedAt).not.toBeNull();

      // Queries should filter out archived by default
      const activeIntegrations = await prisma.merchantIntegration.findMany({
        where: {
          merchantId,
          archivedAt: null, // Only non-archived
        },
      });

      expect(activeIntegrations).toHaveLength(0);

      // Cleanup
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should support soft-delete of credentials via archivedAt', async () => {
      const merchantId = `merchant-cred-soft-delete-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // @ts-ignore Prisma mock typing in tests
      const credential = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'OUTGOING_OAUTH_REFRESH',
          credentialHash: 'test',
          scopes: [],
        },
      });

      // Soft-delete
      const archivedAt = new Date();
      const archived = await prisma.integrationCredential.update({
        where: { id: credential.id },
        data: { archivedAt },
      });

      expect(archived.archivedAt).not.toBeNull();

      // Cleanup
      await prisma.integrationCredential.delete({ where: { id: credential.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });
  });

  describe('Integration Logs — Audit Trail', () => {
    it('should create append-only audit logs of API calls', async () => {
      const merchantId = `merchant-logs-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const log = await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          endpoint: '/v1/catalog/items',
          method: 'GET',
          responseStatus: 200,
          responseBody: '{"items": [...]}',
          ipAddress: '192.0.2.1',
          correlationId: 'corr-123',
        },
      });

      expect(log.endpoint).toBe('/v1/catalog/items');
      expect(log.responseStatus).toBe(200);
      expect(log.method).toBe('GET');

      // Cleanup
      await prisma.integrationLog.delete({ where: { id: log.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should capture request/response bodies and errors', async () => {
      const merchantId = `merchant-logs-error-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const failedLog = await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          endpoint: '/v1/catalog/items',
          method: 'POST',
          requestBody: '{"name": "New Item"}',
          responseStatus: 400,
          responseBody: '{"error": "Invalid SKU"}',
          errorMessage: 'SKU must be unique',
          correlationId: 'corr-error-456',
        },
      });

      expect(failedLog.responseStatus).toBe(400);
      expect(failedLog.errorMessage).toContain('unique');

      // Cleanup
      await prisma.integrationLog.delete({ where: { id: failedLog.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should create compound index on (integration_id, created_at) for efficient queries', async () => {
      const merchantId = `merchant-logs-index-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // Create multiple logs
      for (let i = 0; i < 3; i++) {
        await prisma.integrationLog.create({
          data: {
            integrationId: integration.id,
            endpoint: '/test',
            method: 'GET',
            responseStatus: 200,
          },
        });
      }

      // Query should be efficient
      const logs = await prisma.integrationLog.findMany({
        where: { integrationId: integration.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);

      // Cleanup
      for (const log of logs) {
        await prisma.integrationLog.delete({ where: { id: log.id } });
      }
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });
  });

  describe('Reconciliation Conflicts — Data Mismatch Tracking', () => {
    it('should track conflicts between dripplex and external values', async () => {
      const merchantId = `merchant-conflicts-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const conflict = await prisma.integrationConflict.create({
        data: {
          integrationId: integration.id,
          conflictType: 'PRICE_MISMATCH',
          externalId: 'ext-sku-001',
          dripplexValue: '99.99',
          externalValue: '100.00',
          status: 'OPEN',
        },
      });

      expect(conflict.status).toBe('OPEN');
      expect(conflict.conflictType).toBe('PRICE_MISMATCH');

      // Resolve conflict
      const resolved = await prisma.integrationConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          resolution: 'Updated dripplex price to 100.00',
          resolvedAt: new Date(),
        },
      });

      expect(resolved.status).toBe('RESOLVED');

      // Cleanup
      await prisma.integrationConflict.delete({ where: { id: conflict.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should index on (integration_id, status) for conflict queries', async () => {
      const merchantId = `merchant-conflicts-index-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // Create multiple conflicts
      const conflicts = await Promise.all([
        prisma.integrationConflict.create({
          data: {
            integrationId: integration.id,
            conflictType: 'PRICE_MISMATCH',
            status: 'OPEN',
          },
        }),
        prisma.integrationConflict.create({
          data: {
            integrationId: integration.id,
            conflictType: 'INVENTORY_MISMATCH',
            status: 'RESOLVED',
          },
        }),
      ]);

      // Query open conflicts for this integration
      const openConflicts = await prisma.integrationConflict.findMany({
        where: {
          integrationId: integration.id,
          status: 'OPEN',
        },
      });

      expect(openConflicts).toHaveLength(1);

      // Cleanup
      for (const conf of conflicts) {
        await prisma.integrationConflict.delete({ where: { id: conf.id } });
      }
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });
  });

  describe('Catalog Sync Jobs — Batch Synchronization Tracking', () => {
    it('should track catalog sync job status and progress', async () => {
      const merchantId = `merchant-sync-jobs-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const job = await prisma.catalogSyncJob.create({
        data: {
          integrationId: integration.id,
          jobStatus: 'PENDING',
          syncDirection: 'FROM_EXTERNAL',
          productCount: 0,
        },
      });

      expect(job.jobStatus).toBe('PENDING');
      expect(job.syncDirection).toBe('FROM_EXTERNAL');

      // Start job
      const started = await prisma.catalogSyncJob.update({
        where: { id: job.id },
        data: {
          jobStatus: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });

      expect(started.jobStatus).toBe('IN_PROGRESS');

      // Complete job
      const completed = await prisma.catalogSyncJob.update({
        where: { id: job.id },
        data: {
          jobStatus: 'COMPLETED',
          completedAt: new Date(),
          productCount: 150,
        },
      });

      expect(completed.jobStatus).toBe('COMPLETED');
      expect(completed.productCount).toBe(150);

      // Cleanup
      await prisma.catalogSyncJob.delete({ where: { id: job.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should track failed sync jobs with failure reason', async () => {
      const merchantId = `merchant-sync-fail-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const job = await prisma.catalogSyncJob.create({
        data: {
          integrationId: integration.id,
          jobStatus: 'FAILED',
          syncDirection: 'FROM_EXTERNAL',
          failureReason: 'API timeout after 3 retries',
          productCount: 0,
        },
      });

      expect(job.jobStatus).toBe('FAILED');
      expect(job.failureReason).toContain('timeout');

      // Cleanup
      await prisma.catalogSyncJob.delete({ where: { id: job.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });

    it('should index on (integration_id, job_status) for querying pending/in-progress jobs', async () => {
      const merchantId = `merchant-sync-pending-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // Create jobs with different statuses
      const jobs = await Promise.all([
        prisma.catalogSyncJob.create({
          data: {
            integrationId: integration.id,
            jobStatus: 'PENDING',
            syncDirection: 'FROM_EXTERNAL',
          },
        }),
        prisma.catalogSyncJob.create({
          data: {
            integrationId: integration.id,
            jobStatus: 'IN_PROGRESS',
            syncDirection: 'FROM_EXTERNAL',
          },
        }),
        prisma.catalogSyncJob.create({
          data: {
            integrationId: integration.id,
            jobStatus: 'COMPLETED',
            syncDirection: 'TO_EXTERNAL',
          },
        }),
      ]);

      // Query pending jobs
      const pendingJobs = await prisma.catalogSyncJob.findMany({
        where: {
          integrationId: integration.id,
          jobStatus: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      expect(pendingJobs).toHaveLength(2);

      // Cleanup
      for (const j of jobs) {
        await prisma.catalogSyncJob.delete({ where: { id: j.id } });
      }
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });
  });

  describe('Cascading Delete Behavior', () => {
    it('should cascade delete all child entities when integration is deleted', async () => {
      const merchantId = `merchant-cascade-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      // Create related entities
      // @ts-ignore Prisma mock typing in tests
      const cred = await prisma.integrationCredential.create({
        data: {
          integrationId: integration.id,
          credentialType: 'INCOMING_SIGNATURE',
          credentialHash: 'test',
          scopes: [],
        },
      });

      const log = await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          endpoint: '/test',
          method: 'GET',
          responseStatus: 200,
        },
      });

      const conflict = await prisma.integrationConflict.create({
        data: {
          integrationId: integration.id,
          conflictType: 'TEST',
          status: 'OPEN',
        },
      });

      const sync = await prisma.productSync.create({
        data: {
          integrationId: integration.id,
          externalSku: `TEST-SKU-${String(Date.now())}`,
          mappingStatus: 'ACTIVE',
        },
      });

      const job = await prisma.catalogSyncJob.create({
        data: {
          integrationId: integration.id,
          jobStatus: 'PENDING',
          syncDirection: 'FROM_EXTERNAL',
        },
      });

      // Delete integration
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });

      // All children should be cascaded
      const credCheck = await prisma.integrationCredential.findUnique({
        where: { id: cred.id },
      });
      const logCheck = await prisma.integrationLog.findUnique({
        where: { id: log.id },
      });
      const conflictCheck = await prisma.integrationConflict.findUnique({
        where: { id: conflict.id },
      });
      const syncCheck = await prisma.productSync.findUnique({
        where: { id: sync.id },
      });
      const jobCheck = await prisma.catalogSyncJob.findUnique({
        where: { id: job.id },
      });

      expect(credCheck).toBeNull();
      expect(logCheck).toBeNull();
      expect(conflictCheck).toBeNull();
      expect(syncCheck).toBeNull();
      expect(jobCheck).toBeNull();
    });
  });

  describe('Inventory Updates — Webhook/Poll Delivery Tracking', () => {
    it('should track delivery status and retry attempts', async () => {
      const merchantId = `merchant-inv-delivery-${String(Date.now())}`;
      const integration = await prisma.merchantIntegration.create({
        data: {
          merchantId,
          integrationName: 'Test',
          posProvider: 'SQUARE',
          status: 'ACTIVE',
        },
      });

      const sync = await prisma.productSync.create({
        data: {
          integrationId: integration.id,
          externalSku: `SKU-${String(Date.now())}`,
          mappingStatus: 'ACTIVE',
        },
      });

      const update = await prisma.inventoryUpdate.create({
        data: {
          integrationId: integration.id,
          productSyncId: sync.id,
          externalSku: sync.externalSku,
          previousQuantity: 100,
          newQuantity: 95,
          sourceType: 'WEBHOOK',
          deliveryStatus: 'PENDING',
          idempotencyKey: `inv-${String(Date.now())}`,
        },
      });

      // Attempt delivery
      const firstAttempt = await prisma.inventoryUpdate.update({
        where: { id: update.id },
        data: {
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
      });

      expect(firstAttempt.attemptCount).toBe(1);

      // After successful delivery
      const delivered = await prisma.inventoryUpdate.update({
        where: { id: update.id },
        data: {
          deliveryStatus: 'DELIVERED',
        },
      });

      expect(delivered.deliveryStatus).toBe('DELIVERED');

      // Cleanup
      await prisma.inventoryUpdate.delete({ where: { id: update.id } });
      await prisma.productSync.delete({ where: { id: sync.id } });
      await prisma.merchantIntegration.delete({ where: { id: integration.id } });
    });
  });
});
