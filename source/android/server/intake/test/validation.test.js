import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyReport, validateReport } from "../src/validation.js";

function validReport() {
  return {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    observed_at: "Jul 29, 2026 12:00 PM",
    categories: ["sidewalk_safety"],
    severity: "low",
    police_response: "not_involved",
    details: "Connectivity test",
    latitude: 40.0337,
    longitude: -76.5044,
    location: {
      type: "Point",
      coordinates: [-76.5044, 40.0337]
    },
    app_version: "0.4.0",
    assessment_mode: "walkability_assessment",
    checklist_responses: {
      walk_05: "needs_attention",
      cross_04: "ok"
    },
    reported_party_type: "unknown",
    vehicle_involved: false,
    vehicle_details: {},
    police_observations: [],
    police_complaint_details: "",
    submission_mode: "full",
    quick_report_type: null,
    quick_report_types: [],
    nearest_intersection: {
      label: "3rd Street & Locust Street",
      latitude: 40.0337,
      longitude: -76.5044,
      distance_meters: 12,
      major: true
    }
  };
}

function continuousReport(kind = "sidewalk") {
  const categories = {
    sidewalk: "sidewalk_safety",
    vehicle: "vehicle_safety",
    crosswalk: "crosswalk_safety",
    trip_hazard: "trip_hazards",
    lighting_or_visibility: "lighting_or_visibility",
    accessibility_ada: "accessibility_ada",
    school_route: "school_route_safety",
    police_response: "police_response",
    other: "not_included_elsewhere"
  };
  return {
    ...validReport(),
    app_version: "3.14.0",
    submission_mode: "quick",
    categories: [categories[kind]],
    rapid_report_kind: kind,
    sidewalk_lip_height: null,
    vehicle_issue_type: null,
    continuous_session_id: "e03e14d7-2f0b-4ec7-b48c-e1386ebd72ca",
    continuous_sequence: 1,
    location_source: "photo_exif",
    photo_latitude: 40.0337,
    photo_longitude: -76.5044,
    location_overridden: false
  };
}

test("accepts the Android report payload", () => {
  const result = validateReport(validReport());
  assert.equal(result.ok, true);
  assert.equal(result.report.client_report_id, validReport().client_report_id);
});

test("defaults new provenance fields for old Android clients", () => {
  const result = validateReport(validReport());
  assert.equal(result.ok, true, result.error);
  assert.equal(result.report.rapid_report_kind, null);
  assert.equal(result.report.sidewalk_lip_height, null);
  assert.equal(result.report.vehicle_issue_type, null);
  assert.equal(result.report.continuous_session_id, null);
  assert.equal(result.report.continuous_sequence, null);
  assert.equal(result.report.location_source, "legacy");
  assert.equal(result.report.photo_latitude, null);
  assert.equal(result.report.photo_longitude, null);
  assert.equal(result.report.location_overridden, false);
  assert.equal(result.report.official_email_authorized, false);
  assert.equal(result.report.official_email_destination_authorized, null);
});

test("accepts an explicit official-email authorization and missing-sidewalk type", () => {
  const report = validReport();
  report.app_version = "3.15.0";
  report.submission_mode = "quick";
  report.categories = ["sidewalk_safety"];
  report.quick_report_type = "missing_sidewalk";
  report.quick_report_types = ["missing_sidewalk"];
  report.official_email_authorized = true;
  report.official_email_destination_authorized = "test";
  const result = validateReport(report);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.report.official_email_authorized, true);
  assert.equal(result.report.official_email_destination_authorized, "test");
  assert.deepEqual(result.report.quick_report_types, ["missing_sidewalk"]);
});

test("rejects non-boolean official-email authorization", () => {
  const report = validReport();
  report.official_email_authorized = "true";
  const result = validateReport(report);
  assert.equal(result.ok, false);
  assert.equal(result.error, "official_email_authorized must be true or false.");
});

test("validates destination-specific official-email authorization", () => {
  for (const destination of ["test", "official"]) {
    const report = validReport();
    report.official_email_authorized = true;
    report.official_email_destination_authorized = destination;
    const result = validateReport(report);
    assert.equal(result.ok, true, result.error);
    assert.equal(
      result.report.official_email_destination_authorized,
      destination
    );
  }

  const unsupported = validReport();
  unsupported.official_email_authorized = true;
  unsupported.official_email_destination_authorized = "police";
  const unsupportedResult = validateReport(unsupported);
  assert.equal(unsupportedResult.ok, false);
  assert.match(
    unsupportedResult.error,
    /must be test, official, or null/
  );

  const contradictory = validReport();
  contradictory.official_email_authorized = false;
  contradictory.official_email_destination_authorized = "test";
  const contradictoryResult = validateReport(contradictory);
  assert.equal(contradictoryResult.ok, false);
  assert.match(
    contradictoryResult.error,
    /requires official_email_authorized/
  );
});

