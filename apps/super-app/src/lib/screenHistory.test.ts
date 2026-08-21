import { describe, expect, it } from 'vitest';

import { clearHistory, popPrevious, recordNavigation, SCREEN_HISTORY_LIMIT } from './screenHistory';

/**
 * A tiny driver that behaves the way App.tsx does: `go` is a forward
 * navigation, `back` pops. Written this way so a test reads as the sequence of
 * taps a person actually made.
 */
function session(start: string) {
  const stack: string[] = [];
  let screen = start;
  return {
    go(to: string) {
      recordNavigation(stack, screen, to);
      screen = to;
      return this;
    },
    back(fallback: string) {
      screen = popPrevious(stack, fallback);
      return this;
    },
    get at() {
      return screen;
    },
    get history() {
      return [...stack];
    },
    stack,
  };
}

describe('screen history', () => {
  it('returns to where the customer came from', () => {
    const s = session('home').go('account');
    expect(s.history).toEqual(['home']);

    s.back('home');
    expect(s.at).toBe('home');
    expect(s.history).toEqual([]);
  });

  /**
   * The bug Abdullahi reported on 2026-08-21: he opened Manage Account, tapped
   * into PIN Setup, and could not get back to Home. Back bounced him between
   * the two pages forever.
   *
   * The cause was that PIN Setup's Back is written `go('account')` — a
   * hard-coded destination, not a pop — and a forward navigation pushed onto
   * the stack, so the stack grew on the way back and the exit was never
   * reached. Ninety-one Back buttons in App.tsx are written that way.
   */
  it('gets out of a profile page whose Back is a hard-coded forward navigation', () => {
    const s = session('home').go('account').go('pinsetup');
    expect(s.history).toEqual(['home', 'account']);

    // PIN Setup's Back — spelled as go('account'), not as a pop.
    s.go('account');
    expect(s.at).toBe('account');
    expect(s.history).toEqual(['home']);

    // And Manage Account's Back reaches Home, instead of bouncing back into
    // PIN Setup.
    s.back('home');
    expect(s.at).toBe('home');
    expect(s.history).toEqual([]);
  });

  it('does not grow the stack however long the customer bounces', () => {
    const s = session('home').go('account');
    for (let i = 0; i < 20; i += 1) {
      s.go('pinsetup');
      s.go('account');
    }
    // Twenty round trips, and the stack is exactly where one visit left it.
    expect(s.history).toEqual(['home']);
    expect(s.at).toBe('account');
  });

  it('works the same for any other pair of screens, not just the reported one', () => {
    const s = session('home').go('account').go('security').go('emergency');
    expect(s.history).toEqual(['home', 'account', 'security']);

    s.go('security'); // Emergency's hard-coded Back
    s.go('account'); // Security's hard-coded Back
    s.back('home'); // Manage Account's real Back
    expect(s.at).toBe('home');
    expect(s.history).toEqual([]);
  });

  it('falls back when there is no history, rather than going nowhere', () => {
    const s = session('pinsetup');
    s.back('home');
    expect(s.at).toBe('home');
  });

  it('ignores a navigation to the screen already showing', () => {
    const s = session('home').go('home');
    expect(s.history).toEqual([]);
  });

  it('drops the oldest entry rather than growing without bound', () => {
    const stack: string[] = [];
    for (let i = 0; i < SCREEN_HISTORY_LIMIT + 10; i += 1) {
      recordNavigation(stack, `screen-${String(i)}`, `screen-${String(i + 1)}`);
    }
    expect(stack.length).toBe(SCREEN_HISTORY_LIMIT);
    // The oldest are the ones discarded; the most recent are kept.
    expect(stack[stack.length - 1]).toBe(`screen-${String(SCREEN_HISTORY_LIMIT + 9)}`);
  });

  it('forgets everything across an authentication boundary', () => {
    const s = session('welcome').go('signin').go('home');
    clearHistory(s.stack);
    // Back from home must not walk into the sign-in form.
    s.back('home');
    expect(s.at).toBe('home');
  });
});
