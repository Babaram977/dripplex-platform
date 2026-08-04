import * as React from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppWalletQuickAction {
  key: string;
  icon: string;
  label: string;
  color: string;
  onClick?: (() => void) | undefined;
}

/** Top Up / Withdraw / Transfer / Pay quick-action row on Wallet Home. */
export function SuperAppWalletQuickActionsGrid({
  actions,
}: {
  actions: SuperAppWalletQuickAction[];
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="flex items-center justify-between px-4" style={{ marginTop: 20 }}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          disabled={!action.onClick}
          className="flex flex-col items-center gap-2 disabled:opacity-40"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[18px]"
            style={{
              background: '#0D1B2E',
              border: '1px solid rgba(255,255,255,.08)',
              boxShadow: '0 2px 12px rgba(0,0,0,.3)',
            }}
          >
            <span className="text-[22px] font-bold leading-none" style={{ color: action.color }}>
              {action.icon}
            </span>
          </div>
          <span
            className={`text-[12px] font-medium ${body}`}
            style={{ color: 'rgba(255,255,255,.7)' }}
          >
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}
