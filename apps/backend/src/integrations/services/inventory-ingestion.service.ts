import { createHash } from 'node:crypto';

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CONFLICT_TYPE,
  INVENTORY_DELIVERY_STATUS,
  INVENTORY_REJECTION,
  INVENTORY_SOURCE_TYPE,
  INVENTORY_SYNC_AUDIT_ACTIONS,
  MAPPING_STATUS,
} from '../catalogue-ingestion.constants';

import { MerchantProfileResolver } from './merchant-profile-resolver.service';

import type { UpdateInventoryItemDto } from '../dtos/update-inventory.dto';
import type { MerchantIntegration } from '@prisma/client';

/** One absolute stock write, already resolved to a DrippleX product. */
export interface AbsoluteQuantityWrite {
  integrationId: string;
  productSyncId: string;
  productId: string;
  /** The `MerchantProfile.id` the product must belong to. Enforced under the row lock. */
  merchantProfileId: string;
  externalSku: string;
  /** As the POS sent it. Negative values are clamped, and the caller is told. */
  requestedQuantity: number;
  /**
   * Unique per integration. This is the idempotency guarantee — the unique
   * index on `(integrationId, idempotencyKey)` is what actually prevents a
   * double apply, not any read that precedes it.
   */
  idempotencyKey: string;
}

export interface AppliedQuantity {
  inventoryUpdateId: string;
  previousQuantity: number;
  newQuantity: number;
  /** True when this key had already been applied; nothing was written. */
  replayed: boolean;
  /** True when the POS sent a negative quantity and it was clamped to zero. */
  clamped: boolean;
}

/** Raised for a stock write that cannot land. Fails the item, never the batch. */
export class InventoryItemRejected extends Error {
  constructor(
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryItemRejected';
  }
}

export interface InventorySyncItemResult {
  externalSku: string;
  status: 'APPLIED' | 'REPLAYED' | 'REJECTED';
  previousQuantity?: number;
  newQuantity?: number;
  reason?: string;
}

export interface InventorySyncSummary {
  appliedCount: number;
  replayedCount: number;
  rejectedCount: number;
  items: InventorySyncItemResult[];
}

export interface InventoryLevel {
  externalSku: string;
  productId: string | null;
  mappingStatus: string;
  lastSyncedAt: Date | null;
  quantity: number | null;
  reserved: number | null;
  /** What a customer can actually buy: quantity less what carts and orders hold. */
  available: number | null;
  trackInventory: boolean | null;
}

/**
 * The one place an external system's stock count is written into DrippleX.
 *
 * Both the catalogue push (a full item, quantity included) and the
 * inventory-only push land here, because two writers would be two chances to
 * disagree about the rule that matters more than the rest:
 *
 * > An external quantity sets `quantity` only. It must never write `reserved`.
 *
 * `reserved` is DrippleX-owned — it is carts and in-flight orders. A POS knows
 * nothing about it, and clobbering it would release stock already promised to
 * a customer mid-checkout.
 *
 * Implements §6 of the Phase 1 Catalogue Ingestion Contract
 * (docs/DPX-MKT-INT-001-P1-CATALOGUE-CONTRACT.md) and the inventory increment
 * recorded in docs/DPX-MKT-INT-001-P1-INVENTORY-CONTRACT.md.
 */
