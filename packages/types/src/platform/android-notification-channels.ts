/**
 * DPX-MOBILE-001 — Android notification channels.
 *
 * A channel id is a contract between two codebases: the Android app creates the
 * channel, and the backend names it on the message. `AndroidNotification.channelId`
 * is documented as *"The app must create a channel with this channel ID before any
 * notification with this channel ID can be received. If you don't send this channel
 * ID in the request, or if the channel ID provided has not yet been created by the
 * app, FCM uses the channel ID specified in the app manifest."*
 *
 * There is no manifest default channel in this app, so a mismatch does not raise an
 * error anywhere — the alert simply arrives on FCM's own fallback channel, quiet and
 * low-importance, which is the exact failure this work exists to remove. Two string
 * literals in two repositories' worth of code is how that happens, so the id lives
 * here and both sides import it.
 */

/**
 * The channel a ride offer is delivered on.
 *
 * **The `_v1` suffix is load-bearing.** A NotificationChannel's importance, sound and
 * vibration are fixed at creation: once the channel exists on a device, `createChannel`
 * with the same id is a no-op, and the settings belong to the user — by design, so an
 * app cannot make itself louder after someone has turned it down. Changing what a ride
 * alert sounds like therefore means creating a *new* channel and deleting the old one,
 * not editing this definition. The suffix makes that unavoidable rather than something
 * to rediscover when the edit silently does nothing on every existing install.
 */
export const RIDE_ALERT_ANDROID_CHANNEL_ID = 'dripplex_ride_alerts_v1';

/**
 * DPX-MOBILE-002 — the channel an incoming voice call rings on.
 *
 * Separate from the ride-alert channel on purpose, and not because a call is
 * more urgent. A channel is the unit a *person* silences: sharing one would mean
 * a driver who turns ride requests down to silent — a legitimate thing to do
 * between shifts — also stops hearing the passenger phoning them mid-trip. Two
 * channels is what makes those two decisions separable in the system settings.
 *
 * The `_v1` suffix is load-bearing for the same reason it is on the ride
 * channel: importance, sound and vibration are fixed when the channel is
 * created, and editing this definition would silently do nothing on every
 * device that already has it.
 */
export const CALL_ALERT_ANDROID_CHANNEL_ID = 'dripplex_call_alerts_v1';
