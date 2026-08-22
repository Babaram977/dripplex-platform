#!/usr/bin/env bash
# Build Android release artifacts (AAB + universal APK) for customer-mobile.
# Requires: JDK 21 (Capacitor 7 targets JavaVersion.VERSION_21), Android SDK.
#
# Signing is optional for a packaging check and MANDATORY for anything going to
# Play. Set REQUIRE_SIGNED=1 to make the difference fatal instead of advisory —
# see the check after the build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/customer-mobile"
FLAVOR="${ANDROID_FLAVOR:-production}"
REQUIRE_SIGNED="${REQUIRE_SIGNED:-0}"

cd "${MOBILE}"

if [[ ! -f android/keystore.properties ]]; then
  if [[ "${REQUIRE_SIGNED}" == "1" ]]; then
    echo "ERROR: android/keystore.properties is missing and REQUIRE_SIGNED=1." >&2
    echo "       The four ANDROID_KEYSTORE_* secrets must be set on the repo," >&2
    echo "       and the workflow step that writes this file must actually run." >&2
    exit 1
  fi
  echo "WARN: android/keystore.properties missing — release will be UNSIGNED and is NOT submittable to Play"
fi

export CAPACITOR_SERVER_URL="${CAPACITOR_SERVER_URL:-https://app.dripplex.com}"
pnpm exec cap sync android

cd android
./gradlew ":app:bundle${FLAVOR^}Release" ":app:assemble${FLAVOR^}Release"

OUT="${MOBILE}/android/app/build/outputs"
AAB=$(find "${OUT}/bundle/${FLAVOR}Release" -name '*.aab' -print -quit 2>/dev/null || true)

echo "AAB: ${OUT}/bundle/${FLAVOR}Release/"
echo "APK: ${OUT}/apk/${FLAVOR}/release/"

# Gradle assigns the release signing config only when keystore.properties
# exists, and it does so SILENTLY — an unsigned bundle builds green and uploads
# as an artifact that looks submittable right up until Play rejects it. That
# happened: the two workflow steps writing the keystore were skipped by a broken
# `if`, and the build still reported success. So the bundle is inspected here
# rather than trusted.
if [[ -z "${AAB}" ]]; then
  echo "ERROR: no .aab produced under ${OUT}/bundle/${FLAVOR}Release" >&2
  exit 1
fi

# An AAB is a jar; a signed one carries META-INF/*.RSA|DSA|EC.
if unzip -l "${AAB}" | grep -qE 'META-INF/.*\.(RSA|DSA|EC)$'; then
  echo "SIGNED: ${AAB}"
else
  if [[ "${REQUIRE_SIGNED}" == "1" ]]; then
    echo "ERROR: ${AAB} is UNSIGNED — Play will reject it." >&2
    echo "       keystore.properties was present but Gradle produced no signature;" >&2
    echo "       check the keystore decoded correctly and the alias/passwords match." >&2
    exit 1
  fi
  echo "UNSIGNED: ${AAB} — packaging check only, NOT submittable to Play"
fi
