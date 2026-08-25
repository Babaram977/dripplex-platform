/// DPX-UTILITIES-001 / -002 — the Utilities tab (airtime, data, electricity,
/// cable TV, betting top-ups and exam PINs) behind the Peyflex aggregator.
///
/// Every shape here mirrors the BACKEND contract
/// (apps/backend/src/utilities/utilities.service.ts and
/// providers/utility-provider.port.ts), not the client's convenience. A
/// client-shaped interface that drifts from the server is how a screen ends
/// up rendering `undefined` for every field while the build stays green.

export type UtilityServiceType =
  | 'AIRTIME'
  | 'DATA'
  | 'ELECTRICITY'
  | 'CABLE_TV'
  /// Funding a bookmaker account. Verified before funding — money sent to a
  /// mistyped betting id does not come back.
  | 'BETTING'
  /// WAEC / NECO / NABTEB result-checker PINs. The only service priced per
  /// unit and bought in quantity.
  | 'EDUCATION';

export type UtilityPaymentMethod = 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE';

export type UtilityPurchaseStatus =
  /// Card path, before the gateway confirms. No money has moved.
  | 'AWAITING_PAYMENT'
  /// The provider never answered. The customer's money is reserved and a
  /// human has to establish what happened — Peyflex offers no status lookup.
  | 'PENDING'
  | 'SUCCESSFUL'
  | 'FAILED'
  /// A declared failure whose reservation has been given back.
  | 'REVERSED';

export interface UtilityCatalogueDto {
  /// False until Peyflex credentials exist. The tab badges itself from this
  /// rather than looking live and failing after a bundle is chosen.
  available: boolean;
  services: UtilityServiceType[];
  airtimeMinAmount: number;
  airtimeMaxAmount: number;
  bettingMinAmount: number;
  bettingMaxAmount: number;
  /// Exam PINs are the only service bought in quantity.
  educationMaxQuantity: number;
}

export interface UtilityNetworkDto {
  code: string;
  name: string;
}

export interface UtilityDataPlanDto {
  /// `plan_code:amount`, not the bare plan code — Peyflex publishes the same
  /// code at two different prices, so selecting by code alone sells the
  /// wrong bundle.
  id: string;
  planCode: string;
  amount: number;
  label: string;
}

export interface UtilityCablePlanDto {
  id: string;
  planCode: string;
  amount: number;
  label: string;
  description?: string;
}

/// A result-checker PIN. `unitPrice` is for ONE — the charge is unitPrice
/// multiplied by the quantity, which no other utility does.
export interface UtilityEducationPlanDto {
  id: string;
  planCode: string;
  unitPrice: number;
  label: string;
}

export interface UtilityElectricityDiscoDto {
  code: string;
  name: string;
  minAmount: number;
  maxAmount: number;
}

export interface UtilityCustomerLookupDto {
  customerName: string;
  identifier: string;
  providerName?: string;
}

export interface UtilityPurchaseDto {
  id: string;
  serviceType: UtilityServiceType;
  customerIdentifier: string;
  providerCode: string;
  planCode: string | null;
  amountCharged: number;
  /// Exam PINs only. Without it a receipt for ₦16,050 cannot explain itself.
  quantity: number | null;
  /// Whose betting account was funded, as verified before payment. Null for
  /// every other service.
  beneficiaryName: string | null;
  paymentMethod: UtilityPaymentMethod;
  status: UtilityPurchaseStatus;
  providerReference: string | null;
  /// The electricity token or exam PIN(s) — every PIN a purchase sold, in
  /// one `||`-separated string. Re-displayable, because a customer who closes
  /// the app and loses it has lost the money.
  deliveredToken: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/// Ops-only. `providerCost` is deliberately absent from the customer's view:
/// the spread is DrippleX's business and putting it on a receipt invites an
/// argument about the margin on every purchase.
export interface AdminUtilityPurchaseDto extends UtilityPurchaseDto {
  customerId: string;
  providerCost: number | null;
  /// Exactly what the provider replied, verbatim. The backend has always sent
  /// it and this contract never declared it, so the Ops Console could not
  /// render the one field that says *why* a purchase was refused without
  /// reaching past the type. `unknown` rather than a shape: it is a foreign
  /// body, and pretending to know its keys is how a rendering crashes on the
  /// first response that disagrees.
  providerResponse: unknown;
}

export interface CreateUtilityPurchaseRequest {
  serviceType: UtilityServiceType;
  provider: string;
  customerIdentifier: string;
  /// Required for DATA, CABLE_TV and EDUCATION; the amount comes from the
  /// catalogue.
  planId?: string;
  /// Required for AIRTIME, ELECTRICITY and BETTING, which are amount-priced.
  amount?: number;
  /// EDUCATION only — how many PINs. Defaults to 1.
  quantity?: number;
  meterType?: 'prepaid' | 'postpaid';
  contactPhone?: string;
  paymentMethod: UtilityPaymentMethod;
}

export interface InitiateUtilityPurchaseResult {
  purchase: UtilityPurchaseDto;
  /// Card path only — where to send the customer to pay.
  authorizationUrl?: string;
}

export interface VerifyCableCustomerRequest {
  provider: string;
  smartcardNumber: string;
}

export interface VerifyBettingCustomerRequest {
  provider: string;
  /// May be a username, not only a phone number — Bet9ja and others identify
  /// customers by username.
  customerId: string;
}

export interface VerifyElectricityCustomerRequest {
  provider: string;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
}

export interface UtilityFloatStatusDto {
  configured: boolean;
  balance: number | null;
  currency: string;
  threshold: number;
  low: boolean;
  error?: string;
}

export interface ResolveUtilityPurchaseRequest {
  outcome: 'SUCCESSFUL' | 'REVERSED';
  note: string;
  providerReference?: string;
  deliveredToken?: string;
  providerCost?: number;
}
