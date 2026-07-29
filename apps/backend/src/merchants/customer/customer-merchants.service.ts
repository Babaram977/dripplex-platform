import { Injectable } from '@nestjs/common';
import { BusinessStatus, Prisma, ProductStatus, ReviewTargetType } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { decodeCursorOffset, encodeCursor } from '../../common/pagination/cursor.util';
import { parseSmartQuery } from '../../common/search/smart-query.util';
import { PrismaService } from '../../prisma/prisma.service';

import { toMerchantDetailDto, toMerchantSummaryDto, ZERO_RATING } from './customer-merchant.mapper';

import type { BrowseMerchantsQueryDto } from './dto/browse-merchants-query.dto';
import type { SmartSearchQueryDto } from '../../common/search/dto/smart-search-query.dto';
import type {
  CursorPaginatedResult,
  MerchantDetailDto,
  MerchantSort,
  MerchantSummaryDto,
  RatingSummaryDto,
  SmartSearchResult,
} from '@dripplex/types';
const DEFAULT_LIMIT = 20;
/** Rating/distance-ranked sorts score in application code, same trade-off as CustomerProductsService. */
const RANKED_SORT_CANDIDATE_CAP = 1000;

const BUSINESS_WHERE_BASE = {
  status: BusinessStatus.ACTIVE,
  merchant: { merchantProfile: { isApproved: true, deletedAt: null } },
} satisfies Prisma.BusinessWhereInput;

/**
 * merchantProfile is an optional 1:1 relation on User in Prisma's types even
 * though BUSINESS_WHERE_BASE already filters to businesses whose merchant has
 * an approved (non-null) profile — this narrows the TS type to match what the
 * where clause guarantees at runtime.
 */
function hasMerchantProfile<T extends { merchant: { merchantProfile: { id: string } | null } }>(
  row: T,
): row is T & { merchant: { merchantProfile: { id: string } } } {
  return row.merchant.merchantProfile !== null;
}

