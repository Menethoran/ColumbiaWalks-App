import assert from "node:assert/strict";
import test from "node:test";

import { validateTrashCanSubmission } from "../src/trash-can-validation.js";

const SUBMISSION_ID = "a9927f31-6d65-4bf0-8fa6-7a92481de4a1";
const CAN_ID = "b046815a-1bb7-43a2-bb8f-ddd9cd7a8c84";

function publicComment() {
  return {
    submission_id: SUBMISSION_ID,
    kind: "public_comment",
    public_trash_can_id: CAN_ID,
    categories: ["clean_well_maintained"],
    comment: "  This can is clean and easy to reach.  ",
    app_version: "3.16.0",
    submission_source: "android"
  };
}

test("normalizes an anonymous public comment and defaults to public scope", () => {
  const result = validateTrashCanSubmission(publicComment());
  assert.equal(result.ok, true);
  assert.equal(result.submission.asset_scope, "public");
  assert.equal(result.submission.comment, "This can is clean and easy to reach.");
  assert.equal(result.submission.public_trash_can_id, CAN_ID);
  assert.equal(result.submission.latitude, null);
  assert.equal(result.submission.address, "");
});

test("accepts a private complaint located by an address", () => {
  const value = publicComment();
  value.kind = "private_complaint";
  value.asset_scope = "private_property";
  delete value.public_trash_can_id;
  value.categories = ["odor_or_pests", "missed_service"];
  value.comment = "The container has not been emptied and is attracting pests.";
  value.address = "  100 block of Locust Street  ";
  value.submission_source = "ios";

  const result = validateTrashCanSubmission(value);
  assert.equal(result.ok, true);
  assert.equal(result.submission.asset_scope, "private_property");
  assert.equal(result.submission.address, "100 block of Locust Street");
  assert.equal(result.submission.submission_source, "ios");
});

test("accepts a complaint located by a complete coordinate pair", () => {
  const value = publicComment();
  value.kind = "private_complaint";
  value.categories = ["damaged"];
  delete value.public_trash_can_id;
  value.latitude = 40.0337;
  value.longitude = -76.5044;
  const result = validateTrashCanSubmission(value);
  assert.equal(result.ok, true);
  assert.equal(result.submission.latitude, 40.0337);
  assert.equal(result.submission.longitude, -76.5044);
});

test("requires a fixed can, address, or complete coordinate pair", () => {
  const value = publicComment();
  delete value.public_trash_can_id;
  assert.equal(validateTrashCanSubmission(value).ok, false);

  value.latitude = 40.0337;
  assert.equal(validateTrashCanSubmission(value).ok, false);
  value.longitude = -76.5044;
  assert.equal(validateTrashCanSubmission(value).ok, true);
});

test("keeps public comments on public assets", () => {
  const value = publicComment();
  value.asset_scope = "private_property";
  assert.equal(validateTrashCanSubmission(value).ok, false);

  value.kind = "private_complaint";
  value.categories = ["damaged"];
  assert.equal(validateTrashCanSubmission(value).ok, false);
});

test("applies separate allowlisted categories to comments and complaints", () => {
  const wrongCommentCategory = publicComment();
  wrongCommentCategory.categories = ["illegal_dumping"];
  assert.equal(validateTrashCanSubmission(wrongCommentCategory).ok, false);

  const tooMany = publicComment();
  tooMany.categories = [
    "clean_well_maintained",
    "needs_cleaning",
    "damaged",
    "other"
  ];
  assert.equal(validateTrashCanSubmission(tooMany).ok, false);

  const duplicates = publicComment();
  duplicates.categories = ["damaged", "damaged"];
  const result = validateTrashCanSubmission(duplicates);
  assert.equal(result.ok, true);
  assert.deepEqual(result.submission.categories, ["damaged"]);
});

test("requires a valid UUID and meaningful bounded comment text", () => {
  const badId = publicComment();
  badId.submission_id = "not-a-uuid";
  assert.equal(validateTrashCanSubmission(badId).ok, false);

  const badCanId = publicComment();
  badCanId.public_trash_can_id = "can-12";
  assert.equal(validateTrashCanSubmission(badCanId).ok, false);

  const empty = publicComment();
  empty.comment = "  ";
  assert.equal(validateTrashCanSubmission(empty).ok, false);

  const tooLong = publicComment();
  tooLong.comment = "x".repeat(2001);
  assert.equal(validateTrashCanSubmission(tooLong).ok, false);
});

test("rejects invalid coordinates, source values, and app versions", () => {
  const latitude = publicComment();
  latitude.latitude = 91;
  latitude.longitude = -76.5;
  assert.equal(validateTrashCanSubmission(latitude).ok, false);

  const longitude = publicComment();
  longitude.latitude = 40;
  longitude.longitude = Number.NaN;
  assert.equal(validateTrashCanSubmission(longitude).ok, false);

  const source = publicComment();
  source.submission_source = "browser-with-fingerprint";
  assert.equal(validateTrashCanSubmission(source).ok, false);

  const version = publicComment();
  version.app_version = "contains spaces";
  assert.equal(validateTrashCanSubmission(version).ok, false);
});

test("rejects contact, account, device, and unsupported fields", () => {
  for (const field of ["contact_email", "device_id", "account_name", "ip_address"]) {
    const value = publicComment();
    value[field] = "must-not-be-stored";
    const result = validateTrashCanSubmission(value);
    assert.equal(result.ok, false);
    assert.match(result.error, /anonymous/i);
  }

  const value = publicComment();
  value.internal_notes = "not accepted";
  assert.equal(validateTrashCanSubmission(value).ok, false);
});

