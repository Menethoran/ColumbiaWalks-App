const ALLOWED_CATEGORIES = new Set([
  "sidewalk_safety",
  "vehicle_safety",
  "crosswalk_safety",
  "trip_hazards",
  "aggressive_drivers",
  "police_response",
  "lighting_or_visibility",
  "accessibility_ada",
  "school_route_safety",
  "not_included_elsewhere",
  "other"
]);

const ALLOWED_SEVERITIES = new Set(["low", "medium", "high"]);
const ALLOWED_POLICE_RESPONSES = new Set([
  "not_involved",
  "good",
  "poor",
  "mixed"
]);
const ALLOWED_ASSESSMENT_MODES = new Set([
  "quick_report",
  "walkability_assessment"
]);
const ALLOWED_CHECKLIST_RESPONSES = new Set([
  "ok",
  "needs_attention",
  "not_applicable"
]);
const ALLOWED_REPORTED_PARTY_TYPES = new Set([
  "unknown",
  "civilian_driver",
  "police_officer",
  "other_government_driver",
  "commercial_driver"
]);
const ALLOWED_SUBMISSION_MODES = new Set(["pos", "quick", "full"]);
const ALLOWED_OFFICIAL_EMAIL_DESTINATIONS = new Set(["test", "official"]);
const ALLOWED_QUICK_REPORT_TYPES = new Set([
  "sidewalk_issue",
  "driver_issue",
  "crosswalk_issue",
  "other_safety_issue",
  "crosswalk_encroachment",
  "missing_sidewalk",
  "speeding",
  "illegal_u_turn",
  "trip_hazard"
]);
const ALLOWED_RAPID_REPORT_KINDS = new Set([
  "sidewalk",
  "vehicle",
  "crosswalk",
  "trip_hazard",
  "lighting_or_visibility",
  "accessibility_ada",
  "school_route",
  "police_response",
  "other"
]);
const RAPID_REPORT_CATEGORIES = new Map([
  ["sidewalk", "sidewalk_safety"],
  ["vehicle", "vehicle_safety"],
  ["crosswalk", "crosswalk_safety"],
  ["trip_hazard", "trip_hazards"],
  ["lighting_or_visibility", "lighting_or_visibility"],
  ["accessibility_ada", "accessibility_ada"],
  ["school_route", "school_route_safety"],
  ["police_response", "police_response"],
  ["other", "not_included_elsewhere"]
]);
const ALLOWED_SIDEWALK_LIP_HEIGHTS = new Set([
  "quarter_inch_or_less",
  "over_quarter_inch",
  "over_half_inch",
  "over_one_inch",
  "over_two_inches"
]);
const ALLOWED_VEHICLE_ISSUE_TYPES = new Set([
  "aggressive_driving",
  "crosswalk_incursion",
  "illegal_u_turn",
  "speeding",
  "failure_to_yield",
  "red_light_violation",
  "stop_sign_violation",
  "blocked_crosswalk_or_sidewalk",
  "illegal_parking",
  "distracted_driving",
  "other"
]);
const ALLOWED_LOCATION_SOURCES = new Set([
  "none",
  "photo_exif",
  "device_gps",
  "manual_map",
  "manual_coordinates",
  "legacy"
]);
const MANUAL_LOCATION_SOURCES = new Set([
  "manual_map",
  "manual_coordinates"
]);
const ALLOWED_STATUS_VALUES = new Set(["unknown", "on", "off"]);
const ALLOWED_POLICE_OBSERVATIONS = new Set([
  "entered_against_red_signal",
  "failed_to_stop_at_stop_sign",
  "unsafe_speed",
  "failed_to_yield",
  "blocked_crosswalk_or_sidewalk",
  "aggressive_or_threatening_conduct",
  "complaint_or_report_not_taken",
  "identification_not_provided",
  "no_follow_up_observed",
  "professional_or_helpful_response"
]);
const VEHICLE_FIELD_LIMITS = new Map([
  ["license_plate", 20],
  ["plate_state", 32],
  ["year", 8],
  ["make", 80],
  ["model", 80],
  ["color", 80],
  ["body_style", 80],
  ["vin", 32],
  ["unit_number", 80],
  ["visible_damage", 500],
  ["description", 1000]
]);
const CHECKLIST_ID_LIMITS = new Map([
  ["walk", 11],
  ["cross", 10],
  ["driver", 8],
  ["view", 5],
  ["access", 4],
  ["vehicle", 20],
  ["school", 18],
  ["practice", 6],
  ["police", 2]
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_CATEGORY_ALIASES = new Map([
  ["sidewalk", "sidewalk_safety"],
  ["sidewalk_issue", "sidewalk_safety"],
  ["sidewalk_condition", "sidewalk_safety"],
  ["missing_sidewalk", "sidewalk_safety"],
  ["vehicle", "vehicle_safety"],
  ["driver", "aggressive_drivers"],
  ["driver_issue", "aggressive_drivers"],
  ["crosswalk", "crosswalk_safety"],
  ["crosswalk_issue", "crosswalk_safety"],
  ["trip_hazard", "trip_hazards"],
  ["lighting", "lighting_or_visibility"],
  ["visibility", "lighting_or_visibility"],
  ["accessibility", "accessibility_ada"],
  ["ada", "accessibility_ada"],
  ["school_route", "school_route_safety"],
  ["police", "police_response"],
  ["other_safety_issue", "not_included_elsewhere"]
]);

export function normalizeLegacyReport(
  value,
  { fallbackId, userAgent = "", now = new Date() } = {}
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const suppliedVersion = firstText(
    value.app_version,
    value.appVersion,
    value.version,
    versionFromUserAgent(userAgent)
  );
  if (!isLegacyVersion(suppliedVersion)) {
    return { ...value };
  }

  const normalized = { ...value };
  normalized.client_report_id = firstText(
    value.client_report_id,
    value.clientReportId,
    value.report_id,
    value.id,
    fallbackId
  );
  normalized.observed_at = firstText(
    value.observed_at,
    value.observedAt,
    value.incident_at,
    value.created_at,
    value.date,
    now instanceof Date ? now.toISOString() : String(now)
  );
  normalized.app_version = suppliedVersion.toLowerCase().startsWith("web-")
    ? `web-legacy-${safeLegacyVersion(suppliedVersion.slice(4))}`
    : `legacy-${safeLegacyVersion(suppliedVersion)}`;

  const rawQuickTypes = normalizeArray(
    value.quick_report_types ?? value.quick_report_type ?? value.quickReportType
  );
  normalized.quick_report_types = uniqueStrings(rawQuickTypes)
    .map(toSlug)
    .filter((item) => ALLOWED_QUICK_REPORT_TYPES.has(item));
  normalized.quick_report_type = normalized.quick_report_types[0] || null;

  const rawCategories = normalizeArray(
    value.categories ?? value.category ?? value.issue_type ?? value.issueType
  );
  normalized.categories = uniqueStrings(rawCategories).map((item) => {
    const slug = toSlug(item);
    if (ALLOWED_CATEGORIES.has(slug)) return slug;
    return LEGACY_CATEGORY_ALIASES.get(slug) || "other";
  });
  if (normalized.categories.length === 0 && normalized.quick_report_type) {
    normalized.categories = [
      LEGACY_CATEGORY_ALIASES.get(normalized.quick_report_type) || "other"
    ];
  }

  const requestedMode = toSlug(
    firstText(value.submission_mode, value.submissionMode, value.mode)
  );
  normalized.submission_mode = ALLOWED_SUBMISSION_MODES.has(requestedMode)
    ? requestedMode
    : normalized.quick_report_types.length > 0
      ? "quick"
      : "full";
  if (
    normalized.submission_mode === "full" &&
    normalized.categories.length === 0
  ) {
    normalized.categories = ["other"];
  }

  normalized.severity = normalizeLegacySeverity(value.severity ?? value.urgency);
  normalized.police_response = normalizeLegacyPoliceResponse(
    value.police_response ?? value.policeResponse ?? value.police_involvement
  );
  normalized.details = firstText(
    value.details,
    value.description,
    value.notes,
    value.comment
  );

  const latitude = finiteNumber(value.latitude ?? value.lat);
  const longitude = finiteNumber(value.longitude ?? value.lng ?? value.lon);
  normalized.latitude = latitude;
  normalized.longitude = longitude;
  normalized.location = latitude !== null && longitude !== null
    ? { type: "Point", coordinates: [longitude, latitude] }
    : null;

  normalized.assessment_mode = ALLOWED_ASSESSMENT_MODES.has(
    value.assessment_mode
  ) ? value.assessment_mode : "quick_report";
  normalized.checklist_responses = normalizeObject(value.checklist_responses);
  normalized.reported_party_type = ALLOWED_REPORTED_PARTY_TYPES.has(
    value.reported_party_type
  ) ? value.reported_party_type : "unknown";
  normalized.vehicle_details = normalizeObject(value.vehicle_details);
  normalized.vehicle_involved = typeof value.vehicle_involved === "boolean"
    ? value.vehicle_involved
    : Object.keys(normalized.vehicle_details).length > 0;
  normalized.police_observations = uniqueStrings(
    normalizeArray(value.police_observations)
  ).filter((item) => ALLOWED_POLICE_OBSERVATIONS.has(item));
  normalized.police_complaint_details = firstText(
    value.police_complaint_details
  );
  normalized.nearest_intersection = normalizeNullableObject(
    value.nearest_intersection
  );
  return normalized;
}

export function validateReport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The report must be a JSON object.");
  }

  if (!UUID_PATTERN.test(value.client_report_id || "")) {
    return invalid("client_report_id must be a valid UUID.");
  }

  if (
    typeof value.observed_at !== "string" ||
    value.observed_at.length < 1 ||
    value.observed_at.length > 100
  ) {
    return invalid("observed_at must contain 1–100 characters.");
  }

  const submissionMode = value.submission_mode || "full";
  if (!ALLOWED_SUBMISSION_MODES.has(submissionMode)) {
    return invalid("submission_mode must be pos, quick, or full.");
  }
  const webPosMayOmitCoordinates =
    submissionMode === "pos" &&
    typeof value.app_version === "string" &&
    value.app_version.startsWith("web-");
  const legacyMayOmitCoordinates =
    typeof value.app_version === "string" &&
    (value.app_version.startsWith("legacy-") ||
      value.app_version.startsWith("web-legacy-"));

  if (
    !Array.isArray(value.categories) ||
    (submissionMode === "full" && value.categories.length < 1) ||
    value.categories.length > ALLOWED_CATEGORIES.size ||
    new Set(value.categories).size !== value.categories.length ||
    value.categories.some((category) => !ALLOWED_CATEGORIES.has(category))
  ) {
    return invalid("categories contains an unsupported issue type.");
  }

  if (!ALLOWED_SEVERITIES.has(value.severity)) {
    return invalid("severity must be low, medium, or high.");
  }
  if (!ALLOWED_POLICE_RESPONSES.has(value.police_response)) {
    return invalid("police_response contains an unsupported value.");
  }

  if (typeof value.details !== "string" || value.details.length > 1500) {
    return invalid("details must be text no longer than 1,500 characters.");
  }

  const hasLatitude = Number.isFinite(value.latitude);
  const hasLongitude = Number.isFinite(value.longitude);
  const hasCoordinates = hasLatitude && hasLongitude;
  if (hasLatitude !== hasLongitude) {
    return invalid("latitude and longitude must be provided together.");
  }
  if (
    (hasCoordinates &&
      (value.latitude < -90 ||
        value.latitude > 90 ||
        value.longitude < -180 ||
        value.longitude > 180)) ||
    ((submissionMode === "full" && !legacyMayOmitCoordinates) ||
      (submissionMode === "pos" && !webPosMayOmitCoordinates)) &&
      !hasCoordinates
  ) {
    return invalid(
      submissionMode === "pos" && !hasCoordinates
        ? "PoS reports require GPS coordinates."
        : "latitude or longitude is outside its valid range."
    );
  }

  if (hasCoordinates) {
    if (
      !value.location ||
      value.location.type !== "Point" ||
      !Array.isArray(value.location.coordinates) ||
      value.location.coordinates.length !== 2 ||
      !approximatelyEqual(value.location.coordinates[0], value.longitude) ||
      !approximatelyEqual(value.location.coordinates[1], value.latitude)
    ) {
      return invalid("location must be a GeoJSON Point matching the coordinates.");
    }
  } else if (value.location !== null && value.location !== undefined) {
    return invalid("location must be null when coordinates are not provided.");
  }

  if (
    typeof value.app_version !== "string" ||
    !/^[0-9A-Za-z.+_-]{1,32}$/.test(value.app_version)
  ) {
    return invalid("app_version is invalid.");
  }

  const assessmentMode = value.assessment_mode || "quick_report";
  if (!ALLOWED_ASSESSMENT_MODES.has(assessmentMode)) {
    return invalid("assessment_mode contains an unsupported value.");
  }

  const checklistResponses = value.checklist_responses || {};
  if (
    !checklistResponses ||
    typeof checklistResponses !== "object" ||
    Array.isArray(checklistResponses)
  ) {
    return invalid("checklist_responses must be a JSON object.");
  }
  const checklistEntries = Object.entries(checklistResponses);
  if (
    checklistEntries.length > 84 ||
    checklistEntries.some(
      ([questionId, response]) =>
        !isChecklistQuestionId(questionId) ||
        !ALLOWED_CHECKLIST_RESPONSES.has(response)
    )
  ) {
    return invalid("checklist_responses contains an unsupported question or answer.");
  }

  const reportedPartyType = value.reported_party_type || "unknown";
  if (!ALLOWED_REPORTED_PARTY_TYPES.has(reportedPartyType)) {
    return invalid("reported_party_type contains an unsupported value.");
  }

  const vehicleInvolved = value.vehicle_involved ?? false;
  if (typeof vehicleInvolved !== "boolean") {
    return invalid("vehicle_involved must be true or false.");
  }

  const vehicleDetails = value.vehicle_details || {};
  const vehicleValidation = validateVehicleDetails(vehicleDetails);
  if (!vehicleValidation.ok) {
    return vehicleValidation;
  }
  if (!vehicleInvolved && Object.keys(vehicleDetails).length > 0) {
    return invalid("vehicle_details requires vehicle_involved to be true.");
  }

  const policeObservations = value.police_observations || [];
  if (
    !Array.isArray(policeObservations) ||
    policeObservations.length > ALLOWED_POLICE_OBSERVATIONS.size ||
    new Set(policeObservations).size !== policeObservations.length ||
    policeObservations.some(
      (observation) => !ALLOWED_POLICE_OBSERVATIONS.has(observation)
    )
  ) {
    return invalid("police_observations contains an unsupported value.");
  }

  const policeComplaintDetails = value.police_complaint_details || "";
  if (
    typeof policeComplaintDetails !== "string" ||
    policeComplaintDetails.length > 1500
  ) {
    return invalid(
      "police_complaint_details must be text no longer than 1,500 characters."
    );
  }

  const legacyQuickReportType = value.quick_report_type || null;
  const quickReportTypes =
    value.quick_report_types === undefined
      ? legacyQuickReportType
        ? [legacyQuickReportType]
        : []
      : value.quick_report_types;
  if (
    !Array.isArray(quickReportTypes) ||
    quickReportTypes.length > ALLOWED_QUICK_REPORT_TYPES.size ||
    new Set(quickReportTypes).size !== quickReportTypes.length ||
    quickReportTypes.some(
      (quickReportType) =>
        !ALLOWED_QUICK_REPORT_TYPES.has(quickReportType)
    )
  ) {
    return invalid("quick_report_types contains an unsupported value.");
  }
  const quickReportType = quickReportTypes[0] || null;

  const nearestIntersection = value.nearest_intersection || null;
  if (!hasCoordinates && nearestIntersection !== null) {
    return invalid("nearest_intersection requires a report location.");
  }
  const intersectionValidation =
    validateNearestIntersection(nearestIntersection);
  if (!intersectionValidation.ok) {
    return intersectionValidation;
  }

  const rapidReportKind = value.rapid_report_kind ?? null;
  if (
    rapidReportKind !== null &&
    !ALLOWED_RAPID_REPORT_KINDS.has(rapidReportKind)
  ) {
    return invalid("rapid_report_kind contains an unsupported value.");
  }
  if (
    rapidReportKind !== null &&
    quickReportTypes.length > 0 &&
    !(
      rapidReportKind === "sidewalk" &&
      quickReportTypes.length === 1 &&
      quickReportTypes[0] === "missing_sidewalk"
    )
  ) {
    return invalid(
      "Continuous rapid reports contain an incompatible quick report type."
    );
  }

  const sidewalkLipHeight = value.sidewalk_lip_height ?? null;
  if (
    sidewalkLipHeight !== null &&
    !ALLOWED_SIDEWALK_LIP_HEIGHTS.has(sidewalkLipHeight)
  ) {
    return invalid("sidewalk_lip_height contains an unsupported value.");
  }

  const vehicleIssueType = value.vehicle_issue_type ?? null;
  if (
    vehicleIssueType !== null &&
    !ALLOWED_VEHICLE_ISSUE_TYPES.has(vehicleIssueType)
  ) {
    return invalid("vehicle_issue_type contains an unsupported value.");
  }

  const continuousSessionId = value.continuous_session_id ?? null;
  const continuousSequence = value.continuous_sequence ?? null;
  if (
    continuousSessionId !== null &&
    (typeof continuousSessionId !== "string" ||
      !UUID_PATTERN.test(continuousSessionId))
  ) {
    return invalid("continuous_session_id must be a valid UUID or null.");
  }
  if (
    continuousSequence !== null &&
    (!Number.isSafeInteger(continuousSequence) || continuousSequence < 1)
  ) {
    return invalid("continuous_sequence must be a positive integer or null.");
  }
  if ((continuousSessionId === null) !== (continuousSequence === null)) {
    return invalid(
      "continuous_session_id and continuous_sequence must be provided together."
    );
  }

  if (rapidReportKind === null) {
    if (
      sidewalkLipHeight !== null ||
      vehicleIssueType !== null ||
      continuousSessionId !== null
    ) {
      return invalid(
        "Continuous-report details require rapid_report_kind."
      );
    }
  } else {
    if (submissionMode !== "quick") {
      return invalid("Continuous rapid reports must use quick submission mode.");
    }
    if (continuousSessionId === null) {
      return invalid(
        "Continuous rapid reports require a session ID and sequence."
      );
    }
    const expectedCategory = RAPID_REPORT_CATEGORIES.get(rapidReportKind);
    if (!value.categories.includes(expectedCategory)) {
      return invalid(
        "rapid_report_kind does not match the report category."
      );
    }
  }

  if (sidewalkLipHeight !== null && rapidReportKind !== "sidewalk") {
    return invalid(
      "sidewalk_lip_height is only valid for sidewalk rapid reports."
    );
  }
  if (vehicleIssueType !== null && rapidReportKind !== "vehicle") {
    return invalid(
      "vehicle_issue_type is only valid for vehicle rapid reports."
    );
  }

  const officialEmailAuthorized = value.official_email_authorized ?? false;
  if (typeof officialEmailAuthorized !== "boolean") {
    return invalid("official_email_authorized must be true or false.");
  }
  const officialEmailDestinationAuthorized =
    value.official_email_destination_authorized ?? null;
  if (
    officialEmailDestinationAuthorized !== null &&
    !ALLOWED_OFFICIAL_EMAIL_DESTINATIONS.has(
      officialEmailDestinationAuthorized
    )
  ) {
    return invalid(
      "official_email_destination_authorized must be test, official, or null."
    );
  }
  if (!officialEmailAuthorized && officialEmailDestinationAuthorized !== null) {
    return invalid(
      "official_email_destination_authorized requires official_email_authorized."
    );
  }

  const photoLatitude = value.photo_latitude ?? null;
  const photoLongitude = value.photo_longitude ?? null;
  if ((photoLatitude === null) !== (photoLongitude === null)) {
    return invalid(
      "photo_latitude and photo_longitude must be provided together."
    );
  }
  const hasPhotoCoordinates =
    photoLatitude !== null && photoLongitude !== null;
  if (
    hasPhotoCoordinates &&
    (!Number.isFinite(photoLatitude) ||
      photoLatitude < -90 ||
      photoLatitude > 90 ||
      !Number.isFinite(photoLongitude) ||
      photoLongitude < -180 ||
      photoLongitude > 180)
  ) {
    return invalid("Photo coordinates are outside their valid range.");
  }

  const locationSource = value.location_source ?? (
    hasCoordinates ? "legacy" : "none"
  );
  if (!ALLOWED_LOCATION_SOURCES.has(locationSource)) {
    return invalid("location_source contains an unsupported value.");
  }
  const locationOverridden = value.location_overridden ?? false;
  if (typeof locationOverridden !== "boolean") {
    return invalid("location_overridden must be true or false.");
  }
  if (locationSource === "none" && hasCoordinates) {
    return invalid("location_source cannot be none when coordinates exist.");
  }
  if (locationSource !== "none" && !hasCoordinates) {
    return invalid("The selected location_source requires report coordinates.");
  }
  if (locationSource === "photo_exif") {
    if (!hasPhotoCoordinates) {
      return invalid("photo_exif requires photo coordinates.");
    }
    if (locationOverridden) {
      return invalid("photo_exif coordinates cannot be marked as overridden.");
    }
    if (
      !approximatelyEqual(photoLatitude, value.latitude) ||
      !approximatelyEqual(photoLongitude, value.longitude)
    ) {
      return invalid(
        "photo_exif coordinates must match the final report location."
      );
    }
  }
  if (
    locationOverridden &&
    locationSource !== "device_gps" &&
    !MANUAL_LOCATION_SOURCES.has(locationSource)
  ) {
    return invalid(
      "location_overridden requires device GPS or a manual location source."
    );
  }
  if (
    locationOverridden &&
    locationSource === "device_gps" &&
    !hasPhotoCoordinates
  ) {
    return invalid(
      "A device GPS override requires preserved photo coordinates."
    );
  }
  if (
    rapidReportKind !== null &&
    (locationSource === "legacy" || locationSource === "none")
  ) {
    return invalid(
      "Continuous rapid reports must record their location source."
    );
  }

  return {
    ok: true,
    report: {
      client_report_id: value.client_report_id,
      observed_at: value.observed_at,
      categories: value.categories,
      severity: value.severity,
      police_response: value.police_response,
      details: value.details,
      latitude: hasCoordinates ? value.latitude : null,
      longitude: hasCoordinates ? value.longitude : null,
      location: hasCoordinates ? value.location : null,
      app_version: value.app_version,
      assessment_mode: assessmentMode,
      checklist_responses: checklistResponses,
      reported_party_type: reportedPartyType,
      vehicle_involved: vehicleInvolved,
      vehicle_details: vehicleDetails,
      police_observations: policeObservations,
      police_complaint_details: policeComplaintDetails,
      submission_mode: submissionMode,
      quick_report_type: quickReportType,
      quick_report_types: quickReportTypes,
      nearest_intersection: nearestIntersection,
      rapid_report_kind: rapidReportKind,
      sidewalk_lip_height: sidewalkLipHeight,
      vehicle_issue_type: vehicleIssueType,
      official_email_authorized: officialEmailAuthorized,
      official_email_destination_authorized:
        officialEmailDestinationAuthorized,
      continuous_session_id: continuousSessionId,
      continuous_sequence: continuousSequence,
      location_source: locationSource,
      photo_latitude: hasPhotoCoordinates ? photoLatitude : null,
      photo_longitude: hasPhotoCoordinates ? photoLongitude : null,
      location_overridden: locationOverridden
    }
  };
}