@Injectable()
export class CustomerMerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  public async browse(
    query: BrowseMerchantsQueryDto,
  ): Promise<CursorPaginatedResult<MerchantSummaryDto>> {
    const sort: MerchantSort = query.sort ?? 'recommended';
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = decodeCursorOffset(query.cursor, sort);
    const where = await this.buildWhere(query);
    const fromLocation =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined;

    if (sort === 'newest') {
      return await this.browseByColumn(where, offset, limit, fromLocation);
    }
    // 'nearest' without a location can't be computed — fall back to 'recommended'.
    const effectiveSort = sort === 'nearest' && !fromLocation ? 'recommended' : sort;
    return await this.browseByComputedScore(where, effectiveSort, offset, limit, fromLocation);
  }

  /**
   * "AI discovery" search — a lightweight structural parser (see
   * parseSmartQuery), not an LLM call. `nearMe` selects the 'nearest' sort
   * when a location is supplied; `openNow` is parsed but not yet enforced
   * as a filter — the merchant's isOpenNow still appears on each result for
   * the frontend to highlight or exclude client-side. See
   * customer-merchant.mapper.ts's isOpenNow doc comment for why this stays
   * an approximation until businesses carry a timezone.
   */
  public async smartSearch(
    query: SmartSearchQueryDto,
  ): Promise<SmartSearchResult<MerchantSummaryDto>> {
    const parsed = parseSmartQuery(query.query);
    const hasLocation = query.lat !== undefined && query.lng !== undefined;
    const results = await this.browse({
      ...(parsed.keywords ? { q: parsed.keywords } : {}),
      sort: parsed.nearMe && hasLocation ? 'nearest' : 'recommended',
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.lat !== undefined ? { lat: query.lat } : {}),
      ...(query.lng !== undefined ? { lng: query.lng } : {}),
    });
    return { parsed, results };
  }

  public async getMerchantDetail(
    merchantProfileId: string,
    fromLocation?: { lat: number; lng: number },
  ): Promise<MerchantDetailDto> {
    const business = await this.prisma.business.findFirst({
      where: {
        ...BUSINESS_WHERE_BASE,
        merchant: { merchantProfile: { id: merchantProfileId, isApproved: true, deletedAt: null } },
      },
      include: { merchant: { include: { merchantProfile: true } } },
    });
    if (!business?.merchant.merchantProfile) {
      throw new NotFoundDomainException('Merchant not found');
    }

    const [rating, productCount] = await Promise.all([
      this.ratingsFor([merchantProfileId]).then((map) => map.get(merchantProfileId) ?? ZERO_RATING),
      this.prisma.product.count({
        where: { merchantId: merchantProfileId, status: ProductStatus.PUBLISHED, isDeleted: false },
      }),
    ]);

    return toMerchantDetailDto(
      business,
      business.merchant.merchantProfile.id,
      rating,
      productCount,
      fromLocation,
    );
  }

  private async browseByColumn(
    where: Prisma.BusinessWhereInput,
    offset: number,
    limit: number,
    fromLocation?: { lat: number; lng: number },
  ): Promise<CursorPaginatedResult<MerchantSummaryDto>> {
    const rows = await this.prisma.business.findMany({
      where,
      include: { merchant: { include: { merchantProfile: true } } },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).filter(hasMerchantProfile);
    const ratings = await this.ratingsFor(page.map((row) => row.merchant.merchantProfile.id));

    return {
      items: page.map((row) =>
        toMerchantSummaryDto(
          row,
          row.merchant.merchantProfile.id,
          ratings.get(row.merchant.merchantProfile.id),
          fromLocation,
        ),
      ),
      nextCursor: hasMore ? encodeCursor('newest', offset + limit) : null,
      hasMore,
    };
  }

  private async browseByComputedScore(
    where: Prisma.BusinessWhereInput,
    sort: Exclude<MerchantSort, 'newest'>,
    offset: number,
    limit: number,
    fromLocation?: { lat: number; lng: number },
  ): Promise<CursorPaginatedResult<MerchantSummaryDto>> {
    const candidates = (
      await this.prisma.business.findMany({
        where,
        include: { merchant: { include: { merchantProfile: true } } },
        orderBy: { createdAt: 'desc' },
        take: RANKED_SORT_CANDIDATE_CAP,
      })
    ).filter(hasMerchantProfile);

    const ratings = await this.ratingsFor(candidates.map((row) => row.merchant.merchantProfile.id));

    const scored = candidates
      .map((business) => {
        const merchantProfileId = business.merchant.merchantProfile.id;
        const rating = ratings.get(merchantProfileId) ?? ZERO_RATING;
        const dto = toMerchantSummaryDto(business, merchantProfileId, rating, fromLocation);
        const score =
          sort === 'nearest'
            ? -(dto.distanceKm ?? Number.POSITIVE_INFINITY)
            : sort === 'rating_desc'
              ? rating.average
              : rating.average; // 'recommended' — same heuristic as rating_desc, honestly not a distinct algorithm yet.
        return { business, dto, score };
      })
      .sort((a, b) => b.score - a.score);

    const total = scored.length;
    const page = scored.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items: page.map(({ dto }) => dto),
      nextCursor: hasMore ? encodeCursor(sort, offset + limit) : null,
      hasMore,
    };
  }

  private async buildWhere(query: BrowseMerchantsQueryDto): Promise<Prisma.BusinessWhereInput> {
    const where: Prisma.BusinessWhereInput = {
      ...BUSINESS_WHERE_BASE,
      ...(query.businessType ? { businessType: query.businessType } : {}),
    };

    const term = query.q?.trim();
    if (term) {
      where.businessName = { contains: term, mode: 'insensitive' };
    }

    if (query.minRating !== undefined) {
      const qualifying = await this.prisma.reviewAggregate.findMany({
        where: { targetType: ReviewTargetType.MERCHANT, averageRating: { gte: query.minRating } },
        select: { targetId: true },
      });
      where.merchant = {
        merchantProfile: {
          isApproved: true,
          deletedAt: null,
          id: { in: qualifying.map((row) => row.targetId) },
        },
      };
    }

    return where;
  }

  private async ratingsFor(merchantProfileIds: string[]): Promise<Map<string, RatingSummaryDto>> {
    if (merchantProfileIds.length === 0) {
      return new Map();
    }
    const aggregates = await this.prisma.reviewAggregate.findMany({
      where: { targetType: ReviewTargetType.MERCHANT, targetId: { in: merchantProfileIds } },
    });
    return new Map(
      aggregates.map((aggregate) => [
        aggregate.targetId,
        { average: aggregate.averageRating, count: aggregate.reviewCount },
      ]),
    );
  }
}