@Injectable()
export class InventoryIngestionService {
  private readonly logger = new Logger(InventoryIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantProfiles: MerchantProfileResolver,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Apply one pushed batch of stock levels.
   *
   * Every item is independent: an unmapped SKU is recorded and skipped rather
   * than rejecting a merchant's whole push, exactly as catalogue ingestion
   * treats a malformed row (decision #9 of the catalogue contract).
   */
  public async applyBatch(
    integration: MerchantIntegration,
    items: UpdateInventoryItemDto[],
    batchKey: string,
    context: AuditContext,
  ): Promise<InventorySyncSummary> {
    const merchantProfileId = await this.merchantProfiles.resolve(integration.merchantId);
    if (!merchantProfileId) {
      // A DrippleX-side defect, not a bad payload: this integration is linked
      // to a user who has no merchant profile, so nothing in the batch can be
      // written. Answered as a server error rather than as a batch of rejected
      // items, because the POS did nothing wrong and should retry once the
      // link is repaired — which its idempotency key makes safe.
      this.logger.error(
        `Integration ${integration.id} has no merchant profile for user ${integration.merchantId}`,
      );
      throw new InternalServerErrorException('Integration is not linked to a merchant profile');
    }

    // Sorted so two concurrent batches touching the same SKUs take their row
    // locks in the same order. Without this, a batch holding SKU-1 and waiting
    // on SKU-2 while another holds SKU-2 and waits on SKU-1 is a deadlock, and
    // Postgres resolves it by killing one of them mid-run.
    const ordered = [...items].sort((a, b) => a.externalSku.localeCompare(b.externalSku));

    const results: InventorySyncItemResult[] = [];
    const seen = new Set<string>();

    for (const item of ordered) {
      const externalSku = item.externalSku.trim();

      if (seen.has(externalSku)) {
        // Two rows for one SKU in one batch: the second derives the same
        // idempotency key as the first and would read as a replay, silently
        // discarding whichever quantity the POS actually meant. Say so instead.
        results.push({
          externalSku,
          status: 'REJECTED',
          reason: INVENTORY_REJECTION.DUPLICATE_IN_BATCH,
        });
        continue;
      }
      seen.add(externalSku);

      try {
        const mapping = await this.resolveMapping(integration.id, externalSku);
        const applied = await this.applyAbsoluteQuantity({
          integrationId: integration.id,
          productSyncId: mapping.id,
          productId: mapping.productId,
          merchantProfileId,
          externalSku,
          requestedQuantity: item.quantity,
          idempotencyKey: deriveItemKey(batchKey, externalSku),
        });

        // Not raised on a replay: the conflict was already recorded the first
        // time this key landed, and a retrying POS must not multiply it.
        if (applied.clamped && !applied.replayed) {
          await this.raiseNegativeQuantity(
            integration.id,
            externalSku,
            item.quantity,
            mapping.productId,
          );
        }

        results.push({
          externalSku,
          status: applied.replayed ? 'REPLAYED' : 'APPLIED',
          previousQuantity: applied.previousQuantity,
          newQuantity: applied.newQuantity,
        });
      } catch (error) {
        const reason =
          error instanceof InventoryItemRejected ? error.reason : 'INVENTORY_WRITE_ERROR';
        results.push({ externalSku, status: 'REJECTED', reason });
        await this.recordItemFailure(integration.id, batchKey, externalSku, reason, error);
      }
    }

    const summary: InventorySyncSummary = {
      appliedCount: results.filter((r) => r.status === 'APPLIED').length,
      replayedCount: results.filter((r) => r.status === 'REPLAYED').length,
      rejectedCount: results.filter((r) => r.status === 'REJECTED').length,
      items: results,
    };

    await this.auditService.record(INVENTORY_SYNC_AUDIT_ACTIONS.BATCH_APPLIED, context, {
      resource: 'merchant_integration',
      resourceId: integration.id,
      metadata: {
        integrationId: integration.id,
        itemCount: items.length,
        appliedCount: summary.appliedCount,
        replayedCount: summary.replayedCount,
        rejectedCount: summary.rejectedCount,
      },
    });

    await this.prisma.merchantIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date() },
    });

