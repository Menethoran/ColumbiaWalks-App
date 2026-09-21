import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

function validRequest(overrides = {}) {
  return {
    request_id: "a1bc648c-fead-45b2-a8cd-3db0ea713320",
    platform: "android",
    account_name: "Robert Thompson",
    account_email: "robert@example.com",
    columbia_street: "Locust Street",
    comments: "I would like to test mapping.",
    privacy_consent: true,
    website: "",
    ...overrides
  };
}

test("serves the public beta request page with the two app branches", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation: async () => {
      throw new Error("Directus should not be contacted while loading the page.");
    },
    logger: false
  });
  const redirect = await app.inject({ method: "GET", url: "/beta-testing" });
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, "/beta-testing/");

  const response = await app.inject({ method: "GET", url: "/beta-testing/" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Apple \/ iOS/);
  assert.match(response.body, /Google \/ Android/);
  assert.match(response.body, /street only — no house number/i);
  assert.match(response.body, /Numbers cannot be entered or saved/i);
  assert.match(response.headers["content-security-policy"], /form-action 'self'/);
  await app.close();
});

test("stores a valid private beta tester request without returning contact data", async () => {
  let stored = null;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation: async (url, options = {}) => {
      assert.equal(new URL(url).pathname, "/items/beta_tester_requests");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.get("Authorization"), "Bearer service-token");
      stored = JSON.parse(options.body);
      return Response.json({
        data: { request_id: stored.request_id, status: "new" }
      });
    },
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/beta-testers",
    payload: validRequest()
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(stored.platform, "android");
  assert.equal(stored.columbia_street, "Locust Street");
  assert.equal(stored.submission_source, "website");
  assert.deepEqual(response.json().data, {
    request_id: validRequest().request_id,
    status: "new"
  });
  assert.doesNotMatch(response.body, /Robert|robert@example\.com|Locust/);
  await app.close();
});

test("rejects a house number before contacting Directus", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation: async () => {
      throw new Error("Directus must not receive an invalid address.");
    },
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/beta-testers",
    payload: validRequest({ columbia_street: "123 Locust Street" })
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /House numbers are not allowed/i);
  await app.close();
});

