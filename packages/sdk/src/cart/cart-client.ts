import type { HttpClient } from '../client/http-client.js';
import type {
  CartDto,
  CartSummaryDto,
  CreateCartItemDto,
  UpdateCartItemDto,
} from '@dripplex/types';

export class CartClient {
  public constructor(private readonly http: HttpClient) {}

  public get(): Promise<CartDto | null> {
    return this.http.request<CartDto | null>('/customer/cart', {
      method: 'GET',
      auth: true,
    });
  }

  public addItem(body: CreateCartItemDto): Promise<CartDto> {
    return this.http.request<CartDto>('/customer/cart/items', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public updateItem(id: string, body: UpdateCartItemDto): Promise<CartDto> {
    return this.http.request<CartDto>(`/customer/cart/items/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public removeItem(id: string): Promise<CartDto> {
    return this.http.request<CartDto>(`/customer/cart/items/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public clear(): Promise<CartSummaryDto> {
    return this.http.request<CartSummaryDto>('/customer/cart', {
      method: 'DELETE',
      auth: true,
    });
  }

  public recalculate(): Promise<CartDto> {
    return this.http.request<CartDto>('/customer/cart/recalculate', {
      method: 'POST',
      auth: true,
    });
  }
}
