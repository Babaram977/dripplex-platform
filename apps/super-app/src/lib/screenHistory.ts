/**
 * The app's back stack.
 *
 * Extracted out of `App.tsx` so it can be tested. It is nine lines of logic
 * that decide whether every Back button in the app works, and it lived inside
 * a 2,000-line component where nothing could reach it.
 *
 * The app is a screen-key state machine with no browser history, so this array
 * is the only record of where a customer came from.
 */

/** A wandering session should not grow the stack without bound. */
export const SCREEN_HISTORY_LIMIT = 50;

/**
 * Record a move from `from` to `to`.
 *
 * The `to === top` branch is the one that matters. Most Back buttons in this
 * app are written as a hard-coded forward navigation — `onBack={() =>
 * go('account')}` — rather than a pop, and treating those as forward moves
 * made the stack grow on the way *back*, so Back could never reach the bottom:
 *
 *   home → Manage Account → PIN Setup → Back → Back
 *
 * used to land on PIN Setup again, and the two screens bounced off each other
 * for as long as the customer kept tapping. Abdullahi hit this on 2026-08-21
 * and could not get out of his own profile.
 *
 * Returning to the screen directly beneath us on the stack *is* a back move,
 * whichever call spelled it. Popping there fixes every hard-coded Back at once
 * — including the ones nobody has rewritten yet, and the ones not written yet.
 */
export function recordNavigation<S>(stack: S[], from: S, to: S): void {
  if (from === to) return;

  if (stack[stack.length - 1] === to) {
    stack.pop();
    return;
  }

  stack.push(from);
  if (stack.length > SCREEN_HISTORY_LIMIT) stack.shift();
}

/**
 * Where Back goes: the screen we actually came from, or a sensible home for
 * this persona when there is no history (a deep link, or a page reload).
 */
export function popPrevious<S>(stack: S[], fallback: S): S {
  return stack.pop() ?? fallback;
}

/**
 * Crossing an authentication boundary makes the previous history meaningless
 * and, worse, walkable: without this, Back from the home screen would return
 * to the sign-in form, and Back after signing out would walk into the
 * signed-in app.
 */
export function clearHistory<S>(stack: S[]): void {
  stack.length = 0;
}
