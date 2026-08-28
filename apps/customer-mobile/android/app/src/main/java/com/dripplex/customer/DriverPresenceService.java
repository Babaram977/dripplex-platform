package com.dripplex.customer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * DPX-MOBILE-003 — keeps a driver visible to dispatch while the app is not on
 * screen.
 *
 * The problem this exists for, in one line: the driver heartbeat was a
 * `setInterval` inside the WebView. Android throttles and then freezes WebView
 * JS timers when the app is backgrounded, so roughly four minutes after a
 * driver minimises DrippleX their `locationUpdatedAt` ages past
 * DRIVER_LOCATION_MAX_AGE_MS (5 minutes) and `findNearestEligibleDriver` skips
 * them — while `DriverAvailability.online` is still true and their screen still
 * says "You are live". They do not go offline. They go invisible.
 *
 * A foreground service is the sanctioned Android mechanism for continuing to
 * receive location with the app backgrounded, and it needs no
 * ACCESS_BACKGROUND_LOCATION as long as it is started while the app is visible
 * — which it is, from the driver tapping "Go online". Its ongoing notification
 * is also the "floating presence" the founder asked for: the driver can see at
 * a glance, from anywhere in Android, that DrippleX still has them working.
 *
 * Reporting is done here rather than handed back to JavaScript on purpose. A
 * foreground service keeps the process alive, but Chromium still throttles
 * timers in a WebView that is not visible, so a native service that woke the
 * WebView to do the POST would reintroduce the exact bug it is fixing.
 *
 * The access token is passed in at start and held in memory only. It is never
 * written to disk, never logged, and is dropped when the service stops.
 */
public class DriverPresenceService extends Service {
  private static final String TAG = "DriverPresence";

  public static final String ACTION_START = "com.dripplex.customer.PRESENCE_START";
  public static final String ACTION_STOP = "com.dripplex.customer.PRESENCE_STOP";
  /** Swap in a fresh access token without disturbing the running service. */
  public static final String ACTION_UPDATE_TOKEN = "com.dripplex.customer.PRESENCE_UPDATE_TOKEN";

  public static final String EXTRA_BASE_URL = "baseUrl";
  public static final String EXTRA_TOKEN = "token";
  /**
   * The availability endpoint, relative to the base URL — e.g.
   * "/driver/rides/availability" or "/rider/availability".
   *
   * Was hardcoded to the driver's. Riders have the same problem drivers had
   * (DPX-MOBILE-003): they go online, minimise the app, and stop reporting,
   * because a WebView setInterval is throttled by Chromium and the process is
   * killed by Android. The fix is the same foreground service — so it is the
   * path and the body that vary, not the mechanism.
   */
  public static final String EXTRA_PRESENCE_PATH = "presencePath";
  /**
   * The persona-specific half of the request body, as a JSON string. The
   * service merges a fresh latitude and longitude into it on every tick.
   *
   * A driver sends {online, acceptingRides, acceptingDeliveries?, vehicleType};
   * a rider sends {online, acceptingOrders}. Rather than teach this class about
   * either shape, the caller supplies the whole thing and this file stays a
   * generic "post this, with a fresh fix, every N seconds" service. A future
   * persona is then a JavaScript change — which reaches a phone by web deploy —
   * instead of a native change, which needs a new APK on every device.
   */
  public static final String EXTRA_PRESENCE_BODY = "presenceBody";
  /** Notification body text while reporting is healthy. Differs per persona:
   * a rider is not waiting for ride requests. */
  public static final String EXTRA_ONLINE_TEXT = "onlineText";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";
  /** The fix the app already held when the driver went online. See
   * {@link #seedFromCaller}. */
  public static final String EXTRA_SEED_LATITUDE = "seedLatitude";
  public static final String EXTRA_SEED_LONGITUDE = "seedLongitude";

