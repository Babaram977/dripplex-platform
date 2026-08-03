import { BORDER, G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

const DEFAULT_ICONS = ['✨', '🚗', '📦', '💊', '🏷'];

/**
 * "Ask Drip" bottom-sheet modal, ported from `AISheet` in the locked
 * Figma Make export's Home screen. `prompts`/`icons` are parameterized
 * (default to Home's) so other screens can offer contextual prompts while
 * reusing the same chrome.
 *
 * Source computed each row's icon via `'✨🚗📦💊🏷'.slice(i*2,i*2+2)`,
 * which is broken (UTF-16 surrogate-pair misalignment garbles every row) —
 * `DEFAULT_ICONS` uses a plain array instead. See
 * docs/FIGMA-SOURCE-INVENTORY-V2.md.
 */
export function SuperAppAISheet({
  prompts,
  icons = DEFAULT_ICONS,
  onSelectPrompt,
  onClose,
}: {
  prompts: string[];
  icons?: string[];
  onSelectPrompt?: (prompt: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        animation: 'fade-in .2s ease',
      }}
    >
      <div
        className="rounded-t-[32px] p-5 pb-8"
        style={{
          background: 'linear-gradient(180deg,#0D1F2E 0%,#091420 100%)',
          border: '1.5px solid rgba(43,172,82,.18)',
          boxShadow: '0 -20px 60px rgba(0,0,0,.5)',
        }}
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.14)' }}
        />
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: '0 6px 20px rgba(43,172,82,.35)',
            }}
          >
            <span style={{ fontSize: 22 }}>✨</span>
          </div>
          <div>
            <p className={`text-[16px] font-bold ${heading}`} style={{ color: '#FFF' }}>
              Ask Drip
            </p>
            <p className={`text-[11px] ${body}`} style={{ color: G3 }}>
              AI · Ready to help you
            </p>
          </div>
        </div>
        <div className="mb-5 flex flex-col gap-2.5">
          {prompts.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onSelectPrompt?.(s);
                onClose();
              }}
              className={`active:scale-98 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[12.5px] transition-transform ${body}`}
              style={{
                background: 'rgba(255,255,255,.045)',
                color: 'rgba(255,255,255,.78)',
                border: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[i % icons.length]}</span>
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`active:scale-97 h-12 w-full rounded-2xl text-[13px] font-semibold transition-transform ${body}`}
          style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.42)' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
