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
import android.widget.TextView;

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

    final WindowManager.LayoutParams params =
        new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
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

  private View buildBubble() {
    int size = dp(56);

    TextView label = new TextView(context);
    label.setText("DX");
    label.setTextColor(Color.WHITE);
    label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f);
    label.setGravity(Gravity.CENTER);
    label.setTypeface(label.getTypeface(), android.graphics.Typeface.BOLD);

    GradientDrawable circle = new GradientDrawable();
    circle.setShape(GradientDrawable.OVAL);
    // DrippleX green, the same family the app's own online state uses.
    circle.setColor(Color.parseColor("#2BAC52"));
    circle.setStroke(dp(2), Color.parseColor("#66FFFFFF"));

    FrameLayout container = new FrameLayout(context);
    container.setBackground(circle);
    container.addView(
        label, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, size));
    container.setLayoutParams(new FrameLayout.LayoutParams(size, size));
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
