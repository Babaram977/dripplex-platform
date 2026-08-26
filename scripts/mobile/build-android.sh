#!/usr/bin/env bash
# Build Android release artifacts (AAB + universal APK) for customer-mobile.
# Requires: JDK 21 (Capacitor 7 targets JavaVersion.VERSION_21), Android SDK.
#
# Signing is optional for a packaging check and MANDATORY for anything going to
# Play. Set REQUIRE_SIGNED=1 to make the difference fatal instead of advisory —
# see the check after the build.
#
# REQUIRE_PUSH=1 does the same for Firebase Cloud Messaging (DPX-MOBILE-001):
# google-services.json must be present, must name this exact application id, and
# must have actually been consumed by the plugin. Every one of those fails
# SILENTLY otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/customer-mobile"
FLAVOR="${ANDROID_FLAVOR:-production}"
REQUIRE_SIGNED="${REQUIRE_SIGNED:-0}"
REQUIRE_PUSH="${REQUIRE_PUSH:-0}"
APPLICATION_ID="com.dripplex.customer"

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

# ── Firebase config, checked BEFORE Gradle ────────────────────────────────────
# build.gradle applies the google-services plugin only when this file is
# non-empty, and logs at info level when it is not — so a missing or malformed
# config produces a completely green build of an app that can never receive a
# push. Checked here, loudly, instead.
GS_JSON="android/app/google-services.json"

if [[ ! -s "${GS_JSON}" ]]; then
  if [[ "${REQUIRE_PUSH}" == "1" ]]; then
    echo "ERROR: ${GS_JSON} is missing or empty and REQUIRE_PUSH=1." >&2
    echo "       Push notifications would be silently dead in this build." >&2
    echo "       Set the GOOGLE_SERVICES_JSON_BASE64 repo secret from the Firebase" >&2
    echo "       console (project dripplex-3a92d, Android app ${APPLICATION_ID})," >&2
    echo "       and confirm the workflow's decode step ran before this script." >&2
    exit 1
  fi
  echo "WARN: ${GS_JSON} missing — build will have NO push notifications"
else
  # The package name inside the config must match applicationId exactly. Firebase
  # will happily register an app under any string you type, and a mismatch is not
  # a build error — the plugin simply finds no matching client. A real
  # registration used "Com.dripplex.com" on 2026-08-26; nothing would have caught
  # it until a driver's phone stayed silent.
  GS_PACKAGE=$(node -e "
    const fs = require('node:fs');
    try {
      const cfg = JSON.parse(fs.readFileSync('${GS_JSON}', 'utf8'));
      const names = (cfg.client ?? [])
        .map((c) => c?.client_info?.android_client_info?.package_name)
        .filter(Boolean);
      process.stdout.write(names.join(','));
    } catch (error) {
      process.stdout.write('__UNPARSEABLE__');
    }
  ")

  if [[ "${GS_PACKAGE}" == "__UNPARSEABLE__" ]]; then
    echo "ERROR: ${GS_JSON} is not valid JSON." >&2
    echo "       A truncated base64 secret is the usual cause." >&2
    exit 1
  fi

  if [[ ",${GS_PACKAGE}," != *",${APPLICATION_ID},"* ]]; then
    echo "ERROR: ${GS_JSON} does not contain a client for ${APPLICATION_ID}." >&2
    echo "       It declares: ${GS_PACKAGE:-<none>}" >&2
    echo "       Package names are case-sensitive and must match applicationId" >&2
    echo "       exactly. Firebase cannot rename a registered app — remove it and" >&2
    echo "       add it again with the correct package name." >&2
    exit 1
  fi
  echo "FIREBASE CONFIG: ${GS_JSON} declares ${APPLICATION_ID}"
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

# Presence of the config is not proof the plugin consumed it. `apply plugin` is
# inside an `if` in build.gradle — and inside a `try/catch` that swallows every
# exception at info level — so a plugin that never ran leaves nothing behind to
# notice. Verify its OUTPUT instead of its input: it generates a values.xml
# carrying google_app_id and the default sender id.
#
# Search the whole generated-resource tree rather than a fixed subdirectory. The
# plugin's output path is not stable across versions: google-services 4.4.2 with
# AGP 8.7 writes to `generated/res/processProductionReleaseGoogleServices`, named
# after the task and therefore after the variant, while older versions used a
# plain `generated/res/google-services/<variant>`. Hardcoding either one turns a
# perfectly good build into a false failure — which is exactly what the first
# version of this check did.
GENERATED_RES="${MOBILE}/android/app/build/generated/res"
GS_VALUES=$(grep -rl 'google_app_id' "${GENERATED_RES}" --include='values.xml' 2>/dev/null | head -1 || true)

if [[ -n "${GS_VALUES}" ]]; then
  echo "FCM: google-services plugin applied — ${GS_VALUES#"${MOBILE}/android/app/build/generated/res/"}"
elif [[ "${REQUIRE_PUSH}" == "1" ]]; then
  echo "ERROR: no google_app_id resource was generated anywhere under" >&2
  echo "       ${GENERATED_RES}" >&2
  echo "       ${GS_JSON} was present and named the right package, so the plugin" >&2
  echo "       was skipped or threw — build.gradle catches that silently. Check" >&2
  echo "       the build log for a processGoogleServices task; if it ran, this" >&2
  echo "       check is looking in the wrong place rather than the build being" >&2
  echo "       broken." >&2
  exit 1
else
  echo "NO FCM: no google-services resources generated — push is inert in this build"
fi
