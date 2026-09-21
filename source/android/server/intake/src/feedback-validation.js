const ALLOWED_FEEDBACK_CATEGORIES = new Set([
  "app_feedback",
  "feature_request",
  "bug_report",
  "other"
]);

const ALLOWED_SUBMISSION_SOURCES = new Set([
  "android",
  "ios",
  "web",
  "wordpress"
]);

const CONTACT_FIELD_LIMITS = new Map([
  ["contact_name", 200],
  ["contact_phone", 64],
  ["contact_email", 254],
  ["contact_street_address", 500],
  ["contact_notes", 1500]
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("The feedback submission must be a JSON object.");
  }

  if (!UUID_PATTERN.test(value.feedback_id || "")) {
    return invalid("feedback_id must be a valid UUID.");
  }

  if (!ALLOWED_FEEDBACK_CATEGORIES.has(value.feedback_category)) {
    return invalid("feedback_category contains an unsupported value.");
  }

  if (typeof value.feedback_text !== "string") {
    return invalid("feedback_text must be text.");
  }
  const feedbackText = value.feedback_text.trim();
  if (feedbackText.length < 1 || feedbackText.length > 5000) {
    return invalid("feedback_text must contain 1–5,000 characters.");
  }

  if (
    typeof value.app_version !== "string" ||
    !/^[0-9A-Za-z.+_-]{1,32}$/.test(value.app_version)
  ) {
    return invalid("app_version is invalid.");
  }

  if (!ALLOWED_SUBMISSION_SOURCES.has(value.submission_source)) {
    return invalid("submission_source contains an unsupported value.");
  }

  if (typeof value.contact_information_offered !== "boolean") {
    return invalid("contact_information_offered must be true or false.");
  }
  if (typeof value.consent_to_contact !== "boolean") {
    return invalid("consent_to_contact must be true or false.");
  }

  const contact = {};
  for (const [field, limit] of CONTACT_FIELD_LIMITS) {
    const fieldValue = value[field] ?? "";
    if (typeof fieldValue !== "string" || fieldValue.length > limit) {
      return invalid(`${field} must be text no longer than ${limit} characters.`);
    }
    contact[field] = fieldValue.trim();
  }

  if (
    contact.contact_email &&
    !EMAIL_PATTERN.test(contact.contact_email)
  ) {
    return invalid("contact_email is not a valid email address.");
  }

  const contactInformationProvided = Object.values(contact).some(Boolean);
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
    feedback: {
      feedback_id: value.feedback_id,
      feedback_category: value.feedback_category,
      feedback_text: feedbackText,
      app_version: value.app_version,
      submission_source: value.submission_source,
      contact_information_offered: value.contact_information_offered,
      contact_information_provided: contactInformationProvided,
      ...contact,
      consent_to_contact: value.consent_to_contact
    }
  };
}

function invalid(error) {
  return { ok: false, error };
}
