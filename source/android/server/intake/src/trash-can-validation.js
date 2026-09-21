const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_KINDS = new Set(["public_comment", "private_complaint"]);
const ALLOWED_ASSET_SCOPES = new Set([
  "public",
  "private_property",
  "unknown"
]);
const ALLOWED_SOURCES = new Set(["android", "ios", "web", "unknown"]);

export const TRASH_CAN_CATEGORIES = Object.freeze({
  public_comment: Object.freeze([
    "clean_well_maintained",
    "needs_cleaning",
    "full_or_overflowing",
    "damaged",
    "hard_to_access",
    "poor_location",
    "request_new_can",
    "other"
  ]),
  private_complaint: Object.freeze([
    "full_or_overflowing",
    "damaged",
    "missing",
    "odor_or_pests",
    "illegal_dumping",
    "unsafe_or_obstructing",
    "missed_service",
    "other"
  ])
});

const CATEGORY_SETS = Object.freeze({
  public_comment: new Set(TRASH_CAN_CATEGORIES.public_comment),
  private_complaint: new Set(TRASH_CAN_CATEGORIES.private_complaint)
});

const ALLOWED_FIELDS = new Set([
  "submission_id",
  "kind",
  "asset_scope",
  "public_trash_can_id",
  "categories",
  "comment",
  "latitude",
  "longitude",
  "address",
  "app_version",
  "submission_source"
]);

const IDENTIFYING_FIELD_PATTERN =
  /^(?:contact|email|phone|name|device|advertising|user|account|ip)(?:_|$)/i;

export function validateTrashCanSubmission(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The trash-can submission must be a JSON object.");
  }

  const unsupported = Object.keys(value).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unsupported.length > 0) {
    const identifiesReporter = unsupported.some((field) =>
      IDENTIFYING_FIELD_PATTERN.test(field)
    );
    return invalid(identifiesReporter
      ? "Anonymous trash-can submissions do not accept contact, account, or device identifiers."
      : `Unsupported trash-can submission field: ${unsupported[0]}.`);
  }

  if (!UUID_PATTERN.test(value.submission_id || "")) {
    return invalid("submission_id must be a valid UUID.");
  }
  if (!ALLOWED_KINDS.has(value.kind)) {
    return invalid("kind must be public_comment or private_complaint.");
  }

  const assetScope = value.asset_scope ?? "public";
  if (!ALLOWED_ASSET_SCOPES.has(assetScope)) {
    return invalid("asset_scope contains an unsupported value.");
  }
  if (value.kind === "public_comment" && assetScope !== "public") {
    return invalid("Public comments require asset_scope public.");
  }

  const publicTrashCanId = normalizeOptionalString(value.public_trash_can_id);
  if (publicTrashCanId === null) {
    return invalid("public_trash_can_id must be text when provided.");
  }
  if (publicTrashCanId && !UUID_PATTERN.test(publicTrashCanId)) {
    return invalid("public_trash_can_id must be a valid UUID when provided.");
  }
  if (publicTrashCanId && assetScope !== "public") {
    return invalid("public_trash_can_id can only be used with asset_scope public.");
  }

  if (!Array.isArray(value.categories)) {
    return invalid("categories must be a list.");
  }
  const categories = [...new Set(value.categories)];
  const categorySet = CATEGORY_SETS[value.kind];
  if (
    categories.length < 1 ||
    categories.length > 3 ||
    categories.some((category) =>
      typeof category !== "string" || !categorySet.has(category)
    )
  ) {
    return invalid(`Select one to three supported ${value.kind} categories.`);
  }

  if (typeof value.comment !== "string") {
    return invalid("comment is required.");
  }
  const comment = value.comment.trim();
  if (comment.length < 3 || comment.length > 2000) {
    return invalid("comment must contain 3 to 2000 characters.");
  }

  const addressResult = normalizeLimitedText(value.address, 500, "address");
  if (!addressResult.ok) return addressResult;

  const hasLatitude = value.latitude !== undefined && value.latitude !== null;
  const hasLongitude = value.longitude !== undefined && value.longitude !== null;
  if (hasLatitude !== hasLongitude) {
    return invalid("latitude and longitude must be provided together.");
  }
  let latitude = null;
  let longitude = null;
  if (hasLatitude) {
    if (
      typeof value.latitude !== "number" ||
      !Number.isFinite(value.latitude) ||
      value.latitude < -90 ||
      value.latitude > 90
    ) {
      return invalid("latitude must be a number from -90 to 90.");
    }
    if (
      typeof value.longitude !== "number" ||
      !Number.isFinite(value.longitude) ||
      value.longitude < -180 ||
      value.longitude > 180
    ) {
      return invalid("longitude must be a number from -180 to 180.");
    }
    latitude = value.latitude;
    longitude = value.longitude;
  }
  if (!publicTrashCanId && !addressResult.value && !hasLatitude) {
    return invalid(
      "Identify the trash can with public_trash_can_id, an address, or coordinates."
    );
  }

  const appVersion = value.app_version ?? "unknown";
  if (
    typeof appVersion !== "string" ||
    !/^[0-9A-Za-z.+_-]{1,32}$/.test(appVersion)
  ) {
    return invalid("app_version is invalid.");
  }
  const submissionSource = value.submission_source ?? "unknown";
  if (!ALLOWED_SOURCES.has(submissionSource)) {
    return invalid("submission_source contains an unsupported value.");
  }

  return {
    ok: true,
    submission: {
      submission_id: value.submission_id.toLowerCase(),
      kind: value.kind,
      asset_scope: assetScope,
      public_trash_can_id: publicTrashCanId
        ? publicTrashCanId.toLowerCase()
        : null,
      categories,
      comment,
      latitude,
      longitude,
      address: addressResult.value,
      app_version: appVersion,
      submission_source: submissionSource
    }
  };
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  return value.trim();
}

function normalizeLimitedText(value, limit, field) {
  const normalized = normalizeOptionalString(value);
  if (normalized === null || normalized.length > limit) {
    return invalid(`${field} must be text no longer than ${limit} characters.`);
  }
  return { ok: true, value: normalized };
}

function invalid(error) {
  return { ok: false, error };
}
