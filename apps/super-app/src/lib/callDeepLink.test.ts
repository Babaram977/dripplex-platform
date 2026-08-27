import { describe, expect, it } from 'vitest';

import { incomingCallFromDeepLink } from './callRequests';

/**
 * DPX-MOBILE-002 Stage 2 — the deep link on an incoming-call push.
 *
 * This link is not navigation. It is the only record of the call that reaches
 * a device whose app was closed: `call:incoming` went out over a socket
 * nothing was connected to, so what is parsed here is what the callee gets to
 * answer. Two failures matter — refusing a link that is real, and accepting
 * one that is stale.
 */

const NOW = Date.parse('2026-08-27T10:00:00.000Z');
const CALL = 'call-01JB8XR3ZQ7K9V2N4M6P8T';

describe('incomingCallFromDeepLink', () => {
  it('reads the call, its expiry and the kind of job', () => {
    expect(
      incomingCallFromDeepLink(
        `/call/${CALL}?expires=2026-08-27T10%3A00%3A45.000Z&context=RIDE`,
        NOW,
      ),
    ).toEqual({
      callId: CALL,
      contextType: 'RIDE',
      expiresAt: '2026-08-27T10:00:45.000Z',
    });
  });

  it('reads a delivery call', () => {
    expect(incomingCallFromDeepLink(`/call/${CALL}?context=DELIVERY`, NOW)?.contextType).toBe(
      'DELIVERY',
    );
  });

  it('refuses a call that has already stopped ringing', () => {
    // The whole point. FCM's TTL stops a *delivery* that is too late; this
    // stops a *tap* that is. A push can sit unnoticed on a lock screen for an
    // hour, and a ringing screen for a call nobody is on is worse than none.
    expect(
      incomingCallFromDeepLink(`/call/${CALL}?expires=2026-08-27T09%3A59%3A59.000Z`, NOW),
    ).toBeNull();
  });

  it('treats the expiry moment itself as over', () => {
    expect(
      incomingCallFromDeepLink(`/call/${CALL}?expires=2026-08-27T10%3A00%3A00.000Z`, NOW),
    ).toBeNull();
  });

  it('rings anyway when the expiry is unreadable', () => {
    // A malformed timestamp is a bug on our side. Throwing away a real call
    // over it is the worse of the two outcomes — the ringing screen has its own
    // give-up timer, so the cost is a screen that closes itself a minute later.
    expect(incomingCallFromDeepLink(`/call/${CALL}?expires=soon`, NOW)?.callId).toBe(CALL);
  });

  it('rings when the link carries no expiry at all', () => {
    expect(incomingCallFromDeepLink(`/call/${CALL}`, NOW)).toEqual({
      callId: CALL,
      contextType: null,
      expiresAt: null,
    });
  });

  it('ignores an unknown context rather than guessing one', () => {
    expect(incomingCallFromDeepLink(`/call/${CALL}?context=HOTEL`, NOW)?.contextType).toBeNull();
  });

  it.each([
    ['a link for something else', '/ride'],
    ['a bare path', '/call'],
    ['no call id', '/call/'],
    ['an id too short to be one', '/call/abc'],
    ['a nested path', '/call/abc/def'],
    ['an empty string', ''],
    // The id is used verbatim in a POST path. Anything that is not the shape of
    // an id has no business getting that far.
    ['a traversal attempt', '/call/../../admin'],
    ['a path separator smuggled in', '/call/abc%2F..%2Fadmin'],
  ])('returns null for %s', (_why, link) => {
    expect(incomingCallFromDeepLink(link, NOW)).toBeNull();
  });

  it('does not throw on a link that is not a URL at all', () => {
    expect(() => incomingCallFromDeepLink('http://[', NOW)).not.toThrow();
    expect(incomingCallFromDeepLink('http://[', NOW)).toBeNull();
  });
});
