import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * One SKU this integration brought into the merchant's catalogue.
 *
 * An allow-list, and the test pins the key set by equality — the same rule the
 * conflict reader follows. `integrationId` is absent because the caller
 * supplied it in the path, and `mappingStatus`, `externalCatalogId` and
 * `lastSyncedAt` are absent because the merchant cannot act on them.
 *
 * `id` is the **import record's** id (`ProductSync.id`), not the product's —
 * `productId` carries that separately. The two are different things and a
 * screen that confuses them would acknowledge the wrong row.
 *
 * `createdAt` / `updatedAt` are likewise the import record's: when this
 * integration first brought the SKU in, and when the mapping last changed.
 * The product's own timestamps belong to the product, which the merchant
 * already has a Products tab for.
 */
export interface ImportedProductView {
  id: string;
  externalSku: string;
  productId: string | null;
  productName: string | null;
  price: number | null;
  status: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportedProductPage {
  items: ImportedProductView[];
  total: number;
  page: number;
  pageSize: number;
}

/** One page of imported products is capped, as the conflict reader is, for the same reason. */
export const MAX_IMPORTED_PRODUCT_PAGE_SIZE = 50;

/**
 * What one POS integration actually put in the merchant's catalogue.
 *
 * The merchant's Products tab answers "what do I sell". This answers the
 * narrower operational question Merchant Connect exists for: *what did this
 * particular integration bring in, and what still needs my attention* — which
 * `GET /merchant/products?status=DRAFT` cannot answer, because it mixes
 * manually created drafts, this integration's imports and every other
 * integration's imports into one undifferentiated list.
 *
 * **Read-only.** Publishing remains `POST /merchant/products/:id/publish`;
 * nothing here mutates a product, a mapping, inventory or ingestion.
 *
 * `ProductSync` has no Prisma relation to `Product` — `productId` is a bare
 * indexed column — so the join is done here in a second, bounded query rather
 * than by `include`. One page is at most 50 rows, so it is one `IN` lookup.
 */
@Injectable()
export class ImportedProductsService {
  constructor(private readonly prisma: PrismaService) {}

  public async list(
    integrationId: string,
    options: { page?: number; pageSize?: number } = {},
  ): Promise<ImportedProductPage> {
    const take = Math.min(
      Math.max(options.pageSize ?? MAX_IMPORTED_PRODUCT_PAGE_SIZE, 1),
      MAX_IMPORTED_PRODUCT_PAGE_SIZE,
    );
    const page = Math.max(options.page ?? 1, 1);
    const where = { integrationId };

    // No `mappingStatus` filter: ingestion only ever writes ACTIVE. The schema
    // documents ARCHIVED and FAILED but nothing in the codebase produces them,
    // so filtering on it would encode a rule that has no author.
    const [rows, total] = await Promise.all([
      this.prisma.productSync.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.productSync.count({ where }),
    ]);

    const products = await this.resolveProducts(rows.map((row) => row.productId));

    return {
      items: rows.map((row) => {
        const product = row.productId === null ? undefined : products.get(row.productId);
        return {
          id: row.id,
          externalSku: row.externalSku,
          productId: row.productId,
          productName: product?.name ?? null,
          price: product === undefined ? null : Number(product.basePrice),
          status: product?.status ?? null,
          publishedAt: product?.publishedAt ?? null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
      total,
      page,
      pageSize: take,
    };
  }

  /**
   * The products behind this page of mappings, excluding soft-deleted ones.
   *
   * `isDeleted: false` matches `requireOwnedProduct`, which every merchant
   * product mutation goes through. A soft-deleted product cannot be published
   * — the publish route answers 404 — so reporting its status here would put a
   * Publish control on a row where pressing it always fails. Such a row
   * reports null product fields instead, which is what it is: a SKU this
   * integration still maps that is no longer in the live catalogue.
   *
   * `productId` itself is still reported exactly as stored. Blanking it would
   * misreport the mapping, which does point at a product.
   */
  private async resolveProducts(
    productIds: (string | null)[],
  ): Promise<
    Map<string, { name: string; basePrice: unknown; status: string; publishedAt: Date | null }>
  > {
    const ids = [...new Set(productIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) {
      return new Map();
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { id: true, name: true, basePrice: true, status: true, publishedAt: true },
    });

    return new Map(
      products.map((product) => [
        product.id,
        {
          name: product.name,
          basePrice: product.basePrice,
          status: product.status,
          publishedAt: product.publishedAt,
        },
      ]),
    );
  }
}
