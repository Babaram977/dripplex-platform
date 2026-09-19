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
const podfilePath = join(root, 'ios/App/Podfile');

/**
 * Apple's floor, not ours. Xcode 26 — mandatory for App Store Connect uploads
 * since 2026-04-28 — supports deployment targets iOS 15-26 only, so a project
 * pinned below 15.0 fails at the first archive.
 * @see https://developer.apple.com/xcode/system-requirements/
 */
const MIN_IOS_DEPLOYMENT_TARGET = 15.0;

if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8');
  // Android only. The iOS bundle identifier below is still
  // com.dripplex.customer and stays that way: Apple never claimed it, so
  // nothing forces it to move, and changing it would invalidate the
  // Associated Domains entry and the appID in assetlinks/AASA for no gain.
  if (!gradle.includes('applicationId "com.dripplex.app"')) fail('Android applicationId mismatch');
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
    // Firebase cannot rename an Android app's package, so the applicationId
    // move needs a NEW app registered in the dripplex-3a92d project and a
    // replacement GOOGLE_SERVICES_JSON_BASE64 secret. Until that is done this
    // check fails loudly, which is the point: the alternative is a green build
    // whose push is silently dead.
    if (!packages.includes('com.dripplex.app')) {
      fail(
        `google-services.json has no client for com.dripplex.app (declares: ${
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
  // Anchored on the key, not a floating string: the old check matched
  // <string>Dripplex</string> anywhere in the file, so any unrelated value
  // would have satisfied it while a blank display name slipped through.
  if (!/<key>CFBundleDisplayName<\/key>\s*<string>DrippleX<\/string>/.test(plist))
    fail('iOS display name is not CFBundleDisplayName = DrippleX');
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
  // Asserted as a floor rather than a literal. This check used to read
  // `includes('IPHONEOS_DEPLOYMENT_TARGET = 14.0;')`, so raising the target to
  // Apple's required minimum made it report "deployment target is missing"
  // when the target was present and correct — the message named the wrong
  // fault and cost a CI cycle to read.
  const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => m[1]);
  if (targets.length === 0) {
    fail('iOS deployment target is missing from project.pbxproj');
  } else if (new Set(targets).size > 1) {
    fail(`iOS deployment target disagrees across build configurations: ${targets.join(', ')}`);
  } else if (Number(targets[0]) < MIN_IOS_DEPLOYMENT_TARGET) {
    fail(
      `iOS deployment target is ${targets[0]}; Xcode 26 supports ${MIN_IOS_DEPLOYMENT_TARGET}+ and will refuse to archive below it`,
    );
  }
  if (!project.includes('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;'))
    fail('iOS AppIcon asset catalog is not configured');

  // The Podfile carries its own copy of the same number, and `post_install`
  // forces every pod to it. If the two drift, the pods are built against a
  // different floor than the app and the mismatch surfaces only on a Mac.
  if (existsSync(podfilePath) && new Set(targets).size === 1) {
    const podPlatform = readFileSync(podfilePath, 'utf8').match(/^platform :ios, '([\d.]+)'/m)?.[1];
    if (!podPlatform) fail('Podfile is missing its `platform :ios` line');
    else if (Number(podPlatform) !== Number(targets[0]))
      fail(
        `Podfile platform :ios, '${podPlatform}' disagrees with IPHONEOS_DEPLOYMENT_TARGET = ${targets[0]}`,
      );
  }

  if (!failed) ok('iOS release build metadata');

  // A file can be on disk, committed, and green through `test -f`, and still
  // never reach the app: Xcode copies only what the target's Resources build
  // phase lists. PrivacyInfo.xcprivacy sat in this repo for months with ZERO
  // references in project.pbxproj and went to Apple that way in build 1000100 —
  // an archive with no privacy manifest, from a tree where the manifest was
  // present and correct. Existence checks are structurally blind to this, so
  // this walks the same path Xcode walks: PBXFileReference -> PBXBuildFile ->
  // PBXResourcesBuildPhase. Matching the bare filename anywhere in the file
  // would pass on a comment, which is exactly the false green being closed.
  const resourcesOfAppTarget = () => {
    const lines = project.split('\n');
    const refs = new Map();
    for (const line of lines) {
      const refId = line.match(/^\t\t([0-9A-F]{24}) .*isa = PBXFileReference;/)?.[1];
      if (!refId) continue;
      const path = line.match(/\bpath = "([^"]+)";/)?.[1] ?? line.match(/\bpath = ([^;\s]+);/)?.[1];
      if (path) refs.set(refId, path);
    }
    // Second pass, not a continuation of the first: pbxproj emits the
    // PBXBuildFile section ahead of PBXFileReference, so resolving a fileRef
    // while still collecting them reads an empty map and reports every file as
    // unbundled — a guard that fails on a correct project teaches people to
    // ignore it.
    const builds = new Map();
    for (const line of lines) {
      const build = line.match(
        /^\t\t([0-9A-F]{24}) .*isa = PBXBuildFile; fileRef = ([0-9A-F]{24})\b/,
      );
      if (build && refs.has(build[2])) builds.set(build[1], refs.get(build[2]));
    }
    const bundled = new Set();
    for (const phase of project.matchAll(
      /isa = PBXResourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/g,
    )) {
      for (const [, id] of phase[1].matchAll(/([0-9A-F]{24})/g)) {
        if (builds.has(id)) bundled.add(builds.get(id));
      }
    }
    return bundled;
  };

  const bundled = resourcesOfAppTarget();
  let membership = true;
  for (const required of ['PrivacyInfo.xcprivacy', 'GoogleService-Info.plist']) {
    if (!bundled.has(required)) {
      fail(
        `${required} exists but is not a member of the App target's Resources build phase; it will be missing from the archive`,
      );
      membership = false;
    }
  }
  if (membership) ok('iOS target membership (privacy manifest, Firebase config)');
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

