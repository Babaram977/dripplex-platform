import type { RideDto } from './api';

/**
 * Whether a completed trip is a cash fare the driver still has to confirm.
 *
 * This mirrors the backend's own guard (`requireCashConfirmableRide`) rather
 * than inventing a looser one: COMPLETED, paid in CASH, not yet PAID. Getting
 * it wrong in either direction costs something real.
 *
 * Too narrow and a cash ride stays stuck: the driver holds the money, the
 * platform accrues no commission on it, and the passenger sits on "Waiting for
 * your driver to confirm" with rating and tipping locked behind a payment that
 * will never land.
 *
 * Too wide and the driver is offered a button the server will refuse — a card
 * fare the passenger abandoned, or a ride where they have not chosen a method
 * yet. Neither is the driver's to settle, and an error they can do nothing
 * about is worse than no button at all.
 */
export function needsCashConfirmation(
  trip: Pick<RideDto, 'paymentMethod' | 'paymentStatus'>,
): boolean {
  return trip.paymentMethod === 'CASH' && trip.paymentStatus !== 'PAID';
}
