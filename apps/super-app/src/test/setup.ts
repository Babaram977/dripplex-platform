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
}