function validateNearestIntersection(value) {
  if (value === null) {
    return { ok: true };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("nearest_intersection must be a JSON object or null.");
  }
  if (
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > 200 ||
    !Number.isFinite(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !Number.isFinite(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180 ||
    !Number.isFinite(value.distance_meters) ||
    value.distance_meters < 0 ||
    value.distance_meters > 2000 ||
    typeof value.major !== "boolean"
  ) {
    return invalid("nearest_intersection contains invalid values.");
  }
  return { ok: true };
}

function validateVehicleDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("vehicle_details must be a JSON object.");
  }
  const allowedKeys = new Set([
    ...VEHICLE_FIELD_LIMITS.keys(),
    "emergency_lights",
    "siren"
  ]);
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!allowedKeys.has(key)) {
      return invalid("vehicle_details contains an unsupported field.");
    }
    if (key === "emergency_lights" || key === "siren") {
      if (!ALLOWED_STATUS_VALUES.has(fieldValue)) {
        return invalid(`${key} contains an unsupported value.`);
      }
      continue;
    }
    const limit = VEHICLE_FIELD_LIMITS.get(key);
    if (
      typeof fieldValue !== "string" ||
      fieldValue.length > limit
    ) {
      return invalid(
        `vehicle_details.${key} must be text no longer than ${limit} characters.`
      );
    }
  }
  return { ok: true };
}

