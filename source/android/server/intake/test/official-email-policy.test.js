import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeOfficialEmailConfig,
  officialEmailCandidates
} from "../src/official-email-policy.js";

function config(mode = "automatic", overrides = {}) {
  return normalizeOfficialEmailConfig({
    mode,
    destinationMode: "official",
    policeChiefEmail: "chief@example.gov",
    mayorEmail: "mayor@example.gov",
    codesEmail: "codes@example.gov",
    radiusKm: 5,
    ...overrides
  });
}

function report(overrides = {}) {
  return {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    official_email_authorized: true,
    official_email_destination_authorized: "official",
    latitude: 40.0337,
    longitude: -76.5044,
    submission_mode: "quick",
    quick_report_types: [],
    rapid_report_kind: null,
    vehicle_issue_type: null,
    ...overrides
  };
}

test("routes only the exact crosswalk types to police chief and mayor", () => {
  const quick = officialEmailCandidates(
    report({ quick_report_types: ["crosswalk_encroachment"] }),
    "photo-id",
    config()
  );
  assert.equal(quick.length, 1);
  assert.equal(quick[0].ruleId, "police_crosswalk_v1");
  assert.deepEqual(quick[0].to, ["chief@example.gov"]);
  assert.deepEqual(quick[0].cc, ["mayor@example.gov"]);
  assert.equal(quick[0].status, "queued");

  const continuous = officialEmailCandidates(
    report({
      rapid_report_kind: "vehicle",
      vehicle_issue_type: "crosswalk_incursion"
    }),
    "photo-id",
    config()
  );
  assert.equal(continuous.length, 1);
  assert.equal(continuous[0].ruleId, "police_crosswalk_v1");
});

test("routes only missing_sidewalk to Codes", () => {
  const candidates = officialEmailCandidates(
    report({ quick_report_types: ["missing_sidewalk"] }),
    "photo-id",
    config()
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].ruleId, "codes_missing_sidewalk_v1");
  assert.deepEqual(candidates[0].to, ["codes@example.gov"]);
  assert.deepEqual(candidates[0].cc, []);

  const rapidSidewalk = officialEmailCandidates(
    report({
      rapid_report_kind: "sidewalk",
      quick_report_types: ["missing_sidewalk"]
    }),
    "photo-id",
    config()
  );
  assert.equal(rapidSidewalk.length, 1);
  assert.equal(rapidSidewalk[0].ruleId, "codes_missing_sidewalk_v1");
});

test("does not route broad or future issue categories", () => {
  for (const value of [
    "speeding",
    "illegal_u_turn",
    "sidewalk_issue",
    "crosswalk_issue",
    "driver_issue",
    "trip_hazard"
  ]) {
    assert.deepEqual(
      officialEmailCandidates(
        report({ quick_report_types: [value], details: "missing sidewalk" }),
        "photo-id",
        config()
      ),
      []
    );
  }
  assert.deepEqual(
    officialEmailCandidates(
      report({ rapid_report_kind: "vehicle", vehicle_issue_type: "aggressive_driving" }),
      "photo-id",
      config()
    ),
    []
  );
});

test("mixed, duplicated, and non-normalized quick selections fail closed", () => {
  for (const quickReportTypes of [
    ["crosswalk_encroachment", "speeding"],
    ["crosswalk_encroachment", "missing_sidewalk"],
    ["missing_sidewalk", "trip_hazard"],
    ["crosswalk_encroachment", "crosswalk_encroachment"],
    ["missing_sidewalk", "missing_sidewalk"],
    [" crosswalk_encroachment"],
    ["MISSING_SIDEWALK"]
  ]) {
    assert.deepEqual(
      officialEmailCandidates(
        report({ quick_report_types: quickReportTypes }),
        "photo-id",
        config()
      ),
      [],
      `must not route ${JSON.stringify(quickReportTypes)}`
    );
  }
});

test("rapid vehicle crosswalk rejects stray quick-report keys", () => {
  assert.deepEqual(
    officialEmailCandidates(
      report({
        rapid_report_kind: "vehicle",
        vehicle_issue_type: "crosswalk_incursion",
        quick_report_types: ["crosswalk_encroachment"]
      }),
      "photo-id",
      config()
    ),
    []
  );
});

test("does not activate a route when a full or PoS payload smuggles a quick type", () => {
  for (const submissionMode of ["full", "pos"]) {
    assert.deepEqual(
      officialEmailCandidates(
        report({
          submission_mode: submissionMode,
          quick_report_types: ["crosswalk_encroachment"]
        }),
        "photo-id",
        config()
      ),
      []
    );
    assert.deepEqual(
      officialEmailCandidates(
        report({
          submission_mode: submissionMode,
          quick_report_types: ["missing_sidewalk"]
        }),
        "photo-id",
        config()
      ),
      []
    );
  }
});

