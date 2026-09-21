import assert from "node:assert/strict";
import test from "node:test";

import { validateFeedback } from "../src/feedback-validation.js";

function validFeedback() {
  return {
    feedback_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
    feedback_category: "feature_request",
    feedback_text: "Please add a dark map option.",
    app_version: "android-0.7.5",
    submission_source: "android",
    contact_information_offered: false,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    contact_street_address: "",
    contact_notes: "",
    consent_to_contact: false
  };
}

test("accepts anonymous feedback", () => {
  const result = validateFeedback(validFeedback());
  assert.equal(result.ok, true);
  assert.equal(result.feedback.contact_information_provided, false);
});

test("accepts anonymous feedback from the iOS app", () => {
  const feedback = validFeedback();
  feedback.app_version = "ios-3.16.0";
  feedback.submission_source = "ios";
  const result = validateFeedback(feedback);
  assert.equal(result.ok, true);
  assert.equal(result.feedback.submission_source, "ios");
});

test("accepts Other without a predefined subject", () => {
  const feedback = validFeedback();
  feedback.feedback_category = "other";
  feedback.feedback_text = "A general observation about the app.";
  const result = validateFeedback(feedback);
  assert.equal(result.ok, true);
  assert.equal(result.feedback.feedback_category, "other");
});

test("accepts optional contact information and consent", () => {
  const feedback = validFeedback();
  feedback.contact_information_offered = true;
  feedback.contact_name = "A resident";
  feedback.contact_email = "resident@example.com";
  feedback.consent_to_contact = true;
  const result = validateFeedback(feedback);
  assert.equal(result.ok, true);
  assert.equal(result.feedback.contact_information_provided, true);
  assert.equal(result.feedback.consent_to_contact, true);
});

test("does not require contact fields after opting in", () => {
  const feedback = validFeedback();
  feedback.contact_information_offered = true;
  const result = validateFeedback(feedback);
  assert.equal(result.ok, true);
  assert.equal(result.feedback.contact_information_provided, false);
});

test("rejects contact data when the anonymous option is selected", () => {
  const feedback = validFeedback();
  feedback.contact_phone = "717-555-0100";
  const result = validateFeedback(feedback);
  assert.equal(result.ok, false);
});

test("rejects unsupported categories and sources", () => {
  const category = validFeedback();
  category.feedback_category = "billing";
  assert.equal(validateFeedback(category).ok, false);

  const source = validFeedback();
  source.submission_source = "desktop";
  assert.equal(validateFeedback(source).ok, false);
});

test("requires feedback text after a reason is selected", () => {
  const feedback = validFeedback();
  feedback.feedback_text = "   ";
  const result = validateFeedback(feedback);
  assert.equal(result.ok, false);
});
