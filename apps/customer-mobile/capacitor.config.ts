import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Remote URL shell — customer-web is a Next.js SSR app (not a static export).
 * Production/staging URLs are injected at CI via CAPACITOR_SERVER_URL.
 * @see docs/mobile/ANDROID.md · docs/mobile/IOS.md
 */
const serverUrl =
  process.env['CAPACITOR_SERVER_URL'] ??
  process.env['NEXT_PUBLIC_APP_URL'] ??
  'https://app.dripplex.com';

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
