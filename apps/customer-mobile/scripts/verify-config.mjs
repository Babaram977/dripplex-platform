#!/usr/bin/env node
/**
 * Validates customer-mobile packaging metadata without requiring Android SDK / Xcode.
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
];

let failed = false;
for (const rel of required) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`MISSING ${rel}`);
    failed = true;
  } else {
    console.log(`OK ${rel}`);
  }
}

const manifest = readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
if (!gradle.includes('applicationId "com.dripplex.customer"')) {
  console.error('Android applicationId mismatch');
  failed = true;
}
if (!manifest.includes('app.dripplex.com')) {
  console.error('Android deep link host missing');
  failed = true;
}

const plist = readFileSync(join(root, 'ios/App/App/Info.plist'), 'utf8');
if (!plist.includes('com.dripplex.customer')) {
  console.error('iOS bundle identifier mismatch');
  failed = true;
}

process.exit(failed ? 1 : 0);