  /**
   * Distinct from the ride-alert channel (DPX-MOBILE-001): this one is a
   * persistent status line, not an interruption. IMPORTANCE_LOW so it never
   * makes a sound — a driver working a shift must not be pinged every minute by
   * their own presence indicator.
   */
  private static final String CHANNEL_ID = "dripplex_driver_presence_v1";
  private static final int NOTIFICATION_ID = 4201;

  /** The healthy state's body text when the caller names none. Anything other
   * than this means reporting is degraded and the person is being told so. */
  private static final String DEFAULT_ONLINE_TEXT = "DrippleX can send you requests";

  /**
   * Default reporting cadence. The server drops a driver from dispatch after 5
   * minutes (DRIVER_LOCATION_MAX_AGE_MS), so 60s leaves room for four
   * consecutive failures — a tunnel, a dead cell, a backend restart — before
   * the driver goes invisible. The WebView heartbeat used 120s, which allowed
   * exactly one miss.
   */
  private static final long DEFAULT_INTERVAL_MS = 60_000L;
  private static final long MIN_INTERVAL_MS = 15_000L;

  /**
   * How old a fix may be and still be worth reporting.
   *
   * The server stamps `locationUpdatedAt` with the time it receives the write,
   * so posting an old fix asserts the driver is there *now*. A few minutes of
   * drift is the price of staying dispatchable while backgrounded — the
   * WebView heartbeat has always had the same property. Beyond this, the claim
   * stops being true enough to make: reporting a half-hour-old position sends
   * dispatch to where the driver used to be, which is worse for the passenger
   * than the driver being invisible.
   */
  private static final long LOCATION_MAX_AGE_MS = 10 * 60_000L;

  /**
   * How long to keep reporting attempts alive after the token is rejected,
   * waiting for the app to push a fresh one.
   *
   * Ten minutes: long enough for a WebView that Android has throttled hard to
   * get round to its next request and refresh, short enough that a driver who
   * has genuinely been signed out is not left with a notification claiming a
   * shift the server will not accept.
   */
  private static final long TOKEN_GRACE_MS = 10 * 60_000L;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private final Handler handler = new Handler(Looper.getMainLooper());
  private ExecutorService network;
  private LocationManager locationManager;
  private LocationListener locationListener;

  private DriverPresenceOverlay overlay;
  private volatile Location lastLocation;
  /** What the ongoing notification currently says, so it is only rewritten when
   * the answer changes. */
  private String notificationText;
  /** When the token was first rejected, or 0 while it is good. Main thread. */
  private long tokenRejectedAtMs;
  private String baseUrl;
  private String token;
  private String presencePath;
  private String presenceBody;
  private String onlineText = DEFAULT_ONLINE_TEXT;
  private long intervalMs = DEFAULT_INTERVAL_MS;

  /** Whether the service is currently running, for the plugin's isRunning(). */
  private static volatile boolean active = false;

  public static boolean isActive() {
    return active;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null || ACTION_STOP.equals(intent.getAction())) {
      stopPresence();
      return START_NOT_STICKY;
    }

    // A token refresh, not a start. Swap it in and leave everything else alone:
    // restarting would drop and recreate the notification, and re-running
    // requestLocationUpdates would subscribe a second listener.
    if (ACTION_UPDATE_TOKEN.equals(intent.getAction())) {
      String fresh = intent.getStringExtra(EXTRA_TOKEN);
      if (fresh != null && !fresh.isEmpty() && running.get()) {
        token = fresh;
        tokenRejectedAtMs = 0L;
        Log.i(TAG, "access token refreshed by the app");
      }
      return START_NOT_STICKY;
    }

