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
  if (!gradle.includes('versionCode 1000100')) fail('Android versionCode is missing or unexpected');
  else ok('Android versionCode');
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

  // Declaring background location triggers a Play policy review we would fail,
  // for a capability the app does not have: the heartbeat runs on
  // navigator.geolocation in a WebView, which only executes in the foreground.
  if (declares('ACCESS_BACKGROUND_LOCATION'))
    fail('Android ACCESS_BACKGROUND_LOCATION declared — not used, and a Play policy risk');
  else ok('Android background location correctly absent');
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
