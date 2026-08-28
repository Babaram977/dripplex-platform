import { describe, expect, it } from 'vitest';

import {
  CALL_ALERT_ANDROID_CHANNEL_ID,
  CALL_ALERT_ANDROID_CHANNEL_ID_V1,
  RIDE_ALERT_ANDROID_CHANNEL_ID,
  RIDE_ALERT_ANDROID_CHANNEL_ID_V1,
} from './android-notification-channels.js';

describe('RIDE_ALERT_ANDROID_CHANNEL_ID', () => {
  it('is the exact string every installed app has already created', () => {
    // Not a tautology, and not a value to update when this test fails.
    //
    // A NotificationChannel is identified by this string on the device. Changing
    // it does not reconfigure the ride-alert channel — it orphans the one every
    // existing install already created, leaves it visible in the user's settings,
    // and starts sending offers to a channel their phone will not have until it
    // next launches the app. Any edit here is a migration, so it has to be
    // deliberate enough to change a test that says so.
    //
    // It was v1 until 2026-08-27, and this test did its job: the bump to v2 is
    // the migration it describes, done on purpose. v1 named no sound, so Android
    // gave it the handset default — which a driver, hearing the first real offer
    // ever to reach a phone, called "so slow". A channel's sound is fixed at
    // creation, so a new sound requires a new id; editing v1 in place would have
    // changed nothing on any existing install.
    expect(RIDE_ALERT_ANDROID_CHANNEL_ID).toBe('dripplex_ride_alerts_v2');
  });
});

describe('CALL_ALERT_ANDROID_CHANNEL_ID', () => {
  it('is the exact string every installed app has already created', () => {
    // Same migration hazard as the ride channel above. See that comment.
    expect(CALL_ALERT_ANDROID_CHANNEL_ID).toBe('dripplex_call_alerts_v2');
  });

  it('is not the ride-alert channel', () => {
    // The reason there are two. A channel is the unit a person silences in
    // Android's own settings, so sharing one would mean a driver turning ride
    // requests down between shifts also stops hearing the passenger phoning
    // them mid-trip — one switch for two unrelated decisions.
    expect(CALL_ALERT_ANDROID_CHANNEL_ID).not.toBe(RIDE_ALERT_ANDROID_CHANNEL_ID);
  });
});

describe('the superseded channel ids', () => {
  // These exist so the app can DELETE the channels it no longer uses. Without
  // them a driver keeps a dead "Ride requests" entry in their notification
  // settings for alerts that will never arrive on it again — so losing one is a
  // user-visible regression, not a tidy-up.
  it('still name the channels an existing install is carrying', () => {
    expect(RIDE_ALERT_ANDROID_CHANNEL_ID_V1).toBe('dripplex_ride_alerts_v1');
    expect(CALL_ALERT_ANDROID_CHANNEL_ID_V1).toBe('dripplex_call_alerts_v1');
  });

  it('are not the ids currently in use', () => {
    // The whole point of a version bump. If a future edit ever makes these
    // equal, the app would delete the channel it had just created — and the
    // alert would go silent with nothing reporting a problem.
    expect(RIDE_ALERT_ANDROID_CHANNEL_ID_V1).not.toBe(RIDE_ALERT_ANDROID_CHANNEL_ID);
    expect(CALL_ALERT_ANDROID_CHANNEL_ID_V1).not.toBe(CALL_ALERT_ANDROID_CHANNEL_ID);
  });
});
