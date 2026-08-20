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

/** A result-checker PIN. Priced per unit and bought in quantity, which no
 *  other utility is. */
export interface UtilityEducationPlan {
  /** Peyflex's `plan_id` — taken from the live catalogue, which publishes
   *  `waec`/`neco`/`nabteb`. The Postman sample's `waecdirect` does not
   *  appear in it; the catalogue wins. */
  id: string;
  planCode: string;
  /** Price for ONE unit. Multiply by quantity for the charge. */
  unitPrice: number;
  label: string;
}

export interface UtilityPurchaseRequest {
  providerCode: string;
  /** Phone, meter, smartcard — or, for betting, the bookmaker account id,
   *  which may be a username rather than a number. */
  customerIdentifier: string;
  /** Face value, in naira. For education this is unitPrice × quantity. */
  amount: number;
  /** Data bundle, cable package or exam plan; absent for airtime,
   *  electricity and betting. */
  planCode?: string;
  /** Prepaid vs postpaid — electricity only. */
  meterType?: 'prepaid' | 'postpaid';
  /** A contact number for the receipt. Electricity, cable and education want one. */
  contactPhone?: string;
  /** How many units — education only. */
  quantity?: number;
  /** The verified account holder. Betting only, where Peyflex requires it.
   *  Resolved server-side from a verification call, never taken from the
   *  client: it names whose account is about to be credited. */
  customerName?: string;
  /**
   * DrippleX's own reference for this purchase.
   *
   * Only the betting endpoint accepts one, and it is the single place the
   * platform can close G1: with a reference we chose, a retry after a timeout
   * is Peyflex's problem to deduplicate rather than ours to reconcile by
   * hand. Every other service ignores this because Peyflex gives it nowhere
   * to go.
   */
  reference?: string;
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
  listBettingCompanies(): Promise<UtilityNetwork[]>;
  /** One flat list — Peyflex publishes exam PINs under a single `education`
   *  identifier, so there is no provider to choose first. */
  listEducationPlans(): Promise<UtilityEducationPlan[]>;

  verifyCableCustomer(
    providerCode: string,
    smartcardNumber: string,
  ): Promise<UtilityCustomerLookup>;
  verifyElectricityCustomer(
    discoCode: string,
    meterNumber: string,
    meterType: 'prepaid' | 'postpaid',
  ): Promise<UtilityCustomerLookup>;
  verifyBettingCustomer(companyCode: string, customerId: string): Promise<UtilityCustomerLookup>;

  purchaseAirtime(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseData(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseCable(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseElectricity(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseBetting(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;
  purchaseEducation(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult>;

  /** The DrippleX float, not a customer balance. Read by the low-balance
   * alarm. */
  getFloatBalance(): Promise<UtilityFloatBalance>;
}

/**
 * A provider failure that proves the request was never executed.
 *
 * The Utilities money path deliberately never reverses an `UNKNOWN` outcome:
 * a request that timed out may still have delivered, and refunding it would
 * give away airtime. That rule is right for a timeout and wrong for a
 * rejection. An auth failure, a missing configuration or a malformed request
 * is refused at the door — the DrippleX float cannot have moved, nothing was
 * delivered, and there is nothing ambiguous to reconcile.
 *
 * Collapsing both into UNKNOWN is what left a customer's card payment sitting
 * on "Still confirming" with the money kept and nothing delivered, while the
 * provider dashboard showed no transaction at all — because there had not
 * been one.
 */
export class UtilityProviderRejectedError extends Error {
  /** Discriminator: the request never reached execution. */
  public readonly neverExecuted = true;

  constructor(message: string) {
    super(message);
    this.name = 'UtilityProviderRejectedError';
  }
}

export function isProviderRejection(error: unknown): error is UtilityProviderRejectedError {
  return error instanceof UtilityProviderRejectedError;
}

export const UTILITY_PROVIDER = Symbol('UTILITY_PROVIDER');
