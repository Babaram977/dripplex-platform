import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProductStatus, StockMovementType } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantProductsService } from '../../products/merchant-products.service';
import {
  CATALOGUE_SYNC_AUDIT_ACTIONS,
  CATALOG_SYNC_JOB_STATUS,
  CONFLICT_TYPE,
  INVENTORY_DELIVERY_STATUS,
  INVENTORY_SOURCE_TYPE,
  MAPPING_STATUS,
  SUPPORTED_CURRENCY,
  SYNC_DIRECTION,
} from '../catalogue-ingestion.constants';

import { CategoryMappingService } from './category-mapping.service';

import type { IngestCatalogueDto, IngestCatalogueItemDto } from '../dtos/ingest-catalogue.dto';
import type { CatalogSyncJob, MerchantIntegration } from '@prisma/client';

/** Raised for an item that cannot be applied. Fails the item, never the batch. */
class ItemRejected extends Error {
  constructor(
    public readonly conflictType: string,
    message: string,
    public readonly externalValue?: string,
  ) {
    super(message);
    this.name = 'ItemRejected';
  }
}

export interface CatalogueSyncJobSummary {
  jobId: string;
  jobStatus: string;
  productCount: number;
  failedCount: number;
  /** True when this batch's idempotency key had already been applied. */
  replayed: boolean;
}

/**
 * Ingests an external POS catalogue into the DrippleX catalogue.
 *
 * Implements the Phase 1 Catalogue Ingestion Contract
 * (docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md). The rules that are easy to
 * get wrong and expensive to get wrong are called out at their call sites:
 * `reserved` is never written, nothing is ever hard-deleted, a merchant's own
 * edit is never silently overwritten, and one bad row never rejects a
 * merchant's whole catalogue.
 */
