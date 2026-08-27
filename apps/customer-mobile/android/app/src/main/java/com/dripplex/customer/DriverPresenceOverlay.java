package com.dripplex.customer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

/**
 * DPX-MOBILE-003 — the floating driver bubble (founder decision, 2026-08-27).
 *
 * The ongoing foreground-service notification already tells a driver they are
 * online from anywhere in Android. The founder asked for the Uber/Bolt
 * behaviour on top of that: a circle that sits over whatever else they are
 * doing, so the shift is visible without pulling down the shade.
 *
 * Why this needs SYSTEM_ALERT_WINDOW, when nothing else in DrippleX does:
 * Android has a supported floating-bubble API that needs no such permission,
 * but it does not fit. Bubbles require API 30+ with a sharing shortcut and a
 * conversation-style notification; this app is minSdk 23, so most handsets in
 * the launch market would get nothing at all.
 *
 * SYSTEM_ALERT_WINDOW is a **special** permission: it cannot be granted by a
 * runtime dialog. The user has to be sent to Settings via
 * ACTION_MANAGE_OVERLAY_PERMISSION and toggle it themselves, which is why
 * every path here treats "not granted" as normal rather than as an error. A
 * driver who declines the overlay still has a fully working shift — the
 * service, the reporting and the notification are all unaffected.
 */
final class DriverPresenceOverlay {

  private final Context context;
  private WindowManager windowManager;
  private View bubble;

  DriverPresenceOverlay(Context context) {
    this.context = context;
  }