test("defaults unlocated old quick reports to a none location source", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.categories = [];
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  const result = validateReport(report);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.report.location_source, "none");
});

test("accepts a continuous sidewalk report with optional lip height", () => {
  const report = continuousReport("sidewalk");
  report.sidewalk_lip_height = "over_half_inch";
  const result = validateReport(report);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.report.rapid_report_kind, "sidewalk");
  assert.equal(result.report.sidewalk_lip_height, "over_half_inch");
  assert.equal(result.report.continuous_sequence, 1);
  assert.equal(result.report.location_source, "photo_exif");
});

test("accepts every Android sidewalk lip-height choice", () => {
  for (const lipHeight of [
    "quarter_inch_or_less",
    "over_quarter_inch",
    "over_half_inch",
    "over_one_inch",
    "over_two_inches"
  ]) {
    const report = continuousReport("sidewalk");
    report.sidewalk_lip_height = lipHeight;
    const result = validateReport(report);
    assert.equal(result.ok, true, `${lipHeight}: ${result.error}`);
  }
});

test("accepts every Android rapid hierarchy", () => {
  for (const kind of [
    "sidewalk",
    "vehicle",
    "crosswalk",
    "trip_hazard",
    "lighting_or_visibility",
    "accessibility_ada",
    "school_route",
    "police_response",
    "other"
  ]) {
    const result = validateReport(continuousReport(kind));
    assert.equal(result.ok, true, `${kind}: ${result.error}`);
  }
});

test("accepts vehicle rapid reports with or without an optional issue", () => {
  const unspecified = validateReport(continuousReport("vehicle"));
  assert.equal(unspecified.ok, true, unspecified.error);
  assert.equal(unspecified.report.vehicle_issue_type, null);

  const report = continuousReport("vehicle");
  report.vehicle_issue_type = "aggressive_driving";
  const specified = validateReport(report);
  assert.equal(specified.ok, true, specified.error);
  assert.equal(specified.report.vehicle_issue_type, "aggressive_driving");
});

test("accepts every Android vehicle issue choice", () => {
  for (const vehicleIssueType of [
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
  ]) {
    const report = continuousReport("vehicle");
    report.vehicle_issue_type = vehicleIssueType;
    const result = validateReport(report);
    assert.equal(result.ok, true, `${vehicleIssueType}: ${result.error}`);
  }
});

test("rejects unsupported or cross-hierarchy rapid details", () => {
  const badLip = continuousReport("sidewalk");
  badLip.sidewalk_lip_height = "three_inches_exactly";
  assert.equal(validateReport(badLip).ok, false);

  const vehicleLip = continuousReport("vehicle");
  vehicleLip.sidewalk_lip_height = "over_one_inch";
  assert.equal(validateReport(vehicleLip).ok, false);

  const sidewalkVehicleIssue = continuousReport("sidewalk");
  sidewalkVehicleIssue.vehicle_issue_type = "speeding";
  assert.equal(validateReport(sidewalkVehicleIssue).ok, false);

  const vehicleWithMissingSidewalk = continuousReport("vehicle");
  vehicleWithMissingSidewalk.quick_report_type = "missing_sidewalk";
  vehicleWithMissingSidewalk.quick_report_types = ["missing_sidewalk"];
  assert.equal(validateReport(vehicleWithMissingSidewalk).ok, false);

  const sidewalkWithCrosswalk = continuousReport("sidewalk");
  sidewalkWithCrosswalk.quick_report_type = "crosswalk_encroachment";
  sidewalkWithCrosswalk.quick_report_types = ["crosswalk_encroachment"];
  assert.equal(validateReport(sidewalkWithCrosswalk).ok, false);
});

test("allows missing-sidewalk only inside the rapid sidewalk hierarchy", () => {
  const report = continuousReport("sidewalk");
  report.quick_report_type = "missing_sidewalk";
  report.quick_report_types = ["missing_sidewalk"];
  const result = validateReport(report);
  assert.equal(result.ok, true, result.error);
});

test("requires valid paired continuous session metadata", () => {
  const missingSequence = continuousReport();
  missingSequence.continuous_sequence = null;
  assert.equal(validateReport(missingSequence).ok, false);

  const badSession = continuousReport();
  badSession.continuous_session_id = "not-a-uuid";
  assert.equal(validateReport(badSession).ok, false);

  const fractionalSequence = continuousReport();
  fractionalSequence.continuous_sequence = 1.5;
  assert.equal(validateReport(fractionalSequence).ok, false);
});

