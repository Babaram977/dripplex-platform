import { Injectable } from '@nestjs/common';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFLICT_TYPE } from '../catalogue-ingestion.constants';

import type { CategoryMapping } from '@prisma/client';

/**
 * How an external category name resolved.
 *
 * `categoryId` null with a `conflictType` is the normal, non-fatal outcome:
 * the product still ingests, uncategorised, and the conflict tells the
 * merchant what to map.
 */
export interface CategoryResolution {
  categoryId: string | null;
  conflictType: (typeof CONFLICT_TYPE)[keyof typeof CONFLICT_TYPE] | null;
}

const RESOLVED = (categoryId: string): CategoryResolution => ({ categoryId, conflictType: null });

/**
 * Resolves the category names an external POS sends to DrippleX categories.
 *
 * The hard rule this service exists to enforce: **a POS must never create a
 * DrippleX Category.** `Category.slug` is unique across the entire platform,
 * with no `merchantId` — it is a shared taxonomy. If ingestion created
 * categories on demand, the first merchant whose POS happened to say "Drinks"
 * would own that slug for every other merchant on DrippleX.
 *
 * So the mapping is explicit data (`CategoryMapping`, decision #6) that an
 * operator maintains, and an unmapped name is reported rather than guessed.
 */
@Injectable()
export class CategoryMappingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve one external category name for one integration.
   *
   * Never throws for an unmapped or inactive category: a taxonomy gap must not
   * look like a catalogue outage, so the product ingests either way.
   */
  public async resolve(
    integrationId: string,
    externalCategoryName: string | undefined,
  ): Promise<CategoryResolution> {
    const name = externalCategoryName?.trim();
    if (!name) {
      // The POS sent no category at all. That is not a conflict — plenty of
      // tills are flat — so it ingests uncategorised and silently.
      return { categoryId: null, conflictType: null };
    }

    const mapping = await this.prisma.categoryMapping.findUnique({
      where: {
        integrationId_externalCategoryName: { integrationId, externalCategoryName: name },
      },
      include: { category: { select: { id: true, isActive: true } } },
    });

    if (!mapping) {
      return { categoryId: null, conflictType: CONFLICT_TYPE.CATEGORY_UNMAPPED };
    }

    if (!mapping.category.isActive) {
      // Still categorise it — the mapping is a deliberate operator decision and
      // the category may be reactivated — but say so, because an inactive
      // category will not surface the product where the merchant expects.
      return {
        categoryId: mapping.category.id,
        conflictType: CONFLICT_TYPE.CATEGORY_INACTIVE,
      };
    }

    return RESOLVED(mapping.category.id);
  }

  /**
   * A merchant's mappings for one integration, with the DrippleX category
   * resolved so a console can render the pair without a second round trip.
   *
   * Ownership is the caller's job: every route reaching this has already run
   * `verifyMerchantAccess`, so an integration id alone is a sufficient scope
   * here and cannot be used to read another merchant's mappings.
   */
  public async list(integrationId: string): Promise<
    {
      externalCategoryName: string;
      categoryId: string;
      categoryName: string;
      categoryIsActive: boolean;
      updatedAt: Date;
    }[]
  > {
    const rows = await this.prisma.categoryMapping.findMany({
      where: { integrationId },
      include: { category: { select: { id: true, name: true, isActive: true } } },
      orderBy: { externalCategoryName: 'asc' },
    });

    return rows.map((row) => ({
      externalCategoryName: row.externalCategoryName,
      categoryId: row.category.id,
      categoryName: row.category.name,
      categoryIsActive: row.category.isActive,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Point one external category name at a DrippleX category.
   *
   * The category must already exist. That is the whole point of the model: a
   * POS may never create a DrippleX category, and neither may this endpoint on
   * its behalf — `Category.slug` is globally unique with no `merchantId`, so
   * one merchant naming a category would claim that slug platform-wide.
   *
   * An inactive category is accepted deliberately rather than refused. A
   * merchant mapping ahead of a category being switched back on is legitimate,
   * and `resolve()` already reports that case as `CATEGORY_INACTIVE` at
   * ingestion time, which is where the merchant can act on it.
   */
  public async upsert(
    integrationId: string,
    externalCategoryName: string,
    categoryId: string,
  ): Promise<CategoryMapping> {
    const name = externalCategoryName.trim();
    if (name === '') {
      throw new NotFoundDomainException('External category name is required');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundDomainException('Category not found');
    }

    return await this.prisma.categoryMapping.upsert({
      where: {
        integrationId_externalCategoryName: { integrationId, externalCategoryName: name },
      },
      create: { integrationId, externalCategoryName: name, categoryId },
      update: { categoryId },
    });
  }

  /**
   * Remove a mapping. Products already categorised by it keep their category —
   * this stops future syncs resolving that name, it does not retroactively
   * uncategorise a catalogue.
   */
  public async remove(integrationId: string, externalCategoryName: string): Promise<void> {
    const name = externalCategoryName.trim();
    const existing = await this.prisma.categoryMapping.findUnique({
      where: {
        integrationId_externalCategoryName: { integrationId, externalCategoryName: name },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundDomainException('Category mapping not found');
    }

    await this.prisma.categoryMapping.delete({ where: { id: existing.id } });
  }
}