// ─── iOS push wiring (DPX-MOBILE-001) ────────────────────────────────────────
//
// iOS push had never worked, and none of the three reasons was visible from a
// build: AppDelegate implemented neither remote-notification callback, so
// Capacitor's plugin — which listens on NotificationCenter rather than
// implementing them itself — never received a token and reported `timeout`;
// there was no Firebase SDK, so no FCM token could exist; and the backend
// sends via firebase-admin and stores FCM registration tokens, so an APNs
// token would have been rejected and the device DEACTIVATED as stale.
//
// Checked here rather than in a test because this package has no test runner
// and CI already runs this script (scripts/mobile/verify-mobile.sh). A build
// cannot catch any of it: every one of these states compiles and archives
// perfectly, and fails only on a real device, silently.
const appDelegatePath = join(root, 'ios/App/App/AppDelegate.swift');
const googleServiceExamplePath = join(root, 'ios/App/App/GoogleService-Info.plist.example');

if (existsSync(podfilePath)) {
  const podfile = readFileSync(podfilePath, 'utf8');
  if (!/^\s*pod 'FirebaseMessaging'/m.test(podfile)) {
    fail(
      'iOS Podfile does not declare FirebaseMessaging — push can only yield an APNs token, which FCM rejects',
    );
  } else ok('iOS Podfile declares FirebaseMessaging');

  // Messaging only. Analytics would be a second SDK, a second privacy-manifest
  // surface, and a tracking declaration the App Store listing currently answers
  // with "tracking = false".
  if (/^\s*pod 'FirebaseAnalytics'/m.test(podfile)) {
    fail(
      'iOS Podfile pulls in FirebaseAnalytics — not wanted; it changes the privacy manifest and the tracking answer',
    );
  }
}

if (existsSync(appDelegatePath)) {
  const appDelegate = readFileSync(appDelegatePath, 'utf8');

  // Without this, the token APNs returns reaches nothing.
  //
  // Matched on the SIGNATURE, not the name. A substring check passes for
  // `didRegisterForRemoteNotificationsWithDeviceTokenXX` — proved by mutation,
  // where renaming the method left this guard green.
  if (!/didRegisterForRemoteNotificationsWithDeviceToken\s+deviceToken:\s*Data/.test(appDelegate)) {
    fail(
      'AppDelegate does not implement didRegisterForRemoteNotificationsWithDeviceToken — Capacitor never receives a token and push times out',
    );
  } else ok('AppDelegate forwards APNs registration');

  if (!/didFailToRegisterForRemoteNotificationsWithError\s+error:\s*Error/.test(appDelegate)) {
    fail(
      'AppDelegate does not implement didFailToRegisterForRemoteNotificationsWithError — a refusal is indistinguishable from silence',
    );
  } else ok('AppDelegate forwards APNs registration failure');

  // The point of the whole change: what gets forwarded must be the FCM token.
  if (!appDelegate.includes('Messaging.messaging().apnsToken')) {
    fail(
      'AppDelegate never hands the APNs token to FCM — FCM cannot mint a registration token without it',
    );
  } else ok('AppDelegate hands the APNs token to FCM');

  // Guards the specific regression that is easy to introduce and impossible to
  // see: posting `deviceToken` forwards the raw APNs token, which the backend
  // stores, FCM rejects, and the provider then deactivates the device over.
  if (
    /capacitorDidRegisterForRemoteNotifications,\s*\n?\s*object:\s*deviceToken/.test(appDelegate)
  ) {
    fail(
      'AppDelegate posts the raw APNs deviceToken — the backend expects an FCM token and deactivates devices whose token FCM rejects',
    );
  } else ok('AppDelegate posts an FCM token, not the raw APNs token');

  // FirebaseApp.configure() traps when the plist is absent. A clean checkout
  // legitimately has no plist (it is gitignored), so an unguarded call turns a
  // missing config file into a crash on launch for every user.
  //
  // Matched on the BUNDLE LOOKUP, not on the string "GoogleService-Info"
  // appearing somewhere in the file. The first version of this check looked for
  // the latter and stayed green when the guard was deleted, because the name
  // still appears in a comment and in an error message. Proved by mutation.
  if (
    appDelegate.includes('FirebaseApp.configure()') &&
    !/Bundle\.main\.path\(\s*forResource:\s*"GoogleService-Info"/.test(appDelegate)
  ) {
    fail(
      'AppDelegate calls FirebaseApp.configure() without checking the plist is bundled — a missing config file becomes a launch crash',
    );
  } else ok('Firebase is configured only when its plist is present');
}

if (!existsSync(googleServiceExamplePath)) {
  fail(
    'ios/App/App/GoogleService-Info.plist.example is missing — the real plist is gitignored, so the shape reference is all a new machine has',
  );
} else ok('iOS Firebase config template present');

process.exit(failed ? 1 : 0);
