const PLATFORMS = new Set(["ios", "android"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_PATTERN = /\p{N}/u;
const LETTER_PATTERN = /\p{L}/u;

export function validateBetaTesterRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The beta tester request must be a JSON object.");
  }
  if (!UUID_PATTERN.test(value.request_id || "")) {
    return invalid("request_id must be a valid UUID.");
  }
  if (!PLATFORMS.has(value.platform)) {
    return invalid("Choose Apple / iOS or Google / Android.");
  }

  const accountName = cleanSingleLine(value.account_name);
  if (accountName.length < 2 || accountName.length > 200) {
    return invalid("Name must contain 2–200 characters.");
  }
  const accountEmail = cleanSingleLine(value.account_email).toLowerCase();
  if (accountEmail.length > 254 || !EMAIL_PATTERN.test(accountEmail)) {
    return invalid("Enter a valid account email address.");
  }

  const columbiaStreet = cleanSingleLine(value.columbia_street);
  if (columbiaStreet.length < 2 || columbiaStreet.length > 200) {
    return invalid("Enter a Columbia street name containing 2–200 characters.");
  }
  if (NUMBER_PATTERN.test(columbiaStreet)) {
    return invalid("Enter the street name only. House numbers are not allowed.");
  }
  if (!LETTER_PATTERN.test(columbiaStreet)) {
    return invalid("The Columbia street field must contain a street name.");
  }

  if (typeof value.comments !== "string" || value.comments.length > 2000) {
    return invalid("Comments must be no longer than 2,000 characters.");
  }
  if (value.privacy_consent !== true) {
    return invalid("Consent is required to submit a beta tester request.");
  }
  if (typeof value.website !== "string" || value.website.length > 0) {
    return invalid("The request could not be accepted.");
  }

  return {
    ok: true,
    request: {
      request_id: value.request_id,
      platform: value.platform,
      account_name: accountName,
      account_email: accountEmail,
      columbia_street: columbiaStreet,
      comments: value.comments.trim(),
      privacy_consent: true,
      submission_source: "website",
      status: "new"
    }
  };
}

function cleanSingleLine(value) {
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim()
    : "";
}

function invalid(error) {
  return { ok: false, error };
}

