import * as React from 'react';

import type { DispatchException } from '@/lib/dispatch-exceptions';

/** DPX-OPS-001 Slice 3 — the founder's UX direction: "use strong visual
 * priority for exceptions." A dedicated, unmissable banner at the top of
 * the ride detail view, not a badge easily lost among routine status
 * chips. Renders nothing when there's nothing wrong — an operator should
 * never have to guess whether an empty section means "no problems" or
 * "still loading." */
export function DispatchExceptionBanner({
  exceptions,
}: {
  exceptions: DispatchException[];
}): React.JSX.Element | null {
  if (exceptions.length === 0) return null;

  return (
    <div className="border-destructive/50 bg-destructive/10 flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-destructive text-sm font-semibold">Needs attention</p>
      <ul className="flex flex-col gap-1">
        {exceptions.map((exception) => (
          <li key={exception.id} className="text-destructive flex items-start gap-2 text-sm">
            <span aria-hidden="true">⚠️</span>
            <span>{exception.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
