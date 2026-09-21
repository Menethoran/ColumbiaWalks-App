import assert from "node:assert/strict";
import test from "node:test";

import { validateAppUpdateEvent } from "../src/app-update-validation.js";

function validEvent() {
  return {
    event_id: "cc9fb7b7-f757-4eeb-a4cc-365bdb295f41",
    event_type: "update_available",
    from_version_code: 31300,
    from_version_name: "3.13.0",
    target_version_code: 31400,
    target_version_name: "3.14.0",
    occurred_at: "2026-08-19T14:30:00.000Z",
    platform: "android"
  };
}

test("accepts an anonymous update event and retains no device identifier", () => {
  const event = validEvent();
  event.device_id = "must-not-be-stored";
  const result = validateAppUpdateEvent(event);
  assert.equal(result.ok, true);
  assert.equal(result.event.event_type, "update_available");
  assert.equal("device_id" in result.event, false);
  assert.equal(result.event.target_version_code, 31400);
});

test("accepts a failed check without a target version", () => {
  const event = validEvent();
  event.event_type = "check_failed";
  event.error_code = "network_error";
  delete event.target_version_code;
  delete event.target_version_name;
  const result = validateAppUpdateEvent(event);
  assert.equal(result.ok, true);
  assert.equal(result.event.error_code, "network_error");
});

test("requires a target version for download and install events", () => {
  const event = validEvent();
  event.event_type = "installed";
  delete event.target_version_code;
  delete event.target_version_name;
  assert.equal(validateAppUpdateEvent(event).ok, false);
});

test("rejects unsupported event types, invalid versions, and unsafe error codes", () => {
  const unsupported = validEvent();
  unsupported.event_type = "device_fingerprint";
  assert.equal(validateAppUpdateEvent(unsupported).ok, false);

  const version = validEvent();
  version.from_version_name = "3.13.0-beta";
  assert.equal(validateAppUpdateEvent(version).ok, false);

  const error = validEvent();
  error.error_code = "raw exception: user@example.com";
  assert.equal(validateAppUpdateEvent(error).ok, false);
});

