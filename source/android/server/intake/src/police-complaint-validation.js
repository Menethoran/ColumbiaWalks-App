const ALLOWED_CATEGORIES = new Set([
  "helpful_or_supportive",
  "professional_or_respectful",
  "de_escalation",
  "community_engagement",
  "timely_response",
  "made_people_safer",
  "went_out_of_way",
  "other_positive",
  "conduct_or_discourtesy",
  "harassment_or_intimidation",
  "unlawful_stop_search_seizure_or_arrest",
  "excessive_force",
  "discrimination_or_bias",
  "failure_to_act_or_take_report",
  "unsafe_driving_or_traffic_conduct",
  "retaliation",
  "corruption_or_other_misconduct",
  "poor_communication",
  "made_people_less_safe",
  "slow_or_no_response",
  "other_negative",
  "routine_observation",
  "traffic_enforcement",
  "response_to_call",
  "community_presence",
  "police_driving",
  "mixed_experience",
  "other_observation",
  "other"
]);

const ALLOWED_SOURCES = new Set(["android", "web", "wordpress"]);
const ALLOWED_SENTIMENTS = new Set([
  "positive",
  "negative",
  "mixed_neutral",
  "not_labeled"
]);
const ALLOWED_PERSPECTIVES = new Set([
  "directly_involved",
  "calling_for_someone",
  "bystander"
]);
const ALLOWED_CALL_CONTEXTS = new Set([
  "called_by_reporter",
  "called_by_someone_else",
  "police_initiated",
  "already_present",
  "unknown"
]);
const ALLOWED_ENCOUNTER_TYPES = new Set([
  "response_to_call",
  "traffic_stop",
  "pedestrian_stop",
  "community_presence",
  "welfare_check",
  "event_or_crowd",
  "police_driving",
  "other",
  "unknown"
]);
const ALLOWED_PRESENCE_MODES = new Set([
  "on_foot",
  "cruiser",
  "bicycle",
  "motorcycle",
  "other",
  "unknown"
]);
const ALLOWED_SAFETY_CHANGES = new Set([
  "much_safer",
  "somewhat_safer",
  "no_change",
  "somewhat_less_safe",
  "much_less_safe",
  "not_sure"
]);
const ALLOWED_TIMELINESS = new Set([
  "much_too_slow",
  "somewhat_slow",
  "about_right",
  "fast",
  "not_applicable",
  "unknown"
]);
const ALLOWED_WENT_OUT_OF_WAY = new Set([
  "yes",
  "no",
  "not_sure",
  "not_applicable"
]);
const RATING_FIELDS = [
  "safety_before_rating",
  "safety_during_rating",
  "safety_after_rating",
  "respect_rating",
  "communication_rating",
  "helpfulness_rating",
  "professionalism_rating",
  "fairness_rating",
  "outcome_rating"
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEXT_LIMITS = new Map([
  ["agency", 200],
  ["officer_name", 200],
  ["badge_number", 64],
  ["unit_number", 64],
  ["officer_description", 1000],
  ["incident_at", 100],
  ["location_description", 1000],
  ["complaint_text", 10000],
  ["witnesses_or_evidence", 3000],
  ["contact_name", 200],
  ["contact_phone", 64],
  ["contact_email", 254],
  ["contact_street_address", 500],
  ["contact_notes", 1500]
]);

export function validatePoliceComplaint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The police interaction must be a JSON object.");
  }
  if (!UUID_PATTERN.test(value.complaint_id || "")) {
    return invalid("complaint_id must be a valid UUID.");
  }

  const categoryValue = Array.isArray(value.interaction_categories)
    ? value.interaction_categories
    : value.complaint_categories;
  if (!Array.isArray(categoryValue)) {
    return invalid("interaction_categories must be a list.");
  }
  const categories = [...new Set(categoryValue)];
  if (
    categories.length < 1 ||
    categories.length > ALLOWED_CATEGORIES.size ||
    categories.some((category) => !ALLOWED_CATEGORIES.has(category))
  ) {
    return invalid("Select at least one supported interaction topic.");
  }

  const interactionSentiment = value.interaction_sentiment || "negative";
  const reporterPerspective = value.reporter_perspective || "directly_involved";
  const callContext = value.call_context || "unknown";
  const encounterType = value.encounter_type || "unknown";
  const safetyChange = value.safety_change || "not_sure";
  const responseTimeliness = value.response_timeliness || "unknown";
  const wentOutOfWay = value.went_out_of_way || "not_applicable";
  const enumChecks = [
    [ALLOWED_SENTIMENTS, interactionSentiment, "interaction_sentiment"],
    [ALLOWED_PERSPECTIVES, reporterPerspective, "reporter_perspective"],
    [ALLOWED_CALL_CONTEXTS, callContext, "call_context"],
    [ALLOWED_ENCOUNTER_TYPES, encounterType, "encounter_type"],
    [ALLOWED_SAFETY_CHANGES, safetyChange, "safety_change"],
    [ALLOWED_TIMELINESS, responseTimeliness, "response_timeliness"],
    [ALLOWED_WENT_OUT_OF_WAY, wentOutOfWay, "went_out_of_way"]
  ];
  for (const [allowed, fieldValue, field] of enumChecks) {
    if (!allowed.has(fieldValue)) {
      return invalid(`${field} contains an unsupported value.`);
    }
  }

  const presenceValue = value.presence_modes ?? ["unknown"];
  if (!Array.isArray(presenceValue)) {
    return invalid("presence_modes must be a list.");
  }
  const presenceModes = [...new Set(presenceValue)];
  if (
    presenceModes.length < 1 ||
    presenceModes.length > ALLOWED_PRESENCE_MODES.size ||
    presenceModes.some((mode) => !ALLOWED_PRESENCE_MODES.has(mode))
  ) {
    return invalid("Select at least one supported police presence type.");
  }

  const ratings = {};
  for (const field of RATING_FIELDS) {
    const rating = value[field];
    if (rating === undefined || rating === null || rating === "") {
      ratings[field] = null;
      continue;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return invalid(`${field} must be a whole number from 1 to 10.`);
    }
    ratings[field] = rating;
  }

  if (!ALLOWED_SOURCES.has(value.submission_source)) {
    return invalid("submission_source contains an unsupported value.");
  }
  if (
    typeof value.app_version !== "string" ||
    !/^[0-9A-Za-z.+_-]{1,32}$/.test(value.app_version)
  ) {
    return invalid("app_version is invalid.");
  }
  if (value.good_faith_confirmation !== true) {
    return invalid("The good-faith confirmation is required.");
  }
  if (typeof value.contact_information_offered !== "boolean") {
    return invalid("contact_information_offered must be true or false.");
  }
  if (typeof value.consent_to_contact !== "boolean") {
    return invalid("consent_to_contact must be true or false.");
  }

  const normalized = {};
  for (const [field, limit] of TEXT_LIMITS) {
    const fieldValue = value[field] ?? "";
    if (typeof fieldValue !== "string" || fieldValue.length > limit) {
      return invalid(`${field} must be text no longer than ${limit} characters.`);
    }
    normalized[field] = fieldValue.trim();
  }

  if (
    normalized.complaint_text.length > 0 &&
    normalized.complaint_text.length < 20
  ) {
    return invalid(
      "If provided, complaint_text must contain at least 20 characters."
    );
  }
  if (!normalized.agency) {
    normalized.agency = "Columbia Borough Police Department";
  }
  if (normalized.contact_email && !EMAIL_PATTERN.test(normalized.contact_email)) {
    return invalid("contact_email is not a valid email address.");
  }

  const contactFields = [
    normalized.contact_name,
    normalized.contact_phone,
    normalized.contact_email,
    normalized.contact_street_address,
    normalized.contact_notes
  ];
  const contactInformationProvided = contactFields.some(Boolean);
  if (
    !value.contact_information_offered &&
    (contactInformationProvided || value.consent_to_contact)
  ) {
    return invalid(
      "Contact details and consent require contact_information_offered to be true."
    );
  }

  return {
    ok: true,
    complaint: {
      complaint_id: value.complaint_id,
      interaction_sentiment: interactionSentiment,
      reporter_perspective: reporterPerspective,
      interaction_categories: categories,
      complaint_categories: categories,
      call_context: callContext,
      encounter_type: encounterType,
      presence_modes: presenceModes,
      safety_change: safetyChange,
      response_timeliness: responseTimeliness,
      went_out_of_way: wentOutOfWay,
      ...ratings,
      ...normalized,
      app_version: value.app_version,
      submission_source: value.submission_source,
      contact_information_offered: value.contact_information_offered,
      contact_information_provided: contactInformationProvided,
      consent_to_contact: value.consent_to_contact,
      good_faith_confirmation: true
    }
  };
}

function invalid(error) {
  return { ok: false, error };
}