test("rejects a rapid hierarchy that does not match its category", () => {
  const report = continuousReport("sidewalk");
  report.categories = ["vehicle_safety"];
  const result = validateReport(report);
  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "rapid_report_kind does not match the report category."
  );
});

test("accepts manual and device overrides while preserving photo GPS", () => {
  const manual = continuousReport();
  manual.location_source = "manual_coordinates";
  manual.location_overridden = true;
  manual.latitude = 40.0338;
  manual.longitude = -76.5045;
  manual.location = {
    type: "Point",
    coordinates: [-76.5045, 40.0338]
  };
  const manualResult = validateReport(manual);
  assert.equal(manualResult.ok, true, manualResult.error);
  assert.equal(manualResult.report.photo_latitude, 40.0337);
  assert.equal(manualResult.report.latitude, 40.0338);

  const device = continuousReport();
  device.location_source = "device_gps";
  device.location_overridden = true;
  device.latitude = 40.0339;
  device.longitude = -76.5046;
  device.location = {
    type: "Point",
    coordinates: [-76.5046, 40.0339]
  };
  const deviceResult = validateReport(device);
  assert.equal(deviceResult.ok, true, deviceResult.error);
  assert.equal(deviceResult.report.location_source, "device_gps");
  assert.equal(deviceResult.report.location_overridden, true);
});

test("enforces photo GPS provenance consistency", () => {
  const missingPhotoCoordinate = continuousReport();
  missingPhotoCoordinate.photo_longitude = null;
  assert.equal(validateReport(missingPhotoCoordinate).ok, false);

  const mismatched = continuousReport();
  mismatched.photo_latitude = 40.1;
  assert.equal(validateReport(mismatched).ok, false);

  const overriddenExif = continuousReport();
  overriddenExif.location_overridden = true;
  assert.equal(validateReport(overriddenExif).ok, false);

  const deviceWithoutPhoto = continuousReport();
  deviceWithoutPhoto.location_source = "device_gps";
  deviceWithoutPhoto.location_overridden = true;
  deviceWithoutPhoto.photo_latitude = null;
  deviceWithoutPhoto.photo_longitude = null;
  assert.equal(validateReport(deviceWithoutPhoto).ok, false);
});

test("requires a recorded final location for continuous reports", () => {
  const report = continuousReport();
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  report.location_source = "none";
  report.photo_latitude = null;
  report.photo_longitude = null;
  const result = validateReport(report);
  assert.equal(result.ok, false);
  assert.equal(
    result.error,
    "Continuous rapid reports must record their location source."
  );
});

