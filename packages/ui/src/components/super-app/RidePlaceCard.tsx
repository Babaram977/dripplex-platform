import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Saved-place card: icon, name, default badge, address, and edit/set-default/delete actions. */
export function SuperAppRidePlaceCard({
  icon,
  title,
  subtitle,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  icon: string;
  title: string;
  subtitle: string;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="mb-3 overflow-hidden rounded-2xl"
      style={{
        background: '#0D1B2E',
        border: '1px solid rgba(255,255,255,.08)',
        borderLeft: isDefault ? '3px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-[14px] font-semibold text-white ${heading}`}>{title}</p>
            {isDefault ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${body}`}
                style={{ background: 'rgba(43,172,82,.12)', color: '#47CF72' }}
              >
                Default
              </span>
            ) : null}
          </div>
          <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={onEdit}
          className={`text-[12px] font-semibold ${heading}`}
          style={{ color: '#47CF72' }}
        >
          Edit
        </button>
        {!isDefault ? (
          <button
            type="button"
            onClick={onSetDefault}
            className={`text-[12px] font-semibold ${heading}`}
            style={{ color: 'rgba(255,255,255,.6)' }}
          >
            Set as default
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className={`ml-auto text-[12px] font-semibold ${heading}`}
          style={{ color: '#EF4444' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
