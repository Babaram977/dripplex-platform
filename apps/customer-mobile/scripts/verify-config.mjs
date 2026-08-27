#!/usr/bin/env node
/**
 * Validates customer-mobile packaging metadata without requiring Android SDK / Xcode.
 * This is a preflight gate only; signed store archives still require the native toolchains.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'capacitor.config.ts',
  'www/index.html',
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'ios/App/App/Info.plist',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/App.xcodeproj/project.pbxproj',
];

let failed = false;
const fail = (message) => {
  console.error(`FAIL ${message}`);
  failed = true;
};
const ok = (message) => console.log(`OK ${message}`);

for (const rel of required) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  else ok(rel);
}

const manifestPath = join(root, 'android/app/src/main/AndroidManifest.xml');
const gradlePath = join(root, 'android/app/build.gradle');
const plistPath = join(root, 'ios/App/App/Info.plist');
const privacyPath = join(root, 'ios/App/App/PrivacyInfo.xcprivacy');
const projectPath = join(root, 'ios/App/App.xcodeproj/project.pbxproj');

if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8');
  if (!gradle.includes('applicationId "com.dripplex.customer"'))
    fail('Android applicationId mismatch');
  else ok('Android applicationId');
  // This used to pin the literal `versionCode 1000100`, which is precisely the
  // state that broke: Play accepts a versionCode once per applicationId, for
  // ever, so a fixed number here means the second upload is rejected as a
  // duplicate — including one built to replace a bad release. CI now supplies
  // ANDROID_VERSION_CODE (scripts/mobile/build-android.sh).
  //
  // So the check is the wiring, not a magic number. Pinning the new value would
  // reintroduce the same defect one refactor later.
  //
  // Two assertions rather than one, because the value reaches versionCode
  // through a local: the env var must actually be read, AND the versionCode line
  // must not be a bare literal. Either alone passes a broken file — a literal
  // with the variable still declared above it, or a declaration nothing uses.
  //
  // Comments are stripped first. The block above this line mentions
  // ANDROID_VERSION_CODE by name, so a plain substring search over the file is
  // satisfied by prose: swapping the getenv call for a hardcoded number left the
  // check green until this was written.
  const gradleCode = gradle.replace(/\/\/.*$/gm, '');
  const versionCodeLine = /^\s*versionCode .*$/m.exec(gradleCode)?.[0]?.trim() ?? '';
  if (!versionCodeLine) fail('Android versionCode is missing');
  else if (/^versionCode\s+\d+\s*$/.test(versionCodeLine))
    fail(
      `Android versionCode is a fixed number, so Play would reject the next upload: ${versionCodeLine}`,
    );
  else if (!/System\.getenv\(\s*['"]ANDROID_VERSION_CODE['"]\s*\)/.test(gradleCode))
    fail('Android versionCode does not read ANDROID_VERSION_CODE — CI cannot bump it');
  else ok('Android versionCode is driven by ANDROID_VERSION_CODE');
  if (!gradle.includes('versionName "1.0.0"')) fail('Android versionName is missing or unexpected');
  else ok('Android versionName');
  if (
    !gradle.includes('production') ||
    !gradle.includes('internal') ||
    !gradle.includes('closedBeta')
  ) {
    fail('Android release flavors are incomplete');
  } else ok('Android release flavors');
}

if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:exported="true"'))
    fail('Android launcher activity is not explicitly exported');
  else ok('Android launcher export');
  if (!manifest.includes('android:scheme="https" android:host="app.dripplex.com"'))
    fail('Android HTTPS deep-link host missing');
  else ok('Android HTTPS deep link');
  if (!manifest.includes('android.permission.INTERNET'))
    fail('Android INTERNET permission missing');
  else ok('Android INTERNET permission');

  // Capacitor cannot grant navigator.geolocation a permission the app never
  // declared. Without these, getCurrentPosition fails on device and takes
  // checkout, ride pickup and the driver/rider heartbeat with it.
  const declares = (perm) =>
    manifest.includes(`<uses-permission android:name="android.permission.${perm}" />`);
  const missingPerms = ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'].filter(
    (p) => !declares(p),
  );
  if (missingPerms.length)
    fail(`Android ${missingPerms.join(', ')} missing — geolocation will fail on device`);
  else ok('Android location permissions');

  // DPX-MOBILE-001 — the ride-alert channel enables vibration, but the system
  // vibrates on the app's behalf and checks this permission first. Missing, the
  // channel claims to vibrate and silently does not.
  if (!declares('VIBRATE'))
    fail('Android VIBRATE missing — the ride-alert channel will not vibrate on device');
  else ok('Android VIBRATE permission');

  // DPX-MOBILE-003 — the driver presence foreground service. Every part of
  // this fails silently on its own: without the permissions the service throws
  // at startForeground; without foregroundServiceType="location" Android 14
  // refuses to start it; and a missing <service> entry means the plugin's
  // startForegroundService targets a class the system does not know about. In
  // every case the driver taps "Go online", sees nothing wrong, and goes
  // invisible to dispatch four minutes later — the exact bug this replaces.
  const missingFgs = ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION'].filter(
    (p) => !declares(p),
  );
  if (missingFgs.length)
    fail(`Android ${missingFgs.join(', ')} missing — driver presence cannot start`);
  else ok('Android foreground-service permissions');

  // The floating bubble needs this and there is no runtime dialog for it, so a
  // missing line here means the driver is sent to a Settings screen that
  // toggles nothing, and canDrawOverlays() returns false for ever.
  if (!declares('SYSTEM_ALERT_WINDOW'))
    fail('Android SYSTEM_ALERT_WINDOW missing — the floating driver bubble cannot be granted');
  else ok('Android overlay permission');

  // DPX-MOBILE-002 — voice calls. Capacitor's BridgeWebChromeClient launches
  // the runtime request for this exact pair when the page calls getUserMedia,
  // but Android denies a request for an undeclared permission instantly and
  // shows no dialog at all. Missing, a driver taps Accept, is never asked for
  // the microphone, and the call fails to connect with nothing to explain it.
  const missingAudio = ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'].filter((p) => !declares(p));
  if (missingAudio.length)
    fail(`Android ${missingAudio.join(', ')} missing — voice calls cannot capture audio`);
  else ok('Android microphone permissions');

  if (!manifest.includes('android:name=".DriverPresenceService"'))
    fail('Android DriverPresenceService is not declared — the plugin cannot start it');
  else if (!manifest.includes('android:foregroundServiceType="location"'))
    fail('Android DriverPresenceService has no foregroundServiceType — Android 14 refuses it');
  else ok('Android driver presence service');

  // Declaring background location triggers a Play policy review we would fail.
  // Corrected 2026-08-27: a foreground service is the sanctioned way to hold
  // location while backgrounded and needs no such permission — it covers
  // location with NO service, and starting one FROM the background. Presence
  // starts from the driver tapping "Go online", on screen. So this stays absent
  // even now that the service exists.
  if (declares('ACCESS_BACKGROUND_LOCATION'))
    fail('Android ACCESS_BACKGROUND_LOCATION declared — not needed, and a Play policy risk');
  else ok('Android background location correctly absent');
}

// DPX-MOBILE-001 — validate google-services.json WHEN PRESENT.
//
// Absent is normal and not a failure: the file is gitignored, and CI decodes it
// in the Android job only, after this static check has already run. This is
// here for the developer who downloads it from the console locally, so a wrong
// file is caught in seconds rather than after a forty-minute build. CI's
// authoritative check is REQUIRE_PUSH in scripts/mobile/build-android.sh.
const googleServicesPath = join(root, 'android/app/google-services.json');
if (existsSync(googleServicesPath)) {
  let config = null;
  try {
    config = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
  } catch {
    fail('android/app/google-services.json is not valid JSON');
  }
  if (config) {
    const packages = (config.client ?? [])
      .map((client) => client?.client_info?.android_client_info?.package_name)
      .filter(Boolean);
    // Firebase registers an app under whatever string is typed, and a mismatch
    // is not a build error — the plugin just finds no matching client and push
    // is silently dead. A real registration used "Com.dripplex.com".
    if (!packages.includes('com.dripplex.customer')) {
      fail(
        `google-services.json has no client for com.dripplex.customer (declares: ${
          packages.join(', ') || 'none'
        }) — package names are case-sensitive and cannot be renamed in Firebase`,
      );
    } else ok('google-services.json package name');
  }
} else {
  ok('google-services.json absent (supplied by CI secret)');
}

if (existsSync(plistPath)) {
  const plist = readFileSync(plistPath, 'utf8');
  if (!plist.includes('com.dripplex.customer')) fail('iOS bundle identifier missing');
  else ok('iOS bundle identifier');
  if (!plist.includes('<key>ITSAppUsesNonExemptEncryption</key>'))
    fail('iOS export-compliance declaration missing');
  else ok('iOS export-compliance declaration');
  if (!plist.includes('<string>Dripplex</string>')) fail('iOS display name missing');
  else ok('iOS display name');

  // iOS refuses to prompt without a usage string, so a missing key is a dead
  // feature and a rejection, not just a paperwork gap. WKWebView invokes the
  // camera and photo picker directly — unlike Android, which delegates by
  // intent and needs no permission from us.
  const missingUsage = [
    'NSLocationWhenInUseUsageDescription',
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    // DPX-MOBILE-002. Worse than a dead feature here: iOS terminates the
    // process when an app reaches the microphone with no usage string, so a
    // missing key is the app closing on the first tap of Call.
    'NSMicrophoneUsageDescription',
  ].filter((key) => !plist.includes(`<key>${key}</key>`));
  if (missingUsage.length)
    fail(
      `iOS ${missingUsage.join(', ')} missing — the system will never prompt and the feature is dead`,
    );
  else ok('iOS permission usage descriptions');

  if (plist.includes('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>')) {
    fail('iOS always-on location declared — the app only uses location in the foreground');
  } else ok('iOS background location correctly absent');
}

if (existsSync(projectPath)) {
  const project = readFileSync(projectPath, 'utf8');
  if (!project.includes('PRODUCT_BUNDLE_IDENTIFIER = com.dripplex.customer;'))
    fail('iOS product bundle identifier mismatch');
  if (!project.includes('MARKETING_VERSION = 1.0.0;'))
    fail('iOS marketing version is missing or unexpected');
  if (!project.includes('CURRENT_PROJECT_VERSION = 1000100;'))
    fail('iOS build number is missing or unexpected');
  if (!project.includes('IPHONEOS_DEPLOYMENT_TARGET = 14.0;'))
    fail('iOS deployment target is missing');
  if (!project.includes('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;'))
    fail('iOS AppIcon asset catalog is not configured');
  if (!failed) ok('iOS release build metadata');
}

if (existsSync(privacyPath)) {
  const privacy = readFileSync(privacyPath, 'utf8');
  if (!privacy.includes('<key>NSPrivacyTracking</key>'))
    fail('Apple privacy manifest tracking declaration missing');
  else ok('Apple privacy manifest');

  // Every type below is backed by a field in prisma/schema.prisma — see
  // docs/store/DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md. Apple rejects a
  // manifest that under-declares, so a silent drop must fail the build.
  const required = [
    'Name',
    'EmailAddress',
    'PhoneNumber',
    'PhysicalAddress',
    'PreciseLocation',
    'PhotosorVideos',
    // DPX-MOBILE-002 — live call audio. Not recorded and not stored, but it
    // leaves the device, which is Apple's test for "collected".
    'AudioData',
    'OtherDataTypes',
    'PaymentInfo',
    'PurchaseHistory',
    'DeviceID',
  ];
  const missing = required.filter((t) => !privacy.includes(`NSPrivacyCollectedDataType${t}<`));
  if (missing.length) fail(`Apple privacy manifest under-declares: ${missing.join(', ')}`);
  else ok(`Apple privacy manifest declares all ${required.length} collected types`);

  // Crash and performance data are NOT collected: customer-web's Sentry hook
  // returns early without SENTRY_DSN, which is absent in production, and the
  // super-app has no Sentry. Declaring them would be a false statement to
  // Apple. If a DSN is ever set, add them back and relax this check.
  for (const t of ['CrashData', 'PerformanceData']) {
    if (privacy.includes(`NSPrivacyCollectedDataType${t}<`)) {
      fail(
        `Apple privacy manifest declares ${t}, but no crash/analytics SDK is active — see DPX-MOBILE-003`,
      );
    }
  }
}

process.exit(failed ? 1 : 0);
