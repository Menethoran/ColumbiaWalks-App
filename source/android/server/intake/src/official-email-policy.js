const DELIVERY_MODES = new Set(["disabled", "review", "automatic"]);
const DESTINATION_MODES = new Set(["test", "official"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COLUMBIA_CENTER = Object.freeze({
  latitude: 40.0337,
  longitude: -76.5044
});
export const OFFICIAL_EMAIL_SERVICE_RADIUS_KM = 5;

export const OFFICIAL_EMAIL_RULE_IDS = Object.freeze({
  POLICE_CROSSWALK: "police_crosswalk_v1",
  CODES_MISSING_SIDEWALK: "codes_missing_sidewalk_v1"
});

export function normalizeOfficialEmailConfig(value = {}) {
  const mode = String(value.mode || "disabled").trim().toLowerCase();
  if (!DELIVERY_MODES.has(mode)) {
    throw new Error("OFFICIAL_EMAIL_MODE must be disabled, review, or automatic.");
  }
  const destinationMode = String(value.destinationMode || "test")
    .trim()
    .toLowerCase();
  if (!DESTINATION_MODES.has(destinationMode)) {
    throw new Error(
      "OFFICIAL_EMAIL_DESTINATION_MODE must be test or official."
    );
  }

  const config = {
    mode,
    destinationMode,
    sender: normalizeEmail(value.sender || "columbiawalks@gmail.com"),
    testRecipient: normalizeEmail(value.testRecipient),
    policeChiefEmail: normalizeEmail(value.policeChiefEmail),
    mayorEmail: normalizeEmail(value.mayorEmail),
    codesEmail: normalizeEmail(value.codesEmail),
    centerLatitude: finiteNumber(
      value.centerLatitude,
      COLUMBIA_CENTER.latitude
    ),
    centerLongitude: finiteNumber(
      value.centerLongitude,
      COLUMBIA_CENTER.longitude
    ),
    radiusKm: boundedNumber(
      value.radiusKm,
      OFFICIAL_EMAIL_SERVICE_RADIUS_KM,
      0.25,
      25
    ),
    dailyRecipientCap: boundedInteger(value.dailyRecipientCap, 25, 1, 100),
    maxAttempts: boundedInteger(value.maxAttempts, 5, 1, 10),
    workerIntervalMs: boundedInteger(
      value.workerIntervalMs,
      15_000,
      1_000,
      3_600_000
    ),
    leaseMs: boundedInteger(value.leaseMs, 120_000, 30_000, 900_000)
  };

  if (config.sender !== "columbiawalks@gmail.com") {
    throw new Error(
      "OFFICIAL_EMAIL_SENDER must be columbiawalks@gmail.com for version 3.15."
    );
  }
  if (
    Math.abs(config.centerLatitude - COLUMBIA_CENTER.latitude) > 1e-9 ||
    Math.abs(config.centerLongitude - COLUMBIA_CENTER.longitude) > 1e-9 ||
    Math.abs(config.radiusKm - OFFICIAL_EMAIL_SERVICE_RADIUS_KM) > 1e-9
  ) {
    throw new Error(
      "Version 3.15 fixes the official-email service area at 5 km from Columbia Borough center so the server and mobile disclosures cannot diverge."
    );
  }
  if (mode !== "disabled") {
    const requiredRecipients = destinationMode === "test"
      ? [["OFFICIAL_EMAIL_TEST_RECIPIENT", config.testRecipient]]
      : [
          ["OFFICIAL_EMAIL_POLICE_CHIEF", config.policeChiefEmail],
          ["OFFICIAL_EMAIL_MAYOR", config.mayorEmail],
          ["OFFICIAL_EMAIL_CODES", config.codesEmail]
        ];
    for (const [name, address] of requiredRecipients) {
      if (!address) throw new Error(`${name} must contain a valid email address.`);
    }
  }
  return Object.freeze(config);
}

export function officialEmailCandidates(report, photoId, configValue) {
  const config = normalizeOfficialEmailConfig(configValue);
  if (report?.official_email_authorized !== true) return [];
  // Authorization is destination-specific. A report approved for the internal
  // field-test mailbox must never be rerouted to officials merely because a
  // server setting changes later (and vice versa).
  if (
    report?.official_email_destination_authorized !== config.destinationMode
  ) return [];
  // Version 3.15 permits official-email generation only from the two explicit
  // quick-report paths. A caller cannot smuggle a quick type into a full or
  // Page of Shame payload to activate a route.
  if (report?.submission_mode !== "quick") return [];

  const rules = [];
  const rapidKind = report.rapid_report_kind ?? null;
  const quickTypes = Array.isArray(report.quick_report_types)
    ? report.quick_report_types
    : null;
  // Fail closed on legacy, malformed, duplicated, or mixed quick selections.
  // A standard Quick or Repeat sidewalk route must carry exactly one exact
  // machine key. Repeat vehicle crosswalk reports use their dedicated subtype
  // and must carry no quick-report keys at all.
  if (
    quickTypes === null ||
    quickTypes.some((value) => typeof value !== "string") ||
    new Set(quickTypes).size !== quickTypes.length
  ) return [];

  const standardQuickType = rapidKind === null && quickTypes.length === 1
    ? quickTypes[0]
    : null;
  const repeatSidewalkType = rapidKind === "sidewalk" && quickTypes.length === 1
    ? quickTypes[0]
    : null;
  const repeatVehicleCrosswalk = rapidKind === "vehicle" &&
    quickTypes.length === 0 &&
    report.vehicle_issue_type === "crosswalk_incursion";

  if (
    standardQuickType === "crosswalk_encroachment" ||
    repeatVehicleCrosswalk
  ) {
    rules.push(withDestination({
      ruleId: OFFICIAL_EMAIL_RULE_IDS.POLICE_CROSSWALK,
      route: "police_mayor",
      to: [config.policeChiefEmail].filter(Boolean),
      cc: [config.mayorEmail].filter(Boolean)
    }, config));
  }

  if (
    standardQuickType === "missing_sidewalk" ||
    repeatSidewalkType === "missing_sidewalk"
  ) {
    rules.push(withDestination({
      ruleId: OFFICIAL_EMAIL_RULE_IDS.CODES_MISSING_SIDEWALK,
      route: "codes",
      to: [config.codesEmail].filter(Boolean),
      cc: []
    }, config));
  }

  const location = officialEmailLocationStatus(report, config);
  return rules.map((rule) => {
    let status;
    let blockedReason = null;
    if (config.mode === "disabled") {
      status = "disabled";
      blockedReason = "delivery_disabled";
    } else if (!photoId) {
      status = "blocked";
      blockedReason = "missing_photo";
    } else if (!location.ok) {
      status = "blocked";
      blockedReason = location.reason;
    } else if (rule.to.length === 0) {
      status = "blocked";
      blockedReason = "recipient_not_configured";
    } else {
      status = config.mode === "review" ? "review" : "queued";
    }
    return {
      ...rule,
      photoId: photoId || null,
      status,
      blockedReason,
      recipientCount: rule.to.length + rule.cc.length
    };
  });
}

export function officialEmailLocationStatus(report, configValue) {
  const config = normalizeOfficialEmailConfig(configValue);
  const latitude = Number(report?.latitude);
  const longitude = Number(report?.longitude);
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return { ok: false, reason: "missing_location" };
  }
  const distanceKm = haversineKm(
    latitude,
    longitude,
    config.centerLatitude,
    config.centerLongitude
  );
  return distanceKm <= config.radiusKm
    ? { ok: true, distanceKm }
    : { ok: false, reason: "outside_service_area", distanceKm };
}

export function snapshotOfficialEmailReport(report, photoId = null) {
  return {
    client_report_id: String(report?.client_report_id || ""),
    observed_at: String(report?.observed_at || ""),
    categories: strings(report?.categories, 20),
    severity: String(report?.severity || ""),
    details: String(report?.details || "").slice(0, 1500),
    latitude: Number.isFinite(Number(report?.latitude))
      ? Number(report.latitude)
      : null,
    longitude: Number.isFinite(Number(report?.longitude))
      ? Number(report.longitude)
      : null,
    nearest_intersection: normalizeIntersection(report?.nearest_intersection),
    weather_status: String(report?.weather_status || "").slice(0, 64),
    weather_summary: String(report?.weather_summary || "").slice(0, 500),
    weather_valid_time_utc: String(
      report?.weather_valid_time_utc || ""
    ).slice(0, 64),
    weather_attribution: String(report?.weather_attribution || "").slice(0, 250),
    quick_report_types: strings(report?.quick_report_types, 20),
    submission_mode: String(report?.submission_mode || "").slice(0, 16),
    official_email_authorized: report?.official_email_authorized === true,
    official_email_destination_authorized:
      report?.official_email_destination_authorized === "test" ||
      report?.official_email_destination_authorized === "official"
        ? report.official_email_destination_authorized
        : null,
    rapid_report_kind: nullableText(report?.rapid_report_kind),
    vehicle_issue_type: nullableText(report?.vehicle_issue_type),
    sidewalk_lip_height: nullableText(report?.sidewalk_lip_height),
    vehicle_details: normalizeVehicleDetails(report?.vehicle_details),
    app_version: String(report?.app_version || "").slice(0, 32),
    submission_channel: String(report?.submission_channel || "unknown").slice(0, 32),
    photo_id: typeof photoId === "string" && photoId ? photoId : null
  };
}

export function deliveryDedupeKey(clientReportId, ruleId) {
  return `v1:${String(clientReportId)}:${String(ruleId)}`;
}

function normalizeIntersection(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return {
    label: String(parsed.label || "").slice(0, 200),
    latitude: Number.isFinite(Number(parsed.latitude))
      ? Number(parsed.latitude)
      : null,
    longitude: Number.isFinite(Number(parsed.longitude))
      ? Number(parsed.longitude)
      : null
  };
}

function normalizeVehicleDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const key of [
    "license_plate",
    "plate_state",
    "year",
    "make",
    "model",
    "color",
    "body_style",
    "unit_number",
    "description"
  ]) {
    if (typeof value[key] === "string") result[key] = value[key].slice(0, 1000);
  }
  return result;
}

function withDestination(rule, config) {
  if (config.destinationMode === "test") {
    return {
      ...rule,
      destinationMode: "test",
      to: [config.testRecipient].filter(Boolean),
      cc: []
    };
  }
  return { ...rule, destinationMode: "official" };
}

function strings(value, limit) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").slice(0, limit)
    : [];
}

function nullableText(value) {
  return typeof value === "string" && value ? value : null;
}

function normalizeEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : "";
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = finiteNumber(value, fallback);
  if (number < minimum || number > maximum) {
    throw new Error(`Configuration value must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = value === undefined || value === null || value === ""
    ? fallback
    : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      `Configuration value must be an integer between ${minimum} and ${maximum}.`
    );
  }
  return number;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDistance = radians(lat2 - lat1);
  const longitudeDistance = radians(lon2 - lon1);
  const a = Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(longitudeDistance / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
