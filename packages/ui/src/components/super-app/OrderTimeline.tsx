import { BORDER, G2, G3, MUTED } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppTimelineStep {
  key: string;
  label: string;
  sub: string;
  state: 'done' | 'active' | 'pending';
}

/**
 * Generic order-progress timeline, ported from the Tracking screen's
 * `OrderTimeline`. Unlike the source (which drives a single hardcoded
 * `OrderStatus` union spanning both order and delivery lifecycles), this
 * takes a pre-built step list — the real backend has two separate state
 * machines (`Order.status` and `DeliveryJob.status`), and pickup orders
 * have no delivery steps at all, so the page composes the right step
 * list for the real data rather than the component guessing at it.
 */
export function SuperAppOrderTimeline({
  steps,
}: {
  steps: SuperAppTimelineStep[];
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const { state } = step;
        const done = state === 'done';
        const active = state === 'active';
        const pending = state === 'pending';
        return (
          <div key={step.key} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center" style={{ width: 32 }}>
              {i > 0 ? (
                <div
                  className="h-3 w-0.5 shrink-0"
                  style={{ background: done || active ? G2 : BORDER }}
                />
              ) : null}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-500 ${heading}`}
                style={{
                  background: done ? G2 : active ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                  border: `2px solid ${done || active ? G2 : BORDER}`,
                  boxShadow: active ? '0 0 0 4px rgba(43,172,82,.15)' : 'none',
                  color: done ? '#FFF' : active ? G3 : MUTED,
                }}
              >
                {done ? '✓' : active ? '●' : ''}
              </div>
              {i < steps.length - 1 ? (
                <div
                  className="w-0.5 flex-1"
                  style={{
                    minHeight: 16,
                    background: done ? G2 : BORDER,
                    transition: 'background .6s ease',
                  }}
                />
              ) : null}
            </div>
            <div className="pb-4 pt-0.5">
              <p
                className={`text-[13px] font-semibold leading-none ${heading}`}
                style={{ color: pending ? 'rgba(255,255,255,.3)' : active ? 'white' : G3 }}
              >
                {step.label}
                {active ? (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: 'rgba(43,172,82,.18)', color: G3 }}
                  >
                    LIVE
                  </span>
                ) : null}
              </p>
              <p
                className={`mt-0.5 text-[11px] ${body}`}
                style={{ color: pending ? 'rgba(255,255,255,.18)' : MUTED }}
              >
                {step.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
