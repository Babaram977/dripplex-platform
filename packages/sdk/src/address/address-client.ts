import type { HttpClient } from '../client/http-client.js';
import type {
  AddressListResponse,
  CreateAddressDto,
  CustomerAddressDto,
  DefaultAddressResponse,
  UpdateAddressDto,
} from '@dripplex/types';

/**
 * Typed client for customer saved addresses (`/customer/addresses`).
 */
export class AddressClient {
  public constructor(private readonly http: HttpClient) {}

  public create(body: CreateAddressDto): Promise<CustomerAddressDto> {
    return this.http.request<CustomerAddressDto>('/customer/addresses', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public update(id: string, body: UpdateAddressDto): Promise<CustomerAddressDto> {
    return this.http.request<CustomerAddressDto>(`/customer/addresses/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public delete(id: string): Promise<undefined> {
    return this.http.request<undefined>(`/customer/addresses/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public list(): Promise<AddressListResponse> {
    return this.http.request<AddressListResponse>('/customer/addresses', {
      method: 'GET',
      auth: true,
    });
  }

  public get(id: string): Promise<CustomerAddressDto> {
    return this.http.request<CustomerAddressDto>(`/customer/addresses/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public setDefault(id: string): Promise<CustomerAddressDto> {
    return this.http.request<CustomerAddressDto>(`/customer/addresses/${id}/default`, {
      method: 'PATCH',
      auth: true,
    });
  }

  public getDefault(): Promise<DefaultAddressResponse> {
    return this.http.request<DefaultAddressResponse>('/customer/addresses/default', {
      method: 'GET',
      auth: true,
    });
  }
}
