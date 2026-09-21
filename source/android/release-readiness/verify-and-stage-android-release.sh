#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_PACKAGE="org.columbiawalks.app"
readonly EXPECTED_VERSION_NAME="3.16.0"
readonly EXPECTED_VERSION_CODE="31600"
readonly EXPECTED_CERT_SHA256="a0c9e5abc99caec8d2ec31181c75c577d00963e0af3f654aca19bb3f7355dcc4"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
artifact_dir="${CW_ANDROID_ARTIFACT_DIR:-$source_dir/../artifacts}"
production_apk="$artifact_dir/ColumbiaWalks-3.16.0.apk"

usage() {
    echo "Usage: $0 /absolute/path/to/app-release.apk [--stage]" >&2
    exit 2
}

fail() {
    echo "Release verification failed: $*" >&2
    exit 1
}

find_build_tool() {
    local tool_name="$1"
    local explicit_path="$2"
    local sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/robert/.cache/columbiawalks-android-sdk}}"
    local candidate=""

    if [[ -n "$explicit_path" && -x "$explicit_path" ]]; then
        printf '%s\n' "$explicit_path"
        return 0
    fi
    if command -v "$tool_name" >/dev/null 2>&1; then
        command -v "$tool_name"
        return 0
    fi
    if [[ -n "$sdk_root" && -d "$sdk_root/build-tools" ]]; then
        candidate="$(
            find "$sdk_root/build-tools" -mindepth 2 -maxdepth 2 \
                -type f -name "$tool_name" -perm -u+x -print \
                | sort -V | tail -1
        )"
    fi
    [[ -n "$candidate" ]] || return 1
    printf '%s\n' "$candidate"
}

[[ $# -ge 1 && $# -le 2 ]] || usage
apk_path="$1"
stage_requested=false
if [[ $# -eq 2 ]]; then
    [[ "$2" == "--stage" ]] || usage
    stage_requested=true
fi

[[ "$apk_path" == /* ]] || fail "APK path must be absolute."
[[ -f "$apk_path" ]] || fail "APK does not exist: $apk_path"

apksigner_path="$(find_build_tool apksigner "${APKSIGNER:-}")" \
    || fail "Could not find Android build-tools apksigner."
aapt_path="$(find_build_tool aapt "${AAPT:-}")" \
    || fail "Could not find Android build-tools aapt."

signature_report="$("$apksigner_path" verify --verbose --print-certs "$apk_path" 2>&1)" \
    || fail "apksigner rejected the APK."

grep -q '^Verifies$' <<<"$signature_report" \
    || fail "APK does not verify."
grep -q '^Verified using v2 scheme (APK Signature Scheme v2): true$' \
    <<<"$signature_report" \
    || fail "APK is missing its required v2 signature."

signer_count="$(
    sed -n 's/^Number of signers: //p' <<<"$signature_report" | tail -1
)"
[[ "$signer_count" == "1" ]] || fail "Expected exactly one signer; found $signer_count."

actual_cert="$(
    sed -n 's/^Signer #1 certificate SHA-256 digest: //p' \
        <<<"$signature_report" | tr '[:upper:]' '[:lower:]' | tail -1
)"
[[ "$actual_cert" == "$EXPECTED_CERT_SHA256" ]] \
    || fail "Signer does not match the pinned ColumbiaWalks production certificate."

badging_report="$("$aapt_path" dump badging "$apk_path" 2>&1)" \
    || fail "aapt could not inspect the APK."
package_line="$(sed -n '/^package: /{p;q;}' <<<"$badging_report")"
[[ -n "$package_line" ]] || fail "APK package metadata is missing."

actual_package="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$package_line")"
actual_version_code="$(sed -n "s/.* versionCode='\([^']*\)'.*/\1/p" <<<"$package_line")"
actual_version_name="$(sed -n "s/.* versionName='\([^']*\)'.*/\1/p" <<<"$package_line")"

[[ "$actual_package" == "$EXPECTED_PACKAGE" ]] \
    || fail "Package is $actual_package, expected $EXPECTED_PACKAGE."
[[ "$actual_version_code" == "$EXPECTED_VERSION_CODE" ]] \
    || fail "Version code is $actual_version_code, expected $EXPECTED_VERSION_CODE."
[[ "$actual_version_name" == "$EXPECTED_VERSION_NAME" ]] \
    || fail "Version name is $actual_version_name, expected $EXPECTED_VERSION_NAME."

if unzip -Z1 "$apk_path" | grep -Eqi '(^|/)([^/]*\.(jks|keystore|p12|pfx)|keystore)(/|$)'; then
    fail "APK unexpectedly contains a keystore-like file."
fi

apk_bytes="$(stat -c '%s' "$apk_path")"
apk_sha256="$(sha256sum "$apk_path" | awk '{print $1}')"

echo "Android release verification passed."
echo "Package:     $actual_package"
echo "Version:     $actual_version_name ($actual_version_code)"
echo "Signer:      $actual_cert"
echo "Bytes:       $apk_bytes"
echo "SHA-256:     $apk_sha256"

if [[ "$stage_requested" == true ]]; then
    install -d -m 755 "$artifact_dir"
    install -m 644 "$apk_path" "$production_apk"
    echo "Staged:      $production_apk"
fi
