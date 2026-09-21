#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRADLE_VERSION="8.13"
BOOTSTRAP_DIR="$PROJECT_DIR/.gradle-bootstrap"
GRADLE_BIN="${GRADLE_BIN:-$BOOTSTRAP_DIR/gradle-$GRADLE_VERSION/bin/gradle}"

if [[ -n "${JAVA_HOME:-}" ]]; then
    java_bin="$JAVA_HOME/bin/java"
else
    java_bin="$(command -v java || true)"
fi
if [[ -z "$java_bin" || ! -x "$java_bin" ]]; then
    echo "JDK 17 was not found. Install it and set JAVA_HOME before building."
    exit 1
fi
java_major="$($java_bin -version 2>&1 \
    | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' \
    | head -n 1)"
if [[ "$java_major" != "17" ]]; then
    echo "ColumbiaWalks requires JDK 17; this shell is using Java ${java_major:-unknown}."
    echo "Set JAVA_HOME to a JDK 17 installation and try again."
    exit 1
fi

if [[ ! -x "$GRADLE_BIN" ]]; then
    if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
        echo "Install curl and unzip first: sudo apt install curl unzip"
        exit 1
    fi

    mkdir -p "$BOOTSTRAP_DIR"
    echo "Downloading Gradle $GRADLE_VERSION..."
    curl --fail --location \
        "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip" \
        --output "$BOOTSTRAP_DIR/gradle-$GRADLE_VERSION-bin.zip"
    unzip -q -o \
        "$BOOTSTRAP_DIR/gradle-$GRADLE_VERSION-bin.zip" \
        -d "$BOOTSTRAP_DIR"
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" \
      && ! -f "$PROJECT_DIR/local.properties" ]]; then
    echo "Android SDK not detected."
    echo "Open this project in Android Studio once, or set ANDROID_HOME."
    echo "Install Android SDK Platform 36 and Build-Tools 36.0.0."
    exit 1
fi

cd "$PROJECT_DIR"
python3 release-readiness/verify-ui-clarity.py
python3 release-readiness/verify-release-policy.py
python3 release-readiness/verify-community-tools.py

required_signing_variables=(
    CW_ANDROID_KEYSTORE
    CW_ANDROID_KEYSTORE_PASSWORD
    CW_ANDROID_KEY_ALIAS
    CW_ANDROID_KEY_PASSWORD
)
for variable_name in "${required_signing_variables[@]}"; do
    if [[ -z "${!variable_name:-}" ]]; then
        echo "Missing required release-signing variable: $variable_name"
        exit 1
    fi
done

"$GRADLE_BIN" --no-daemon clean test lintRelease lintPlayRelease \
    assembleRelease bundlePlayRelease

echo
echo "Build complete:"
echo "$PROJECT_DIR/app/build/outputs/apk/release/app-release.apk"
echo "$PROJECT_DIR/app/build/outputs/bundle/playRelease/app-playRelease.aab"
