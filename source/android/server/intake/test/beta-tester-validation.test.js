import assert from "node:assert/strict";
import test from "node:test";

import { validateBetaTesterRequest } from "../src/beta-tester-validation.js";

function request(overrides = {}) {
  return {
    request_id: "a1bc648c-fead-45b2-a8cd-3db0ea713320",
    platform: "ios",
    account_name: "Callie Thompson",
    account_email: "Callie@example.com",
    columbia_street: "Locust Street",
    comments: "I can test VoiceOver.",
    privacy_consent: true,
    website: "",
    ...overrides
  };
}

test("accepts an iOS or Android beta request and normalizes the account email", () => {
  const ios = validateBetaTesterRequest(request());
  assert.equal(ios.ok, true);
  assert.equal(ios.request.platform, "ios");
  assert.equal(ios.request.account_email, "callie@example.com");
  assert.equal(ios.request.columbia_street, "Locust Street");
  assert.equal(ios.request.submission_source, "website");

  const android = validateBetaTesterRequest(request({ platform: "android" }));
  assert.equal(android.ok, true);
  assert.equal(android.request.platform, "android");
});

test("rejects every house number from the Columbia street field", () => {
  for (const columbia_street of [
    "123 Locust Street",
    "Locust Street 123",
    "Locust ٣ Street"
  ]) {
    const result = validateBetaTesterRequest(request({ columbia_street }));
    assert.equal(result.ok, false);
    assert.match(result.error, /House numbers are not allowed/i);
  }
});

test("requires a platform, valid account email, street name, and consent", () => {
  assert.equal(validateBetaTesterRequest(request({ platform: "windows" })).ok, false);
  assert.equal(validateBetaTesterRequest(request({ account_email: "not-an-email" })).ok, false);
  assert.equal(validateBetaTesterRequest(request({ columbia_street: "---" })).ok, false);
  assert.equal(validateBetaTesterRequest(request({ privacy_consent: false })).ok, false);
  assert.equal(validateBetaTesterRequest(request({ website: "spam" })).ok, false);
});

