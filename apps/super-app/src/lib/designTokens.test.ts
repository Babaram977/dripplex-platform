import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Screens must be built from the locked token system, not a private palette.
 *
 * ## The defect this pins
 *
 * `hotelBookingScreens.tsx` shipped with **zero** imports from `src/tokens`,
 * one `fontFamily` declaration in the whole file, and 23 distinct hardcoded hex
 * values — a light-mode Tailwind palette (`#FFFFFF` cards, `#E5E7EB` borders,
 * `#111827` buttons, `#6B7280` body text) rendered inside a navy application.
 * On a phone it read as a second app bolted onto the first, and the founder
 * reported exactly that.
 *
 * Nothing caught it. It type-checked, it built, it passed every test: a colour
 * is a string, and a wrong string is as valid as a right one. The only signal
 * was a person looking at a screen.
 *
 * ## Why the assertion is "no raw hex" rather than "looks right"
 *
 * There is no way to test that a screen is well designed. There is a way to
 * test that it cannot quietly invent its own colours — which is the specific
 * mistake that was made, and the one that reproduces every time somebody writes
 * a new screen without opening `src/tokens` first.
 *
 * A file listed here has been converted and must stay converted. Adding a
 * screen to the list is a deliberate act; nothing here scans the whole app,
 * because most of it predates the token system and a failing test that nobody
 * can fix is a test that gets deleted.
 */

/** Files that are fully on the token system and must remain so. */
const TOKEN_ONLY_SCREENS = ['hotelBookingScreens.tsx'];

/** `#RGB`, `#RRGGBB` and `#RRGGBBAA`, but not a `#anchor` or an id selector. */
const RAW_HEX = /#[0-9A-Fa-f]{3,8}\b/g;

/**
 * Comments are not markup. A file is allowed — and in this case expected — to
 * name the colours it used to use, so the person reading it knows what was
 * wrong. Stripping comments first is what keeps the record honest without the
 * record failing the test.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe.each(TOKEN_ONLY_SCREENS)('%s is built from src/tokens', (file) => {
  const source = readFileSync(join(__dirname, '..', 'app', file), 'utf8');
  const code = withoutComments(source);

  /** Guards every assertion below against passing because the read gave back
   *  something empty or something else entirely. */
  it('is reading the real screen', () => {
    expect(source.length).toBeGreaterThan(2_000);
    expect(source).toContain('export function');
  });

  it('declares no colour of its own', () => {
    // Reported with the offending strings, so a failure names the colours to
    // replace rather than just a count.
    expect([...code.matchAll(RAW_HEX)].map((m) => m[0])).toEqual([]);
  });

  it('takes its colours, spacing and type from the token system', () => {
    expect(source).toMatch(/from '\.\.\/tokens'/);
  });

  /**
   * Every text node needs a family. The original file had one `fontFamily` in
   * 1,088 lines, so every string on every hotel screen fell back to the
   * browser's system face while the rest of the app is Poppins and Inter — the
   * single most visible part of the divergence, and the easiest to miss because
   * nothing about it looks broken in isolation.
   */
  it('sets a font family rather than falling back to the system face', () => {
    const families = code.match(/fontFamily:/g) ?? [];
    expect(families.length).toBeGreaterThan(3);
    expect(code).toMatch(/\bFONT_(HEADING|BODY)\b/);
  });
});
