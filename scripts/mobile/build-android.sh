#!/usr/bin/env bash
# Build Android release artifacts (AAB + universal APK) for customer-mobile.
# Requires: JDK 17+, Android SDK, keystore.properties (release signing).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/customer-mobile"
FLAVOR="${ANDROID_FLAVOR:-production}"

cd "${MOBILE}"

if [[ ! -f android/keystore.properties ]]; then
  echo "WARN: android/keystore.properties missing — release will be unsigned (CI debug only)"
fi

export CAPACITOR_SERVER_URL="${CAPACITOR_SERVER_URL:-https://app.dripplex.com}"
pnpm exec cap sync android

cd android
./gradlew ":app:bundle${FLAVOR^}Release" ":app:assemble${FLAVOR^}Release"

OUT="${MOBILE}/android/app/build/outputs"
echo "AAB: ${OUT}/bundle/${FLAVOR}Release/"
echo "APK: ${OUT}/apk/${FLAVOR}/release/"
