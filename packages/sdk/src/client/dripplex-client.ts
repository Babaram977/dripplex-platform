import { AddressClient } from '../address/address-client.js';
import { AuthApi } from '../auth/auth-api.js';
import { CartClient } from '../cart/cart-client.js';
import { HttpClient } from '../client/http-client.js';
import { resolveSdkConfig } from '../config/sdk-config.js';
import { AdminMerchantsApi, MerchantApi } from '../merchant/merchant-api.js';

import type { SdkConfig } from '../config/sdk-config.js';

export class DripplexClient {
  public readonly auth: AuthApi;
  public readonly merchant: MerchantApi;
  public readonly adminMerchants: AdminMerchantsApi;
  public readonly addresses: AddressClient;
  public readonly cart: CartClient;
  private readonly http: HttpClient;

  public constructor(config: Partial<SdkConfig> = {}) {
    const resolved = resolveSdkConfig(config);
    this.http = new HttpClient(resolved);
    this.auth = new AuthApi(this.http);
    this.merchant = new MerchantApi(this.http);
    this.adminMerchants = new AdminMerchantsApi(this.http);
    this.addresses = new AddressClient(this.http);
    this.cart = new CartClient(this.http);
  }
}

export { DripplexApiError } from '../errors/api-error.js';
export type { SdkConfig } from '../config/sdk-config.js';
export { resolveSdkConfig } from '../config/sdk-config.js';
export { AdminMerchantsApi, MerchantApi } from '../merchant/merchant-api.js';
export { AddressClient } from '../address/address-client.js';
export { CartClient } from '../cart/cart-client.js';
