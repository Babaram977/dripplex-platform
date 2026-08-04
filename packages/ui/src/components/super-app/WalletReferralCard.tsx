import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Referral code display + copy button (Rewards screen). */
export function SuperAppWalletReferralCard({
  code,
  subtitle,
  copied,
  onCopy,
}: {
  code: string;
  subtitle: string;
  copied: boolean;
  onCopy: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="rounded-2xl p-[18px_16px] text-center"
      style={{ background: '#112238', border: '1px solid rgba(251,191,36,.2)' }}
    >
      <p className={`mb-2 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
        {subtitle}
      </p>
      <p
        className={`mb-3 text-[24px] font-extrabold tracking-widest ${heading}`}
        style={{ color: '#FBBF24' }}
      >
        {code}
      </p>
      <button
        type="button"
        onClick={onCopy}
        className={`rounded-xl px-6 py-2.5 text-[14px] font-bold transition-all ${body}`}
        style={{
          background: copied ? 'linear-gradient(135deg,#176B30,#2BAC52)' : 'rgba(251,191,36,.12)',
          border: `1px solid ${copied ? 'transparent' : 'rgba(251,191,36,.3)'}`,
          color: copied ? '#fff' : '#FBBF24',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy Code'}
      </button>
    </div>
  );
}
