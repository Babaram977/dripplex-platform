import { Injectable, Logger } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import {
  UTILITY_CATALOGUE_CACHE_TTL_MS,
  UTILITY_FLOAT_EXHAUSTED_MARKERS,
  UTILITY_PROVIDER_TIMEOUT_MS,
} from '../utilities.constants';

import { UtilityProviderRejectedError } from './utility-provider.port';

import type {
  UtilityCablePlan,
  UtilityCustomerLookup,
  UtilityDataPlan,
  UtilityElectricityDisco,
  UtilityFloatBalance,
  UtilityNetwork,
  UtilityProviderPort,
  UtilityPurchaseRequest,
  UtilityPurchaseResult,
} from './utility-provider.port';

/**
 * Peyflex, as documented in DPX-UTILITIES-002.
 *
 * Every quirk of their wire format is absorbed here and nowhere else:
 *
 * - **Trailing slashes are required** on every path (Django convention).
 * - **HTTP status is not the outcome.** `POST /api/electricity/subscribe/`
 *   returns HTTP 200 carrying `{"status":"FAILED"}`, while cable returns HTTP
 *   400 for the same kind of failure. Only the body's `status` field is read.
 * - **`identifier` in some places, `id` in others** — airtime networks come
 *   back keyed `id`, data networks keyed `identifier`.
 * - **Absurd decimal precision** — `charged` arrives as
 *   `98.99999999999999997918331829`. Rounded to kobo once, here, rather than
 *   drifting through the arithmetic downstream.
 */

