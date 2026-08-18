/**
 * The interface Peyflex sits behind.
 *
 * Two concrete reasons for the indirection rather than calling Peyflex from
 * the service: the platform has already had to safe-disable one payment
 * provider (OPay), and a utilities aggregator is exactly the kind of
 * dependency that gets swapped when its uptime or its rates move. The
 * not-configured implementation is the default, so the feature deploys
 * disabled rather than deploying broken.
 *
 * The shapes below are DrippleX's, not Peyflex's. The adapter is where the
 * provider's wire format — its `identifier` vs `id` inconsistency, its
 * 28-significant-figure decimals, its HTTP 200 failures — is translated once
 * so none of it leaks into the service or the client.
 */

export interface UtilityNetwork {
  /** The code sent back on purchase. Never free-typed by a client. */
  code: string;
  name: string;
}

export interface UtilityDataPlan {
  /**
   * `plan_code` alone is NOT unique — Peyflex publishes `M2GBS` twice, at
   * ₦800 for 2 days and ₦1,505 for 1 month (DPX-UTILITIES-002 G5). This id
   * is `plan_code` combined with the amount so a customer cannot be sold the
   * wrong bundle by a code collision; the adapter splits it back apart.
   */
  id: string;
  planCode: string;
  amount: number;
  label: string;
}

export interface UtilityCablePlan {
  id: string;
  planCode: string;
  amount: number;
  label: string;
  description?: string;
}

export interface UtilityElectricityDisco {
  code: string;
  name: string;
  /** Per-disco bounds — Kaduna 1,100–100,000, Kano 500–500,000, Aba
   * 100–400,000. Enforced before payment, or the customer meets a provider
   * rejection after their money has moved. */
  minAmount: number;
  maxAmount: number;
}

export interface UtilityCustomerLookup {
  /** The name registered against the meter or smartcard. This is the whole
   * point of verification: the customer confirms they are about to top up
   * the right meter. */
  customerName: string;
  identifier: string;
  providerName?: string;
}

export interface UtilityPurchaseRequest {
  providerCode: string;
  /** Phone, meter or smartcard number. */
  customerIdentifier: string;
  /** Face value, in naira. */
  amount: number;
  /** Data bundle or cable package; absent for airtime and electricity. */
  planCode?: string;
  /** Prepaid vs postpaid — electricity only. */
  meterType?: 'prepaid' | 'postpaid';
  /** A contact number for the receipt. Electricity and cable want one. */
  contactPhone?: string;
}

/**
 * The outcome of a provider call, as DrippleX understands it.
 *
 * `outcome` is deliberately three-valued. A provider that says no is not the
 * same as a provider that never answered: the first is safe to reverse, the
 * second is not, because the float may or may not already be spent. Collapsing
 * them into a boolean is how a customer gets refunded for electricity they
 * actually received — or charged for electricity they never got.
 */
export type UtilityPurchaseOutcome = 'SUCCESS' | 'FAILED' | 'UNKNOWN';

export interface UtilityPurchaseResult {
  outcome: UtilityPurchaseOutcome;
  /** Peyflex's own reference. Present on success; sometimes present on a
   * declared failure. */
  providerReference?: string;
  /** What the float was actually debited. The spread against face value is
   * DrippleX's margin. Absent when the provider did not say. */
  providerCost?: number;
  /** Electricity token or recharge PIN — the artifact the customer bought. */
  deliveredToken?: string;
  /** The provider's own words. Not shown to the customer unfiltered; the
   * service decides what is safe to surface. */
  providerMessage?: string;
  /** True when the failure was the DrippleX float running dry rather than
   * anything about this customer or this meter. */
  floatExhausted?: boolean;
  /** The raw body, stored for reconciliation against the Peyflex dashboard. */
  raw?: unknown;
}

export interface UtilityFloatBalance {
  balance: number;
  currency: string;
}

export interface UtilityProviderPort {
  /** False when no credentials are configured. The service checks this
   * before offering a catalogue, so the UI can badge the tab honestly
   * instead of looking live and failing. */
  readonly configured: boolean;

  listAirtimeNetworks(): Promise<UtilityNetwork[]>;
  listDataNetworks(): Promise<UtilityNetwork[]>;
  listDataPlans(networkCode: string): Promise<UtilityDataPlan[]>;
  listCableProviders(): Promise<UtilityNetwork[]>;
  listCablePlans(providerCode: string): Promise<UtilityCablePlan[]>;
  listElectricityDiscos(): Promise<UtilityElectricityDisco[]>;

  verifyCableCustomer(
    providerCode: string,
    smartcardNumber: string,
  ): Promise<UtilityCustomerLookup>;
  verifyElectricityCustomer(
    discoCode: string,
    meterNumber: string,
    meterType: 'prepaid' | 'postpaid',
  ): Promise<UtilityCustomerLookup>;

  purchaseAirtime(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseData(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseCable(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseElectricity(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;

  /** The DrippleX float, not a customer balance. Read by the low-balance
   * alarm. */
  getFloatBalance(): Promise<UtilityFloatBalance>;
}

export const UTILITY_PROVIDER = Symbol('UTILITY_PROVIDER');
