import { randomInt } from 'node:crypto';

/**
 * The five-character code a guest reads out at the hotel desk.
 *
 * Founder decision 2026-08-22: "PIN should be generated like 5 digits alpha
 * numeric which the hotel will see as the reference to the booking."
 *
 * Three deliberate choices, all of them about a person reading a code aloud in
 * a lobby:
 *
 * 1. **The alphabet excludes 0/O, 1/I/L and 5/S.** A guest reading "B0X1S" over
 *    a phone line, or a receptionist typing what they heard, confuses those
 *    pairs constantly. Dropping them costs a little entropy and removes the
 *    most common way this code fails in the room it is used in.
 * 2. **Uppercase only**, and comparison upper-cases the input, because nobody
 *    reads case aloud and a phone keyboard will happily send "b7x9k".
 * 3. **`randomInt`, not `Math.random`.** The PIN is what proves a guest is the
 *    guest. A predictable one lets somebody guess their way into another
 *    person's room.
 *
 * 29 characters over 5 positions is ~20.5 million combinations. That is not a
 * password and is not treated as one: it identifies a booking to a hotel that
 * also has the guest's name, phone and dates in front of them. It is a
 * convenience for the desk, not the only thing standing between a stranger and
 * a room — which is why `bookingPinsMatch` exists rather than any comparison
 * being scattered around.
 */
// Digits 0, 1 and 5 and letters I, L, O and S are absent on purpose — see above.
// The first version of this line kept the 5 while the comment claimed it was
// gone; the test that reads the rule back is what caught it.
const PIN_ALPHABET = '2346789ABCDEFGHJKMNPQRTUVWXYZ';
export const BOOKING_PIN_LENGTH = 5;

export function generateBookingPin(): string {
  const characters: string[] = [];
  for (let i = 0; i < BOOKING_PIN_LENGTH; i += 1) {
    characters.push(PIN_ALPHABET.charAt(randomInt(PIN_ALPHABET.length)));
  }
  return characters.join('');
}

/**
 * Whether what the desk typed matches the booking.
 *
 * Case-insensitive and whitespace-tolerant: a receptionist typing "b7 x9k"
 * means the same thing as "B7X9K", and refusing it would send a real guest
 * away over a space.
 */
export function bookingPinsMatch(stored: string, entered: string): boolean {
  return normalizeBookingPin(stored) === normalizeBookingPin(entered);
}

export function normalizeBookingPin(pin: string): string {
  return pin.replace(/\s+/g, '').toUpperCase();
}

/** The characters a PIN can contain — exported so a client can validate input
 *  against the same set rather than keeping its own copy that drifts. */
export function isBookingPinShaped(pin: string): boolean {
  const normalized = normalizeBookingPin(pin);
  if (normalized.length !== BOOKING_PIN_LENGTH) return false;
  // A character class built from the alphabet itself, so the two cannot drift.
  return new RegExp(`^[${PIN_ALPHABET}]{${String(BOOKING_PIN_LENGTH)}}$`).test(normalized);
}
