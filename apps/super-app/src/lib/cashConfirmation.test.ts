import { describe, expect, it } from 'vitest';

import { needsCashConfirmation } from './cashConfirmation';

/**
 * The gate on the only control that can settle a cash fare from the app.
 *
 * It exists because the completed-trip screen confirms cash by itself and only
 * while it is mounted, so a driver who taps "Go Back Online" first strands the
 * ride: nothing else in the app could reach it, and Trip History showed
 * AWAITING PAYMENT with no way out.
 */
describe('needsCashConfirmation', () => {
  it('offers the control on a cash fare the driver has not settled', () => {
    expect(needsCashConfirmation({ paymentMethod: 'CASH', paymentStatus: 'PENDING' })).toBe(true);
  });

  it('stops offering it once the fare is settled', () => {
    // Otherwise the button survives its own success and invites a second tap
    // the server would refuse as already paid.
    expect(needsCashConfirmation({ paymentMethod: 'CASH', paymentStatus: 'PAID' })).toBe(false);
  });

  it('never offers it on a card fare, however unpaid', () => {
    // An abandoned card checkout is the passenger's to finish. A driver
    // confirming cash they never took would accrue commission on money that
    // does not exist.
    expect(needsCashConfirmation({ paymentMethod: 'PAYSTACK', paymentStatus: 'PENDING' })).toBe(
      false,
    );
    expect(needsCashConfirmation({ paymentMethod: 'WALLET', paymentStatus: 'FAILED' })).toBe(false);
  });

  it('waits for the passenger to choose a method before offering anything', () => {
    // The server rejects a confirm before the passenger has picked cash, so a
    // button here would only produce an error the driver cannot act on.
    expect(needsCashConfirmation({ paymentMethod: null, paymentStatus: 'PENDING' })).toBe(false);
  });
});
