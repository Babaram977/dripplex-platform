import '@testing-library/jest-dom/vitest';

// Not every suite runs in jsdom. `src/server.test.ts` declares
// `@vitest-environment node` because it boots a real HTTP server, and there is
// no `window` there — an unguarded stub below throws during setup and fails the
// file before a single test runs.
if (typeof window === 'undefined') {
  // Nothing to stub outside a DOM.
} else {
  // jsdom implements neither of these, and this app calls both: `matchMedia` for
  // responsive layout decisions, `scrollTo` on nearly every screen change. Left
  // unstubbed they throw inside a render and fail a test for a reason that has
  // nothing to do with what it was checking.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined });

  // Recharts' ResponsiveContainer constructs a ResizeObserver on mount, and
  // jsdom has none. Unstubbed it throws during the COMMIT phase, which React
  // does not recover from: the whole tree unmounts, so a test that only wanted
  // to click something elsewhere on the page fails with an empty document and
  // an error naming neither the chart nor the assertion.
  //
  // That is why the Analytics screen had no test until now — it renders charts,
  // so it could not be mounted at all. Stubbed here beside matchMedia and
  // scrollTo rather than in one spec, because every screen carrying a chart has
  // the same problem and any of them would otherwise hit it in turn.
  //
  // A no-op is the honest stub: jsdom reports zero-size elements regardless, so
  // a real implementation would observe nothing anyway. Charts render their
  // empty state; assertions about them belong in a browser test, not here.
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      public observe(): void {
        // no-op
      }
      public unobserve(): void {
        // no-op
      }
      public disconnect(): void {
        // no-op
      }
    };
  }
}