test("rejects unsupported report categories", () => {
  const report = validReport();
  report.categories = ["not_a_real_category"];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("rejects a GeoJSON point that does not match coordinates", () => {
  const report = validReport();
  report.location.coordinates = [-76.4, 40.1];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("accepts legacy reports without checklist fields", () => {
  const report = validReport();
  delete report.assessment_mode;
  delete report.checklist_responses;
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.assessment_mode, "quick_report");
  assert.deepEqual(result.report.checklist_responses, {});
  assert.equal(result.report.reported_party_type, "unknown");
  assert.equal(result.report.vehicle_involved, false);
  assert.deepEqual(result.report.vehicle_details, {});
  assert.deepEqual(result.report.police_observations, []);
  assert.equal(result.report.submission_mode, "full");
});

test("rejects unsupported checklist answers", () => {
  const report = validReport();
  report.checklist_responses = { walk_01: "probably" };
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("rejects unknown checklist question ids", () => {
  const report = validReport();
  report.checklist_responses = { walk_99: "needs_attention" };
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("accepts linked police and vehicle observations", () => {
  const report = validReport();
  report.categories = ["aggressive_drivers", "police_response"];
  report.reported_party_type = "police_officer";
  report.vehicle_involved = true;
  report.vehicle_details = {
    license_plate: "MG-1234",
    plate_state: "PA",
    year: "2024",
    make: "Ford",
    model: "Explorer",
    color: "Black and white",
    body_style: "SUV",
    vin: "",
    unit_number: "Unit 7",
    visible_damage: "Dent on rear passenger door",
    description: "Marked borough police vehicle",
    emergency_lights: "off",
    siren: "off"
  };
  report.police_observations = [
    "entered_against_red_signal",
    "failed_to_yield"
  ];
  report.police_complaint_details =
    "Vehicle entered the intersection while the signal was red.";

  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.reported_party_type, "police_officer");
  assert.equal(result.report.vehicle_details.unit_number, "Unit 7");
});

test("rejects vehicle details when no vehicle was involved", () => {
  const report = validReport();
  report.vehicle_details = { license_plate: "ABC123" };
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("rejects unsupported police observation values", () => {
  const report = validReport();
  report.police_observations = ["made_up_observation"];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("accepts multiple quick report types and an intersection tag", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.quick_report_type = "speeding";
  report.quick_report_types = ["speeding", "illegal_u_turn"];
  report.categories = ["aggressive_drivers", "vehicle_safety"];
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.quick_report_type, "speeding");
  assert.deepEqual(result.report.quick_report_types, [
    "speeding",
    "illegal_u_turn"
  ]);
  assert.equal(
    result.report.nearest_intersection.label,
    "3rd Street & Locust Street"
  );
});

test("accepts a quick report with no optional complaint type", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.quick_report_type = null;
  report.quick_report_types = [];
  report.categories = [];
  const result = validateReport(report);
  assert.equal(result.ok, true);
});

test("accepts the streamlined quick categories", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.categories = ["sidewalk_safety"];
  report.quick_report_type = "sidewalk_issue";
  report.quick_report_types = ["sidewalk_issue"];
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.quick_report_type, "sidewalk_issue");
});

test("accepts the dedicated PoS submission mode", () => {
  const report = validReport();
  report.submission_mode = "pos";
  report.categories = ["aggressive_drivers"];
  report.quick_report_type = null;
  report.quick_report_types = [];
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.submission_mode, "pos");
});

test("accepts a photo-first PoS payload without categories", () => {
  const report = validReport();
  report.submission_mode = "pos";
  report.categories = [];
  report.details = "Optional description";
  report.quick_report_type = null;
  report.quick_report_types = [];
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.categories, []);
});

test("requires GPS coordinates for PoS reports", () => {
  const report = validReport();
  report.submission_mode = "pos";
  report.categories = [];
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  report.nearest_intersection = null;
  const result = validateReport(report);
  assert.equal(result.ok, false);
  assert.equal(result.error, "PoS reports require GPS coordinates.");
});

test("allows web PoS reports without GPS coordinates", () => {
  const report = validReport();
  report.submission_mode = "pos";
  report.categories = [];
  report.app_version = "web-3.12.1";
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.latitude, null);
  assert.equal(result.report.longitude, null);
  assert.equal(result.report.location, null);
});

test("accepts a legacy singular quick report type", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.quick_report_type = "trip_hazard";
  delete report.quick_report_types;
  report.categories = ["trip_hazards"];
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.quick_report_types, ["trip_hazard"]);
});

test("rejects duplicate quick report choices", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.quick_report_types = ["speeding", "speeding"];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("rejects unsupported quick report choices", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.quick_report_types = ["parking_complaint"];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("accepts a quick report with no GPS fix or dropped pin", () => {
  const report = validReport();
  report.submission_mode = "quick";
  report.categories = [];
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  const result = validateReport(report);
  assert.equal(result.ok, true);
  assert.equal(result.report.latitude, null);
  assert.equal(result.report.location, null);
});

test("still requires an issue category for full mode", () => {
  const report = validReport();
  report.categories = [];
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("still requires a report location for full mode", () => {
  const report = validReport();
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  const result = validateReport(report);
  assert.equal(result.ok, false);
});

test("normalizes a versionless legacy payload into the current report schema", () => {
  const normalized = normalizeLegacyReport({
    id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    date: "2026-08-16T12:00:00Z",
    category: "sidewalk condition",
    urgency: "minor",
    description: "Broken sidewalk near the corner.",
    lat: "40.0337",
    lng: "-76.5044"
  });
  const result = validateReport(normalized);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.report.app_version, "legacy-unknown");
  assert.deepEqual(result.report.categories, ["sidewalk_safety"]);
  assert.equal(result.report.latitude, 40.0337);
});

test("keeps current versions strict instead of hiding malformed payloads", () => {
  const current = normalizeLegacyReport({
    app_version: "3.13.0",
    categories: "sidewalk_safety"
  });
  const result = validateReport(current);
  assert.equal(result.ok, false);
});

test("keeps old web Page of Shame submissions compatible without GPS", () => {
  const report = validReport();
  report.app_version = "web-3.12.1";
  report.submission_mode = "pos";
  report.categories = [];
  report.latitude = null;
  report.longitude = null;
  report.location = null;
  report.nearest_intersection = null;
  const result = validateReport(normalizeLegacyReport(report));
  assert.equal(result.ok, true, result.error);
  assert.match(result.report.app_version, /^web-legacy-/);
});
