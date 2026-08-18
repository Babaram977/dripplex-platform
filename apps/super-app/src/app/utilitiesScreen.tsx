import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { api, ApiError } from '../lib/api';
import { playNotificationSound } from '../lib/sound';

import type {
  UtilityCablePlanDto,
  UtilityCatalogueDto,
  UtilityDataPlanDto,
  UtilityElectricityDiscoDto,
  UtilityNetworkDto,
  UtilityPaymentMethod,
  UtilityPurchaseDto,
  UtilityServiceType,
} from '../lib/api';

/**
 * Utilities — airtime, data, electricity and cable TV, through the Peyflex
 * hub.
 *
 * Three things here are load-bearing rather than decorative:
 *
 * 1. **The catalogues are read from the server, never hardcoded.** A baked-in
 *    plan list drifts out of step with what the provider will actually sell,
 *    and the first symptom is a customer paying for a bundle that no longer
 *    exists.
 * 2. **Amounts for plan-priced services are never sent from here.** The
 *    server prices a data or cable purchase from its own catalogue; this
 *    screen sends the plan id and shows what the server said it costs.
 * 3. **An electricity token is re-displayable.** It is the thing the customer
 *    bought — the receipt below can be reopened from history at any time, so
 *    closing the app does not lose it.
 */

const NAVY_BASE = '#050D1A';
const NAVY_CARD = '#0C1829';
const NAVY_SURFACE = '#0A1524';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.45)';
const WHITE = '#FFFFFF';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const C_ERR = '#EF4444';
const C_WARN = '#F59E0B';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

const SERVICES: { type: UtilityServiceType; label: string; icon: string; blurb: string }[] = [
  { type: 'AIRTIME', label: 'Airtime', icon: '📱', blurb: 'Top up any network' },
  { type: 'DATA', label: 'Data', icon: '🌐', blurb: 'Buy a data bundle' },
  { type: 'ELECTRICITY', label: 'Electricity', icon: '💡', blurb: 'Pay for power' },
  { type: 'CABLE_TV', label: 'Cable TV', icon: '📺', blurb: 'Renew a subscription' },
];

const naira = (amount: number): string => `₦${amount.toLocaleString('en-NG')}`;

// ── Chrome ──────────────────────────────────────────────────────────────────

function PageShell({
  title,
  onBack,
  action,
  children,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-[56px]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl active:scale-95"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={WHITE}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p
          style={{ fontFamily: PP, fontSize: 19, fontWeight: 700, color: WHITE, flex: 1 }}
          className="truncate"
        >
          {title}
        </p>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-10" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: IT,
        fontSize: 12,
        fontWeight: 600,
        color: MUTED,
        letterSpacing: '0.08em',
        margin: '18px 4px 10px',
      }}
    >
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode = 'numeric',
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, display: 'block', marginBottom: 6 }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => {
          onChange(
            inputMode === 'numeric'
              ? event.target.value.replace(/[^0-9]/g, '')
              : event.target.value,
          );
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-label={label}
        className="w-full rounded-xl px-4"
        style={{
          height: 52,
          background: NAVY_SURFACE,
          border: `1px solid ${BORDER}`,
          color: WHITE,
          fontFamily: IT,
          fontSize: 15,
          outline: 'none',
        }}
      />
      {hint ? (
        <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, marginTop: 5 }}>{hint}</p>
      ) : null}
    </div>
  );
}

