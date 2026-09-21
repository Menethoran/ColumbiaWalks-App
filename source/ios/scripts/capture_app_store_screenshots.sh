#!/usr/bin/env bash
set -euo pipefail

IOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${IOS_DIR}/build/app-store-screenshots}"
RESULT_BUNDLE="${OUTPUT_DIR}/ColumbiaWalksScreenshots.xcresult"
RAW_ATTACHMENTS="${OUTPUT_DIR}/raw-attachments"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode is required to capture iOS Simulator screenshots." >&2
  exit 1
fi
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen is required. Install it with: brew install xcodegen" >&2
  exit 1
fi

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

cd "${IOS_DIR}"
xcodegen generate --spec project.yml

RUNTIME_ID="$({ xcrun simctl list runtimes --json; } | python3 -c '
import json, sys

runtimes = [
    item for item in json.load(sys.stdin).get("runtimes", [])
    if item.get("isAvailable") and item.get("platform") == "iOS"
]
if not runtimes:
    raise SystemExit("No available iOS Simulator runtime was found")

def version(item):
    return tuple(int(part) for part in item.get("version", "0").split("."))

print(max(runtimes, key=version)["identifier"])
')"

DEVICE_TYPES_JSON="$(xcrun simctl list devicetypes --json)"
DEVICE_TYPE_ID="$({ printf '%s' "${DEVICE_TYPES_JSON}"; } | python3 -c '
import json, sys

available = {item["identifier"] for item in json.load(sys.stdin).get("devicetypes", [])}
preferred = [
    "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max",
    "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max",
    "com.apple.CoreSimulator.SimDeviceType.iPhone-14-Pro-Max",
    "com.apple.CoreSimulator.SimDeviceType.iPhone-11-Pro-Max",
    "com.apple.CoreSimulator.SimDeviceType.iPhone-14-Plus",
]
for identifier in preferred:
    if identifier in available:
        print(identifier)
        break
else:
    raise SystemExit("No supported large-screen iPhone simulator is available")
')"

SIMULATOR_ID="$(xcrun simctl create "ColumbiaWalks App Store Screenshots" "${DEVICE_TYPE_ID}" "${RUNTIME_ID}")"
cleanup() {
  xcrun simctl shutdown "${SIMULATOR_ID}" >/dev/null 2>&1 || true
  xcrun simctl delete "${SIMULATOR_ID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

xcrun simctl boot "${SIMULATOR_ID}"
xcrun simctl bootstatus "${SIMULATOR_ID}" -b
xcrun simctl status_bar "${SIMULATOR_ID}" override \
  --time "9:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --wifiBars 3 \
  --cellularBars 4

xcodebuild \
  -project ColumbiaWalks.xcodeproj \
  -scheme ColumbiaWalksScreenshots \
  -destination "platform=iOS Simulator,id=${SIMULATOR_ID}" \
  -only-testing:ColumbiaWalksUITests/AppStoreScreenshots/testCaptureAppStoreScreenshots \
  -resultBundlePath "${RESULT_BUNDLE}" \
  -derivedDataPath "${OUTPUT_DIR}/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  test

mkdir -p "${RAW_ATTACHMENTS}"
xcrun xcresulttool export attachments \
  --path "${RESULT_BUNDLE}" \
  --output-path "${RAW_ATTACHMENTS}"

PNG_COUNT="$(find "${RAW_ATTACHMENTS}" -type f -name '*.png' | wc -l | tr -d ' ')"
if [[ "${PNG_COUNT}" -lt 6 ]]; then
  echo "Expected at least six exported PNG attachments, found ${PNG_COUNT}." >&2
  exit 1
fi

echo "Exported ${PNG_COUNT} PNG attachments to ${RAW_ATTACHMENTS}"
find "${RAW_ATTACHMENTS}" -type f -name '*.png' -print -exec sips \
  -g pixelWidth \
  -g pixelHeight \
  -g hasAlpha \
  {} \;
