#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../../.." && pwd)"
sdk_root="${ANDROID_SDK_ROOT:-/home/robert/.cache/columbiawalks-android-sdk}"
gradle_cache="${CW_GRADLE_CACHE:-/home/robert/.cache/columbiawalks-gradle}"
qa_android_home="${CW_QA_ANDROID_HOME:-/home/robert/.cache/columbiawalks-qa-android}"
mkdir -p -m 700 "$qa_android_home"
python3 "$script_dir/verify-distribution.py" --channel public
docker run --rm --user "$(id -u):$(id -g)" \
 --env GRADLE_USER_HOME="$gradle_cache" --env ANDROID_HOME="$sdk_root" \
 --env ANDROID_USER_HOME="$qa_android_home" --volume "$qa_android_home:$qa_android_home" \
 --volume "$gradle_cache:$gradle_cache" --volume "$sdk_root:$sdk_root" \
 --volume "$project_dir:$project_dir" --workdir "$project_dir/source/android" \
 "${CW_GRADLE_IMAGE:-gradle:8.13-jdk17}" gradle --no-daemon testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest
mkdir -p "$project_dir/artifacts"
cp "$project_dir/source/android/app/build/outputs/apk/debug/app-debug.apk" "$project_dir/artifacts/ColumbiaWalks-3.17.1-qa.apk"
(cd "$project_dir/artifacts" && sha256sum ColumbiaWalks-3.17.1-qa.apk > ColumbiaWalks-3.17.1-qa.apk.sha256)
echo "QA-only, separate .qa package: $project_dir/artifacts/ColumbiaWalks-3.17.1-qa.apk"
