import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearGatewayReturnParam,
  gatewayCallbackUrl,
  gatewayReturnKindFromUrl,
  rememberGatewayReturn,
  takeGatewayReturn,
} from './gatewayReturn';

/**
 * The round trip through a payment gateway.
 *
 * This module exists because of a real incident: on 2026-08-19 a ₦1,000 airtime
 * purchase was paid for and the customer was left sitting on Paystack's
 * "Payment Successful" page with no airtime and no way back into the app.
 *
 * A hotel booking now makes the same trip, and the stakes are a notch higher —
 * the thing waiting on the other side is the PIN that proves the room is
 * theirs. So the tests below are mostly about `booking` being a first-class
 * kind everywhere, because a kind that is written but not *read* fails
 * silently: the customer comes back, the app shrugs, and nothing confirms.
 */

function setUrl(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

describe('gatewayReturn', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setUrl('');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    setUrl('');
  });

  describe('booking is a real kind, on both sides', () => {
    /**
     * The bug this pins. `rememberGatewayReturn` accepts any kind, so writing
     * one is never the failure — the failure is the reader not recognising it,
     * which returns null and drops the customer on the splash screen with an
     * unconfirmed payment behind them.
     */
    it('reads a booking return back out of the URL', () => {
      setUrl('?dxreturn=booking');
      expect(gatewayReturnKindFromUrl()).toBe('booking');
    });

    it('round-trips a booking through storage', () => {
      setUrl('?dxreturn=booking');
      rememberGatewayReturn('booking', 'booking-123');
      expect(takeGatewayReturn()).toEqual({ kind: 'booking', id: 'booking-123' });
    });

    it('still reads the kinds that were there first', () => {
      setUrl('?dxreturn=utility');
      expect(gatewayReturnKindFromUrl()).toBe('utility');
      setUrl('?dxreturn=wallet');
      expect(gatewayReturnKindFromUrl()).toBe('wallet');
    });

    it('refuses a kind it does not know', () => {
      setUrl('?dxreturn=definitely-not-a-kind');
      expect(gatewayReturnKindFromUrl()).toBeNull();
    });
  });

  describe('the callback URL', () => {
    it('names the flow to come back to', () => {
      setUrl('');
      expect(gatewayCallbackUrl('booking')).toContain('dxreturn=booking');
    });

    /** A stale `?dxreturn` or a `?preview=1` must not ride along into the
     *  callback and make the next return trip lie about which flow it was. */
    it('strips whatever query was already there', () => {
      setUrl('?preview=1&dxreturn=wallet');
      const url = gatewayCallbackUrl('booking');
      expect(url).toContain('dxreturn=booking');
      expect(url).not.toContain('preview=1');
      expect(url).not.toContain('dxreturn=wallet');
    });
  });

  describe('taking the pending payment', () => {
    /** A reload must not re-run the confirmation. */
    it('yields the payment once and then nothing', () => {
      setUrl('?dxreturn=booking');
      rememberGatewayReturn('booking', 'booking-123');
      expect(takeGatewayReturn()).not.toBeNull();
      expect(takeGatewayReturn()).toBeNull();
    });

    /** Storage can hold a stale entry from a trip that was abandoned. Without
     *  the URL saying this is a return, acting on it would confirm a payment
     *  the customer never made on this visit. */
    it('ignores storage when this is not a return trip', () => {
      rememberGatewayReturn('booking', 'booking-123');
      setUrl('');
      expect(takeGatewayReturn()).toBeNull();
    });

    it('clears the parameter so a refresh is not a second return', () => {
      setUrl('?dxreturn=booking');
      clearGatewayReturnParam();
      expect(gatewayReturnKindFromUrl()).toBeNull();
    });
  });
});
