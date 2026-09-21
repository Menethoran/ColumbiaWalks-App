const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APP_VERSION_PATTERN = /^[0-9A-Za-z.+_-]{1,32}$/;
const SOURCES = new Set(["tracked_walk", "health_connect"]);

export function validateWalkingMetric(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The walking summary must be a JSON object.");
  }
  if (!UUID_PATTERN.test(value.metric_id || "")) {
    return invalid("metric_id must be a valid UUID.");
  }
  const start = parseTime(value.period_start);
  const end = parseTime(value.period_end);
  if (start === null || end === null || end <= start) {
    return invalid("period_start and period_end must describe a valid time range.");
  }
  if (end - start > 31 * 24 * 60 * 60 * 1000) {
    return invalid("A walking summary cannot cover more than 31 days.");
  }
  const distance = Number(value.distance_meters);
  if (!Number.isFinite(distance) || distance < 0 || distance > 5_000_000) {
    return invalid("distance_meters is outside the supported range.");
  }
  const duration = Number(value.duration_seconds);
  if (!Number.isInteger(duration) || duration < 0 || duration > 31 * 24 * 60 * 60) {
    return invalid("duration_seconds is outside the supported range.");
  }
  if (!SOURCES.has(value.source)) {
    return invalid("source must be tracked_walk or health_connect.");
  }
  const activityCount = value.activity_count === undefined
    ? 1
    : Number(value.activity_count);
  if (!Number.isInteger(activityCount) || activityCount < 1 || activityCount > 10_000) {
    return invalid("activity_count is outside the supported range.");
  }
  if (!APP_VERSION_PATTERN.test(value.app_version || "")) {
    return invalid("app_version is invalid.");
  }
  if (value.user_consent !== true) {
    return invalid("user_consent must be true before sharing walking data.");
  }
  return {
    ok: true,
    metric: {
      metric_id: value.metric_id,
      period_start: new Date(start).toISOString(),
      period_end: new Date(end).toISOString(),
      distance_meters: Math.round(distance * 10) / 10,
      duration_seconds: duration,
      activity_count: activityCount,
      source: value.source,
      app_version: value.app_version
    }
  };
}

function parseTime(value) {
  if (typeof value !== "string" || value.length > 100) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function invalid(error) {
  return { ok: false, error };
}