@Injectable()
export class CatalogueIngestionService {
  private readonly logger = new Logger(CatalogueIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantProducts: MerchantProductsService,
    private readonly categoryMapping: CategoryMappingService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Apply one pushed batch.
   *
   * Item failures are recorded and skipped; only an error that makes the whole
   * batch meaningless (no merchant profile behind the integration) fails the job.
   */
  public async ingest(
    integration: MerchantIntegration,
    dto: IngestCatalogueDto,
    context: AuditContext,
  ): Promise<CatalogueSyncJobSummary> {
    const replay = await this.findReplayedJob(integration.id, dto.idempotencyKey);
    if (replay) {
      // Decision #3. The original job is returned untouched — re-applying a
      // batch the POS merely retried would double-count stock movements.
      return {
        jobId: replay.id,
        jobStatus: replay.jobStatus,
        productCount: replay.productCount,
        failedCount: 0,
        replayed: true,
      };
    }

    const job = await this.openJob(integration.id, dto.idempotencyKey);
    await this.auditService.record(CATALOGUE_SYNC_AUDIT_ACTIONS.JOB_STARTED, context, {
      resource: 'catalog_sync_job',
      resourceId: job.id,
      metadata: { integrationId: integration.id, itemCount: dto.items.length },
    });

    const merchantId = await this.resolveMerchantProfileId(integration.merchantId);
    if (!merchantId) {
      // Not an item problem — nothing in this batch can be written, so the job
      // fails as a whole rather than reporting 500 individual rejections.
      const failed = await this.failJob(
        job.id,
        `No merchant profile for integration ${integration.id}`,
      );
      await this.recordFinish(failed, context, integration.id);
      return {
        jobId: failed.id,
        jobStatus: failed.jobStatus,
        productCount: 0,
        failedCount: dto.items.length,
        replayed: false,
      };
    }

    let applied = 0;
    let failedCount = 0;

    for (const item of dto.items) {
      try {
        await this.applyItem(integration, merchantId, item, context);
        applied += 1;
      } catch (error) {
        failedCount += 1;
        await this.recordItemFailure(integration.id, job.id, item, error);
      }
    }

    const finished = await this.closeJob(job.id, applied, failedCount);
    await this.recordFinish(finished, context, integration.id);

    return {
      jobId: finished.id,
      jobStatus: finished.jobStatus,
      productCount: applied,
      failedCount,
      replayed: false,
    };
  }

  /**
   * A merchant's own sync history for one integration, newest first.
   *
   * Ownership is verified by the caller before this runs — this method takes an
   * integration id that has already been checked, and deliberately does not
   * re-derive scoping from it.
   */
  public async listJobs(integrationId: string): Promise<CatalogSyncJob[]> {
    return await this.prisma.catalogSyncJob.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Resolve the `MerchantProfile.id` products must be created under.
   *
   * `MerchantIntegration.merchantId` holds a **User id**, not a merchant id —
   * `MerchantScoped` sets it from `user.id` and the column has no foreign key
   * to say otherwise. `Product.merchantId` is an FK to `MerchantProfile.id`.
   * Writing one into the other would violate that FK on every ingested
   * product, so the two are bridged here through `MerchantProfile.userId`,
   * which is unique.
   *
   * Correcting the decorator and backfilling the column is the real fix and is
   * recorded as a follow-up; doing it here would change fourteen existing
   * endpoints and migrate a deployed table.
   */
  private async resolveMerchantProfileId(integrationMerchantId: string): Promise<string | null> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: integrationMerchantId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  private async findReplayedJob(
    integrationId: string,
    idempotencyKey: string,
  ): Promise<CatalogSyncJob | null> {
    return await this.prisma.catalogSyncJob.findUnique({
      where: { integrationId_idempotencyKey: { integrationId, idempotencyKey } },
    });
  }

  private async openJob(integrationId: string, idempotencyKey: string): Promise<CatalogSyncJob> {
    try {
      return await this.prisma.catalogSyncJob.create({
        data: {
          integrationId,
          idempotencyKey,
          jobStatus: CATALOG_SYNC_JOB_STATUS.IN_PROGRESS,
          syncDirection: SYNC_DIRECTION.POS_TO_DRIPPLEX,
          startedAt: new Date(),
        },
      });
    } catch (error) {
      // Two identical batches racing each other. The unique index is the
      // authority, not the read above it, so the loser returns the winner's
      // job rather than starting a second run of the same work.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findReplayedJob(integrationId, idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private async closeJob(
    jobId: string,
    applied: number,
    failedCount: number,
  ): Promise<CatalogSyncJob> {
    const jobStatus =
      failedCount === 0
        ? CATALOG_SYNC_JOB_STATUS.COMPLETED
        : applied === 0
          ? CATALOG_SYNC_JOB_STATUS.FAILED
          : CATALOG_SYNC_JOB_STATUS.PARTIAL;

    return await this.prisma.catalogSyncJob.update({
      where: { id: jobId },
      data: {
        jobStatus,
        completedAt: new Date(),
        // Items successfully applied, not items received. A merchant reading
        // this number needs to know what actually landed.
        productCount: applied,
        ...(failedCount > 0
          ? { failureReason: `${String(failedCount)} item(s) rejected; see integration logs` }
          : {}),
      },
    });
  }

  private async failJob(jobId: string, reason: string): Promise<CatalogSyncJob> {
    return await this.prisma.catalogSyncJob.update({
      where: { id: jobId },
      data: {
        jobStatus: CATALOG_SYNC_JOB_STATUS.FAILED,
        completedAt: new Date(),
        failureReason: reason.slice(0, 500),
      },
    });
  }

  private async recordFinish(
    job: CatalogSyncJob,
    context: AuditContext,
    integrationId: string,
  ): Promise<void> {
    await this.auditService.record(CATALOGUE_SYNC_AUDIT_ACTIONS.JOB_FINISHED, context, {
      resource: 'catalog_sync_job',
      resourceId: job.id,
      metadata: {
        integrationId,
        jobStatus: job.jobStatus,
        productCount: job.productCount,
      },
    });
  }

  /**
   * Record one rejected item.
   *
   * `CatalogSyncJob.failureReason` is a single VarChar(500) for the whole job,
   * so it cannot say which SKU failed. `IntegrationLog` can, and its
   * `correlationId` (VarChar(64)) holds a job UUID, which makes every failure
   * in a run retrievable together. Decision #8.
   */
  private async recordItemFailure(
    integrationId: string,
    jobId: string,
    item: IngestCatalogueItemDto,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    const conflictType = error instanceof ItemRejected ? error.conflictType : 'INGESTION_ERROR';

    if (!(error instanceof ItemRejected)) {
      // An expected rejection is data; anything else is a defect worth seeing
      // in the service logs as well as the merchant-visible record.
      this.logger.error(
        `Catalogue item ${item.externalSku} failed on job ${jobId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.prisma.integrationLog.create({
      data: {
        integrationId,
        endpoint: '/api/v1/integrations/catalogue/sync',
        method: 'POST',
        errorMessage: `[${conflictType}] ${item.externalSku}: ${message}`,
        correlationId: jobId,
      },
    });
  }

  private async raiseConflict(
    integrationId: string,
    conflictType: string,
    item: IngestCatalogueItemDto,
    dripplexValue: string | null,
    externalValue: string | null,
    sourceId?: string,
  ): Promise<void> {
    await this.prisma.integrationConflict.create({
      data: {
        integrationId,
        conflictType,
        externalId: item.externalSku,
        ...(sourceId ? { sourceId } : {}),
        ...(dripplexValue !== null ? { dripplexValue } : {}),
        ...(externalValue !== null ? { externalValue } : {}),
      },
    });
  }

  /** Apply one item. Throws {@link ItemRejected} to skip it without failing the batch. */
  private async applyItem(
    integration: MerchantIntegration,
    merchantId: string,
    item: IngestCatalogueItemDto,
    context: AuditContext,
  ): Promise<void> {
    const currency = (item.currency ?? SUPPORTED_CURRENCY).toUpperCase();
    if (currency !== SUPPORTED_CURRENCY) {
      // Never converted. DrippleX has no FX source, so a converted price is a
      // mispriced sale rather than a helpful normalisation.
      await this.raiseConflict(
        integration.id,
        CONFLICT_TYPE.CURRENCY_UNSUPPORTED,
        item,
        SUPPORTED_CURRENCY,
        currency,
      );
      throw new ItemRejected(
        CONFLICT_TYPE.CURRENCY_UNSUPPORTED,
        `Unsupported currency ${currency}`,
        currency,
      );
    }

    const category = await this.categoryMapping.resolve(integration.id, item.categoryName);
    if (category.conflictType) {
      await this.raiseConflict(
        integration.id,
        category.conflictType,
        item,
        null,
        item.categoryName ?? null,
      );
    }

    const externalSku = item.externalSku.trim();
    const mapping = await this.prisma.productSync.upsert({
      where: { integrationId_externalSku: { integrationId: integration.id, externalSku } },
      // Created before the product exists on purpose. If the process dies
      // between the two writes, the next run finds a mapping whose productId
      // does not resolve and remaps it — the contract's stated behaviour —
      // rather than creating a second product for the same SKU.
      create: {
        integrationId: integration.id,
        externalSku,
        mappingStatus: MAPPING_STATUS.ACTIVE,
        ...(item.externalCatalogId ? { externalCatalogId: item.externalCatalogId } : {}),
      },
      update: {
        ...(item.externalCatalogId ? { externalCatalogId: item.externalCatalogId } : {}),
      },
    });

    const existing = mapping.productId
      ? await this.prisma.product.findFirst({
          where: { id: mapping.productId, merchantId, isDeleted: false },
          include: { inventory: true },
        })
      : null;

    const productId = existing
      ? await this.updateExisting(integration, existing, item, category.categoryId, mapping)
      : await this.createNew(integration, merchantId, item, category.categoryId, context);

    await this.applyInventory(integration, mapping.id, productId, item);

    await this.prisma.productSync.update({
      where: { id: mapping.id },
      data: {
        productId,
        lastSyncedAt: new Date(),
        mappingStatus: MAPPING_STATUS.ACTIVE,
      },
    });

    await this.prisma.merchantIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  private async createNew(
    integration: MerchantIntegration,
    merchantId: string,
    item: IngestCatalogueItemDto,
    categoryId: string | null,
    context: AuditContext,
  ): Promise<string> {
    // Goes through the shared merchant write path so slug generation, category
    // and brand validation, the audit record and — the one that silently rots
    // otherwise — search indexing all behave identically to a merchant-created
    // product. Decision #2.
    const created = await this.merchantProducts.createProductForMerchant(
      merchantId,
      {
        name: item.name.trim(),
        basePrice: item.price,
        currency: SUPPORTED_CURRENCY,
        ...(item.description ? { description: item.description } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      context,
      {
        // A till counts units, so an ingested product is unit-tracked — unlike
        // the merchant endpoint's default.
        trackInventory: true,
        // A merchant connecting a POS for the first time must not publish
        // their entire catalogue to customers unreviewed. Decision #7:
        // autoPublish is per-integration and off unless explicitly enabled.
        status: this.autoPublishEnabled(integration)
          ? ProductStatus.PUBLISHED
          : ProductStatus.DRAFT,
      },
    );
    return created.id;
  }

  /**
   * Update a mapped product, holding any field the merchant has since edited.
   *
   * Decision #4 is raise-and-hold: a diverged field keeps its DrippleX value
   * and the conflict is left OPEN for the merchant to settle. Fields that have
   * not diverged still sync, so one held price does not freeze the product.
   */
  private async updateExisting(
    integration: MerchantIntegration,
    existing: { id: string; name: string; basePrice: Prisma.Decimal; updatedAt: Date },
    item: IngestCatalogueItemDto,
    categoryId: string | null,
    mapping: { lastSyncedAt: Date | null },
  ): Promise<string> {
    const merchantEdited =
      mapping.lastSyncedAt !== null && existing.updatedAt > mapping.lastSyncedAt;

    const externalPrice = new Prisma.Decimal(item.price);
    const priceDiverged = !existing.basePrice.equals(externalPrice);
    const nameDiverged = existing.name !== item.name.trim();

    const data: Prisma.ProductUpdateInput = {};

    if (priceDiverged) {
      if (merchantEdited) {
        await this.raiseConflict(
          integration.id,
          CONFLICT_TYPE.CATALOG_PRICE_DIFF,
          item,
          existing.basePrice.toString(),
          externalPrice.toString(),
          existing.id,
        );
      } else {
        data.basePrice = externalPrice;
      }
    }

    if (nameDiverged) {
      if (merchantEdited) {
        await this.raiseConflict(
          integration.id,
          CONFLICT_TYPE.CATALOG_NAME_DIFF,
          item,
          existing.name,
          item.name.trim(),
          existing.id,
        );
      } else {
        data.name = item.name.trim();
      }
    }

    if (item.description !== undefined) {
      data.description = item.description.trim();
    }
    if (categoryId) {
      data.category = { connect: { id: categoryId } };
    }

    if (item.active === false) {
      // Archived, never deleted: OrderItem references Product, so a hard delete
      // would destroy the record of what customers already bought.
      data.status = ProductStatus.ARCHIVED;
      await this.raiseConflict(
        integration.id,
        CONFLICT_TYPE.PRODUCT_ARCHIVED,
        item,
        null,
        'inactive at source',
        existing.id,
      );
    } else if (item.active === true) {
      data.status = this.autoPublishEnabled(integration)
        ? ProductStatus.PUBLISHED
        : ProductStatus.DRAFT;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.product.update({ where: { id: existing.id }, data });
    }

    return existing.id;
  }

  /**
   * Apply an absolute external quantity.
   *
   * The rule that matters more than the rest: this writes `quantity` and
   * nothing else. `reserved` is DrippleX-owned — it is carts and in-flight
   * orders — and a POS knows nothing about it. Clobbering it would release
   * stock already promised to a customer mid-checkout.
   */
  private async applyInventory(
    integration: MerchantIntegration,
    productSyncId: string,
    productId: string,
    item: IngestCatalogueItemDto,
  ): Promise<void> {
    if (item.quantity === undefined) {
      return;
    }

    const quantity = Math.max(0, item.quantity);
    if (item.quantity < 0) {
      await this.raiseConflict(
        integration.id,
        CONFLICT_TYPE.NEGATIVE_QUANTITY,
        item,
        null,
        String(item.quantity),
        productId,
      );
    }

    const inventory = await this.prisma.productInventory.upsert({
      where: { productId },
      create: { productId, quantity, trackInventory: true },
      // `reserved` is deliberately absent from this update.
      update: { quantity, trackInventory: true },
    });

    const update = await this.prisma.inventoryUpdate.create({
      data: {
        integrationId: integration.id,
        productSyncId,
        externalSku: item.externalSku.trim(),
        previousQuantity: inventory.quantity,
        newQuantity: quantity,
        // Push-only in Phase 1, so an inbound row arrived by webhook.
        sourceType: INVENTORY_SOURCE_TYPE.WEBHOOK,
        // deliveryStatus and attemptCount describe delivery of an OUTBOUND
        // update to a POS. An inbound row has nothing to deliver — it is
        // already applied — so it is DELIVERED with zero attempts rather than
        // sitting at PENDING for a delivery that will never happen.
        deliveryStatus: INVENTORY_DELIVERY_STATUS.DELIVERED,
        attemptCount: 0,
        idempotencyKey: `${productSyncId}:${String(Date.now())}`,
      },
    });

    await this.prisma.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        // StockMovementType has no SYNC member. ADJUSTMENT is the honest
        // existing fit; referenceType is what makes it identifiable as a POS
        // adjustment rather than a merchant one.
        type: StockMovementType.ADJUSTMENT,
        quantity,
        balanceAfter: quantity,
        reason: 'POS catalogue sync',
        referenceType: 'INTEGRATION',
        referenceId: update.id,
        // No user did this. Leaving actorUserId null is the accurate record.
        actorUserId: null,
      },
    });
  }

  /**
   * Whether this integration publishes ingested products immediately.
   *
   * Stored in `MerchantIntegration.metadata`, a Json column that already
   * exists, rather than adding a third schema change for one boolean.
   * Absent, malformed or non-boolean all mean off — the safe reading, since
   * the cost of being wrong is a merchant's unreviewed catalogue going live.
   */
  private autoPublishEnabled(integration: MerchantIntegration): boolean {
    const metadata = integration.metadata;
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    // Narrowed above to a plain JSON object, so this indexes directly.
    return metadata['autoPublish'] === true;
  }
}
