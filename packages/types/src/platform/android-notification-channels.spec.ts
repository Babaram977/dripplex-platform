import { describe, expect, it } from 'vitest';

import { RIDE_ALERT_ANDROID_CHANNEL_ID } from './android-notification-channels.js';

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
    expect(RIDE_ALERT_ANDROID_CHANNEL_ID).toBe('dripplex_ride_alerts_v1');
  });
});
