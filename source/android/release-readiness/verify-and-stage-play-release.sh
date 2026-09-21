#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_PACKAGE="org.columbiawalks.app"
readonly EXPECTED_VERSION_NAME="3.16.0"
readonly EXPECTED_VERSION_CODE="31600"
readonly EXPECTED_UPLOAD_CERT_SHA256="a0c9e5abc99caec8d2ec31181c75c577d00963e0af3f654aca19bb3f7355dcc4"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
artifact_dir="${CW_ANDROID_ARTIFACT_DIR:-$source_dir/../artifacts}"
play_artifact_dir="$artifact_dir/play"
bundletool_path="${BUNDLETOOL:-/home/robert/.cache/columbiawalks-tools/bundletool-all-1.18.3.jar}"
native_symbols="$source_dir/app/build/outputs/native-debug-symbols/playRelease/native-debug-symbols.zip"
mapping_file="$source_dir/app/build/outputs/mapping/playRelease/mapping.txt"

usage() {
    echo "Usage: $0 /absolute/path/to/app-playRelease.aab [--stage]" >&2
    exit 2
}

fail() {
    echo "Play release verification failed: $*" >&2
    exit 1
}

[[ $# -ge 1 && $# -le 2 ]] || usage
aab_path="$1"
stage_requested=false
if [[ $# -eq 2 ]]; then
    [[ "$2" == "--stage" ]] || usage
    stage_requested=true
fi

[[ "$aab_path" == /* ]] || fail "AAB path must be absolute."
[[ -f "$aab_path" ]] || fail "AAB does not exist: $aab_path"
[[ -f "$bundletool_path" ]] || fail "bundletool is missing: $bundletool_path"
command -v java >/dev/null 2>&1 || fail "Java is required for bundletool."
command -v jarsigner >/dev/null 2>&1 || fail "jarsigner is required."
command -v keytool >/dev/null 2>&1 || fail "keytool is required."

bundletool_report="$(java -jar "$bundletool_path" validate --bundle="$aab_path" 2>&1)" \
    || fail "bundletool rejected the AAB: $bundletool_report"

jarsigner_report="$(jarsigner -verify "$aab_path" 2>&1)" \
    || fail "jarsigner rejected the AAB."
grep -q 'jar verified' <<<"$jarsigner_report" \
    || fail "The AAB JAR signature did not verify."

certificate_report="$(keytool -printcert -jarfile "$aab_path" 2>&1)" \
    || fail "The AAB signing certificate could not be read."
actual_cert="$(
    sed -n 's/^[[:space:]]*SHA256: //p' <<<"$certificate_report" \
        | tr -d ':' | tr '[:upper:]' '[:lower:]' | tail -1
)"
[[ "$actual_cert" == "$EXPECTED_UPLOAD_CERT_SHA256" ]] \
    || fail "AAB signer does not match the Play Console upload certificate."

manifest_report="$(
    java -jar "$bundletool_path" dump manifest \
        --bundle="$aab_path" --module=base 2>&1
)" || fail "bundletool could not dump the base manifest."

actual_package="$(sed -n 's/.*package="\([^"]*\)".*/\1/p' <<<"$manifest_report" | head -1)"
actual_version_code="$(sed -n 's/.*android:versionCode="\([^"]*\)".*/\1/p' <<<"$manifest_report" | head -1)"
actual_version_name="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' <<<"$manifest_report" | head -1)"

[[ "$actual_package" == "$EXPECTED_PACKAGE" ]] \
    || fail "Package is $actual_package, expected $EXPECTED_PACKAGE."
[[ "$actual_version_code" == "$EXPECTED_VERSION_CODE" ]] \
    || fail "Version code is $actual_version_code, expected $EXPECTED_VERSION_CODE."
[[ "$actual_version_name" == "$EXPECTED_VERSION_NAME" ]] \
    || fail "Version name is $actual_version_name, expected $EXPECTED_VERSION_NAME."
if grep -q 'android.permission.REQUEST_INSTALL_PACKAGES' <<<"$manifest_report"; then
    fail "Play AAB still requests REQUEST_INSTALL_PACKAGES."
fi

unzip -tq "$aab_path" >/dev/null || fail "AAB ZIP integrity check failed."
unzip -Z1 "$aab_path" \
    | grep -q '^BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map$' \
    || fail "AAB does not contain its R8 mapping metadata."
[[ -s "$mapping_file" ]] || fail "External R8 mapping file is missing."
[[ -s "$native_symbols" ]] || fail "Native debug-symbol ZIP is missing."
unzip -tq "$native_symbols" >/dev/null \
    || fail "Native debug-symbol ZIP integrity check failed."
for abi in arm64-v8a armeabi-v7a x86 x86_64; do
    unzip -Z1 "$native_symbols" | grep -q "^$abi/.*\.so$" \
        || fail "Native debug-symbol ZIP is missing $abi symbols."
done

aab_bytes="$(stat -c '%s' "$aab_path")"
aab_sha256="$(sha256sum "$aab_path" | awk '{print $1}')"
symbols_sha256="$(sha256sum "$native_symbols" | awk '{print $1}')"
mapping_sha256="$(sha256sum "$mapping_file" | awk '{print $1}')"

echo "Google Play release verification passed."
echo "Package:      $actual_package"
echo "Version:      $actual_version_name ($actual_version_code)"
echo "Upload cert:  $actual_cert"
echo "AAB bytes:    $aab_bytes"
echo "AAB SHA-256:  $aab_sha256"
echo "Symbols SHA:  $symbols_sha256"
echo "Mapping SHA:  $mapping_sha256"

if [[ "$stage_requested" == true ]]; then
    install -d -m 700 "$play_artifact_dir"
    install -m 644 "$aab_path" \
        "$play_artifact_dir/ColumbiaWalks-3.16.0-play.aab"
    install -m 600 "$native_symbols" \
        "$play_artifact_dir/ColumbiaWalks-3.16.0-native-debug-symbols.zip"
    install -m 600 "$mapping_file" \
        "$play_artifact_dir/ColumbiaWalks-3.16.0-mapping.txt"
    echo "Staged AAB:  $play_artifact_dir/ColumbiaWalks-3.16.0-play.aab"
    echo "Staged symbols and mapping privately in: $play_artifact_dir"
fi
