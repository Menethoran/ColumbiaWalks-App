#!/usr/bin/env bash
set -euo pipefail

# Replacement upload certificate prepared for the 2026-09-27 Play reset.
# Confirm Play has activated this fingerprint before uploading the staged AAB.
readonly EXPECTED_UPLOAD_CERT_SHA256="9be8e68554f0f9902e87fccb8199772db31e4186a441c8754e3653a450603e95"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
project_dir="$(cd "$source_dir/../.." && pwd)"
bundletool_path="${BUNDLETOOL:-/home/robert/.cache/columbiawalks-tools/bundletool-all-1.18.3.jar}"
python3 "$script_dir/verify-distribution.py" --channel internal
play_aab="$source_dir/app/build/outputs/bundle/internalTesting/app-internalTesting.aab"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/robert/.cache/columbiawalks-android-sdk}}"
gradle_cache="${CW_GRADLE_CACHE:-/home/robert/.cache/columbiawalks-gradle}"
gradle_image="${CW_GRADLE_IMAGE:-gradle:8.13-jdk17}"

fail() {
    echo "Internal testing build stopped: $*" >&2
    exit 1
}

clear_signing_secrets() {
    unset CW_ANDROID_KEYSTORE_PASSWORD CW_ANDROID_KEY_PASSWORD
}
trap clear_signing_secrets EXIT HUP INT TERM

[[ -d "$source_dir" ]] || fail "Source directory is missing: $source_dir"
[[ -n "${CW_ANDROID_KEYSTORE:-}" ]] \
    || fail "Set CW_ANDROID_KEYSTORE to the absolute Play upload-keystore path."
[[ -n "${CW_ANDROID_KEY_ALIAS:-}" ]] \
    || fail "Set CW_ANDROID_KEY_ALIAS to the Play upload-key alias."
[[ "$CW_ANDROID_KEYSTORE" == /* ]] || fail "CW_ANDROID_KEYSTORE must be absolute."
[[ -f "$CW_ANDROID_KEYSTORE" ]] || fail "The configured keystore does not exist."

keystore_path="$(realpath "$CW_ANDROID_KEYSTORE")"
source_path="$(realpath "$project_dir")"
case "$keystore_path" in
    "$source_path"|"$source_path"/*)
        fail "The upload keystore must remain outside the source tree."
        ;;
esac

keystore_mode="$(stat -c '%a' "$keystore_path")"
if (( (8#$keystore_mode & 077) != 0 )); then
    fail "Keystore permissions are $keystore_mode; run chmod 600 on it first."
fi
[[ "$(stat -c '%u' "$keystore_path")" == "$(id -u)" ]] \
    || fail "The current user does not own the keystore."

if [[ ! -t 0 && ( -z "${CW_ANDROID_KEYSTORE_PASSWORD:-}" || -z "${CW_ANDROID_KEY_PASSWORD:-}" ) ]]; then
    fail "Configure upload-signing credentials privately or run interactively."
fi
if [[ -z "${CW_ANDROID_KEYSTORE_PASSWORD:-}" ]]; then
    read -rsp "Keystore password: " CW_ANDROID_KEYSTORE_PASSWORD
    echo
    export CW_ANDROID_KEYSTORE_PASSWORD
fi
if [[ -z "${CW_ANDROID_KEY_PASSWORD:-}" ]]; then
    read -rsp "Key password: " CW_ANDROID_KEY_PASSWORD
    echo
    export CW_ANDROID_KEY_PASSWORD
fi

keystore_report="$(
    keytool -list -v \
        -keystore "$keystore_path" \
        -alias "$CW_ANDROID_KEY_ALIAS" \
        -storepass:env CW_ANDROID_KEYSTORE_PASSWORD 2>&1
)" || fail "The keystore, password, or alias could not be verified."

keystore_cert="$(
    sed -n 's/^[[:space:]]*SHA256: //p' <<<"$keystore_report" \
        | tr -d ':' | tr '[:upper:]' '[:lower:]' | tail -1
)"
[[ "$keystore_cert" == "$EXPECTED_UPLOAD_CERT_SHA256" ]] \
    || fail "The keystore does not match the pinned Play upload certificate."

export CW_ANDROID_KEYSTORE="$keystore_path"

[[ -f "$sdk_root/platforms/android-36/android.jar" ]] \
    || fail "Android SDK Platform 36 is missing from $sdk_root."
[[ -x "$sdk_root/build-tools/36.0.0/apksigner" ]] \
    || fail "Android Build Tools 36.0.0 are missing from $sdk_root."
[[ -x "$sdk_root/build-tools/36.0.0/aapt" ]] \
    || fail "Android Build Tools 36.0.0 are missing aapt in $sdk_root."
command -v docker >/dev/null 2>&1 || fail "Docker is required for the JDK 17 build."
docker image inspect "$gradle_image" >/dev/null 2>&1 \
    || fail "Required build image is unavailable: $gradle_image"

python3 "$script_dir/verify-ui-clarity.py"
python3 "$script_dir/verify-release-policy.py"
python3 "$script_dir/verify-community-tools.py"

install -d -m 755 "$gradle_cache"

# Pass passwords through stdin rather than Docker's persisted container settings.
printf '%s\0%s\0' "$CW_ANDROID_KEYSTORE_PASSWORD" "$CW_ANDROID_KEY_PASSWORD" \
    | docker run --rm --interactive \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env GRADLE_USER_HOME="$gradle_cache" \
    --env ANDROID_SDK_ROOT="$sdk_root" \
    --env CW_ANDROID_KEYSTORE \
    --env CW_ANDROID_KEY_ALIAS \
    --volume "$source_dir:$source_dir" \
    --volume "$sdk_root:$sdk_root" \
    --volume "$gradle_cache:$gradle_cache" \
    --volume "$keystore_path:$keystore_path:ro" \
    --workdir "$source_dir" \
    "$gradle_image" \
    bash -c '
        set -euo pipefail
        IFS= read -r -d "" CW_ANDROID_KEYSTORE_PASSWORD
        IFS= read -r -d "" CW_ANDROID_KEY_PASSWORD
        export CW_ANDROID_KEYSTORE_PASSWORD CW_ANDROID_KEY_PASSWORD
        exec gradle --no-daemon --no-configuration-cache -PcwDistributionChannel=internal \
            testInternalTestingUnitTest lintInternalTesting bundleInternalTesting
    '

[[ -f "$play_aab" ]] || fail "Gradle completed without producing app-internalTesting.aab."

[[ -f "$bundletool_path" ]] || fail "bundletool is missing: $bundletool_path"
# Use the same complete JDK for JAR signature verification; host Java may be a JRE.
docker run --rm --user "$(id -u):$(id -g)" \
    --env BUNDLETOOL="$bundletool_path" \
    --volume "$project_dir:$project_dir" --volume "$bundletool_path:$bundletool_path:ro" \
    --workdir "$source_dir" "$gradle_image" \
    bash "$script_dir/verify-and-stage-play-internal.sh" "$play_aab" --stage
