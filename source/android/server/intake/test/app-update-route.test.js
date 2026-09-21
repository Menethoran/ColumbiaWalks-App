import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

function payload() {
  return {
    event_id: "cc9fb7b7-f757-4eeb-a4cc-365bdb295f41",
    event_type: "download_verified",
    from_version_code: 31300,
    from_version_name: "3.13.0",
    target_version_code: 31400,
    target_version_name: "3.14.0",
    occurred_at: "2026-08-19T14:30:00.000Z",
    platform: "android"
  };
}

test("stores a validated app update event with the private service token", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ data: { id: 1 } });
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-service-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/app-update-events",
    payload: payload()
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.event_id, payload().event_id);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/items\/app_update_events$/);
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer private-service-token"
  );
  const stored = JSON.parse(calls[0].options.body);
  assert.equal(stored.event_type, "download_verified");
  assert.equal("device_id" in stored, false);
  await app.close();
});

test("treats a duplicate event id as an idempotent success", async () => {
  const fakeFetch = async () => Response.json({
    errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }]
  }, { status: 400 });
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-service-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/app-update-events",
    payload: payload()
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  await app.close();
});

test("rejects malformed update events before calling Directus", async () => {
  let called = false;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-service-token",
    fetchImplementation: async () => {
      called = true;
      return Response.json({});
    },
    logger: false
  });
  const invalid = payload();
  invalid.event_id = "not-a-uuid";
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/app-update-events",
    payload: invalid
  });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});

