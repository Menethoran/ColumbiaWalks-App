#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_CERT_SHA256="a0c9e5abc99caec8d2ec31181c75c577d00963e0af3f654aca19bb3f7355dcc4"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
release_apk="$source_dir/app/build/outputs/apk/release/app-release.apk"
play_aab="$source_dir/app/build/outputs/bundle/playRelease/app-playRelease.aab"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/robert/.cache/columbiawalks-android-sdk}}"
gradle_cache="${CW_GRADLE_CACHE:-/home/robert/.cache/columbiawalks-gradle}"
gradle_image="${CW_GRADLE_IMAGE:-gradle:8.13-jdk17}"

fail() {
    echo "Production build stopped: $*" >&2
    exit 1
}

clear_signing_secrets() {
    unset CW_ANDROID_KEYSTORE_PASSWORD CW_ANDROID_KEY_PASSWORD
}
trap clear_signing_secrets EXIT HUP INT TERM

[[ -d "$source_dir" ]] || fail "Source directory is missing: $source_dir"
[[ -n "${CW_ANDROID_KEYSTORE:-}" ]] \
    || fail "Set CW_ANDROID_KEYSTORE to the absolute recovered-keystore path."
[[ -n "${CW_ANDROID_KEY_ALIAS:-}" ]] \
    || fail "Set CW_ANDROID_KEY_ALIAS to the recovered key alias."
[[ "$CW_ANDROID_KEYSTORE" == /* ]] || fail "CW_ANDROID_KEYSTORE must be absolute."
[[ -f "$CW_ANDROID_KEYSTORE" ]] || fail "The configured keystore does not exist."

keystore_path="$(realpath "$CW_ANDROID_KEYSTORE")"
source_path="$(realpath "$source_dir")"
case "$keystore_path" in
    "$source_path"|"$source_path"/*)
        fail "The production keystore must remain outside the source tree."
        ;;
esac

keystore_mode="$(stat -c '%a' "$keystore_path")"
if (( (8#$keystore_mode & 077) != 0 )); then
    fail "Keystore permissions are $keystore_mode; run chmod 600 on it first."
fi
[[ "$(stat -c '%u' "$keystore_path")" == "$(id -u)" ]] \
    || fail "The current user does not own the keystore."

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
[[ "$keystore_cert" == "$EXPECTED_CERT_SHA256" ]] \
    || fail "The keystore is not the permanent 3.13.0 signing identity."

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

docker run --rm \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env GRADLE_USER_HOME="$gradle_cache" \
    --env ANDROID_SDK_ROOT="$sdk_root" \
    --env CW_ANDROID_KEYSTORE \
    --env CW_ANDROID_KEYSTORE_PASSWORD \
    --env CW_ANDROID_KEY_ALIAS \
    --env CW_ANDROID_KEY_PASSWORD \
    --volume "$source_dir:$source_dir" \
    --volume "$sdk_root:$sdk_root" \
    --volume "$gradle_cache:$gradle_cache" \
    --volume "$keystore_path:$keystore_path:ro" \
    --workdir "$source_dir" \
    "$gradle_image" \
    gradle --no-daemon clean test lintRelease lintPlayRelease \
        assembleRelease bundlePlayRelease

[[ -f "$release_apk" ]] || fail "Gradle completed without producing app-release.apk."
[[ -f "$play_aab" ]] || fail "Gradle completed without producing app-playRelease.aab."

"$script_dir/verify-and-stage-android-release.sh" "$release_apk" --stage
"$script_dir/verify-and-stage-play-release.sh" "$play_aab" --stage
