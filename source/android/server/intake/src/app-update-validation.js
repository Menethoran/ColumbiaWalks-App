const ALLOWED_EVENT_TYPES = new Set([
  "up_to_date",
  "check_failed",
  "update_available",
  "update_deferred",
  "download_started",
  "download_verified",
  "download_failed",
  "install_permission_denied",
  "installer_opened",
  "install_failed",
  "installed"
]);
const EVENTS_REQUIRING_TARGET = new Set([
  "up_to_date",
  "update_available",
  "update_deferred",
  "download_started",
  "download_verified",
  "download_failed",
  "installer_opened",
  "install_failed",
  "installed"
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const ERROR_CODE_PATTERN = /^[a-z0-9_]{1,80}$/;

export function validateAppUpdateEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The update event must be a JSON object.");
  }
  if (!UUID_PATTERN.test(value.event_id || "")) {
    return invalid("event_id must be a UUID.");
  }
  if (!ALLOWED_EVENT_TYPES.has(value.event_type)) {
    return invalid("event_type is not supported.");
  }
  if (value.platform !== "android") {
    return invalid("platform must be android.");
  }

  const fromVersionCode = integerVersion(value.from_version_code);
  const fromVersionName = versionName(value.from_version_name);
  if (fromVersionCode === null || fromVersionName === null) {
    return invalid("A valid source app version is required.");
  }

  const hasTargetCode = value.target_version_code !== undefined;
  const hasTargetName = value.target_version_name !== undefined;
  if (hasTargetCode !== hasTargetName) {
    return invalid("Target version code and name must be provided together.");
  }
  let targetVersionCode = null;
  let targetVersionName = null;
  if (hasTargetCode) {
    targetVersionCode = integerVersion(value.target_version_code);
    targetVersionName = versionName(value.target_version_name);
    if (targetVersionCode === null || targetVersionName === null) {
      return invalid("The target app version is invalid.");
    }
  }
  if (EVENTS_REQUIRING_TARGET.has(value.event_type) && targetVersionCode === null) {
    return invalid("This event requires a target app version.");
  }

  const occurredAt = new Date(value.occurred_at);
  if (
    typeof value.occurred_at !== "string" ||
    value.occurred_at.length > 40 ||
    !Number.isFinite(occurredAt.getTime())
  ) {
    return invalid("occurred_at must be a valid timestamp.");
  }

  let errorCode = null;
  if (value.error_code !== undefined && value.error_code !== null) {
    if (
      typeof value.error_code !== "string" ||
      !ERROR_CODE_PATTERN.test(value.error_code)
    ) {
      return invalid("error_code is invalid.");
    }
    errorCode = value.error_code;
  }

  return {
    ok: true,
    event: {
      event_id: value.event_id.toLowerCase(),
      event_type: value.event_type,
      from_version_code: fromVersionCode,
      from_version_name: fromVersionName,
      target_version_code: targetVersionCode,
      target_version_name: targetVersionName,
      occurred_at: occurredAt.toISOString(),
      error_code: errorCode,
      platform: "android"
    }
  };
}

function integerVersion(value) {
  return Number.isInteger(value) && value > 0 && value <= 2_147_483_647
    ? value
    : null;
}

function versionName(value) {
  return typeof value === "string" &&
    value.length <= 32 &&
    VERSION_PATTERN.test(value)
    ? value
    : null;
}

function invalid(error) {
  return { ok: false, error };
}