    baseUrl = trimTrailingSlash(intent.getStringExtra(EXTRA_BASE_URL));
    token = intent.getStringExtra(EXTRA_TOKEN);
    presencePath = intent.getStringExtra(EXTRA_PRESENCE_PATH);
    presenceBody = intent.getStringExtra(EXTRA_PRESENCE_BODY);
    String text = intent.getStringExtra(EXTRA_ONLINE_TEXT);
    if (text != null && !text.trim().isEmpty()) {
      onlineText = text;
    }
    long requested = intent.getLongExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS);
    intervalMs = Math.max(MIN_INTERVAL_MS, requested);

    if (baseUrl == null || token == null || presencePath == null || presenceBody == null) {
      // Without all four there is nothing to report, nowhere to report it, or
      // no way to authorise it. Failing loudly here beats a service that runs,
      // shows a notification, and silently reports nothing.
      Log.w(TAG, "start requested without baseUrl/token/presencePath/presenceBody — not starting");
      stopPresence();
      return START_NOT_STICKY;
    }

    startInForeground();

    if (running.compareAndSet(false, true)) {
      active = true;
      network = Executors.newSingleThreadExecutor();
      requestLocationUpdates();
      // After the providers, never before: a fix the device already has beats
      // one handed over from the WebView, and this only fills a gap.
      if (intent.hasExtra(EXTRA_SEED_LATITUDE) && intent.hasExtra(EXTRA_SEED_LONGITUDE)) {
        seedFromCaller(
            intent.getDoubleExtra(EXTRA_SEED_LATITUDE, 0d),
            intent.getDoubleExtra(EXTRA_SEED_LONGITUDE, 0d),
            System.currentTimeMillis());
      }
      handler.post(reportTick);
    }

    // The floating bubble (founder decision, 2026-08-27). Deliberately after
    // the reporting is up and never gated on: SYSTEM_ALERT_WINDOW is a special
    // permission the driver grants by hand in Settings, so "not granted" is an
    // ordinary state, not a failure. A driver who declines it still has a fully
    // working shift — the service, the reporting and the notification are
    // untouched. They simply do not get the circle.
    if (overlay == null) {
      overlay = new DriverPresenceOverlay(this);
    }
    overlay.show();

    // START_NOT_STICKY, deliberately. START_STICKY would have Android restart
    // this service after a process kill with a null intent — no token, no
    // base URL — so it would come back as a notification attached to a service
    // that can never report anything. A driver whose app was killed goes
    // offline, which is true, rather than appearing to work.
    return START_NOT_STICKY;
  }

  @Override
  public void onDestroy() {
    stopPresence();
    super.onDestroy();
  }

  private void stopPresence() {
    running.set(false);
    active = false;
    if (overlay != null) {
      // Before anything else can fail. A bubble outliving the shift floats over
      // every other app saying the driver is online when they are not, and the
      // only way to be rid of it is to kill the app.
      overlay.hide();
      overlay = null;
    }
    handler.removeCallbacks(reportTick);
    if (locationManager != null && locationListener != null) {
      try {
        locationManager.removeUpdates(locationListener);
      } catch (SecurityException ignored) {
        // Permission revoked while running; nothing left to remove.
      }
    }
    locationListener = null;
    if (network != null) {
      network.shutdownNow();
      network = null;
    }
    // Held in memory only, and dropped the moment the service stops.
    token = null;
    stopForeground(true);
    stopSelf();
  }

  private final Runnable reportTick =
      new Runnable() {
        @Override
        public void run() {
          if (!running.get()) {
            return;
          }
          postLocation();
          handler.postDelayed(this, intervalMs);
        }
      };

  private void requestLocationUpdates() {
    if (!hasLocationPermission()) {
      Log.w(TAG, "location permission not granted — presence cannot report");
      stopPresence();
      return;
    }
    locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    if (locationManager == null) {
      stopPresence();
      return;
    }
    locationListener =
        new LocationListener() {
          @Override
          public void onLocationChanged(Location location) {
            lastLocation = location;
          }

          // Required on API < 29; harmless no-ops above it.
          @Override
          public void onStatusChanged(String provider, int status, Bundle extras) {}

          @Override
          public void onProviderEnabled(String provider) {}

          @Override
          public void onProviderDisabled(String provider) {}
        };

    // EVERY enabled provider, not a hardcoded GPS/NETWORK pair.
    //
    // The pair was the 2026-08-27 field failure. The service started, showed its
    // notification, and posted nothing for nine minutes: GPS produces no fix
    // indoors, and on a modern handset NETWORK_PROVIDER frequently does not
    // exist at all — Google moved coarse location into Play Services, so
    // isProviderEnabled(NETWORK_PROVIDER) is false and requestFrom() silently
    // subscribed to nothing. getProviders(true) asks the device what it
    // actually has, including "fused" where the platform exposes it.
    try {
      for (String provider : locationManager.getProviders(true)) {
        requestFrom(provider);
      }
      seedFromLastKnown();
    } catch (SecurityException e) {
      Log.w(TAG, "location permission revoked while starting");
      stopPresence();
    }
  }

  private void requestFrom(String provider) throws SecurityException {
    if (locationManager.isProviderEnabled(provider)) {
      locationManager.requestLocationUpdates(provider, intervalMs, 0f, locationListener);
    }
  }

  /**
   * A cold start has no fix yet and the first tick would report nothing, which
   * is a minute of invisibility right when the driver has just gone online.
   *
   * Reads every enabled provider for the same reason the subscription does, and
   * keeps the newest. Note this can still leave `lastLocation` null on a device
   * that has never had a fix — which is what the caller-supplied seed covers.
   */
  private void seedFromLastKnown() throws SecurityException {
    if (lastLocation != null) {
      return;
    }
    Location best = null;
    for (String provider : locationManager.getProviders(true)) {
      Location candidate = locationManager.getLastKnownLocation(provider);
      if (candidate != null && (best == null || candidate.getTime() > best.getTime())) {
        best = candidate;
      }
    }
    lastLocation = best;
  }

  /**
   * The position the app already had when the driver tapped "Go online".
   *
   * `driverScreen` calls `getCurrentPosition()` and only then starts presence,
   * so the WebView holds a real fix at exactly the moment this service begins —
   * through Play Services' fused provider, which is why it succeeds where the
   * platform LocationManager above can come back empty. Passing it in means the
   * first tick reports something true rather than waiting on a provider that
   * may never fire.
   *
   * Only ever used when nothing better exists: a real fix from any provider
   * replaces it the moment one arrives, and `seedFromLastKnown` is preferred
   * when the device does have a recent fix of its own.
   */
  private void seedFromCaller(double latitude, double longitude, long fixedAt) {
    if (lastLocation != null) {
      return;
    }
    Location seed = new Location("dripplex-caller");
    seed.setLatitude(latitude);
    seed.setLongitude(longitude);
    seed.setTime(fixedAt);
    lastLocation = seed;
  }

  private boolean hasLocationPermission() {
    return ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        || ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
  }

  private void postLocation() {
    final Location location = lastLocation;
    final String url = baseUrl;
    final String bearer = token;
    final String path = presencePath;
    final String payload = presenceBody;
    if (url == null || bearer == null || path == null || payload == null || network == null) {
      return;
    }

    // The 2026-08-27 field failure lived here. `location == null` used to sit
    // in the condition above and return in silence, so a
    // service with no fix ran for nine minutes showing "You are online" while
    // writing nothing — indistinguishable, from the outside, from a service
    // that had never started. The driver went stale to dispatch at the
    // five-minute mark and their own screen never stopped saying they were live.
    //
    // Both cases below now say so where the driver can see it, because this is
    // exactly the class of failure the class comment promises not to have: a
    // service that runs, shows a notification, and reports nothing.
    if (location == null) {
      Log.w(TAG, "no location fix available — nothing to report");
      updateNotification("Waiting for location — you may not get requests");
      return;
    }
    final long age = System.currentTimeMillis() - location.getTime();
    if (age > LOCATION_MAX_AGE_MS) {
      Log.w(TAG, "location is " + (age / 1000) + "s old — not reporting it");
      updateNotification("Location is out of date — you may not get requests");
      return;
    }
    // NOT updateNotification(onlineText) here — that happens on a successful
    // response below. Setting it before the request would overwrite
    // "Sign-in expired" on the very next tick and hide the failure it exists to
    // show, which is the mistake this whole file keeps making.
    network.execute(
        () -> {
          HttpURLConnection connection = null;
          try {
            // The caller's own body, with a fresh fix merged in. Parsed rather
            // than string-spliced so a malformed payload fails here, on one
            // tick, instead of being posted as broken JSON every minute.
            JSONObject body = new JSONObject(payload);
            body.put("latitude", location.getLatitude());
            body.put("longitude", location.getLongitude());

            connection = (HttpURLConnection) new URL(url + path).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + bearer);
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
              out.write(body.toString().getBytes("UTF-8"));
            }
            int status = connection.getResponseCode();
            if (status == 401 || status == 403) {
              // The token this service was handed has expired.
              //
              // This used to call stopPresence() immediately, and that single
              // line capped the entire feature at fifteen minutes:
              // JWT_ACCESS_TTL is 15m, the service holds no refresh token, so
              // the first expiry killed the shift. On 2026-08-27 the bubble and
              // the notification vanished mid-test while the WebView — which
              // refreshes normally — carried on reporting without a hitch.
              //
              // The app pushes a new token through ACTION_UPDATE_TOKEN whenever
              // it refreshes its own, so a 401 is now a wait, not a death. The
              // grace window exists because that refresh needs the app to be
              // alive and to notice; if it never comes, the service still stops
              // rather than sit there claiming a shift it cannot report.
              handler.post(() -> onTokenRejected(status));
            } else if (status >= 200 && status < 300) {
              // The one place the healthy text is set, so it can only ever
              // appear when the server has actually accepted a report.
              handler.post(
                  () -> {
                    tokenRejectedAtMs = 0L;
                    updateNotification(onlineText);
                  });
            }
          } catch (Exception e) {
            // A failed report is normal — a tunnel, a dead cell. The next tick
            // tries again, and the 60s cadence leaves room for four misses
            // before the server drops the driver from dispatch. Never crash the
            // service for one bad request.
            Log.d(TAG, "availability report failed: " + e.getClass().getSimpleName());
          } finally {
            if (connection != null) {
              connection.disconnect();
            }
          }
        });
  }

  /**
   * A 401/403 came back. Wait for the app to hand over a fresh token, and give
   * up if it does not.
   *
   * Main thread only — it touches `tokenRejectedAtMs` and the notification.
   */
  private void onTokenRejected(int status) {
    if (!running.get()) {
      return;
    }
    if (tokenRejectedAtMs == 0L) {
      tokenRejectedAtMs = System.currentTimeMillis();
      Log.w(TAG, "availability rejected (" + status + ") — waiting for a fresh token");
      updateNotification("Sign-in expired — open DrippleX");
      return;
    }
    if (System.currentTimeMillis() - tokenRejectedAtMs > TOKEN_GRACE_MS) {
      Log.w(TAG, "no fresh token after " + (TOKEN_GRACE_MS / 1000) + "s — stopping presence");
      stopPresence();
    }
  }

  /** Replace the ongoing notification's body, leaving everything else alone.
   * No-ops when the text has not changed, so the shade is not rewritten every
   * minute of a normal shift. */
  private void updateNotification(String text) {
    if (text.equals(notificationText)) {
      return;
    }
    notificationText = text;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) {
      manager.notify(NOTIFICATION_ID, buildNotification(text));
    }
  }

  private Notification buildNotification(String text) {
    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, flags);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("You are online")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setContentIntent(contentIntent)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setShowWhen(false)
        .build();
  }

  private void startInForeground() {
    createChannel();
    notificationText = onlineText;
    Notification notification = buildNotification(onlineText);

    // Android 10 introduced the typed overload and Android 14 requires it for a
    // location service. Below 29 the untyped call is the only one that exists.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
          NOTIFICATION_ID,
          notification,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) {
      return;
    }
    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_ID, "Driver status", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Shows that you are online and able to receive ride requests.");
    channel.setShowBadge(false);
    channel.enableVibration(false);
    channel.setSound(null, null);
    manager.createNotificationChannel(channel);
  }

  private static String trimTrailingSlash(String value) {
    if (value == null) {
      return null;
    }
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }
}
