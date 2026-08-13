import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus, ReviewTargetType } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { decodeCursorOffset, encodeCursor } from '../../common/pagination/cursor.util';
import { parseSmartQuery } from '../../common/search/smart-query.util';
import { PrismaService } from '../../prisma/prisma.service';

import {
  toBrandDto,
  toCategoryDto,
  toProductDetailDto,
  toProductSummaryDto,
  ZERO_RATING,
} from './customer-product.mapper';

import type { BrowseProductsQueryDto } from './dto/browse-products-query.dto';
import type { SmartSearchQueryDto } from '../../common/search/dto/smart-search-query.dto';
import type { ProductWithRelations } from '../product.mapper';
import type {
  BrandDto,
  CatalogSort,
  CategoryDto,
  CursorPaginatedResult,
  ProductDetailDto,
  ProductMerchantSummaryDto,
  ProductSummaryDto,
  RatingSummaryDto,
  SmartSearchResult,
} from '@dripplex/types';
import type { Business } from '@prisma/client';

const PRODUCT_INCLUDE = {
  images: true,
  variants: true,
  inventory: true,
  merchant: { include: { user: { include: { businesses: { take: 1 } } } } },
} satisfies Prisma.ProductInclude;

type ProductWithMerchant = ProductWithRelations & {
  merchant: { user: { businesses: Business[] } };
};

function merchantNameOf(product: ProductWithMerchant): string {
  return product.merchant.user.businesses[0]?.businessName ?? 'Merchant';
}

const DEFAULT_LIMIT = 20;
const RELATED_PRODUCTS_LIMIT = 6;
/**
 * rating_desc/popular/recommended aren't backed by a Product column, so they
 * can't use DB-level keyset/offset pagination. This caps how many filtered
 * candidates get scored and sorted in application code — fine at today's
 * catalog size; revisit (denormalized rating column, materialized view, or
 * raw SQL) if a merchant's/category's result set grows past it.
 */
const RANKED_SORT_CANDIDATE_CAP = 1000;
const POPULARITY_WINDOW_DAYS = 30;

const COLUMN_SORTS = new Set(['newest', 'price_asc', 'price_desc']);

@Injectable()
export class CustomerProductsService {
  constructor(private readonly prisma: PrismaService) {}

  public async browse(
    query: BrowseProductsQueryDto,
    overrides: { isFeatured?: boolean; forceSort?: CatalogSort } = {},
  ): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    const sort = overrides.forceSort ?? query.sort ?? 'newest';
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = decodeCursorOffset(query.cursor, sort);
    const where = await this.buildWhere(query, overrides.isFeatured);

