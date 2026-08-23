import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Back must actually go back — enforced against App.tsx's source.
 *
 * ## Why a source test rather than a behavioural one
 *
 * The bug this pins is not in the history stack. `screenHistory.ts` was correct
 * and its own tests passed; the defect was in how ~99 screens were *wired* —
 * their Back button called `go('somewhere')`, a **forward** navigation to a
 * hard-coded destination, instead of `goBack('somewhere')`.
 *
 * That distinction is invisible to a unit test of the stack and invisible to a
 * type checker: both calls compile, both take a `Screen`, and both move the
 * user. It only shows up when a person presses Back and arrives somewhere they
 * have never been.
 *
 * ## The trap a founder actually hit, twice
 *
 * Notifications' Back was `go('account')`, and Manage Account's Back was
 * `goBack('home')`. From the home screen:
 *
 *   home → notifications  (history: [home])
 *   press Back → go('account')       — a *forward* move, history: [home, notifications]
 *   press Back → goBack('home')      — pops "notifications"
 *   → back on Notifications. Press Back → Account. Press Back → Notifications…
 *
 * A closed loop with no exit. Reported on 2026-08-21, partly fixed, and
 * reported again on 2026-08-23 because the earlier fix corrected the stack and
 * fourteen call sites while leaving ninety-nine untouched.
 *
 * So the invariant is checked where the mistake actually lives: in the source.
 * A new screen wired the old way fails here rather than reaching a phone.
 */

const appSource = readFileSync(join(__dirname, '..', 'app', 'App.tsx'), 'utf8');

describe('every Back goes back', () => {
  /** Guards the whole file against silently passing because the read failed
   *  or the file moved. */
  it('is reading the real App.tsx', () => {
    expect(appSource.length).toBeGreaterThan(10_000);
    expect(appSource).toContain('const goBack = (fallback: Screen)');
  });

  /**
   * The invariant. `go` moves forward and records history; `goBack` pops it.
   * A Back button calling `go` cannot return the user anywhere — it can only
   * take them to one fixed place and add another entry to the stack.
   */
  it('never wires a Back button to the forward navigator', () => {
    const offenders = [...appSource.matchAll(/onBack=\{[^}]*?\bgo\(/g)].filter(
      // `goBack(` contains `go(` only as a substring of a different call.
      (m) => !/\bgoBack\($/.test(m[0]),
    );
    expect(offenders.map((m) => m[0])).toEqual([]);
  });

  /** There should be a lot of them: if this number collapses, the regex above
   *  has stopped matching anything and the test has stopped meaning anything. */
  it('finds the Back buttons it claims to be checking', () => {
    const backHandlers = appSource.match(/onBack=\{/g) ?? [];
    expect(backHandlers.length).toBeGreaterThan(90);
  });

  /**
   * `goBack` always takes a fallback, which is where a person lands when there
   * is no history — a deep link, or a reload. A bare `goBack()` would send them
   * nowhere.
   */
  it('always gives Back somewhere to fall back to', () => {
    expect(appSource).not.toMatch(/goBack\(\s*\)/);
  });
});
