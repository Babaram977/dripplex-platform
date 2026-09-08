import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CONFLICT_TYPE } from '../catalogue-ingestion.constants';

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
}
