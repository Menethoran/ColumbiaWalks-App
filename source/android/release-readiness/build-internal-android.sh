#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
project_dir="$(cd "$source_dir/../.." && pwd)"
sdk_root="${ANDROID_SDK_ROOT:-/home/robert/.cache/columbiawalks-android-sdk}"
gradle_cache="${CW_GRADLE_CACHE:-/home/robert/.cache/columbiawalks-gradle}"
internal_android_home="${CW_INTERNAL_ANDROID_HOME:-/home/robert/.cache/columbiawalks-internal-android}"
mkdir -p -m 700 "$internal_android_home"
python3 "$script_dir/verify-distribution.py" --channel internal
args=(testDebugUnitTest lintDebug assembleDebug)
artifact="ColumbiaWalks-3.17.10-internal-test.apk"
if [[ "${1:-}" == "--qa" && $# == 1 ]]; then
    args=(testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest)
    artifact="ColumbiaWalks-3.17.10-internal-test.apk"
elif [[ $# != 0 ]]; then
    echo "Usage: $0 [--qa]" >&2
    exit 2
fi
docker run --rm --user "$(id -u):$(id -g)" \
    --env GRADLE_USER_HOME="$gradle_cache" --env ANDROID_HOME="$sdk_root" \
    --env ANDROID_USER_HOME="$internal_android_home" --volume "$internal_android_home:$internal_android_home" \
    --volume "$gradle_cache:$gradle_cache" --volume "$sdk_root:$sdk_root" \
    --volume "$project_dir:$project_dir" --workdir "$source_dir" \
    "${CW_GRADLE_IMAGE:-gradle:8.13-jdk17}" gradle --no-daemon "${args[@]}"
mkdir -p "$project_dir/artifacts"
cp "$source_dir/app/build/outputs/apk/debug/app-debug.apk" "$project_dir/artifacts/$artifact"
(cd "$project_dir/artifacts" && sha256sum "$artifact" > "$artifact.sha256")
echo "INTERNAL TEST ONLY: $project_dir/artifacts/$artifact"
