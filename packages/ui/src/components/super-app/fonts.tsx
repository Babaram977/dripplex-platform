'use client';

import * as React from 'react';

/**
 * Font className plumbing for the super-app (Figma Make) design system.
 *
 * The locked source (`docs/reference/figma-super-app-source/`) sets
 * `fontFamily: "'Poppins',sans-serif"` / `"'Inter',sans-serif"` inline and
 * assumes those faces are already loaded on the page. Consuming Next.js
 * apps load them locally via `next/font/google` (for optimized, scoped
 * loading + no FOUC) and hand the resulting `className`s down through this
 * provider, so components here don't take a hard dependency on `next/font`.
 */
interface SuperAppFontClassNames {
  /** className for text set in the source's `FONT_HEADING` (Poppins). */
  heading: string;
  /** className for text set in the source's `FONT_BODY` (Inter). */
  body: string;
}

const SuperAppFontContext = React.createContext<SuperAppFontClassNames>({
  heading: '',
  body: '',
});

export function SuperAppFontProvider({
  heading,
  body,
  children,
}: SuperAppFontClassNames & { children: React.ReactNode }): React.JSX.Element {
  const value = React.useMemo(() => ({ heading, body }), [heading, body]);
  return <SuperAppFontContext.Provider value={value}>{children}</SuperAppFontContext.Provider>;
}

export function useSuperAppFonts(): SuperAppFontClassNames {
  return React.useContext(SuperAppFontContext);
}
