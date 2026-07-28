import type { HttpClient } from '../client/http-client.js';
import type {
  BrandDto,
  BrowseProductsQuery,
  CategoryDto,
  CursorPaginatedResult,
  ProductDetailDto,
  ProductSummaryDto,
  SmartSearchResult,
} from '@dripplex/types';

function toQueryString(params?: object): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (
      (typeof value === 'string' && value !== '') ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface SmartSearchQuery {
  query: string;
  lat?: number;
  lng?: number;
  cursor?: string;
  limit?: number;
}

/** Customer-facing product browsing (R1.3) — public, no auth required. */
export class CustomerProductsApi {
  public constructor(private readonly http: HttpClient) {}

  public browse(query?: BrowseProductsQuery): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    return this.http.request<CursorPaginatedResult<ProductSummaryDto>>(
      `/products${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public featured(query?: BrowseProductsQuery): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    return this.http.request<CursorPaginatedResult<ProductSummaryDto>>(
      `/products/featured${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public newArrivals(
    query?: BrowseProductsQuery,
  ): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    return this.http.request<CursorPaginatedResult<ProductSummaryDto>>(
      `/products/new-arrivals${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public trending(query?: BrowseProductsQuery): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    return this.http.request<CursorPaginatedResult<ProductSummaryDto>>(
      `/products/trending${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public recommended(
    query?: BrowseProductsQuery,
  ): Promise<CursorPaginatedResult<ProductSummaryDto>> {
    return this.http.request<CursorPaginatedResult<ProductSummaryDto>>(
      `/products/recommended${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public smartSearch(query: SmartSearchQuery): Promise<SmartSearchResult<ProductSummaryDto>> {
    return this.http.request<SmartSearchResult<ProductSummaryDto>>(
      `/products/smart-search${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public get(id: string): Promise<ProductDetailDto> {
    return this.http.request<ProductDetailDto>(`/products/${id}`, { method: 'GET', auth: false });
  }

  public similar(id: string): Promise<ProductSummaryDto[]> {
    return this.http.request<ProductSummaryDto[]>(`/products/${id}/similar`, {
      method: 'GET',
      auth: false,
    });
  }

  public listCategories(): Promise<CategoryDto[]> {
    return this.http.request<CategoryDto[]>('/categories', { method: 'GET', auth: false });
  }

  public listBrands(): Promise<BrandDto[]> {
    return this.http.request<BrandDto[]>('/brands', { method: 'GET', auth: false });
  }
}
