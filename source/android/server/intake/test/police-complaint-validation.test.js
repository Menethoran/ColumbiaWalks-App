import assert from "node:assert/strict";
import test from "node:test";

import { validatePoliceComplaint } from "../src/police-complaint-validation.js";

function payload() {
  return {
    complaint_id: "f1fd351d-a755-43b9-85a1-164df9da5aa2",
    interaction_sentiment: "negative",
    reporter_perspective: "directly_involved",
    interaction_categories: ["conduct_or_discourtesy"],
    call_context: "police_initiated",
    encounter_type: "pedestrian_stop",
    presence_modes: ["on_foot"],
    safety_change: "somewhat_less_safe",
    response_timeliness: "not_applicable",
    went_out_of_way: "not_applicable",
    safety_before_rating: 7,
    safety_during_rating: 4,
    safety_after_rating: 5,
    respect_rating: 3,
    communication_rating: 4,
    helpfulness_rating: 2,
    professionalism_rating: 4,
    fairness_rating: 3,
    outcome_rating: 3,
    agency: "Columbia Borough Police Department",
    officer_name: "",
    badge_number: "",
    unit_number: "",
    officer_description: "",
    incident_at: "2026-08-09T16:00",
    location_description: "Locust Street and Route 462",
    complaint_text: "The officer's conduct is described here in enough detail.",
    witnesses_or_evidence: "",
    app_version: "web-3.13.0",
    submission_source: "web",
    contact_information_offered: false,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    contact_street_address: "",
    contact_notes: "",
    consent_to_contact: false,
    good_faith_confirmation: true
  };
}

test("accepts an anonymous negative police interaction", () => {
  const result = validatePoliceComplaint(payload());
  assert.equal(result.ok, true);
  assert.equal(result.complaint.contact_information_provided, false);
  assert.deepEqual(result.complaint.complaint_categories, [
    "conduct_or_discourtesy"
  ]);
});

test("accepts a positive interaction and tailored response fields", () => {
  const value = payload();
  value.interaction_sentiment = "positive";
  value.interaction_categories = ["went_out_of_way", "made_people_safer"];
  value.call_context = "called_by_reporter";
  value.encounter_type = "response_to_call";
  value.presence_modes = ["cruiser", "on_foot"];
  value.safety_change = "much_safer";
  value.response_timeliness = "fast";
  value.went_out_of_way = "yes";
  value.complaint_text = "The officer stayed to help everyone reach a safe location.";

  const result = validatePoliceComplaint(value);
  assert.equal(result.ok, true);
  assert.equal(result.complaint.went_out_of_way, "yes");
  assert.deepEqual(result.complaint.presence_modes, ["cruiser", "on_foot"]);
});

test("accepts an unlabeled bystander rating without a narrative", () => {
  const value = payload();
  value.interaction_sentiment = "not_labeled";
  value.reporter_perspective = "bystander";
  value.interaction_categories = ["routine_observation"];
  value.call_context = "already_present";
  value.encounter_type = "community_presence";
  value.presence_modes = ["on_foot"];
  value.safety_change = "no_change";
  value.complaint_text = "";
  value.respect_rating = 8;
  value.communication_rating = null;

  const result = validatePoliceComplaint(value);
  assert.equal(result.ok, true);
  assert.equal(result.complaint.reporter_perspective, "bystander");
  assert.equal(result.complaint.communication_rating, null);
});

test("rejects a short narrative when one is provided", () => {
  const value = payload();
  value.complaint_text = "Too short";
  assert.equal(validatePoliceComplaint(value).ok, false);
});

test("rejects a rating outside the 1 to 10 scale", () => {
  const value = payload();
  value.helpfulness_rating = 11;
  assert.equal(validatePoliceComplaint(value).ok, false);
});

test("rejects hidden contact information", () => {
  const value = payload();
  value.contact_email = "resident@example.com";
  assert.equal(validatePoliceComplaint(value).ok, false);
});

test("rejects unsupported interaction topics", () => {
  const value = payload();
  value.interaction_categories = ["unsupported"];
  assert.equal(validatePoliceComplaint(value).ok, false);
});