function PrimaryBtn({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled === true || loading === true;
  return (
    <button
      onClick={onClick}
      disabled={off}
      className="flex h-[54px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold active:scale-[.99]"
      style={{
        fontFamily: PP,
        background: off ? 'rgba(255,255,255,.06)' : `linear-gradient(135deg,${G2},${G3})`,
        color: off ? 'rgba(255,255,255,.24)' : WHITE,
        border: 'none',
      }}
    >
      {loading === true ? 'Please wait…' : label}
    </button>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  const color = tone === 'error' ? C_ERR : tone === 'warn' ? C_WARN : G3;
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="rounded-xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${color}44`,
        marginBottom: 14,
      }}
    >
      <p style={{ fontFamily: IT, fontSize: 12.5, color, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

// ── Service picker ──────────────────────────────────────────────────────────

export function UtilitiesHomeScreen({
  onBack,
  onService,
  onHistory,
}: {
  onBack: () => void;
  /** `cardEnabled` is passed on from the catalogue this screen already
   * fetches, so the purchase screen does not have to ask again. */
  onService: (service: UtilityServiceType, cardEnabled: boolean) => void;
  onHistory: () => void;
}) {
  const [catalogue, setCatalogue] = useState<UtilityCatalogueDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api.utilities
      .getCatalogue()
      .then((next) => {
        if (live) setCatalogue(next);
      })
      .catch((cause: unknown) => {
        if (live)
          setError(cause instanceof ApiError ? cause.message : 'Could not load bill payments');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  // Says so rather than hiding: a tab that silently offers nothing reads as
  // broken. The server is the one that knows whether the provider is wired up.
  const unavailable = catalogue !== null && !catalogue.available;

  return (
    <PageShell
      title="Utilities"
      onBack={onBack}
      action={
        <button
          onClick={onHistory}
          className="rounded-xl px-3 py-2 active:scale-95"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            fontFamily: IT,
            fontSize: 12.5,
            color: WHITE,
          }}
        >
          History
        </button>
      }
    >
      {error !== null ? <Notice tone="error">{error}</Notice> : null}
      {unavailable ? (
        <Notice tone="warn">
          Bill payments are not switched on yet. Nothing here will take your money — check back
          shortly.
        </Notice>
      ) : null}

      <SectionLabel>WHAT WOULD YOU LIKE TO PAY?</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map((service) => (
          <button
            key={service.type}
            onClick={() => {
              onService(service.type, catalogue?.cardEnabled ?? false);
            }}
            disabled={loading || unavailable}
            className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left active:scale-[.98]"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              opacity: loading || unavailable ? 0.45 : 1,
            }}
          >
            <span style={{ fontSize: 26 }} aria-hidden>
              {service.icon}
            </span>
            <span style={{ fontFamily: PP, fontSize: 15, fontWeight: 600, color: WHITE }}>
              {service.label}
            </span>
            <span style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>{service.blurb}</span>
          </button>
        ))}
      </div>
    </PageShell>
  );
}

// ── Purchase ────────────────────────────────────────────────────────────────

interface PurchaseState {
  providers: (UtilityNetworkDto | UtilityElectricityDiscoDto)[];
  plans: (UtilityDataPlanDto | UtilityCablePlanDto)[];
}