    return summary;
  }

  /**
   * Write one absolute quantity, atomically, once.
   *
   * Ordering inside the transaction is deliberate. The row lock comes first so
   * `previousQuantity` is a value nobody else can change underneath us; the
   * `InventoryUpdate` insert comes next so a replayed key aborts the
   * transaction **before** any stock has moved; the quantity write and the
   * `StockMovement` follow. Roll back at any point and the product's stock, its
   * movement log and the idempotency record are still consistent with each
   * other — there is no state where the log claims a change the quantity does
   * not show.
   */
  public async applyAbsoluteQuantity(write: AbsoluteQuantityWrite): Promise<AppliedQuantity> {
    const newQuantity = Math.max(0, write.requestedQuantity);
    const clamped = write.requestedQuantity < 0;

    await this.ensureInventoryRow(write.productId, write.merchantProfileId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await this.lockOwnedInventory(tx, write.productId, write.merchantProfileId);
        const previousQuantity = locked.quantity;

        const update = await tx.inventoryUpdate.create({
          data: {
            integrationId: write.integrationId,
            productSyncId: write.productSyncId,
            externalSku: write.externalSku,
            previousQuantity,
            newQuantity,
            // Push-only in Phase 1, so an inbound row arrived by webhook.
            sourceType: INVENTORY_SOURCE_TYPE.WEBHOOK,
            // deliveryStatus and attemptCount describe delivery of an OUTBOUND
            // update to a POS. An inbound row has nothing to deliver — it is
            // already applied — so it is DELIVERED with zero attempts rather
            // than sitting at PENDING for a delivery that will never happen.
            // Decision #9 of the catalogue contract, amendment 1.
            deliveryStatus: INVENTORY_DELIVERY_STATUS.DELIVERED,
            attemptCount: 0,
            idempotencyKey: write.idempotencyKey,
          },
        });

        await tx.productInventory.update({
          where: { id: locked.id },
          // `reserved` is deliberately absent. See the class comment.
          data: { quantity: newQuantity, trackInventory: true },
        });

        await tx.stockMovement.create({
          data: {
            inventoryId: locked.id,
            // StockMovementType has no SYNC member. ADJUSTMENT is the honest
            // existing fit; referenceType is what makes it identifiable as a
            // POS adjustment rather than a merchant one.
            type: StockMovementType.ADJUSTMENT,
            // The **absolute resulting quantity**, not the delta. Founder
            // ruling, 2026-09-12: a movement row is a snapshot, so a reader
            // sees what the stock became without needing the row before it. A
            // delta is derivable from two consecutive snapshots
            // (`newQuantity - previousQuantity`); a snapshot is not derivable
            // from deltas once one row is missing. Pinned by
            // `a movement records the resulting quantity, not the delta`.
            quantity: newQuantity,
            balanceAfter: newQuantity,
            reason: 'POS inventory sync',
            referenceType: 'INTEGRATION',
            referenceId: update.id,
            // No user did this. Leaving actorUserId null is the accurate record.
            actorUserId: null,
          },
        });

        return {
          inventoryUpdateId: update.id,
          previousQuantity,
          newQuantity,
          replayed: false,
          clamped,
        };
      });
    } catch (error) {
      // A duplicate key rolled the whole transaction back, so nothing was
      // applied. The unique index is the authority; the winner's row is the
      // answer. Recovery has to run out here — in Postgres a unique violation
      // aborts the enclosing transaction, so it cannot be caught inside one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.inventoryUpdate.findUnique({
          where: {
            integrationId_idempotencyKey: {
              integrationId: write.integrationId,
              idempotencyKey: write.idempotencyKey,
            },
          },
        });
        if (existing) {
          return {
            inventoryUpdateId: existing.id,
            previousQuantity: existing.previousQuantity,
            newQuantity: existing.newQuantity,
            replayed: true,
            clamped,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Current stock for one integration's mapped SKUs.
   *
   * Ownership is verified by the caller before this runs — this method takes an
   * integration id that has already been checked, and deliberately does not
   * re-derive scoping from it.
   */
  public async listLevels(integrationId: string): Promise<InventoryLevel[]> {
    const mappings = await this.prisma.productSync.findMany({
      where: { integrationId },
      orderBy: { externalSku: 'asc' },
      take: 500,
    });

    const productIds = mappings
      .map((mapping) => mapping.productId)
      .filter((id): id is string => typeof id === 'string');

    const inventories =
      productIds.length > 0
        ? await this.prisma.productInventory.findMany({
            where: { productId: { in: productIds } },
          })
        : [];
    const byProduct = new Map(inventories.map((row) => [row.productId, row]));

    return mappings.map((mapping) => {
      const inventory = mapping.productId ? byProduct.get(mapping.productId) : undefined;
      return {
        externalSku: mapping.externalSku,
        productId: mapping.productId,
        mappingStatus: mapping.mappingStatus,
        lastSyncedAt: mapping.lastSyncedAt,
        quantity: inventory?.quantity ?? null,
        reserved: inventory?.reserved ?? null,
        // Clamped at zero: `reserved` can exceed `quantity` after a POS
        // correction, and a negative "available" would read as a debt rather
        // than as nothing left to sell.
        available: inventory ? Math.max(0, inventory.quantity - inventory.reserved) : null,
        trackInventory: inventory?.trackInventory ?? null,
      };
    });
  }

  /**
   * Find the mapping a stock push refers to.
   *
   * An inventory push never creates a product. A SKU the merchant has not
   * catalogued has no price, no name and no category, so conjuring one from a
   * stock count would put an unsellable row in a live catalogue.
   */
  private async resolveMapping(
    integrationId: string,
    externalSku: string,
  ): Promise<{ id: string; productId: string }> {
    const mapping = await this.prisma.productSync.findUnique({
      where: { integrationId_externalSku: { integrationId, externalSku } },
    });

    if (!mapping) {
      throw new InventoryItemRejected(
        INVENTORY_REJECTION.SKU_NOT_MAPPED,
        `No product mapping for SKU ${externalSku}`,
      );
    }
    if (mapping.mappingStatus !== MAPPING_STATUS.ACTIVE) {
      throw new InventoryItemRejected(
        INVENTORY_REJECTION.MAPPING_INACTIVE,
        `Mapping for SKU ${externalSku} is ${mapping.mappingStatus}`,
      );
    }
    if (!mapping.productId) {
      // A catalogue batch that died between creating the mapping and creating
      // the product leaves exactly this. It is reported rather than papered
      // over, because the fix is to re-push the catalogue, not the stock.
      throw new InventoryItemRejected(
        INVENTORY_REJECTION.SKU_NOT_LINKED,
        `Mapping for SKU ${externalSku} has no product yet`,
      );
    }

    return { id: mapping.id, productId: mapping.productId };
  }

  /**
   * Create the inventory row if the product has none.
   *
   * Done before the transaction, not inside it: losing a race on
   * `product_inventory.product_id` would abort the enclosing transaction and
   * take the stock write down with it. A row created here starts at zero, which
   * is what a product with no inventory row already reads as, so an
   * interruption between this and the write loses nothing.
   */
  private async ensureInventoryRow(productId: string, merchantProfileId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId: merchantProfileId, isDeleted: false },
      select: { id: true, inventory: { select: { id: true } } },
    });

    if (!product) {
      throw new InventoryItemRejected(
        INVENTORY_REJECTION.PRODUCT_UNAVAILABLE,
        `Product ${productId} is not an available product of this merchant`,
      );
    }
    if (product.inventory) {
      return;
    }

    try {
      await this.prisma.productInventory.create({
        data: { productId, quantity: 0, trackInventory: true },
      });
    } catch (error) {
      // Someone else created it first. The unique index is the authority, not
      // the read above it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  /**
   * Lock the product's inventory row, and prove the product is this merchant's
   * in the same statement.
   *
   * The ownership predicate lives inside the locking query on purpose. Checked
   * separately it would be a check on a value another transaction is free to
   * change before the write lands; checked here, a row that comes back is a row
   * this merchant owns and nobody else can move until we commit.
   */
  private async lockOwnedInventory(
    tx: Prisma.TransactionClient,
    productId: string,
    merchantProfileId: string,
  ): Promise<{ id: string; quantity: number }> {
    const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
      SELECT pi.id, pi.quantity
      FROM product_inventory pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.product_id = ${productId}::uuid
        AND p.merchant_id = ${merchantProfileId}::uuid
        AND p.is_deleted = false
      FOR UPDATE OF pi
    `;

    const row = rows[0];
    if (!row) {
      throw new InventoryItemRejected(
        INVENTORY_REJECTION.PRODUCT_UNAVAILABLE,
        `Product ${productId} is not an available product of this merchant`,
      );
    }
    return row;
  }

  private async raiseNegativeQuantity(
    integrationId: string,
    externalSku: string,
    requested: number,
    productId: string,
  ): Promise<void> {
    await this.prisma.integrationConflict.create({
      data: {
        integrationId,
        conflictType: CONFLICT_TYPE.NEGATIVE_QUANTITY,
        externalId: externalSku,
        sourceId: productId,
        externalValue: String(requested),
      },
    });
  }

  /**
   * Record one rejected item.
   *
   * `IntegrationLog.correlationId` carries the batch key, so every rejection in
   * one push is retrievable together — the same correlation trick catalogue
   * ingestion uses with a job id (decision #8).
   */
  private async recordItemFailure(
    integrationId: string,
    batchKey: string,
    externalSku: string,
    reason: string,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown inventory error';

    if (!(error instanceof InventoryItemRejected)) {
      // An expected rejection is data; anything else is a defect worth seeing
      // in the service logs as well as the merchant-visible record.
      this.logger.error(
        `Inventory item ${externalSku} failed on batch ${batchKey}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.prisma.integrationLog.create({
      data: {
        integrationId,
        endpoint: '/api/v1/integrations/inventory',
        method: 'PUT',
        errorMessage: `[${reason}] ${externalSku}: ${message}`,
        // VarChar(64), and a batch key may be longer.
        correlationId: batchKey.slice(0, 64),
      },
    });
  }
}

/**
 * The idempotency key one item is stored under.
 *
 * `InventoryUpdate.idempotencyKey` is unique per **row**, but a POS sends one
 * key per batch, so each row needs its own derived from it. Hashed rather than
 * concatenated because the column is VarChar(100): `batchKey:sku` overflows for
 * a long SKU, and truncating it would make two SKUs sharing a long prefix
 * collide — one of them would silently read as a replay of the other.
 *
 * The batch key's length is folded in so that no two (batchKey, sku) pairs can
 * produce the same input string by moving the separator.
 *
 * Deterministic, so re-sending the same batch key genuinely replays.
 */
export function deriveItemKey(batchKey: string, externalSku: string): string {
  const material = `${String(batchKey.length)}:${batchKey}:${externalSku}`;
  return `inv:${createHash('sha256').update(material).digest('hex')}`;
}
