import { AddressClient } from '../address/address-client.js';
import { AuthApi } from '../auth/auth-api.js';
import { CallsClient } from '../calls/calls-client.js';
import { CartClient } from '../cart/cart-client.js';
import { HttpClient } from '../client/http-client.js';
import { AdminCommercialCreditSettingsClient } from '../commercial/admin-commercial-credit-settings-client.js';
import { AdminCommissionAccountsClient } from '../commercial/admin-commission-accounts-client.js';
import { AdminPlatformCommissionSettingsClient } from '../commercial/admin-platform-commission-settings-client.js';
import { DriverCommercialClient } from '../commercial/driver-commercial-client.js';
import { MerchantCommercialClient } from '../commercial/merchant-commercial-client.js';
import { resolveSdkConfig } from '../config/sdk-config.js';
import { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
import { DeliveryClient } from '../delivery/delivery-client.js';
import { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
import { AdminDriverIdentityVerificationClient } from '../drivers/admin-driver-identity-verification-client.js';
import { AdminDriverPlannedAvailabilityClient } from '../drivers/admin-driver-planned-availability-client.js';
import { AdminDriverSecuritySettingsClient } from '../drivers/admin-driver-security-settings-client.js';
import { AdminDriverShiftsClient } from '../drivers/admin-driver-shifts-client.js';
import { AdminDriverVehiclesClient } from '../drivers/admin-driver-vehicles-client.js';
import { AdminDriversClient } from '../drivers/admin-drivers-client.js';
import { AdminInspectionCentresClient } from '../drivers/admin-inspection-centres-client.js';
import { DriverHelpClient } from '../drivers/driver-help-client.js';
import { DriverIdentityVerificationClient } from '../drivers/driver-identity-verification-client.js';
import { DriverIncidentReportClient } from '../drivers/driver-incident-report-client.js';
import { DriverInspectionsClient } from '../drivers/driver-inspections-client.js';
import { DriverOnboardingClient } from '../drivers/driver-onboarding-client.js';
import { DriverPlannedAvailabilityClient } from '../drivers/driver-planned-availability-client.js';
import { DriverProfileClient } from '../drivers/driver-profile-client.js';
import { DriverRideContactClient } from '../drivers/driver-ride-contact-client.js';
import { DriverShiftClient } from '../drivers/driver-shift-client.js';
import { DriverSosAlertClient } from '../drivers/driver-sos-alert-client.js';
import { DriverSupportClient } from '../drivers/driver-support-client.js';
import { DriverVehiclesClient } from '../drivers/driver-vehicles-client.js';
import { OperationsInspectionsClient } from '../drivers/operations-inspections-client.js';
import { AdminCustomerKycClient } from '../kyc/admin-customer-kyc-client.js';
import { CustomerKycClient } from '../kyc/customer-kyc-client.js';
import {
  AdminMerchantsApi,
  CustomerMerchantsApi,
  MerchantApi,
  MerchantProductsApi,
} from '../merchant/merchant-api.js';
import { OperationsAnalyticsClient } from '../operations/operations-analytics-client.js';
import { OperationsCasesClient } from '../operations/operations-cases-client.js';
import { OperationsDashboardClient } from '../operations/operations-dashboard-client.js';
import { OperationsFleetClient } from '../operations/operations-fleet-client.js';
import { OperationsQueuesClient } from '../operations/operations-queues-client.js';
import { OperationsRidesClient } from '../operations/operations-rides-client.js';
import { OperationsStaffClient } from '../operations/operations-staff-client.js';
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
import { AdminRidersClient } from '../riders/admin-riders-client.js';
import { AdminRidePricingClient } from '../rides/admin-ride-pricing-client.js';
import { AdminRideReportsClient } from '../rides/admin-ride-reports-client.js';
import { CustomerRideClient } from '../rides/customer-ride-client.js';
import { DriverRideClient } from '../rides/driver-ride-client.js';
import { UploadsClient } from '../uploads/uploads-client.js';
import { AdminUtilitiesClient } from '../utilities/admin-utilities-client.js';

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
  /** DPX-MOBILE-002 — voice calls between the two parties of a live job.
   * Not role-scoped: a customer, a driver and a rider all call through the
   * same routes, and who they may reach is decided by the job, not the SDK. */
  public readonly calls: CallsClient;
  public readonly driverRides: DriverRideClient;
  public readonly driverProfile: DriverProfileClient;
  public readonly driverRideContact: DriverRideContactClient;
  public readonly driverSupport: DriverSupportClient;
  public readonly driverIncidentReports: DriverIncidentReportClient;
  public readonly driverSosAlerts: DriverSosAlertClient;
  public readonly driverShifts: DriverShiftClient;
  public readonly driverPlannedAvailability: DriverPlannedAvailabilityClient;
  public readonly driverHelp: DriverHelpClient;
  public readonly driverIdentityVerification: DriverIdentityVerificationClient;
  public readonly adminDriverSecuritySettings: AdminDriverSecuritySettingsClient;
  public readonly adminDriverIdentityVerification: AdminDriverIdentityVerificationClient;
  public readonly adminDriverPlannedAvailability: AdminDriverPlannedAvailabilityClient;
  public readonly adminDriverShifts: AdminDriverShiftsClient;
  public readonly adminRideReports: AdminRideReportsClient;
  public readonly adminDrivers: AdminDriversClient;
  public readonly adminRiders: AdminRidersClient;
  public readonly driverVehicles: DriverVehiclesClient;
  public readonly adminDriverVehicles: AdminDriverVehiclesClient;
  public readonly driverOnboarding: DriverOnboardingClient;
  public readonly driverInspections: DriverInspectionsClient;
  public readonly adminInspectionCentres: AdminInspectionCentresClient;
  public readonly adminRidePricing: AdminRidePricingClient;
  public readonly adminUtilities: AdminUtilitiesClient;
  public readonly operationsInspections: OperationsInspectionsClient;
  public readonly operationsFleet: OperationsFleetClient;
  public readonly adminCommercialCreditSettings: AdminCommercialCreditSettingsClient;
  public readonly adminPlatformCommissionSettings: AdminPlatformCommissionSettingsClient;
  public readonly adminCommissionAccounts: AdminCommissionAccountsClient;
  public readonly merchantCommercial: MerchantCommercialClient;
  public readonly driverCommercial: DriverCommercialClient;
  public readonly operationsRides: OperationsRidesClient;
  public readonly operationsQueues: OperationsQueuesClient;
  public readonly operationsCases: OperationsCasesClient;
  public readonly operationsDashboard: OperationsDashboardClient;
  public readonly operationsStaff: OperationsStaffClient;
  public readonly operationsAnalytics: OperationsAnalyticsClient;
  public readonly notifications: NotificationsClient;
  public readonly driverNotifications: NotificationsClient;
  public readonly merchantNotifications: NotificationsClient;
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
  public readonly kyc: CustomerKycClient;
  public readonly adminCustomerKyc: AdminCustomerKycClient;
  public readonly uploads: UploadsClient;
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
    this.calls = new CallsClient(this.http);
    this.driverRides = new DriverRideClient(this.http);
    this.driverProfile = new DriverProfileClient(this.http);
    this.driverRideContact = new DriverRideContactClient(this.http);
    this.driverSupport = new DriverSupportClient(this.http);
    this.driverIncidentReports = new DriverIncidentReportClient(this.http);
    this.driverSosAlerts = new DriverSosAlertClient(this.http);
    this.driverShifts = new DriverShiftClient(this.http);
    this.driverPlannedAvailability = new DriverPlannedAvailabilityClient(this.http);
    this.driverHelp = new DriverHelpClient(this.http);
    this.driverIdentityVerification = new DriverIdentityVerificationClient(this.http);
    this.adminDriverSecuritySettings = new AdminDriverSecuritySettingsClient(this.http);
    this.adminDriverIdentityVerification = new AdminDriverIdentityVerificationClient(this.http);
    this.adminDriverPlannedAvailability = new AdminDriverPlannedAvailabilityClient(this.http);
    this.adminDriverShifts = new AdminDriverShiftsClient(this.http);
    this.adminRideReports = new AdminRideReportsClient(this.http);
    this.adminDrivers = new AdminDriversClient(this.http);
    this.adminRiders = new AdminRidersClient(this.http);
    this.driverVehicles = new DriverVehiclesClient(this.http);
    this.adminDriverVehicles = new AdminDriverVehiclesClient(this.http);
    this.driverOnboarding = new DriverOnboardingClient(this.http);
    this.driverInspections = new DriverInspectionsClient(this.http);
    this.adminInspectionCentres = new AdminInspectionCentresClient(this.http);
    this.adminRidePricing = new AdminRidePricingClient(this.http);
    this.adminUtilities = new AdminUtilitiesClient(this.http);
    this.operationsInspections = new OperationsInspectionsClient(this.http);
    this.operationsFleet = new OperationsFleetClient(this.http);
    this.adminCommercialCreditSettings = new AdminCommercialCreditSettingsClient(this.http);
    this.adminPlatformCommissionSettings = new AdminPlatformCommissionSettingsClient(this.http);
    this.adminCommissionAccounts = new AdminCommissionAccountsClient(this.http);
    this.merchantCommercial = new MerchantCommercialClient(this.http);
    this.driverCommercial = new DriverCommercialClient(this.http);
    this.operationsRides = new OperationsRidesClient(this.http);
    this.operationsQueues = new OperationsQueuesClient(this.http);
    this.operationsCases = new OperationsCasesClient(this.http);
    this.operationsDashboard = new OperationsDashboardClient(this.http);
    this.operationsStaff = new OperationsStaffClient(this.http);
    this.operationsAnalytics = new OperationsAnalyticsClient(this.http);
    this.notifications = new NotificationsClient(this.http);
    this.driverNotifications = new NotificationsClient(this.http, '/driver/notifications');
    this.merchantNotifications = new NotificationsClient(this.http, '/merchant/notifications');
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
    this.kyc = new CustomerKycClient(this.http);
    this.adminCustomerKyc = new AdminCustomerKycClient(this.http);
    this.uploads = new UploadsClient(this.http);
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
export { AdminCustomerKycClient } from '../kyc/admin-customer-kyc-client.js';
export { CustomerKycClient } from '../kyc/customer-kyc-client.js';
export { AdminDeliveryClient } from '../delivery/admin-delivery-client.js';
export { DeliveryClient } from '../delivery/delivery-client.js';
export { RiderDeliveryClient } from '../delivery/rider-delivery-client.js';
export { OrderClient } from '../order/order-client.js';
export { PaymentClient } from '../payment/payment-client.js';
export { AdminRidePricingClient } from '../rides/admin-ride-pricing-client.js';
export { CustomerRideClient } from '../rides/customer-ride-client.js';
export { UploadsClient } from '../uploads/uploads-client.js';
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
