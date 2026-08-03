import { useSuperAppFonts } from './fonts';
import { SuperAppWalletActions, type SuperAppWalletAction } from './WalletActions';

export interface SuperAppBalanceStat {
  label: string;
  value: string;
  background: string;
}

const DEFAULT_ACTIONS: SuperAppWalletAction[] = [
  { key: 'send', icon: '↑', label: 'Send' },
  { key: 'receive', icon: '↓', label: 'Receive' },
  { key: 'topup', icon: '⊕', label: 'Top Up' },
  { key: 'pay', icon: '≡', label: 'Pay' },
];

/** Wallet total-balance card, ported from Home's `BalanceCard`. */
export function SuperAppBalanceCard({
  label = 'Total Balance',
  amount,
  decimals,
  fxEquivalent,
  stats,
  actions = DEFAULT_ACTIONS,
  onAction,
}: {
  label?: string | undefined;
  amount: string;
  decimals?: string | undefined;
  fxEquivalent?: string | undefined;
  stats: SuperAppBalanceStat[];
  actions?: SuperAppWalletAction[] | undefined;
  onAction?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="relative mx-5 mb-5 overflow-hidden rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg,#0E3320 0%,#155C31 45%,#1E8A49 80%,#2BAC52 100%)',
        boxShadow: '0 16px 48px rgba(43,172,82,.28), 0 4px 16px rgba(0,0,0,.4)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(71,207,114,.22) 0%,transparent 65%)' }}
      />
      <div className="relative z-10">
        <p
          className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${body}`}
          style={{ color: 'rgba(255,255,255,.55)' }}
        >
          {label}
        </p>
        <p
          className={`mb-0.5 text-[36px] font-bold leading-tight tracking-tight ${heading}`}
          style={{ color: '#FFF' }}
        >
          {amount}
          {decimals ? <span className="text-[20px]">{decimals}</span> : null}
        </p>
        {fxEquivalent ? (
          <p className={`mb-5 text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.45)' }}>
            {fxEquivalent}
          </p>
        ) : null}
        <div className="mb-4 flex gap-2.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-xl px-2.5 py-2"
              style={{ background: s.background }}
            >
              <p
                className={`mb-0.5 text-[8.5px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                {s.label}
              </p>
              <p className={`text-[13px] font-bold ${heading}`} style={{ color: '#FFF' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
        <SuperAppWalletActions actions={actions} onAction={onAction} />
      </div>
    </div>
  );
}
