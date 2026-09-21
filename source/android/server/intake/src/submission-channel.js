const KNOWN_CHANNELS = new Set([
  "iphone_app",
  "iphone_web",
  "desktop_web",
  "android_web",
  "android_app",
  "web_unknown",
  "unknown"
]);

const CHANNEL_LABELS = new Map([
  ["iphone_app", "iPhone app"],
  ["iphone_web", "iPhone web"],
  ["desktop_web", "Desktop web"],
  ["android_web", "Android web"],
  ["android_app", "Android app"],
  ["web_unknown", "Web — device not recorded"],
  ["unknown", "Legacy / unknown"]
]);

export function classifySubmissionChannel({ userAgent = "", appVersion = "" } = {}) {
  const agent = String(userAgent || "").toLowerCase();
  if (agent.includes("columbiawalks-ios/")) return "iphone_app";
  if (agent.includes("columbiawalks-android/")) return "android_app";
  if (/\b(iphone|ipad|ipod)\b/.test(agent)) return "iphone_web";
  if (/\bandroid\b/.test(agent)) return "android_web";
  if (agent) return "desktop_web";
  return inferLegacyChannel(appVersion);
}

export function reportSubmissionChannel(report = {}) {
  if (KNOWN_CHANNELS.has(report.submission_channel)) {
    return report.submission_channel;
  }
  return inferLegacyChannel(report.app_version);
}

export function submissionChannelLabel(channel) {
  return CHANNEL_LABELS.get(channel) || CHANNEL_LABELS.get("unknown");
}

function inferLegacyChannel(appVersion) {
  const version = String(appVersion || "").trim().toLowerCase();
  if (!version || version.includes("unknown") || version === "legacy_not_recorded") {
    return "unknown";
  }
  if (version.startsWith("ios-")) return "iphone_app";
  if (version.startsWith("android-")) return "android_app";
  if (version.startsWith("web-") || version.startsWith("wordpress-")) {
    return "web_unknown";
  }
  // ColumbiaWalks had only the Android native app before this field was added.
  return "android_app";
}