    if (COLUMN_SORTS.has(sort)) {
      return await this.browseByColumn(
        where,
        sort as 'newest' | 'price_asc' | 'price_desc',
        offset,
        limit,
      );
    }
    return await this.browseByComputedScore(
      where,
      sort as 'rating_desc' | 'popular' | 'recommended',
      offset,
      limit,
    );
  }

  /**
   * "AI discovery" search — a lightweight structural parser (see
   * parseSmartQuery), not an LLM call. `openNow` is parsed but unused here;
   * it only means something for merchants, not products.
   */
  public async smartSearch(
    query: SmartSearchQueryDto,
  ): Promise<SmartSearchResult<ProductSummaryDto>> {
    const parsed = parseSmartQuery(query.query);
    const results = await this.browse({
      ...(parsed.keywords ? { q: parsed.keywords } : {}),
      ...(parsed.maxPrice !== undefined ? { maxPrice: parsed.maxPrice } : {}),
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.lat !== undefined ? { lat: query.lat } : {}),
      ...(query.lng !== undefined ? { lng: query.lng } : {}),
    });
    return { parsed, results };
  }

  public async getProductDetail(productId: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.PUBLISHED, isDeleted: false },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundDomainException('Product not found');
    }

    const [rating, related] = await Promise.all([
      this.ratingsFor([product.id]).then((map) => map.get(product.id) ?? ZERO_RATING),
      this.similarProducts(product, RELATED_PRODUCTS_LIMIT),
    ]);

    const business = product.merchant.user.businesses[0] ?? null;
    const merchant: ProductMerchantSummaryDto | null = business
      ? {
          merchantId: product.merchantId,
          businessName: business.businessName,
          logoUrl: business.logoUrl,
          city: business.city,
          state: business.state,
        }
      : null;

    return toProductDetailDto(product, rating, merchant, related);
  }

  public async listSimilar(
    productId: string,
    limit = RELATED_PRODUCTS_LIMIT,
  ): Promise<ProductSummaryDto[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.PUBLISHED, isDeleted: false },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundDomainException('Product not found');
    }
    return await this.similarProducts(product, limit);
  }

  public async listCategories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCategoryDto);
  }

  public async listBrands(): Promise<BrandDto[]> {
    const rows = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toBrandDto);
  }

  private async browseByColumn(
    where: Prisma.ProductWhereInput,
    sort: 'newest' | 'price_asc' | 'price_desc',
    offset: number,
    limit: number,
  ): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === 'newest'
        ? { publishedAt: 'desc' }
        : { basePrice: sort === 'price_asc' ? 'asc' : 'desc' };

    const rows = await this.prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy,
      skip: offset,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ratings = await this.ratingsFor(page.map((product) => product.id));

    return {
      items: page.map((product) =>
        toProductSummaryDto(product, ratings.get(product.id), merchantNameOf(product)),
      ),
      nextCursor: hasMore ? encodeCursor(sort, offset + limit) : null,
      hasMore,
    };
  }

  private async browseByComputedScore(
    where: Prisma.ProductWhereInput,
    sort: 'rating_desc' | 'popular' | 'recommended',
    offset: number,
    limit: number,
  ): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    const candidates = await this.prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { publishedAt: 'desc' },
      take: RANKED_SORT_CANDIDATE_CAP,
    });

    const ratings = await this.ratingsFor(candidates.map((product) => product.id));
    const popularity =
      sort === 'popular'
        ? await this.popularityFor(candidates.map((product) => product.id))
        : new Map<string, number>();

    const scored = candidates
      .map((product) => {
        const rating = ratings.get(product.id) ?? ZERO_RATING;
        return {
          product,
          rating,
          score: sort === 'popular' ? (popularity.get(product.id) ?? 0) : rating.average,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score || b.product.createdAt.getTime() - a.product.createdAt.getTime(),
      );

    const total = scored.length;
    const page = scored.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items: page.map(({ product, rating }) =>
        toProductSummaryDto(product, rating, merchantNameOf(product)),
      ),
      nextCursor: hasMore ? encodeCursor(sort, offset + limit) : null,
      hasMore,
    };
  }

  private async similarProducts(
    product: ProductWithRelations,
    limit: number,
  ): Promise<ProductSummaryDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        isDeleted: false,
        id: { not: product.id },
        ...(product.categoryId
          ? { categoryId: product.categoryId }
          : product.brandId
            ? { brandId: product.brandId }
            : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    const ratings = await this.ratingsFor(rows.map((row) => row.id));
    return rows.map((row) => toProductSummaryDto(row, ratings.get(row.id), merchantNameOf(row)));
  }

  private async buildWhere(
    query: BrowseProductsQueryDto,
    isFeatured?: boolean,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      isDeleted: false,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.merchantId ? { merchantId: query.merchantId } : {}),
      ...(isFeatured ? { isFeatured: true } : {}),
    };

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: new Prisma.Decimal(query.minPrice) } : {}),
        ...(query.maxPrice !== undefined ? { lte: new Prisma.Decimal(query.maxPrice) } : {}),
      };
    }

    // Conditions that must all hold, accumulated so multiple independent
    // OR-groups (stock + search) coexist instead of overwriting each other.
    const and: Prisma.ProductWhereInput[] = [];

    if (query.inStock) {
      // Coarse "looks in stock" filter (ignores reservations); the real
      // available-vs-reserved check happens at cart-add/checkout time.
      // A merchant-forced "out of stock" (manuallyDisabled) is excluded, and a
      // product is otherwise in stock when it isn't inventory-tracked or has
      // sellable quantity — matching computeInStock / hasStock.
      and.push({
        OR: [{ inventory: { is: null } }, { inventory: { is: { manuallyDisabled: false } } }],
      });
      and.push({
        OR: [
          { inventory: { is: null } },
          { inventory: { is: { trackInventory: false } } },
          { inventory: { is: { quantity: { gt: 0 } } } },
        ],
      });
    }

    const term = query.q?.trim();
    if (term && term.length > 0) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { brand: { is: { name: { contains: term, mode: 'insensitive' } } } },
          { category: { is: { name: { contains: term, mode: 'insensitive' } } } },
          {
            merchant: {
              is: {
                user: {
                  is: {
                    businesses: {
                      some: { businessName: { contains: term, mode: 'insensitive' } },
                    },
                  },
                },
              },
            },
          },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    if (query.minRating !== undefined) {
      const qualifying = await this.prisma.reviewAggregate.findMany({
        where: { targetType: ReviewTargetType.PRODUCT, averageRating: { gte: query.minRating } },
        select: { targetId: true },
      });
      where.id = { in: qualifying.map((row) => row.targetId) };
    }

    return where;
  }

  private async ratingsFor(productIds: string[]): Promise<Map<string, RatingSummaryDto>> {
    if (productIds.length === 0) {
      return new Map();
    }
    const aggregates = await this.prisma.reviewAggregate.findMany({
      where: { targetType: ReviewTargetType.PRODUCT, targetId: { in: productIds } },
    });
    return new Map(
      aggregates.map((aggregate) => [
        aggregate.targetId,
        { average: aggregate.averageRating, count: aggregate.reviewCount },
      ]),
    );
  }

  private async popularityFor(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) {
      return new Map();
    }
    const since = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, createdAt: { gte: since } },
      _sum: { quantity: true },
    });
    return new Map(grouped.map((row) => [row.productId, row._sum.quantity ?? 0]));
  }
}
