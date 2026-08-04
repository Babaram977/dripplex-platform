import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Single wallet-ledger row (icon, title, subtitle, amount, credit/debit label). */
export function SuperAppWalletTransactionRow({
  icon,
  iconColor,
  title,
  subtitle,
  amountLabel,
  isCredit,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  isCredit: boolean;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: `${iconColor}22` }}
        >
          <span className="text-[18px]">{icon}</span>
        </div>
        <div>
          <p className={`mb-0.5 text-[14px] font-semibold text-white ${body}`}>{title}</p>
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`text-[15px] font-bold ${body}`}
          style={{ color: isCredit ? '#10B981' : '#fff' }}
        >
          {amountLabel}
        </p>
        <p
          className={`text-[11px] ${body}`}
          style={{ color: isCredit ? '#10B981' : 'rgba(255,255,255,.5)' }}
        >
          {isCredit ? 'Credit' : 'Debit'}
        </p>
      </div>
    </div>
  );
}

/** Divider-separated list of keyed `SuperAppWalletTransactionRow` elements. */
export function SuperAppWalletTransactionList({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const items = React.Children.toArray(children);
  return (
    <div>
      {items.map((child, index) => (
        <React.Fragment key={(child as React.ReactElement).key ?? index}>
          {index > 0 ? (
            <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}
