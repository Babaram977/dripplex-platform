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
  if (!gradle.includes('applicationId "com.dripplex.customer"')) fail('Android applicationId mismatch');
  else ok('Android applicationId');
  if (!gradle.includes('versionCode 1000100')) fail('Android versionCode is missing or unexpected');
  else ok('Android versionCode');
  if (!gradle.includes('versionName "1.0.0"')) fail('Android versionName is missing or unexpected');
  else ok('Android versionName');
  if (!gradle.includes('production') || !gradle.includes('internal') || !gradle.includes('closedBeta')) {
    fail('Android release flavors are incomplete');
  } else ok('Android release flavors');
}

if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('android:exported="true"')) fail('Android launcher activity is not explicitly exported');
  else ok('Android launcher export');
  if (!manifest.includes('android:scheme="https" android:host="app.dripplex.com"')) fail('Android HTTPS deep-link host missing');
  else ok('Android HTTPS deep link');
  if (!manifest.includes('android.permission.INTERNET')) fail('Android INTERNET permission missing');
  else ok('Android INTERNET permission');
}

if (existsSync(plistPath)) {
  const plist = readFileSync(plistPath, 'utf8');
  if (!plist.includes('com.dripplex.customer')) fail('iOS bundle identifier missing');
  else ok('iOS bundle identifier');
  if (!plist.includes('<key>ITSAppUsesNonExemptEncryption</key>')) fail('iOS export-compliance declaration missing');
  else ok('iOS export-compliance declaration');
  if (!plist.includes('<string>Dripplex</string>')) fail('iOS display name missing');
  else ok('iOS display name');
}

if (existsSync(projectPath)) {
  const project = readFileSync(projectPath, 'utf8');
  if (!project.includes('PRODUCT_BUNDLE_IDENTIFIER = com.dripplex.customer;')) fail('iOS product bundle identifier mismatch');
  if (!project.includes('MARKETING_VERSION = 1.0.0;')) fail('iOS marketing version is missing or unexpected');
  if (!project.includes('CURRENT_PROJECT_VERSION = 1000100;')) fail('iOS build number is missing or unexpected');
  if (!project.includes('IPHONEOS_DEPLOYMENT_TARGET = 14.0;')) fail('iOS deployment target is missing');
  if (!project.includes('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;')) fail('iOS AppIcon asset catalog is not configured');
  if (!failed) ok('iOS release build metadata');
}

if (existsSync(privacyPath)) {
  const privacy = readFileSync(privacyPath, 'utf8');
  if (!privacy.includes('<key>NSPrivacyTracking</key>')) fail('Apple privacy manifest tracking declaration missing');
  else ok('Apple privacy manifest');
}

process.exit(failed ? 1 : 0);
