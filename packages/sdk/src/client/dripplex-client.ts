import { AddressClient } from '../address/address-client.js';
import { AuthApi } from '../auth/auth-api.js';
import { CartClient } from '../cart/cart-client.js';
import { HttpClient } from '../client/http-client.js';
import { resolveSdkConfig } from '../config/sdk-config.js';
import { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
import { DeliveryClient } from '../delivery/delivery-client.js';
import { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
import { AdminMerchantsApi, MerchantApi } from '../merchant/merchant-api.js';
import { OrderClient } from '../order/order-client.js';
import { PaymentClient } from '../payment/payment-client.js';

import type { SdkConfig } from '../config/sdk-config.js';

export class DripplexClient {
  public readonly auth: AuthApi;
  public readonly merchant: MerchantApi;
  public readonly adminMerchants: AdminMerchantsApi;
  public readonly addresses: AddressClient;
  public readonly cart: CartClient;
  public readonly orders: OrderClient;
  public readonly payments: PaymentClient;
  public readonly delivery: DeliveryClient;
  public readonly riderDelivery: RiderDeliveryClient;
  public readonly adminDelivery: AdminDeliveryClient;
  private readonly http: HttpClient;

  public constructor(config: Partial<SdkConfig> = {}) {
    const resolved = resolveSdkConfig(config);
    this.http = new HttpClient(resolved);
    this.auth = new AuthApi(this.http);
    this.merchant = new MerchantApi(this.http);
    this.adminMerchants = new AdminMerchantsApi(this.http);
    this.addresses = new AddressClient(this.http);
    this.cart = new CartClient(this.http);
    this.orders = new OrderClient(this.http);
    this.payments = new PaymentClient(this.http);
    this.delivery = new DeliveryClient(this.http);
    this.riderDelivery = new RiderDeliveryClient(this.http);
    this.adminDelivery = new AdminDeliveryClient(this.http);
  }
}

export { DripplexApiError } from '../errors/api-error.js';
export type { SdkConfig } from '../config/sdk-config.js';
export { resolveSdkConfig } from '../config/sdk-config.js';
export { AdminMerchantsApi, MerchantApi } from '../merchant/merchant-api.js';
export { AddressClient } from '../address/address-client.js';
export { CartClient } from '../cart/cart-client.js';
export { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
export { DeliveryClient } from '../delivery/delivery-client.js';
export { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
export { OrderClient } from '../order/order-client.js';
export { PaymentClient } from '../payment/payment-client.js';
