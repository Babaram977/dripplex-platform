import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/**
 * Gold cashback-summary banner shown on Wallet Home. `onClick` is optional
 * — it links to the Rewards screen once that exists; until then the strip
 * renders as an informational (non-interactive) summary of real cashback
 * data rather than a dead link.
 */
export function SuperAppWalletRewardsStrip({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className="text-[20px]">✦</span>
        <div className="text-left">
          <p className={`text-[13px] font-semibold ${heading}`} style={{ color: '#FBBF24' }}>
            {title}
          </p>
          <p className={`text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      {onClick ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12l4-4-4-4"
            stroke="#FBBF24"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </>
  );
  const className = 'mx-4 mt-4 flex items-center justify-between rounded-[14px] px-4 py-3';
  const style: React.CSSProperties = {
    background: 'linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.06))',
    border: '1px solid rgba(251,191,36,.2)',
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
