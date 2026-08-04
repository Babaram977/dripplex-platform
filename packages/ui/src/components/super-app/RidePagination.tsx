import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Previous/Next pager with a "Page X of Y" label, used on Ride History. */
export function SuperAppRidePagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={onPrevious}
        className={`h-10 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-30 ${body}`}
        style={{ background: '#112238', color: 'rgba(255,255,255,.6)' }}
      >
        Previous
      </button>
      <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={onNext}
        className={`h-10 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-30 ${body}`}
        style={{ background: '#112238', color: 'rgba(255,255,255,.6)' }}
      >
        Next
      </button>
    </div>
  );
}