  /** Whether the user has granted "Display over other apps". Always true below
   * API 23, where the permission was granted at install. */
  static boolean canDrawOverlays(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true;
    }
    return Settings.canDrawOverlays(context);
  }

  /** The Settings screen that grants it. There is no dialog to show instead —
   * this is the only route. */
  static Intent overlaySettingsIntent(Context context) {
    Intent intent =
        new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:" + context.getPackageName()));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return intent;
  }

  boolean isShowing() {
    return bubble != null;
  }

  /**
   * Add the bubble, if permitted and not already up.
   *
   * Returns false rather than throwing when the permission is absent: the
   * caller is the presence service, and a missing overlay must never take the
   * shift down with it.
   */
  @SuppressLint("ClickableViewAccessibility")
  boolean show() {
    if (bubble != null) {
      return true;
    }
    if (!canDrawOverlays(context)) {
      return false;
    }
    windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
    if (windowManager == null) {
      return false;
    }

    bubble = buildBubble();

    // TYPE_APPLICATION_OVERLAY is the only type allowed from API 26; the older
    // TYPE_PHONE still works below it and is the only option there.
    int type =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

    // An explicit square, not WRAP_CONTENT.
    //
    // A view added straight to the WindowManager takes its size from THESE
    // params; the FrameLayout.LayoutParams that buildBubble() sets on the
    // container are the wrong type for a window root and are discarded. So
    // WRAP_CONTENT sized the bubble to the "DX" text — narrow — while the
    // child's own params forced 56dp of height, and the oval background
    // stretched into a visible ellipse on the first device that showed it
    // (2026-08-27). The drawable is an OVAL; only a square box makes it a
    // circle.
    final WindowManager.LayoutParams params =
        new WindowManager.LayoutParams(
            dp(56),
            dp(56),
            type,
            // NOT_FOCUSABLE so the bubble never steals typing from the app
            // underneath — a driver texting must not have keystrokes eaten by a
            // circle. NOT_TOUCH_MODAL so taps outside it pass straight through.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            android.graphics.PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.START;
    params.x = dp(12);
    params.y = dp(160);

    bubble.setOnTouchListener(new DragToMove(params));

    try {
      windowManager.addView(bubble, params);
      return true;
    } catch (Exception e) {
      // Permission revoked between the check and the add, or an OEM refusing
      // the window type. Either way the shift continues without a bubble.
      bubble = null;
      return false;
    }
  }

  void hide() {
    if (bubble == null || windowManager == null) {
      bubble = null;
      return;
    }
    try {
      windowManager.removeView(bubble);
    } catch (Exception ignored) {
      // Already detached, or the window token is gone with the service.
    }
    bubble = null;
  }

  /**
   * The app's own launcher icon, not a lettered circle.
   *
   * The first version was a bright green circle with "DX" in white — which at
   * 56dp, floating over another app during a driver's shift, is the visual
   * signature of a competitor operating in this market (founder concern,
   * 2026-08-27). Changing the green alone was not enough: a green circle with
   * two white letters is the resemblance, not the exact shade.
   *
   * `ic_launcher_round` is the mark DrippleX already ships on every home screen
   * and in every notification, in every density the device might ask for. A
   * driver seeing it over WhatsApp knows exactly whose it is, and no argument
   * about whose green it resembles survives it being our actual logo.
   *
   * The emerald ring behind it is the brand primary from BRAND-IDENTITY.md
   * (#0E7A3E, not the brighter #2BAC52 this started with — that one is the
   * in-app "you are online" green, right for a status dot inside our own screen
   * and wrong for something floating over everyone else's).
   */
  private View buildBubble() {
    ImageView mark = new ImageView(context);
    mark.setImageResource(R.mipmap.ic_launcher_round);
    mark.setScaleType(ImageView.ScaleType.FIT_CENTER);

    GradientDrawable circle = new GradientDrawable();
    circle.setShape(GradientDrawable.OVAL);
    circle.setColor(Color.parseColor("#0E7A3E"));
    circle.setStroke(dp(2), Color.parseColor("#66FFFFFF"));

    FrameLayout container = new FrameLayout(context);
    container.setBackground(circle);
    // Inset by dp(6) on each side so the emerald ring stays visible around the
    // mark rather than the icon covering the whole circle. The window itself is
    // an explicit dp(56) square — see show().
    FrameLayout.LayoutParams markParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    markParams.setMargins(dp(6), dp(6), dp(6), dp(6));
    container.addView(mark, markParams);
    container.setContentDescription("DrippleX — you are online. Tap to open.");
    return container;
  }

  /**
   * Drag to reposition, tap to open the app.
   *
   * The two are told apart by distance, not by timing: a tap that wanders a few
   * pixels is still a tap, and a slow deliberate drag is still a drag. Timing
   * alone would make the bubble open the app whenever a driver nudged it out of
   * the way.
   */
  private final class DragToMove implements View.OnTouchListener {
    private final WindowManager.LayoutParams params;
    private int startX;
    private int startY;
    private float touchX;
    private float touchY;
    private boolean dragged;
    private final int slop;

    DragToMove(WindowManager.LayoutParams params) {
      this.params = params;
      this.slop = android.view.ViewConfiguration.get(context).getScaledTouchSlop();
    }

    @Override
    public boolean onTouch(View view, MotionEvent event) {
      switch (event.getAction()) {
        case MotionEvent.ACTION_DOWN:
          startX = params.x;
          startY = params.y;
          touchX = event.getRawX();
          touchY = event.getRawY();
          dragged = false;
          return true;
        case MotionEvent.ACTION_MOVE:
          int dx = (int) (event.getRawX() - touchX);
          int dy = (int) (event.getRawY() - touchY);
          if (!dragged && Math.abs(dx) < slop && Math.abs(dy) < slop) {
            return true;
          }
          dragged = true;
          params.x = startX + dx;
          params.y = startY + dy;
          if (windowManager != null && bubble != null) {
            try {
              windowManager.updateViewLayout(bubble, params);
            } catch (Exception ignored) {
              // The window went away mid-drag; nothing to reposition.
            }
          }
          return true;
        case MotionEvent.ACTION_UP:
          if (!dragged) {
            openApp();
          }
          return true;
        default:
          return false;
      }
    }
  }

  private void openApp() {
    Intent open = new Intent(context, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    try {
      context.startActivity(open);
    } catch (Exception ignored) {
      // Nothing useful to do — the notification remains a second way in.
    }
  }

  private int dp(int value) {
    return (int)
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value, context.getResources().getDisplayMetrics());
  }
}
