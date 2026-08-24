import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Remote URL shell. The APK loads the Super App — the canonical surface for
 * customers, drivers, riders and merchants (founder decision, 2026-08-24) —
 * which is served at app.dripplex.com.
 *
 * `NEXT_PUBLIC_APP_URL` used to sit in this chain as a second fallback. It is
 * customer-web's variable, and customer-web is a different service on a
 * different domain (dripplex.com / www.dripplex.com). A build machine with
 * that variable set and CAPACITOR_SERVER_URL unset would have shipped an APK
 * pointing at the marketing site instead of the app, silently and with no
 * error anywhere. CI has always set CAPACITOR_SERVER_URL explicitly, so this
 * never fired in a release build — but it was one unset variable away.
 *
 * Only an explicit CAPACITOR_SERVER_URL overrides the Super App now, which is
 * what staging and beta tracks already pass.
 * @see docs/mobile/ANDROID.md · docs/mobile/IOS.md
 */
const serverUrl = process.env['CAPACITOR_SERVER_URL'] ?? 'https://app.dripplex.com';

const config: CapacitorConfig = {
  appId: 'com.dripplex.customer',
  appName: 'Dripplex',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    flavor: process.env['ANDROID_FLAVOR'] ?? 'production',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env['NODE_ENV'] !== 'production',
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Dripplex',
    webContentsDebuggingEnabled: process.env['NODE_ENV'] !== 'production',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      // Black to match the black-ground brand artwork in
      // resources/dripplex-mark.svg. The previous green (#0E7A3E) framed
      // the splash image in a colour the image itself does not contain.
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
