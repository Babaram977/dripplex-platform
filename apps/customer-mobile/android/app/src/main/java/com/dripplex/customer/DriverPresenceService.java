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

  public static final String EXTRA_BASE_URL = "baseUrl";
  public static final String EXTRA_TOKEN = "token";
  public static final String EXTRA_VEHICLE_TYPE = "vehicleType";
  public static final String EXTRA_ACCEPTING_RIDES = "acceptingRides";
  public static final String EXTRA_ACCEPTING_DELIVERIES = "acceptingDeliveries";
  public static final String EXTRA_INTERVAL_MS = "intervalMs";

  /**
   * Distinct from the ride-alert channel (DPX-MOBILE-001): this one is a
   * persistent status line, not an interruption. IMPORTANCE_LOW so it never
   * makes a sound — a driver working a shift must not be pinged every minute by
   * their own presence indicator.
   */
  private static final String CHANNEL_ID = "dripplex_driver_presence_v1";
  private static final int NOTIFICATION_ID = 4201;

  /**
   * Default reporting cadence. The server drops a driver from dispatch after 5
   * minutes (DRIVER_LOCATION_MAX_AGE_MS), so 60s leaves room for four
   * consecutive failures — a tunnel, a dead cell, a backend restart — before
   * the driver goes invisible. The WebView heartbeat used 120s, which allowed
   * exactly one miss.
   */
  private static final long DEFAULT_INTERVAL_MS = 60_000L;
  private static final long MIN_INTERVAL_MS = 15_000L;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private final Handler handler = new Handler(Looper.getMainLooper());
  private ExecutorService network;
  private LocationManager locationManager;
  private LocationListener locationListener;

  private DriverPresenceOverlay overlay;
  private volatile Location lastLocation;
  private String baseUrl;
  private String token;
  private String vehicleType;
  private boolean acceptingRides = true;
  private Boolean acceptingDeliveries;
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

    baseUrl = trimTrailingSlash(intent.getStringExtra(EXTRA_BASE_URL));
    token = intent.getStringExtra(EXTRA_TOKEN);
    vehicleType = intent.getStringExtra(EXTRA_VEHICLE_TYPE);
    acceptingRides = intent.getBooleanExtra(EXTRA_ACCEPTING_RIDES, true);
    if (intent.hasExtra(EXTRA_ACCEPTING_DELIVERIES)) {
      acceptingDeliveries = intent.getBooleanExtra(EXTRA_ACCEPTING_DELIVERIES, false);
    }
    long requested = intent.getLongExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS);
    intervalMs = Math.max(MIN_INTERVAL_MS, requested);

    if (baseUrl == null || token == null || vehicleType == null) {
      // Without all three there is nothing to report and no way to authorise
      // it. Failing loudly here beats a service that runs, shows a
      // notification, and silently reports nothing.
      Log.w(TAG, "start requested without baseUrl/token/vehicleType — not starting");
      stopPresence();
      return START_NOT_STICKY;
    }

    startInForeground();

    if (running.compareAndSet(false, true)) {
      active = true;
      network = Executors.newSingleThreadExecutor();
      requestLocationUpdates();
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

    // Both providers. GPS is accurate and useless indoors or under cover;
    // network is coarse and available almost everywhere. Dispatch ranks on
    // distance, so a coarse fix that exists beats a precise one that does not.
    try {
      requestFrom(LocationManager.GPS_PROVIDER);
      requestFrom(LocationManager.NETWORK_PROVIDER);
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
   */
  private void seedFromLastKnown() throws SecurityException {
    if (lastLocation != null) {
      return;
    }
    Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
    Location net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
    if (gps != null && net != null) {
      lastLocation = gps.getTime() >= net.getTime() ? gps : net;
    } else if (gps != null) {
      lastLocation = gps;
    } else {
      lastLocation = net;
    }
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
    final String vehicle = vehicleType;
    final boolean rides = acceptingRides;
    final Boolean deliveries = acceptingDeliveries;
    if (location == null || url == null || bearer == null || vehicle == null || network == null) {
      return;
    }
    network.execute(
        () -> {
          HttpURLConnection connection = null;
          try {
            JSONObject body = new JSONObject();
            body.put("online", true);
            body.put("acceptingRides", rides);
            if (deliveries != null) {
              body.put("acceptingDeliveries", deliveries.booleanValue());
            }
            body.put("vehicleType", vehicle);
            body.put("latitude", location.getLatitude());
            body.put("longitude", location.getLongitude());

            connection = (HttpURLConnection) new URL(url + "/driver/rides/availability").openConnection();
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
              // The token this service was handed is no longer good. Reporting
              // on is pointless and keeping the notification up would tell the
              // driver they are working when the server disagrees.
              Log.w(TAG, "availability rejected (" + status + ") — stopping presence");
              handler.post(this::stopPresence);
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

  private void startInForeground() {
    createChannel();

    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, flags);

    Notification notification =
        new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("You are online")
            .setContentText("DrippleX can send you ride requests")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(false)
            .build();

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
