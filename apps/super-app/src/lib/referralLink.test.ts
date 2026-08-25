import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import {
  capturedReferralCode,
  captureReferralCodeFromUrl,
  clearCapturedReferralCode,
  referralShareUrl,
} from './referralLink';

function land(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

describe('referralLink', () => {
  beforeEach(() => {
    localStorage.clear();
    land('');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('referralShareUrl', () => {
    it('puts the code on the app origin', () => {
      expect(referralShareUrl('VJNERCQC')).toBe(`${window.location.origin}/?ref=VJNERCQC`);
    });

    // A preview build must share a preview link, and a stale ?preview=1 or
    // ?ref= must not ride along into the invite.
    it('drops any existing query, hash and path', () => {
      land('?preview=1&ref=OLD#section');
      expect(referralShareUrl('NEWCODE1')).toBe(`${window.location.origin}/?ref=NEWCODE1`);
    });
  });

  describe('captureReferralCodeFromUrl', () => {
    it('stores the code and strips it from the address bar', () => {
      land('?ref=VJNERCQC');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('VJNERCQC');
      expect(window.location.search).toBe('');
    });

    it('uppercases a lowercase code from a hand-edited link', () => {
      land('?ref=vjnercqc');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('VJNERCQC');
    });

    it('keeps other params intact', () => {
      land('?ref=VJNERCQC&app=driver');
      captureReferralCodeFromUrl();
      expect(window.location.search).toBe('?app=driver');
    });

    it('ignores a malformed code but still strips it', () => {
      land('?ref=no');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('');
      expect(window.location.search).toBe('');
    });

    it('does nothing when there is no ref param', () => {
      land('?app=driver');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('');
      expect(window.location.search).toBe('?app=driver');
    });

    it('a later link replaces an earlier one', () => {
      land('?ref=FIRSTAAA');
      captureReferralCodeFromUrl();
      land('?ref=SECONDBB');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('SECONDBB');
    });
  });

  describe('capturedReferralCode', () => {
    it('is empty when nothing was captured', () => {
      expect(capturedReferralCode()).toBe('');
    });

    // Without this a code stored today would attach itself to a signup a year
    // from now and credit a referrer who had nothing to do with it.
    it('expires after 30 days', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      land('?ref=VJNERCQC');
      captureReferralCodeFromUrl();
      expect(capturedReferralCode()).toBe('VJNERCQC');

      vi.setSystemTime(new Date('2026-01-29T00:00:00Z'));
      expect(capturedReferralCode()).toBe('VJNERCQC');

      vi.setSystemTime(new Date('2026-02-05T00:00:00Z'));
      expect(capturedReferralCode()).toBe('');
    });

    it('discards a corrupt entry rather than throwing', () => {
      localStorage.setItem('dx.referralCode', 'not json');
      expect(capturedReferralCode()).toBe('');
      expect(localStorage.getItem('dx.referralCode')).toBeNull();
    });
  });

  it('clearCapturedReferralCode stops a code attaching to a second signup', () => {
    land('?ref=VJNERCQC');
    captureReferralCodeFromUrl();
    clearCapturedReferralCode();
    expect(capturedReferralCode()).toBe('');
  });
});