export function UtilityPurchaseScreen({
  service,
  cardEnabled,
  onBack,
  onDone,
}: {
  service: UtilityServiceType;
  /** False when no card gateway is configured server-side. The Card option is
   * then not offered at all, rather than offered and failing after the
   * customer has chosen what to buy. */
  cardEnabled: boolean;
  onBack: () => void;
  onDone: (purchase: UtilityPurchaseDto) => void;
}) {
  const definition = SERVICES.find((entry) => entry.type === service) ?? SERVICES[0];

  const [state, setState] = useState<PurchaseState>({ providers: [], plans: [] });
  const [providerCode, setProviderCode] = useState('');
  const [planId, setPlanId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [paymentMethod, setPaymentMethod] = useState<UtilityPaymentMethod | 'CARD'>('WALLET');

  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPlan = service === 'DATA' || service === 'CABLE_TV';
  const needsVerification = service === 'ELECTRICITY' || service === 'CABLE_TV';

  const identifierLabel =
    service === 'ELECTRICITY'
      ? 'Meter number'
      : service === 'CABLE_TV'
        ? 'Smartcard / IUC number'
        : 'Phone number';

  const loadProviders = useCallback(async () => {
    setLoadingCatalogue(true);
    setError(null);
    try {
      const providers =
        service === 'AIRTIME'
          ? await api.utilities.airtimeNetworks()
          : service === 'DATA'
            ? await api.utilities.dataNetworks()
            : service === 'CABLE_TV'
              ? await api.utilities.cableProviders()
              : await api.utilities.electricityProviders();
      setState({ providers, plans: [] });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load providers');
    } finally {
      setLoadingCatalogue(false);
    }
  }, [service]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  // Plans belong to a provider, so they are refetched whenever the provider
  // changes rather than cached across a switch — a GOtv package list shown
  // under DStv is a purchase that fails at the provider.
  useEffect(() => {
    if (!needsPlan || providerCode === '') return;
    let live = true;
    setPlanId('');
    const request =
      service === 'DATA'
        ? api.utilities.dataPlans(providerCode)
        : api.utilities.cablePlans(providerCode);
    request
      .then((plans) => {
        if (live) setState((previous) => ({ ...previous, plans }));
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof ApiError ? cause.message : 'Could not load plans');
      });
    return () => {
      live = false;
    };
  }, [needsPlan, providerCode, service]);

  // A changed meter or smartcard invalidates the name we confirmed against it.
  useEffect(() => {
    setVerifiedName(null);
  }, [identifier, providerCode, meterType]);

  const selectedPlan = useMemo(
    () => state.plans.find((plan) => plan.id === planId) ?? null,
    [state.plans, planId],
  );

  const selectedDisco = useMemo(
    () =>
      service === 'ELECTRICITY'
        ? ((state.providers.find((entry) => 'minAmount' in entry && entry.code === providerCode) ??
            null) as UtilityElectricityDiscoDto | null)
        : null,
    [service, state.providers, providerCode],
  );

  const payable = needsPlan ? (selectedPlan?.amount ?? 0) : Number(amount || '0');

  const verify = async (): Promise<void> => {
    setVerifying(true);
    setError(null);
    try {
      const lookup =
        service === 'CABLE_TV'
          ? await api.utilities.verifyCable({
              provider: providerCode,
              smartcardNumber: identifier,
            })
          : await api.utilities.verifyElectricity({
              provider: providerCode,
              meterNumber: identifier,
              meterType,
            });
      setVerifiedName(lookup.customerName);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That number could not be verified');
    } finally {
      setVerifying(false);
    }
  };

  const canSubmit =
    providerCode !== '' &&
    identifier.length >= 6 &&
    (needsPlan ? planId !== '' : payable > 0) &&
    (!needsVerification || verifiedName !== null) &&
    !submitting;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.utilities.purchase({
        serviceType: service,
        provider: providerCode,
        customerIdentifier: identifier,
        ...(needsPlan ? { planId } : { amount: Number(amount) }),
        ...(service === 'ELECTRICITY' ? { meterType } : {}),
        paymentMethod,
      });

      if (result.authorizationUrl !== undefined && result.authorizationUrl !== '') {
        // Card. The provider is not touched until the gateway confirms, so
        // leaving now costs nothing.
        window.location.assign(result.authorizationUrl);
        return;
      }

      // Founder request (2026-08-18): a completed transaction makes a sound.
      playNotificationSound(result.purchase.status === 'SUCCESSFUL' ? 'success' : 'warning');
      onDone(result.purchase);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That purchase could not be completed');
      playNotificationSound('warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title={definition.label} onBack={onBack}>
      {error !== null ? <Notice tone="error">{error}</Notice> : null}

      <SectionLabel>PROVIDER</SectionLabel>
      {loadingCatalogue ? (
        <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Loading providers…</p>
      ) : state.providers.length === 0 ? (
        <Notice tone="warn">No providers are available right now. Please try again shortly.</Notice>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.providers.map((entry) => {
            const on = entry.code === providerCode;
            return (
              <button
                key={entry.code}
                onClick={() => {
                  setProviderCode(entry.code);
                }}
                className="rounded-xl px-4 py-3 active:scale-[.98]"
                style={{
                  background: on ? `linear-gradient(135deg,${G2},${G3})` : NAVY_CARD,
                  border: `1px solid ${on ? 'transparent' : BORDER}`,
                  fontFamily: PP,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: on ? WHITE : 'rgba(255,255,255,.75)',
                }}
              >
                {entry.name}
              </button>
            );
          })}
        </div>
      )}

      <SectionLabel>{identifierLabel.toUpperCase()}</SectionLabel>
      <Field
        label={identifierLabel}
        value={identifier}
        onChange={setIdentifier}
        placeholder={service === 'ELECTRICITY' ? '12345678901' : '08144216361'}
        maxLength={32}
      />

      {service === 'ELECTRICITY' ? (
        <div className="mb-3 flex gap-2">
          {(['prepaid', 'postpaid'] as const).map((option) => {
            const on = option === meterType;
            return (
              <button
                key={option}
                onClick={() => {
                  setMeterType(option);
                }}
                className="flex-1 rounded-xl py-3 active:scale-[.98]"
                style={{
                  background: on ? `linear-gradient(135deg,${G2},${G3})` : NAVY_CARD,
                  border: `1px solid ${on ? 'transparent' : BORDER}`,
                  fontFamily: IT,
                  fontSize: 13,
                  color: on ? WHITE : MUTED,
                  textTransform: 'capitalize',
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {needsVerification ? (
        <>
          {/* Confirming the name on the meter is the last chance to catch a
              mistyped digit before money moves. */}
          <button
            onClick={() => void verify()}
            disabled={providerCode === '' || identifier.length < 6 || verifying}
            className="mb-3 w-full rounded-xl py-3 active:scale-[.99]"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 13.5,
              color: providerCode === '' || identifier.length < 6 ? 'rgba(255,255,255,.24)' : WHITE,
            }}
          >
            {verifying ? 'Checking…' : 'Confirm the name on this account'}
          </button>
          {verifiedName !== null ? (
            <div
              className="mb-3 rounded-xl px-4 py-3"
              style={{ background: NAVY_CARD, border: `1px solid ${G3}44` }}
            >
              <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>Account name</p>
              <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 600, color: WHITE }}>
                {verifiedName}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {needsPlan ? (
        <>
          <SectionLabel>PLAN</SectionLabel>
          {providerCode === '' ? (
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Choose a provider first.</p>
          ) : state.plans.length === 0 ? (
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Loading plans…</p>
          ) : (
            <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
              {state.plans.map((plan) => {
                const on = plan.id === planId;
                return (
                  <button
                    key={plan.id}
                    onClick={() => {
                      setPlanId(plan.id);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    style={{
                      background: on ? 'rgba(43,172,82,.12)' : NAVY_CARD,
                      border: 'none',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: PP,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: on ? WHITE : 'rgba(255,255,255,.8)',
                        }}
                      >
                        {plan.label}
                      </span>
                      {'description' in plan && plan.description !== undefined ? (
                        <span
                          style={{ display: 'block', fontFamily: IT, fontSize: 11.5, color: MUTED }}
                        >
                          {plan.description}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: G3 }}>
                      {naira(plan.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <SectionLabel>AMOUNT</SectionLabel>
          <Field
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="1000"
            maxLength={7}
            hint={
              selectedDisco !== null
                ? // The provider publishes real per-disco bounds. Shown before
                  // payment, or the customer meets a rejection after paying.
                  `${selectedDisco.name} accepts ${naira(selectedDisco.minAmount)} – ${naira(
                    selectedDisco.maxAmount,
                  )}`
                : undefined
            }
          />
        </>
      )}

      <SectionLabel>PAY WITH</SectionLabel>
      <div className="mb-4 flex gap-2">
        {[
          { method: 'WALLET' as const, label: 'DrippleX Wallet' },
          // 'CARD', not a named gateway. Which one takes the money is the
          // server's decision, and hardcoding one here is what would break the
          // day its keys changed.
          ...(cardEnabled ? [{ method: 'CARD' as const, label: 'Card' }] : []),
        ].map((option) => {
          const on = option.method === paymentMethod;
          return (
            <button
              key={option.method}
              onClick={() => {
                setPaymentMethod(option.method);
              }}
              className="flex-1 rounded-xl py-3 active:scale-[.98]"
              style={{
                background: on ? `linear-gradient(135deg,${G2},${G3})` : NAVY_CARD,
                border: `1px solid ${on ? 'transparent' : BORDER}`,
                fontFamily: IT,
                fontSize: 13,
                color: on ? WHITE : MUTED,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {payable > 0 ? (
        <div
          className="mb-4 flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <span style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>You pay</span>
          <span style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: WHITE }}>
            {naira(payable)}
          </span>
        </div>
      ) : null}

      <PrimaryBtn
        label={payable > 0 ? `Pay ${naira(payable)}` : 'Continue'}
        onClick={() => void submit()}
        disabled={!canSubmit}
        loading={submitting}
      />
    </PageShell>
  );
}

// ── Receipt ─────────────────────────────────────────────────────────────────

export function UtilityReceiptScreen({
  purchase,
  onBack,
  onDone,
}: {
  purchase: UtilityPurchaseDto;
  onBack: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const succeeded = purchase.status === 'SUCCESSFUL';
  const unresolved = purchase.status === 'PENDING';

  const headline = succeeded
    ? 'Done'
    : unresolved
      ? 'Still confirming'
      : purchase.status === 'REVERSED'
        ? 'Not completed — money returned'
        : 'Not completed';

  const copyToken = (): void => {
    if (purchase.deliveredToken === null) return;
    void navigator.clipboard
      ?.writeText(purchase.deliveredToken)
      .then(() => {
        setCopied(true);
      })
      .catch(() => undefined);
  };

  return (
    <PageShell title="Receipt" onBack={onBack}>
      <div
        className="mb-4 rounded-2xl p-5 text-center"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${succeeded ? `${G3}44` : unresolved ? `${C_WARN}44` : BORDER}`,
        }}
      >
        <p style={{ fontSize: 34 }} aria-hidden>
          {succeeded ? '✅' : unresolved ? '⏳' : '⚠️'}
        </p>
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE, marginTop: 6 }}>
          {headline}
        </p>
        <p style={{ fontFamily: PP, fontSize: 26, fontWeight: 700, color: G3, marginTop: 8 }}>
          {naira(purchase.amountCharged)}
        </p>
        <p style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          {purchase.customerIdentifier}
        </p>
      </div>

      {/* A purchase the provider never answered for. Said plainly rather than
          shown as a failure: the money is not lost, and claiming otherwise
          sends the customer to buy the same thing twice. */}
      {unresolved ? (
        <Notice tone="warn">
          {purchase.failureReason ??
            'We could not confirm this purchase yet. Our team is checking it and will update you.'}
        </Notice>
      ) : null}

      {!succeeded && !unresolved && purchase.failureReason !== null ? (
        <Notice tone="error">{purchase.failureReason}</Notice>
      ) : null}

      {/* The token IS the thing they bought. Kept on the receipt, and the
          receipt is reachable from history forever, so closing the app does
          not lose it. */}
      {purchase.deliveredToken !== null ? (
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${G3}44` }}
        >
          <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>Your token</p>
          <p
            style={{
              fontFamily: PP,
              fontSize: 19,
              fontWeight: 700,
              color: WHITE,
              letterSpacing: '0.06em',
              wordBreak: 'break-all',
              margin: '4px 0 10px',
            }}
          >
            {purchase.deliveredToken}
          </p>
          <button
            onClick={copyToken}
            className="rounded-xl px-4 py-2 active:scale-95"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 12.5,
              color: WHITE,
            }}
          >
            {copied ? 'Copied' : 'Copy token'}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
        <ReceiptRow label="Service" value={labelForService(purchase.serviceType)} />
        <ReceiptRow
          label="Paid with"
          value={purchase.paymentMethod === 'WALLET' ? 'Wallet' : 'Card'}
        />
        {purchase.providerReference !== null ? (
          <ReceiptRow label="Reference" value={purchase.providerReference} />
        ) : null}
        <ReceiptRow label="Date" value={new Date(purchase.createdAt).toLocaleString('en-NG')} />
      </div>

      <div style={{ height: 16 }} />
      <PrimaryBtn label="Done" onClick={onDone} />
    </PageShell>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ background: NAVY_CARD, borderBottom: `1px solid ${BORDER}` }}
    >
      <span style={{ fontFamily: IT, fontSize: 12.5, color: MUTED }}>{label}</span>
      <span
        style={{ fontFamily: IT, fontSize: 13, color: WHITE, maxWidth: '60%', textAlign: 'right' }}
        className="truncate"
      >
        {value}
      </span>
    </div>
  );
}

function labelForService(service: UtilityServiceType): string {
  return SERVICES.find((entry) => entry.type === service)?.label ?? service;
}

// ── History ─────────────────────────────────────────────────────────────────

export function UtilityHistoryScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (purchase: UtilityPurchaseDto) => void;
}) {
  const [items, setItems] = useState<UtilityPurchaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.utilities
      .history({ page: 1, pageSize: 50 })
      .then((page) => {
        if (live) setItems(page.items);
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof ApiError ? cause.message : 'Could not load history');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageShell title="Bill payments" onBack={onBack}>
      {error !== null ? <Notice tone="error">{error}</Notice> : null}
      {loading ? (
        <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginTop: 20 }}>Loading…</p>
      ) : items.length === 0 ? (
        // Says the truth rather than showing invented rows.
        <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginTop: 20 }}>
          You have not made a bill payment yet.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
          {items.map((purchase) => (
            <button
              key={purchase.id}
              onClick={() => {
                onOpen(purchase);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              style={{ background: NAVY_CARD, border: 'none', borderBottom: `1px solid ${BORDER}` }}
            >
              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: PP,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: WHITE,
                  }}
                >
                  {labelForService(purchase.serviceType)} · {purchase.customerIdentifier}
                </span>
                <span style={{ display: 'block', fontFamily: IT, fontSize: 11.5, color: MUTED }}>
                  {new Date(purchase.createdAt).toLocaleDateString('en-NG')} ·{' '}
                  {statusLabel(purchase.status)}
                </span>
              </span>
              <span
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: purchase.status === 'SUCCESSFUL' ? G3 : MUTED,
                }}
              >
                {naira(purchase.amountCharged)}
              </span>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}

/** Plain words, not enum names. "REVERSED" means nothing to a customer; "money
 * returned" does. */
function statusLabel(status: UtilityPurchaseDto['status']): string {
  switch (status) {
    case 'SUCCESSFUL':
      return 'Delivered';
    case 'PENDING':
      return 'Confirming';
    case 'AWAITING_PAYMENT':
      return 'Awaiting payment';
    case 'REVERSED':
      return 'Money returned';
    default:
      return 'Not completed';
  }
}