interface PeyflexPurchaseResponse {
  status?: string;
  message?: string;
  reference?: string;
  amount?: string | number;
  charged?: string | number;
  discount?: string | number;
  balance?: string | number;
  token?: string;
  transaction_id?: string | number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class PeyflexUtilityProvider implements UtilityProviderPort {
  private readonly logger = new Logger(PeyflexUtilityProvider.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly config: AppConfigService) {}

  public get configured(): boolean {
    return this.config.peyflexConfigured;
  }

  // ── Catalogues ────────────────────────────────────────────────────────────

  public async listAirtimeNetworks(): Promise<UtilityNetwork[]> {
    return await this.cached('airtime-networks', async () => {
      const body = await this.request<{ networks?: { id?: string; name?: string }[] }>(
        'GET',
        '/api/airtime/networks/',
      );
      return (body.networks ?? [])
        .filter((entry): entry is { id: string; name: string } => Boolean(entry.id && entry.name))
        .map((entry) => ({ code: entry.id, name: entry.name }));
    });
  }

  public async listDataNetworks(): Promise<UtilityNetwork[]> {
    return await this.cached('data-networks', async () => {
      // Note `identifier`, not `id` — airtime and data disagree, and reading
      // the wrong key here yields a list of nameless blanks.
      const body = await this.request<{ networks?: { identifier?: string; name?: string }[] }>(
        'GET',
        '/api/data/networks/',
      );
      return (body.networks ?? [])
        .filter((entry): entry is { identifier: string; name: string } =>
          Boolean(entry.identifier && entry.name),
        )
        .map((entry) => ({ code: entry.identifier, name: entry.name }));
    });
  }

  public async listDataPlans(networkCode: string): Promise<UtilityDataPlan[]> {
    return await this.cached(`data-plans:${networkCode}`, async () => {
      const body = await this.request<{
        plans?: { plan_code?: string; amount?: string | number; label?: string }[];
      }>('GET', `/api/data/plans/?network=${encodeURIComponent(networkCode)}`);

      return (body.plans ?? [])
        .map((plan) => {
          const amount = toNumber(plan.amount);
          if (!plan.plan_code || amount === null) return null;
          return {
            id: composePlanId(plan.plan_code, amount),
            planCode: plan.plan_code,
            amount,
            label: plan.label ?? plan.plan_code,
          };
        })
        .filter((plan): plan is UtilityDataPlan => plan !== null);
    });
  }

  public async listCableProviders(): Promise<UtilityNetwork[]> {
    return await this.cached('cable-providers', async () => {
      const body = await this.request<{ providers?: { identifier?: string; name?: string }[] }>(
        'GET',
        '/api/cable/providers/',
      );
      return (body.providers ?? [])
        .filter((entry): entry is { identifier: string; name: string } =>
          Boolean(entry.identifier && entry.name),
        )
        .map((entry) => ({ code: entry.identifier, name: entry.name }));
    });
  }

  public async listCablePlans(providerCode: string): Promise<UtilityCablePlan[]> {
    return await this.cached(`cable-plans:${providerCode}`, async () => {
      const body = await this.request<{
        plans?: {
          plan_code?: string;
          amount?: string | number;
          display?: string;
          description?: string;
        }[];
      }>('GET', `/api/cable/plans/${encodeURIComponent(providerCode)}/`);

      return (body.plans ?? [])
        .map((plan) => {
          const amount = toNumber(plan.amount);
          if (!plan.plan_code || amount === null) return null;
          return {
            id: composePlanId(plan.plan_code, amount),
            planCode: plan.plan_code,
            amount,
            label: plan.display ?? plan.plan_code,
            ...(plan.description !== undefined ? { description: plan.description } : {}),
          };
        })
        .filter((plan): plan is UtilityCablePlan => plan !== null);
    });
  }

  public async listElectricityDiscos(): Promise<UtilityElectricityDisco[]> {
    return await this.cached('electricity-discos', async () => {
      const body = await this.request<{
        plans?: {
          plan_code?: string;
          plan_name?: string;
          min_amount?: string | number;
          max_amount?: string | number;
        }[];
      }>('GET', '/api/electricity/plans/?identifier=electricity');

      return (body.plans ?? [])
        .map((plan) => {
          if (!plan.plan_code) return null;
          return {
            code: plan.plan_code,
            name: plan.plan_name ?? plan.plan_code,
            // Peyflex publishes real per-disco bounds; the fallbacks only
            // apply if a row omits them, and they are wide enough not to
            // reject a legitimate top-up on their own.
            minAmount: toNumber(plan.min_amount) ?? 100,
            maxAmount: toNumber(plan.max_amount) ?? 500_000,
          };
        })
        .filter((disco): disco is UtilityElectricityDisco => disco !== null);
    });
  }

  // ── Verification ──────────────────────────────────────────────────────────

  public async verifyCableCustomer(
    providerCode: string,
    smartcardNumber: string,
  ): Promise<UtilityCustomerLookup> {
    // Cable verifies by POST with a JSON body; electricity verifies by GET
    // with query parameters. The two are not symmetrical.
    const body = await this.request<{
      status?: string;
      customer_name?: string;
      iuc?: string;
      provider?: string;
      message?: string;
    }>('POST', '/api/cable/verify/', { iuc: smartcardNumber, identifier: providerCode });

    if (!body.customer_name) {
      throw new ValidationDomainException(
        body.message ?? 'That smartcard number could not be verified',
      );
    }
    return {
      customerName: body.customer_name,
      identifier: body.iuc ?? smartcardNumber,
      ...(body.provider !== undefined ? { providerName: body.provider } : {}),
    };
  }

  public async verifyElectricityCustomer(
    discoCode: string,
    meterNumber: string,
    meterType: 'prepaid' | 'postpaid',
  ): Promise<UtilityCustomerLookup> {
    const query = new URLSearchParams({
      identifier: 'electricity',
      meter: meterNumber,
      plan: discoCode,
      type: meterType,
    });
    const body = await this.request<{
      status?: string;
      customer_name?: string;
      message?: string;
    }>('GET', `/api/electricity/verify/?${query.toString()}`);

    if (!body.customer_name) {
      throw new ValidationDomainException(body.message ?? 'That meter could not be verified');
    }
    return { customerName: body.customer_name, identifier: meterNumber };
  }

  // ── Purchases ─────────────────────────────────────────────────────────────

  public async purchaseAirtime(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult> {
    return await this.purchase('/api/airtime/topup/', {
      network: request.providerCode,
      amount: request.amount,
      mobile_number: request.customerIdentifier,
    });
  }

  public async purchaseData(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult> {
    return await this.purchase('/api/data/purchase/', {
      network: request.providerCode,
      mobile_number: request.customerIdentifier,
      plan_code: request.planCode,
    });
  }

  public async purchaseCable(request: UtilityPurchaseRequest): Promise<UtilityPurchaseResult> {
    // `amount` is absent from the documented body but present in the
    // founder's own working curl (G7). Sent: a field Peyflex ignores costs
    // nothing, a field it needs and does not get costs a failed purchase.
    return await this.purchase('/api/cable/subscribe/', {
      identifier: request.providerCode,
      plan: request.planCode,
      iuc: request.customerIdentifier,
      phone: request.contactPhone ?? request.customerIdentifier,
      amount: request.amount,
    });
  }

  public async purchaseElectricity(
    request: UtilityPurchaseRequest,
  ): Promise<UtilityPurchaseResult> {
    return await this.purchase('/api/electricity/subscribe/', {
      identifier: 'electricity',
      meter: request.customerIdentifier,
      plan: request.providerCode,
      amount: request.amount,
      type: request.meterType ?? 'prepaid',
      phone: request.contactPhone ?? request.customerIdentifier,
    });
  }

  public async getFloatBalance(): Promise<UtilityFloatBalance> {
    const body = await this.request<{ wallet_credit?: string | number }>(
      'GET',
      '/api/wallet/balance/',
    );
    return { balance: toNumber(body.wallet_credit) ?? 0, currency: 'NGN' };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * The one place a purchase outcome is decided.
   *
   * Three outcomes, not two. `UNKNOWN` is what a timeout or an unreadable
   * response becomes, and it is the reason the caller must not reverse: with
   * no idempotency key and no status lookup (G1/G2), a timed-out purchase may
   * or may not have spent the float, and only a human looking at the Peyflex
   * dashboard can say which.
   */
  private async purchase(
    path: string,
    body: Record<string, unknown>,
  ): Promise<UtilityPurchaseResult> {
    let response: PeyflexPurchaseResponse;
    try {
      response = await this.request<PeyflexPurchaseResponse>('POST', path, body, {
        // A purchase POST must not throw on a non-2xx: cable signals failure
        // with HTTP 400 and a perfectly readable body that names the reason.
        // Throwing here would turn a known failure into an UNKNOWN and strand
        // the customer's money in a manual queue for no reason.
        acceptErrorStatus: true,
      });
    } catch (error) {
      this.logger.error(
        `Peyflex ${path} did not answer: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        outcome: 'UNKNOWN',
        providerMessage: 'The provider did not respond',
      };
    }

    const status = (response.status ?? '').toUpperCase();
    const message = response.message ?? '';

    if (status === 'SUCCESS') {
      const cost = toNumber(response.charged);
      return {
        outcome: 'SUCCESS',
        ...(response.reference !== undefined ? { providerReference: response.reference } : {}),
        ...(cost !== null ? { providerCost: roundToKobo(cost) } : {}),
        ...(isUsableToken(response.token) ? { deliveredToken: response.token } : {}),
        ...(message ? { providerMessage: message } : {}),
        raw: response,
      };
    }

    // A body with no `status` at all is not a declared failure — it is an
    // answer we cannot read, which is the UNKNOWN case.
    if (!status) {
      return {
        outcome: 'UNKNOWN',
        providerMessage: message || 'Unreadable provider response',
        raw: response,
      };
    }

    return {
      outcome: 'FAILED',
      ...(response.reference !== undefined ? { providerReference: response.reference } : {}),
      ...(message ? { providerMessage: message } : {}),
      floatExhausted: isFloatExhausted(message),
      raw: response,
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    options: { acceptErrorStatus?: boolean } = {},
  ): Promise<T> {
    const token = this.config.peyflexApiToken;
    if (!token) {
      // Nothing was sent, so nothing can have been delivered.
      throw new UtilityProviderRejectedError('Peyflex is not configured');
    }

    const baseUrl = this.config.peyflexBaseUrl.replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, UTILITY_PROVIDER_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          // `Token`, not `Bearer` — Django REST Framework's scheme.
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok && !(options.acceptErrorStatus && parsed !== null)) {
        const detail = `Peyflex request failed (${String(response.status)}): ${text.slice(0, 200)}`;
        // 401/403 mean the token is wrong or revoked; 4xx generally means the
        // request was refused at the door. Either way Peyflex did not process
        // it, the float did not move, and the customer must get their money
        // back rather than be parked on "Still confirming" forever. A 5xx or a
        // timeout stays ambiguous and is handled by the caller as UNKNOWN.
        if (response.status >= 400 && response.status < 500) {
          throw new UtilityProviderRejectedError(detail);
        }
        throw new ValidationDomainException(detail);
      }
      if (parsed === null) {
        throw new ValidationDomainException('Peyflex returned an unreadable response');
      }
      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
    const value = await load();
    this.cache.set(key, { value, expiresAt: Date.now() + UTILITY_CATALOGUE_CACHE_TTL_MS });
    return value;
  }
}

// ── Wire-format helpers ─────────────────────────────────────────────────────

/** Peyflex sends numbers as strings, and sometimes at 28 significant figures.
 * Anything unparseable becomes null rather than NaN, so a missing field can
 * never silently poison an amount. */
export function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Money is rounded to kobo at exactly one point — here — rather than
 * drifting through the arithmetic. */
export function roundToKobo(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `plan_code` is not unique (G5): `M2GBS` is both a ₦800 2-day bundle and a
 * ₦1,505 monthly one. The composite is what the client selects by. */
export function composePlanId(planCode: string, amount: number): string {
  return `${planCode}:${String(roundToKobo(amount))}`;
}

export function decomposePlanId(id: string): { planCode: string; amount: number } | null {
  const separator = id.lastIndexOf(':');
  if (separator <= 0) return null;
  const planCode = id.slice(0, separator);
  const amount = Number.parseFloat(id.slice(separator + 1));
  return Number.isFinite(amount) ? { planCode, amount } : null;
}

/** The published electricity failure carries `token: "Please contact Admin
 * for Token"`. That is prose, not a token, and storing it would show the
 * customer a meter code that does nothing. */
export function isUsableToken(token: string | undefined): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  if (trimmed.length === 0) return false;
  return !/contact\s+admin/i.test(trimmed);
}

/** Whether a provider message means the DrippleX float is dry rather than
 * anything about this customer. */
export function isFloatExhausted(message: string): boolean {
  const lowered = message.toLowerCase();
  return UTILITY_FLOAT_EXHAUSTED_MARKERS.some((marker) => lowered.includes(marker));
}
