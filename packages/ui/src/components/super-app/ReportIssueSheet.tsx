import * as React from 'react';

import { BORDER, G0, G2, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

const ISSUE_PRESETS = [
  'Wrong items received',
  'Missing item',
  'Order arrived damaged',
  'Driver not moving / delayed',
  'Other',
];

/**
 * "Report an Issue" sheet — new, real. The source screen's equivalent
 * (the "Ask Drip" AI card) only returns canned text for this action, not
 * a real report; the real backend has `POST /customer/orders/:id/dispute`
 * (raises an `OrderDispute`), so this is a genuine reason-entry form
 * wired to it instead.
 */
export function SuperAppReportIssueSheet({
  submitting = false,
  onSubmit,
  onClose,
}: {
  submitting?: boolean | undefined;
  onSubmit?: ((reason: string) => void) | undefined;
  onClose?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [preset, setPreset] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');

  const effectiveReason = preset === 'Other' || preset === null ? reason.trim() : preset;
  const canSubmit = effectiveReason.length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-4 rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .25s ease both',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <p className={`text-[16px] font-bold text-white ${heading}`}>Report an Issue</p>

        <div className="flex flex-col gap-2">
          {ISSUE_PRESETS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setPreset(option);
              }}
              className={`flex h-[42px] items-center rounded-xl px-3 text-left text-[13px] font-medium transition-all ${body}`}
              style={{
                background: preset === option ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                border: `1.5px solid ${preset === option ? G2 : BORDER}`,
                color: preset === option ? G3 : 'rgba(255,255,255,.75)',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {preset === 'Other' ? (
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            placeholder="Describe what happened"
            rows={3}
            className={`resize-none rounded-xl px-3 py-2 text-[13px] text-white outline-none ${body}`}
            style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
          />
        ) : null}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={canSubmit ? () => onSubmit?.(effectiveReason) : undefined}
          className={`flex h-[48px] items-center justify-center rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
          style={{
            background:
              !canSubmit || submitting
                ? 'rgba(255,255,255,.07)'
                : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            color: !canSubmit || submitting ? 'rgba(255,255,255,.25)' : 'white',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}
