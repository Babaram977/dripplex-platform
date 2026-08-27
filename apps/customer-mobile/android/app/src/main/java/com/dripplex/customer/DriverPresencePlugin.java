package com.dripplex.customer;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * DPX-MOBILE-003 — the JavaScript door to {@link DriverPresenceService}.
 *
 * Deliberately thin: start, stop, and a way to ask. Everything that decides
 * *whether* a driver should be visible stays in the app, where the driver's
 * role, their online toggle and their commission standing already live. This
 * class only carries that decision across to the platform.
 *
 * The caller supplies the API base URL and access token. The service needs
 * them because it reports on its own — see the note in DriverPresenceService
 * about why waking the WebView to do it would reintroduce the bug.
 */
@CapacitorPlugin(name = "DriverPresence")
public class DriverPresencePlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    String baseUrl = call.getString("baseUrl");
    String token = call.getString("token");
    String vehicleType = call.getString("vehicleType");

    if (baseUrl == null || token == null || vehicleType == null) {
      call.reject("baseUrl, token and vehicleType are required");
      return;
    }

    Intent intent = new Intent(getContext(), DriverPresenceService.class);
    intent.setAction(DriverPresenceService.ACTION_START);
    intent.putExtra(DriverPresenceService.EXTRA_BASE_URL, baseUrl);
    intent.putExtra(DriverPresenceService.EXTRA_TOKEN, token);
    intent.putExtra(DriverPresenceService.EXTRA_VEHICLE_TYPE, vehicleType);
    intent.putExtra(
        DriverPresenceService.EXTRA_ACCEPTING_RIDES,
        Boolean.TRUE.equals(call.getBoolean("acceptingRides", Boolean.TRUE)));
    Boolean deliveries = call.getBoolean("acceptingDeliveries");
    if (deliveries != null) {
      intent.putExtra(DriverPresenceService.EXTRA_ACCEPTING_DELIVERIES, deliveries.booleanValue());
    }
    Integer intervalMs = call.getInt("intervalMs");
    if (intervalMs != null) {
      intent.putExtra(DriverPresenceService.EXTRA_INTERVAL_MS, intervalMs.longValue());
    }
    // The fix the WebView already holds. Both or neither — half a coordinate
    // pair is worse than none, and the service checks for both extras.
    Double seedLatitude = call.getDouble("latitude");
    Double seedLongitude = call.getDouble("longitude");
    if (seedLatitude != null && seedLongitude != null) {
      intent.putExtra(DriverPresenceService.EXTRA_SEED_LATITUDE, seedLatitude.doubleValue());
      intent.putExtra(DriverPresenceService.EXTRA_SEED_LONGITUDE, seedLongitude.doubleValue());
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(intent);
      } else {
        getContext().startService(intent);
      }
    } catch (Exception e) {
      // Android 12+ throws ForegroundServiceStartNotAllowedException if this is
      // ever reached from the background. It should not be — the driver taps
      // "Go online" with the app on screen — but a rejected start must surface
      // as a failed promise rather than crash the WebView.
      call.reject("Could not start driver presence: " + e.getClass().getSimpleName());
      return;
    }

    JSObject result = new JSObject();
    result.put("started", true);
    call.resolve(result);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), DriverPresenceService.class);
    intent.setAction(DriverPresenceService.ACTION_STOP);
    // startService for the stop path, never startForegroundService: the latter
    // promises Android a startForeground() call within five seconds and this
    // intent's whole purpose is to not do that.
    try {
      getContext().startService(intent);
    } catch (Exception ignored) {
      // Already dead, or the process is being torn down. Either way there is
      // nothing left to stop and a driver signing out must not see an error.
    }
    getContext().stopService(intent);
    call.resolve();
  }

  /**
   * Whether "Display over other apps" is granted.
   *
   * SYSTEM_ALERT_WINDOW is a special permission: there is no runtime dialog for
   * it, so the app cannot ask and get an answer. All it can do is check, and
   * send the driver to Settings.
   */
  @PluginMethod
  public void hasOverlayPermission(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", DriverPresenceOverlay.canDrawOverlays(getContext()));
    call.resolve(result);
  }

  /**
   * Open the Settings screen that grants it.
   *
   * Resolves as soon as Settings is launched — it cannot report the outcome,
   * because the user makes the choice in another app and may simply come back.
   * Callers must re-check with hasOverlayPermission() rather than assume.
   */
  @PluginMethod
  public void requestOverlayPermission(PluginCall call) {
    if (DriverPresenceOverlay.canDrawOverlays(getContext())) {
      JSObject already = new JSObject();
      already.put("opened", false);
      already.put("granted", true);
      call.resolve(already);
      return;
    }
    try {
      getContext().startActivity(DriverPresenceOverlay.overlaySettingsIntent(getContext()));
    } catch (Exception e) {
      // Some OEM builds ship no such Settings screen. Nothing is broken — the
      // driver just cannot have the bubble on that handset.
      call.reject("Could not open the overlay permission screen");
      return;
    }
    JSObject result = new JSObject();
    result.put("opened", true);
    result.put("granted", false);
    call.resolve(result);
  }

  /**
   * Replace the access token the running service is using.
   *
   * The service cannot renew its own — it holds no refresh token, and putting
   * one inside a background service is not a trade worth making. JWT_ACCESS_TTL
   * is 15 minutes, so without this the service died of old age mid-shift.
   *
   * Resolves even when nothing is running: the app calls this on every token
   * refresh, and most of those happen with no driver online.
   */
  @PluginMethod
  public void updateToken(PluginCall call) {
    String token = call.getString("token");
    if (token == null || token.isEmpty()) {
      call.reject("token is required");
      return;
    }
    if (!DriverPresenceService.isActive()) {
      call.resolve();
      return;
    }
    Intent intent = new Intent(getContext(), DriverPresenceService.class);
    intent.setAction(DriverPresenceService.ACTION_UPDATE_TOKEN);
    intent.putExtra(DriverPresenceService.EXTRA_TOKEN, token);
    try {
      // startService, never startForegroundService: the service is already in
      // the foreground and this intent promises Android no new startForeground.
      getContext().startService(intent);
    } catch (Exception ignored) {
      // Being torn down. The next Go-online hands over a fresh token anyway.
    }
    call.resolve();
  }

  @PluginMethod
  public void isRunning(PluginCall call) {
    JSObject result = new JSObject();
    result.put("running", DriverPresenceService.isActive());
    call.resolve(result);
  }
}
