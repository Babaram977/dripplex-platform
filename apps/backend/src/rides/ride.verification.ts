import { randomInt } from 'node:crypto';

/**
 * The passenger's 4-digit trip code.
 *
 * Four digits is a deliberate trade: it is short enough to read out of a car
 * window, and it is not a secret that protects money — it proves the person
 * climbing in is the one who booked. Guessing it blind is 1 in 10,000 against
 * a stranger who would also have to be standing at the right pickup point at
 * the right minute, next to the right car.
 *
 * randomInt, not Math.random: this is a security control, and a predictable
 * code is no control at all.
 */
export function generateTripVerificationCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, '0');
}