test("rapid report hierarchies cannot smuggle the other official route", () => {
  assert.deepEqual(
    officialEmailCandidates(
      report({
        rapid_report_kind: "vehicle",
        vehicle_issue_type: "speeding",
        quick_report_types: ["missing_sidewalk"]
      }),
      "photo-id",
      config()
    ),
    []
  );
  assert.deepEqual(
    officialEmailCandidates(
      report({
        rapid_report_kind: "sidewalk",
        quick_report_types: ["crosswalk_encroachment"]
      }),
      "photo-id",
      config()
    ),
    []
  );
});

test("requires reporter authorization, a photo, and Columbia-area coordinates", () => {
  assert.deepEqual(
    officialEmailCandidates(
      report({
        official_email_authorized: false,
        quick_report_types: ["crosswalk_encroachment"]
      }),
      "photo-id",
      config()
    ),
    []
  );

  const noPhoto = officialEmailCandidates(
    report({ quick_report_types: ["crosswalk_encroachment"] }),
    null,
    config()
  );
  assert.equal(noPhoto[0].status, "blocked");
  assert.equal(noPhoto[0].blockedReason, "missing_photo");

  const outside = officialEmailCandidates(
    report({
      quick_report_types: ["missing_sidewalk"],
      latitude: 41.0,
      longitude: -76.5
    }),
    "photo-id",
    config()
  );
  assert.equal(outside[0].status, "blocked");
  assert.equal(outside[0].blockedReason, "outside_service_area");
});

test("review and disabled modes never queue automatic delivery", () => {
  const reviewed = officialEmailCandidates(
    report({ quick_report_types: ["missing_sidewalk"] }),
    "photo-id",
    config("review")
  );
  assert.equal(reviewed[0].status, "review");

  const disabled = officialEmailCandidates(
    report({
      quick_report_types: ["missing_sidewalk"],
      official_email_destination_authorized: "test"
    }),
    "photo-id",
    normalizeOfficialEmailConfig({ mode: "disabled" })
  );
  assert.equal(disabled[0].status, "disabled");
});

test("test destination intercepts both eligible rules without widening triggers", () => {
  const testConfig = normalizeOfficialEmailConfig({
    mode: "automatic",
    testRecipient: "field-test@example.invalid",
    policeChiefEmail: "must-not-appear@example.gov",
    mayorEmail: "must-not-appear-2@example.gov",
    codesEmail: "must-not-appear-3@example.gov"
  });
  assert.equal(testConfig.destinationMode, "test");
  for (const quickReportType of [
    "crosswalk_encroachment",
    "missing_sidewalk"
  ]) {
    const candidates = officialEmailCandidates(
      report({
        quick_report_types: [quickReportType],
        official_email_destination_authorized: "test"
      }),
      "photo-id",
      testConfig
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].destinationMode, "test");
    assert.deepEqual(candidates[0].to, ["field-test@example.invalid"]);
    assert.deepEqual(candidates[0].cc, []);
  }
  assert.deepEqual(
    officialEmailCandidates(
      report({
        quick_report_types: ["speeding"],
        official_email_destination_authorized: "test"
      }),
      "photo-id",
      testConfig
    ),
    []
  );
});

test("authorization is pinned to the configured destination mode", () => {
  assert.deepEqual(
    officialEmailCandidates(
      report({
        quick_report_types: ["missing_sidewalk"],
        official_email_destination_authorized: null
      }),
      "photo-id",
      config()
    ),
    []
  );
  assert.deepEqual(
    officialEmailCandidates(
      report({
        quick_report_types: ["missing_sidewalk"],
        official_email_destination_authorized: "test"
      }),
      "photo-id",
      config()
    ),
    []
  );
  assert.throws(
    () => normalizeOfficialEmailConfig({ mode: "automatic" }),
    /OFFICIAL_EMAIL_TEST_RECIPIENT/
  );
  assert.throws(
    () => normalizeOfficialEmailConfig({
      mode: "disabled",
      destinationMode: "unexpected"
    }),
    /DESTINATION_MODE must be test or official/
  );
});

test("sender is fixed to the ColumbiaWalks Gmail account", () => {
  assert.equal(normalizeOfficialEmailConfig({ mode: "disabled" }).radiusKm, 5);
  assert.throws(
    () => normalizeOfficialEmailConfig({
      mode: "automatic",
      sender: "attacker@example.com",
      policeChiefEmail: "chief@example.gov",
      mayorEmail: "mayor@example.gov",
      codesEmail: "codes@example.gov"
    }),
    /must be columbiawalks@gmail.com/
  );
  assert.throws(
    () => normalizeOfficialEmailConfig({ mode: "disabled", radiusKm: 4 }),
    /fixes the official-email service area at 5 km/
  );
  assert.throws(
    () => normalizeOfficialEmailConfig({
      mode: "disabled",
      centerLatitude: 40.04
    }),
    /server and mobile disclosures cannot diverge/
  );
});
