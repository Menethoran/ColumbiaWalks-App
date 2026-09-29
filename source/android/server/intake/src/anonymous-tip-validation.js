// This first intake is permanently test-only. It has no official delivery mode.
export const TIP_FIELDS = Object.freeze({
  subject: 128,
  observed_time: 500,
  location: 500,
  direction: 500,
  license_plate: 500,
  plate_state: 500,
  vehicle_description: 500,
  observation: 5000,
  evidence_notes: 2000
});
const REQUIRED = new Set(["subject", "observed_time", "location", "observation"]);
const INPUT_KEYS = new Set([
  "submission_id", "app_version", "past_or_inactive_confirmed",
  "test_only_acknowledged", "fields"
]);
export function plainTipText(value) {
  return value.replace(/\[TEST\]/gi, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, " ")
    .replace(/\s+/gu, " ").trim();
}
export function markTestText(value) {
  const text = plainTipText(value) || "Not provided";
  return `[TEST] ${text.split(" ").join(" [TEST] ")} [TEST]`;
}
export function validateAnonymousTip(input) {
  const fail = (error) => ({ ok: false, error: `[TEST] ${error}` });
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !INPUT_KEYS.has(key))) {
    return fail("Only the anonymous test-tip fields are accepted.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submission_id)) {
    return fail("A random submission ID is required.");
  }
  if (typeof input.app_version !== "string" ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.0$/.test(input.app_version) || input.app_version.length > 32) {
    return fail("This endpoint accepts internal .0 builds only.");
  }
  if (input.past_or_inactive_confirmed !== true || input.test_only_acknowledged !== true) {
    return fail("Confirm this is an inactive matter and a private test only.");
  }
  const fields = input.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields) ||
      Object.keys(fields).some((key) => !Object.hasOwn(TIP_FIELDS, key))) {
    return fail("Unexpected tip fields, contact details, or attachments are not accepted.");
  }
  const marked = {};
  for (const [key, limit] of Object.entries(TIP_FIELDS)) {
    const value = fields[key] ?? "";
    if (typeof value !== "string" || value.length > limit * 8 + 64) {
      return fail(`Invalid or oversized ${key} field.`);
    }
    const clean = plainTipText(value);
    if (REQUIRED.has(key) && !clean) return fail(`${key} is required.`);
    if (clean.length > limit) return fail(`${key} is too long.`);
    marked[key] = markTestText(clean);
  }
  return { ok: true, tip: {
    submission_id: input.submission_id.toLowerCase(),
    app_version: input.app_version,
    test_mode: true,
    status: "test_received",
    destination: "private_columbiawalks_test_intake",
    police_contacted: false,
    notice: markTestText("INTERNAL TEST ONLY. Columbia Borough Police Department was not contacted."),
    past_or_inactive_confirmed: true,
    test_only_acknowledged: true,
    ...marked
  } };
}
