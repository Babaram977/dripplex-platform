import { BORDER, G2, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

/** Terms-of-service acknowledgement checkbox, ported from the Checkout screen. */
export function SuperAppCheckoutTermsCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle?: (() => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button
      type="button"
      className="mb-2 flex w-full items-start gap-3 text-left"
      onClick={onToggle}
    >
      <div
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all"
        style={{
          background: checked ? G2 : 'rgba(255,255,255,.07)',
          border: `1.5px solid ${checked ? G2 : BORDER}`,
        }}
      >
        {checked ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : null}
      </div>
      <p className={`text-[12px] leading-relaxed ${body}`} style={{ color: MUTED }}>
        I have reviewed my order and agree to the merchant terms and{' '}
        <span style={{ color: G3 }}>DrippleX Terms of Service</span>.
      </p>
    </button>
  );
}
