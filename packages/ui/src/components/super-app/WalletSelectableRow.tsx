import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Radio-style selectable row (Top Up's real gateway provider list). */
export function SuperAppWalletSelectableRow({
  icon,
  label,
  subtitle,
  selected,
  onClick,
}: {
  icon: string;
  label: string;
  subtitle?: string | undefined;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left"
      style={{
        background: selected ? 'rgba(43,172,82,.08)' : '#112238',
        border: `1.5px solid ${selected ? '#2BAC52' : 'rgba(255,255,255,.08)'}`,
      }}
    >
      <span className="text-[22px]">{icon}</span>
      <div className="flex-1">
        <p className={`text-[14px] font-semibold text-white ${body}`}>{label}</p>
        {subtitle ? (
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
        style={{ border: `2px solid ${selected ? '#2BAC52' : 'rgba(255,255,255,.08)'}` }}
      >
        {selected ? (
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: '#2BAC52' }} />
        ) : null}
      </span>
    </button>
  );
}

/** Avatar-initial recipient row (Transfer's recent/found recipients). */
export function SuperAppWalletRecipientRow({
  name,
  subtitle,
  color = '#2BAC52',
  onClick,
  trailing,
}: {
  name: string;
  subtitle: string;
  color?: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <span
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${heading}`}
        style={{ background: `${color}33`, color }}
      >
        {initials}
      </span>
      <div className="flex-1 text-left">
        <p className={`text-[14px] font-semibold text-white ${body}`}>{name}</p>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {subtitle}
        </p>
      </div>
      {trailing}
    </button>
  );
}
