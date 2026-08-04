import { AddressClient } from '../address/address-client.js';
import { AuthApi } from '../auth/auth-api.js';
import { CartClient } from '../cart/cart-client.js';
import { HttpClient } from '../client/http-client.js';
import { resolveSdkConfig } from '../config/sdk-config.js';
import { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
import { DeliveryClient } from '../delivery/delivery-client.js';
import { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
import { AdminDriverSecuritySettingsClient } from '../drivers/admin-driver-security-settings-client.js';
import { AdminDriverVehiclesClient } from '../drivers/admin-driver-vehicles-client.js';
import { AdminDriversClient } from '../drivers/admin-drivers-client.js';
import { AdminInspectionCentresClient } from '../drivers/admin-inspection-centres-client.js';
import { DriverIdentityVerificationClient } from '../drivers/driver-identity-verification-client.js';
import { DriverIncidentReportClient } from '../drivers/driver-incident-report-client.js';
import { DriverInspectionsClient } from '../drivers/driver-inspections-client.js';
import { DriverOnboardingClient } from '../drivers/driver-onboarding-client.js';
import { DriverProfileClient } from '../drivers/driver-profile-client.js';
import { DriverRideContactClient } from '../drivers/driver-ride-contact-client.js';
import { DriverSosAlertClient } from '../drivers/driver-sos-alert-client.js';
import { DriverSupportClient } from '../drivers/driver-support-client.js';
import { DriverVehiclesClient } from '../drivers/driver-vehicles-client.js';
import { OperationsInspectionsClient } from '../drivers/operations-inspections-client.js';
import {
  AdminMerchantsApi,
  CustomerMerchantsApi,
  MerchantApi,
  MerchantProductsApi,
} from '../merchant/merchant-api.js';
import { OrderClient } from '../order/order-client.js';
import { PaymentClient } from '../payment/payment-client.js';
import {
  AdminDriverCampaignClient,
  AdminPromotionsClient,
  AdminReferralsClient,
  AdminWalletClient,
  AdminCmsClient,
  AdminFraudClient,
  AnalyticsClient,
  CmsClient,
  DevicesClient,
  DriverCampaignClient,
  LoyaltyClient,
  NotificationsClient,
  PromotionsClient,
  ReferralsClient,
  ReviewsClient,
  SearchClient,
  WalletClient,
  WishlistClient,
} from '../platform/platform-client.js';
import { CustomerProductsApi } from '../product/product-api.js';
import { CustomerRideClient } from '../rides/customer-ride-client.js';
import { DriverRideClient } from '../rides/driver-ride-client.js';

import type { SdkConfig } from '../config/sdk-config.js';

export class DripplexClient {
  public readonly auth: AuthApi;
  public readonly merchant: MerchantApi;
  public readonly merchantProducts: MerchantProductsApi;
  public readonly adminMerchants: AdminMerchantsApi;
  public readonly products: CustomerProductsApi;
  public readonly merchants: CustomerMerchantsApi;
  public readonly addresses: AddressClient;
  public readonly cart: CartClient;
  public readonly orders: OrderClient;
  public readonly payments: PaymentClient;
  public readonly delivery: DeliveryClient;
  public readonly riderDelivery: RiderDeliveryClient;
  public readonly adminDelivery: AdminDeliveryClient;
  public readonly rides: CustomerRideClient;
  public readonly driverRides: DriverRideClient;
  public readonly driverProfile: DriverProfileClient;
  public readonly driverRideContact: DriverRideContactClient;
  public readonly driverSupport: DriverSupportClient;
  public readonly driverIncidentReports: DriverIncidentReportClient;
  public readonly driverSosAlerts: DriverSosAlertClient;
  public readonly driverIdentityVerification: DriverIdentityVerificationClient;
  public readonly adminDriverSecuritySettings: AdminDriverSecuritySettingsClient;
  public readonly adminDrivers: AdminDriversClient;
  public readonly driverVehicles: DriverVehiclesClient;
  public readonly adminDriverVehicles: AdminDriverVehiclesClient;
  public readonly driverOnboarding: DriverOnboardingClient;
  public readonly driverInspections: DriverInspectionsClient;
  public readonly adminInspectionCentres: AdminInspectionCentresClient;
  public readonly operationsInspections: OperationsInspectionsClient;
  public readonly notifications: NotificationsClient;
  public readonly driverNotifications: NotificationsClient;
  public readonly devices: DevicesClient;
  public readonly search: SearchClient;
  public readonly reviews: ReviewsClient;
  public readonly wishlist: WishlistClient;
  public readonly promotions: PromotionsClient;
  public readonly adminPromotions: AdminPromotionsClient;
  public readonly referrals: ReferralsClient;
  public readonly adminReferrals: AdminReferralsClient;
  public readonly driverCampaign: DriverCampaignClient;
  public readonly adminDriverCampaign: AdminDriverCampaignClient;
  public readonly loyalty: LoyaltyClient;
  public readonly wallet: WalletClient;
  public readonly adminWallet: AdminWalletClient;
  public readonly analytics: AnalyticsClient;
  public readonly cms: CmsClient;
  public readonly adminCms: AdminCmsClient;
  public readonly adminFraud: AdminFraudClient;
  private readonly http: HttpClient;

  public constructor(config: Partial<SdkConfig> = {}) {
    const resolved = resolveSdkConfig(config);
    this.http = new HttpClient(resolved);
    this.auth = new AuthApi(this.http);
    this.merchant = new MerchantApi(this.http);
    this.merchantProducts = new MerchantProductsApi(this.http);
    this.adminMerchants = new AdminMerchantsApi(this.http);
    this.products = new CustomerProductsApi(this.http);
    this.merchants = new CustomerMerchantsApi(this.http);
    this.addresses = new AddressClient(this.http);
    this.cart = new CartClient(this.http);
    this.orders = new OrderClient(this.http);
    this.payments = new PaymentClient(this.http);
    this.delivery = new DeliveryClient(this.http);
    this.riderDelivery = new RiderDeliveryClient(this.http);
    this.adminDelivery = new AdminDeliveryClient(this.http);
    this.rides = new CustomerRideClient(this.http);
    this.driverRides = new DriverRideClient(this.http);
    this.driverProfile = new DriverProfileClient(this.http);
    this.driverRideContact = new DriverRideContactClient(this.http);
    this.driverSupport = new DriverSupportClient(this.http);
    this.driverIncidentReports = new DriverIncidentReportClient(this.http);
    this.driverSosAlerts = new DriverSosAlertClient(this.http);
    this.driverIdentityVerification = new DriverIdentityVerificationClient(this.http);
    this.adminDriverSecuritySettings = new AdminDriverSecuritySettingsClient(this.http);
    this.adminDrivers = new AdminDriversClient(this.http);
    this.driverVehicles = new DriverVehiclesClient(this.http);
    this.adminDriverVehicles = new AdminDriverVehiclesClient(this.http);
    this.driverOnboarding = new DriverOnboardingClient(this.http);
    this.driverInspections = new DriverInspectionsClient(this.http);
    this.adminInspectionCentres = new AdminInspectionCentresClient(this.http);
    this.operationsInspections = new OperationsInspectionsClient(this.http);
    this.notifications = new NotificationsClient(this.http);
    this.driverNotifications = new NotificationsClient(this.http, '/driver/notifications');
    this.devices = new DevicesClient(this.http);
    this.search = new SearchClient(this.http);
    this.reviews = new ReviewsClient(this.http);
    this.wishlist = new WishlistClient(this.http);
    this.promotions = new PromotionsClient(this.http);
    this.adminPromotions = new AdminPromotionsClient(this.http);
    this.referrals = new ReferralsClient(this.http);
    this.adminReferrals = new AdminReferralsClient(this.http);
    this.driverCampaign = new DriverCampaignClient(this.http);
    this.adminDriverCampaign = new AdminDriverCampaignClient(this.http);
    this.loyalty = new LoyaltyClient(this.http);
    this.wallet = new WalletClient(this.http);
    this.adminWallet = new AdminWalletClient(this.http);
    this.analytics = new AnalyticsClient(this.http);
    this.cms = new CmsClient(this.http);
    this.adminCms = new AdminCmsClient(this.http);
    this.adminFraud = new AdminFraudClient(this.http);
  }
}

export { DripplexApiError } from '../errors/api-error.js';
export type { SdkConfig } from '../config/sdk-config.js';
export { resolveSdkConfig } from '../config/sdk-config.js';
export {
  AdminMerchantsApi,
  CustomerMerchantsApi,
  MerchantApi,
  MerchantProductsApi,
} from '../merchant/merchant-api.js';
export { CustomerProductsApi } from '../product/product-api.js';
export { AddressClient } from '../address/address-client.js';
export { CartClient } from '../cart/cart-client.js';
export { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
export { DeliveryClient } from '../delivery/delivery-client.js';
export { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
export { OrderClient } from '../order/order-client.js';
export { PaymentClient } from '../payment/payment-client.js';
export { CustomerRideClient } from '../rides/customer-ride-client.js';
export {
  AdminDriverCampaignClient,
  AdminPromotionsClient,
  AdminReferralsClient,
  AdminWalletClient,
  AdminCmsClient,
  AdminFraudClient,
  AnalyticsClient,
  CmsClient,
  DevicesClient,
  DriverCampaignClient,
  LoyaltyClient,
  NotificationsClient,
  PromotionsClient,
  ReferralsClient,
  ReviewsClient,
  SearchClient,
  WalletClient,
  WishlistClient,
} from '../platform/platform-client.js';