function isChecklistQuestionId(value) {
  const match = /^([a-z]+)_([0-9]{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const limit = CHECKLIST_ID_LIMITS.get(match[1]);
  const number = Number(match[2]);
  return Number.isInteger(limit) && number >= 1 && number <= limit;
}

function approximatelyEqual(value, expected) {
  return Number.isFinite(value) && Math.abs(value - expected) < 0.000001;
}

function invalid(error) {
  return { ok: false, error };
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function versionFromUserAgent(value) {
  const match = /ColumbiaWalks(?:-Android)?\/([0-9A-Za-z.+_-]{1,32})/i.exec(
    String(value || "")
  );
  return match ? match[1] : "";
}

function isLegacyVersion(value) {
  if (!value) return true;
  const match = /(?:^|[^0-9])([0-9]+)\.([0-9]+)/.exec(value);
  if (!match) return true;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major < 3 || (major === 3 && minor < 13);
}

function safeLegacyVersion(value) {
  const cleaned = String(value || "unknown").replace(/[^0-9A-Za-z.+_-]/g, "_");
  return cleaned.slice(0, 25) || "unknown";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return value === undefined || value === null
    ? []
    : [value];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall back to the legacy delimiter formats below.
    }
  }
  return trimmed.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid legacy optional JSON becomes an empty object.
    }
  }
  return {};
}

function normalizeNullableObject(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = normalizeObject(value);
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLegacySeverity(value) {
  const slug = toSlug(value);
  if (slug.startsWith("high") || slug === "urgent" || slug === "severe") {
    return "high";
  }
  if (slug.startsWith("low") || slug === "minor") return "low";
  return "medium";
}

function normalizeLegacyPoliceResponse(value) {
  const slug = toSlug(value);
  if (slug.startsWith("good") || slug === "positive") return "good";
  if (slug.startsWith("poor") || slug === "negative") return "poor";
  if (slug.startsWith("mixed")) return "mixed";
  return "not_involved";
}
