import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { api, ApiError } from '../lib/api';
import { gatewayCallbackUrl, rememberGatewayReturn } from '../lib/gatewayReturn';
import { playNotificationSound } from '../lib/sound';

import { Icon, type IconName } from './icons';

import type {
  CardProviderOptionDto,
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
 * Utilities — airtime, data, electricity, cable TV, betting top-ups and exam
 * PINs, through the Peyflex hub.
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
 * 3. **A delivered token is re-displayable.** An electricity token or an exam
 *    PIN IS the thing the customer bought — the receipt below can be reopened
 *    from history at any time, so closing the app does not lose it.
 * 4. **Betting is verified before it is funded.** The server re-verifies too;
 *    this screen shows the account holder's name so the customer can stop
 *    before paying, because a top-up sent to the wrong id cannot be recalled.
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

const SERVICES: { type: UtilityServiceType; label: string; icon: IconName; blurb: string }[] = [
  { type: 'AIRTIME', label: 'Airtime', icon: 'airtime', blurb: 'Top up any network' },
  { type: 'DATA', label: 'Data', icon: 'data', blurb: 'Buy a data bundle' },
  { type: 'ELECTRICITY', label: 'Electricity', icon: 'electricity', blurb: 'Pay for power' },
  { type: 'CABLE_TV', label: 'Cable TV', icon: 'cableTv', blurb: 'Renew a subscription' },
  { type: 'BETTING', label: 'Betting', icon: 'betting', blurb: 'Fund your account' },
  { type: 'EDUCATION', label: 'Exam PINs', icon: 'education', blurb: 'WAEC, NECO, NABTEB' },
];

/** Exam PINs are all filed under one provider, so there is no provider step —
 *  this is the code the backend expects on the purchase. */
const EDUCATION_PROVIDER_CODE = 'education';

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

/**
 * A collapsed chooser: the current selection, a chevron, and the options only
 * once you ask for them.
 *
 * Founder feedback, 2026-08-19 — the option lists were rendered flat, so eleven
 * electricity discos or a full MTN data catalogue pushed the amount field, the
 * pay-with row and the Pay button off the bottom of the phone. On a screen where
 * the thing you came to do is at the end, a list that never collapses hides it.
 */
function Picker({
  placeholder,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  placeholder: string;
  options: { id: string; label: string; trailing?: string }[];
  value: string;
  onChange: (next: string) => void;
  /** Shown in place of the list when there is nothing to choose from yet. */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value) ?? null;

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => {
          setOpen((previous) => !previous);
        }}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 active:scale-[.99]"
        style={{ background: NAVY_CARD, border: `1px solid ${open ? `${G3}66` : BORDER}` }}
      >
        <span
          className="flex-1 text-left"
          style={{
            fontFamily: selected ? PP : IT,
            fontSize: 14,
            fontWeight: selected ? 600 : 400,
            color: selected ? WHITE : 'rgba(255,255,255,.42)',
          }}
        >
          {selected?.label ?? placeholder}
        </span>
        {selected?.trailing !== undefined ? (
          <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: G3 }}>
            {selected.trailing}
          </span>
        ) : null}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .18s ease',
            flexShrink: 0,
          }}
        >
          <path
            d="M3 5.5L7 9.5L11 5.5"
            stroke={MUTED}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="mt-2 overflow-y-auto rounded-2xl"
          style={{ border: `1px solid ${BORDER}`, maxHeight: 260 }}
        >
          {options.length === 0 ? (
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, padding: '14px 16px' }}>
              {emptyLabel ?? 'Nothing to choose from yet.'}
            </p>
          ) : (
            options.map((option) => {
              const on = option.id === value;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[.99]"
                  style={{
                    background: on ? `${G3}1F` : NAVY_CARD,
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span
                    className="flex-1"
                    style={{
                      fontFamily: IT,
                      fontSize: 13.5,
                      color: on ? WHITE : 'rgba(255,255,255,.78)',
                    }}
                  >
                    {option.label}
                  </span>
                  {option.trailing !== undefined ? (
                    <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: G3 }}>
                      {option.trailing}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Whether a lookup actually came back with something that confirms the
 * account, rather than a placeholder.
 *
 * The hub returns a 200 with "Unknown", "N/A" or a blank for a number it
 * cannot resolve. Rendering that as the account name tells the customer their
 * typo was confirmed.
 *
 * `requireLetters` is the part that differs by service, and getting it wrong
 * broke every SportyBet verification:
 *
 * - A **meter or smartcard** lookup that echoes the number back has resolved
 *   nothing — a real customer name has letters in it, so letters are required.
 * - A **bookmaker** account is often identified BY the phone number, and
 *   Peyflex's own worked example returns `name: "08105867169"` alongside
 *   `"message": "Customer verified."`. Demanding letters there rejects a
 *   perfectly good confirmation and tells the customer their correct number
 *   is wrong.
 */
const UNUSABLE_ACCOUNT_NAMES = new Set(['unknown', 'n/a', 'na', 'not available', 'null', '-']);

function isUsableAccountName(
  name: string | null | undefined,
  requireLetters: boolean,
): name is string {
  if (name === null || name === undefined) return false;
  const trimmed = name.trim();
  if (trimmed === '') return false;
  if (UNUSABLE_ACCOUNT_NAMES.has(trimmed.toLowerCase())) return false;
  return requireLetters ? /\p{L}/u.test(trimmed) : true;
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
  /** `cardEnabled` and `maxPinQuantity` are passed on from the catalogue this
   * screen already fetches, so the purchase screen does not have to ask
   * again — and so the PIN cap is the SERVER's number rather than a second
   * copy of it that can drift. */
  onService: (service: UtilityServiceType, cardEnabled: boolean, maxPinQuantity: number) => void;
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
              onService(
                service.type,
                catalogue?.cardEnabled ?? false,
                catalogue?.educationMaxQuantity ?? 1,
              );
            }}
            disabled={loading || unavailable}
            className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left active:scale-[.98]"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              opacity: loading || unavailable ? 0.45 : 1,
            }}
          >
            <Icon name={service.icon} size={26} color={G3} />
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
  maxPinQuantity,
  onBack,
  onDone,
}: {
  service: UtilityServiceType;
  /** False when no card gateway is configured server-side. The Card option is
   * then not offered at all, rather than offered and failing after the
   * customer has chosen what to buy. */
  cardEnabled: boolean;
  /** The server's own ceiling on exam PINs per purchase. Threaded rather than
   * redeclared here: two copies of a limit is how a stepper lets a customer
   * pick a quantity the backend then refuses. */
  maxPinQuantity: number;
  onBack: () => void;
  onDone: (purchase: UtilityPurchaseDto) => void;
}) {
  const definition = SERVICES.find((entry) => entry.type === service) ?? SERVICES[0];

  const [state, setState] = useState<PurchaseState>({ providers: [], plans: [] });
  const [providerCode, setProviderCode] = useState('');
  const [planId, setPlanId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  /** Exam PINs only. Held as a number because it multiplies a price — a
   *  string here is how a total becomes "53505350". */
  const [quantity, setQuantity] = useState(1);
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [paymentMethod, setPaymentMethod] = useState<UtilityPaymentMethod | 'CARD'>('WALLET');
  // Which gateways can take money right now. Read from the server rather than
  // listed here: the customer chooses between them (founder, 2026-08-18), and a
  // hardcoded list would show a dead button the day a key is rotated.
  const [cardProviders, setCardProviders] = useState<CardProviderOptionDto[]>([]);

  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPlan = service === 'DATA' || service === 'CABLE_TV' || service === 'EDUCATION';
  const needsVerification =
    service === 'ELECTRICITY' || service === 'CABLE_TV' || service === 'BETTING';
  // Exam PINs are the only thing bought by the unit.
  const needsQuantity = service === 'EDUCATION';
  // Exam PINs have exactly one provider, so asking the customer to pick it
  // would be a step that decides nothing.
  const needsProvider = service !== 'EDUCATION';

  const identifierLabel =
    service === 'ELECTRICITY'
      ? 'Meter number'
      : service === 'CABLE_TV'
        ? 'Smartcard / IUC number'
        : service === 'BETTING'
          ? 'Betting account ID or username'
          : 'Phone number';

  /** Bookmakers identify customers by username as often as by phone, and a
   *  username can be short. Everything else in this screen is a Nigerian
   *  phone, meter or smartcard number and is never shorter than six digits. */
  const minIdentifierLength = service === 'BETTING' ? 3 : 6;

  const loadProviders = useCallback(async () => {
    setLoadingCatalogue(true);
    setError(null);
    try {
      if (!needsProvider) {
        // Exam PINs: skip straight to the plans, with the provider fixed.
        const plans = await api.utilities.educationPlans();
        setProviderCode(EDUCATION_PROVIDER_CODE);
        setState({
          providers: [],
          // The screen's plan list is priced by `amount`; an exam PIN is
          // priced per unit, so the unit price is mapped in here and the
          // quantity is applied when the total is worked out.
          plans: plans.map((plan) => ({
            id: plan.id,
            planCode: plan.planCode,
            amount: plan.unitPrice,
            label: plan.label,
          })),
        });
        return;
      }
      const providers =
        service === 'AIRTIME'
          ? await api.utilities.airtimeNetworks()
          : service === 'DATA'
            ? await api.utilities.dataNetworks()
            : service === 'CABLE_TV'
              ? await api.utilities.cableProviders()
              : service === 'BETTING'
                ? await api.utilities.bettingProviders()
                : await api.utilities.electricityProviders();
      setState({ providers, plans: [] });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load providers');
    } finally {
      setLoadingCatalogue(false);
    }
  }, [service, needsProvider]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!cardEnabled) return;
    let live = true;
    api.payments
      .providers()
      .then((config) => {
        if (live) setCardProviders(config.cardProviders);
      })
      .catch(() => {
        // Card simply does not appear if we cannot confirm what is live.
        if (live) setCardProviders([]);
      });
    return () => {
      live = false;
    };
  }, [cardEnabled]);

  // Plans belong to a provider, so they are refetched whenever the provider
  // changes rather than cached across a switch — a GOtv package list shown
  // under DStv is a purchase that fails at the provider.
  useEffect(() => {
    if (!needsPlan || !needsProvider || providerCode === '') return;
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
  }, [needsPlan, needsProvider, providerCode, service]);

  // A changed meter or smartcard invalidates the name we confirmed against it.
  useEffect(() => {
    setVerifiedName(null);
  }, [identifier, providerCode, meterType]);

  const selectedPlan = useMemo(
    () => state.plans.find((plan) => plan.id === planId) ?? null,
    [state.plans, planId],
  );

  /** The chosen provider's display name — "SportyBet", not "Betting". */
  const selectedProviderName = useMemo(
    () => state.providers.find((entry) => entry.code === providerCode)?.name ?? '',
    [state.providers, providerCode],
  );

  const selectedDisco = useMemo(
    () =>
      service === 'ELECTRICITY'
        ? ((state.providers.find((entry) => 'minAmount' in entry && entry.code === providerCode) ??
            null) as UtilityElectricityDiscoDto | null)
        : null,
    [service, state.providers, providerCode],
  );

  // Exam PINs are the only service where the plan price is a UNIT price.
  const payable = needsPlan
    ? (selectedPlan?.amount ?? 0) * (needsQuantity ? quantity : 1)
    : Number(amount || '0');

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
          : service === 'BETTING'
            ? await api.utilities.verifyBetting({
                provider: providerCode,
                customerId: identifier,
              })
            : await api.utilities.verifyElectricity({
                provider: providerCode,
                meterNumber: identifier,
                meterType,
              });
      // Betting is the exception: a bookmaker that identifies its customers
      // by phone has no other name to give back.
      if (isUsableAccountName(lookup.customerName, service !== 'BETTING')) {
        setVerifiedName(lookup.customerName);
      } else {
        // The hub answered, but with a placeholder rather than a name — the
        // founder's test showed "Account name: Unknown" presented as if it were
        // a confirmation, on a screen whose whole job is to catch a mistyped
        // meter number before ₦1,000 leaves. A name we do not have is not a
        // confirmation, so this stays unverified and the Pay button stays shut.
        setVerifiedName(null);
        setError(
          service === 'BETTING'
            ? 'We could not find that betting account. Check the ID and try again — nothing has been charged.'
            : 'We could not confirm a name for that number. Check the digits and try again — nothing has been charged.',
        );
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That number could not be verified');
    } finally {
      setVerifying(false);
    }
  };

  const canSubmit =
    providerCode !== '' &&
    identifier.length >= minIdentifierLength &&
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
        ...(needsQuantity ? { quantity } : {}),
        ...(service === 'ELECTRICITY' ? { meterType } : {}),
        paymentMethod,
        // Without this the gateway leaves the customer on its own success
        // page — paid, with no airtime and no way back into the app.
        callbackUrl: gatewayCallbackUrl('utility'),
      });

      if (result.authorizationUrl !== undefined && result.authorizationUrl !== '') {
        // Card. The provider is not touched until the gateway confirms, so
        // leaving now costs nothing. The purchase id is kept so the app can
        // show the receipt the moment the customer lands back here.
        rememberGatewayReturn('utility', result.purchase.id);
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

      {needsProvider ? <SectionLabel>PROVIDER</SectionLabel> : null}
      {!needsProvider ? null : loadingCatalogue ? (
        <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Loading providers…</p>
      ) : state.providers.length === 0 ? (
        <Notice tone="warn">No providers are available right now. Please try again shortly.</Notice>
      ) : (
        <Picker
          placeholder="Choose a provider"
          value={providerCode}
          onChange={setProviderCode}
          options={state.providers.map((entry) => ({ id: entry.code, label: entry.name }))}
        />
      )}

      <SectionLabel>{identifierLabel.toUpperCase()}</SectionLabel>
      <Field
        label={identifierLabel}
        value={identifier}
        onChange={setIdentifier}
        placeholder={
          service === 'ELECTRICITY'
            ? '12345678901'
            : service === 'BETTING'
              ? 'Your bookmaker ID or username'
              : '08144216361'
        }
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
            disabled={providerCode === '' || identifier.length < minIdentifierLength || verifying}
            className="mb-3 w-full rounded-xl py-3 active:scale-[.99]"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 13.5,
              color:
                providerCode === '' || identifier.length < minIdentifierLength
                  ? 'rgba(255,255,255,.24)'
                  : WHITE,
            }}
          >
            {verifying ? 'Checking…' : 'Confirm the name on this account'}
          </button>
          {verifiedName !== null ? (
            <div
              className="mb-3 rounded-xl px-4 py-3"
              style={{ background: NAVY_CARD, border: `1px solid ${G3}44` }}
            >
              {/* When the bookmaker gives back the account id rather than a
                  person — which is what SportyBet does, because that IS how it
                  identifies customers — calling it "Account name" would
                  present a phone number as somebody's name. Say what was
                  actually established instead. */}
              <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>
                {verifiedName === identifier ? 'Account found' : 'Account name'}
              </p>
              <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 600, color: WHITE }}>
                {verifiedName === identifier
                  ? `${selectedProviderName} account ${verifiedName}`.trim()
                  : verifiedName}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {needsPlan ? (
        <>
          <SectionLabel>PLAN</SectionLabel>
          <Picker
            placeholder={providerCode === '' ? 'Choose a provider first' : 'Choose a plan'}
            value={planId}
            onChange={setPlanId}
            emptyLabel={providerCode === '' ? 'Choose a provider first.' : 'Loading plans…'}
            options={state.plans.map((plan) => ({
              id: plan.id,
              label: plan.label,
              trailing: needsQuantity ? `${naira(plan.amount)} each` : naira(plan.amount),
            }))}
          />
          {needsQuantity ? (
            <>
              <SectionLabel>HOW MANY</SectionLabel>
              <div className="mb-4 flex items-center gap-3">
                {([-1, 1] as const).map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      setQuantity((current) =>
                        Math.min(maxPinQuantity, Math.max(1, current + step)),
                      );
                    }}
                    className="rounded-xl active:scale-[.96]"
                    style={{
                      width: 46,
                      height: 46,
                      background: NAVY_CARD,
                      border: `1px solid ${BORDER}`,
                      fontFamily: PP,
                      fontSize: 20,
                      color: WHITE,
                      flexShrink: 0,
                    }}
                    aria-label={step === 1 ? 'One more PIN' : 'One fewer PIN'}
                  >
                    {step === 1 ? '+' : '−'}
                  </button>
                ))}
                <div className="flex-1 text-center">
                  <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 600, color: WHITE }}>
                    {quantity}
                  </p>
                  <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>
                    {quantity === 1 ? 'PIN' : 'PINs'}
                  </p>
                </div>
              </div>
              {/* The total is the thing the customer is agreeing to, and it is
                  a multiplication they did not do. Shown before the Pay button,
                  not on the receipt afterwards. */}
              {selectedPlan !== null ? (
                <div
                  className="mb-4 flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
                >
                  <span style={{ fontFamily: IT, fontSize: 12.5, color: MUTED }}>
                    {quantity} × {naira(selectedPlan.amount)}
                  </span>
                  <span style={{ fontFamily: PP, fontSize: 16, fontWeight: 600, color: WHITE }}>
                    {naira(payable)}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
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
          // One button per gateway the SERVER says is live. Naming them is
          // deliberate now — the founder wants the customer to choose, because
          // one gateway can be down while the other works. The list is still
          // never hardcoded, so a rotated key removes the option rather than
          // leaving a button that fails.
          ...cardProviders.map((entry) => ({ method: entry.provider, label: entry.label })),
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

  /** Peyflex packs every exam PIN a purchase sold into one `||`-separated
   *  string. A single electricity token has no separator and comes back as a
   *  one-element list, so this is safe for both. */
  const tokenParts = useMemo(
    () =>
      purchase.deliveredToken === null
        ? []
        : purchase.deliveredToken
            .split('||')
            .map((part) => part.trim())
            .filter((part) => part.length > 0),
    [purchase.deliveredToken],
  );

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
        {/* Whose betting account was credited, as verified before payment.
            The account id alone does not tell a customer they funded the
            right person. */}
        {purchase.beneficiaryName !== null ? (
          <p style={{ fontFamily: IT, fontSize: 12.5, color: WHITE, marginTop: 2 }}>
            {purchase.beneficiaryName}
          </p>
        ) : null}
        {purchase.quantity !== null && purchase.quantity > 1 ? (
          <p style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, marginTop: 2 }}>
            {purchase.quantity} PINs
          </p>
        ) : null}
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
          <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED }}>
            {tokenParts.length > 1 ? `Your ${String(tokenParts.length)} PINs` : 'Your token'}
          </p>
          {/* An education purchase returns every PIN it sold in ONE
              `||`-separated string. Rendered as a single run-on line, a
              customer buying three PINs has to find the boundaries themselves
              — and a mis-copied exam PIN is money gone. Split into one line
              each; a single token is unaffected. */}
          <div style={{ margin: '4px 0 10px', display: 'grid', gap: 6 }}>
            {tokenParts.map((part, index) => (
              <p
                key={`${part}-${String(index)}`}
                style={{
                  fontFamily: PP,
                  fontSize: tokenParts.length > 1 ? 14 : 19,
                  fontWeight: 700,
                  color: WHITE,
                  letterSpacing: '0.06em',
                  wordBreak: 'break-all',
                }}
              >
                {part}
              </p>
            ))}
          </div>
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
