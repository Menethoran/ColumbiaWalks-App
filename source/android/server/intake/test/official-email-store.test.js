import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOfficialEmailConfig } from "../src/official-email-policy.js";
import { createOfficialEmailStore } from "../src/official-email-store.js";

function config(overrides = {}) {
  return normalizeOfficialEmailConfig({
    mode: "automatic",
    destinationMode: "official",
    policeChiefEmail: "chief@example.gov",
    mayorEmail: "mayor@example.gov",
    codesEmail: "codes@example.gov",
    ...overrides
  });
}

function report() {
  return {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    observed_at: "Sep 12, 2026 9:30 AM",
    categories: ["crosswalk_safety"],
    severity: "high",
    details: "Crosswalk observation",
    latitude: 40.0337,
    longitude: -76.5044,
    quick_report_types: ["crosswalk_encroachment"],
    submission_mode: "quick",
    rapid_report_kind: null,
    vehicle_issue_type: null,
    vehicle_details: { license_plate: "ABC1234", plate_state: "PA" },
    official_email_authorized: true,
    official_email_destination_authorized: "official",
    app_version: "3.15.0",
    submission_channel: "android_app"
  };
}

test("creates one durable delivery with server-owned recipients and snapshot", async () => {
  const calls = [];
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    now: () => new Date("2026-09-12T14:00:00Z"),
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      const payload = JSON.parse(options.body);
      return Response.json({ data: { id: 88, ...payload } });
    }
  });
  const deliveries = await store.ensureDeliveries(report(), {
    id: 17,
    photo: "photo-id"
  });
  assert.equal(deliveries.length, 1);
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.dedupe_key, `${"v1:72ca1d8c-3e93-423b-a334-814d3eedaf76"}:police_crosswalk_v1`);
  assert.deepEqual(payload.recipient_to, ["chief@example.gov"]);
  assert.deepEqual(payload.recipient_cc, ["mayor@example.gov"]);
  assert.equal(payload.photo_id, "photo-id");
  assert.equal(payload.destination_mode, "official");
  assert.equal(payload.report_snapshot.photo_id, "photo-id");
  assert.equal(payload.report_snapshot.details, "Crosswalk observation");
  assert.equal(payload.status, "queued");
});

test("unique outbox conflict resolves to the existing delivery", async () => {
  let call = 0;
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    fetchImplementation: async (_url, options = {}) => {
      call += 1;
      if (options.method === "POST") {
        return Response.json({
          errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }]
        }, { status: 400 });
      }
      return Response.json({ data: [{
        id: 88,
        dedupe_key:
          "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
        rule_id: "police_crosswalk_v1",
        status: "sent"
      }] });
    }
  });
  const deliveries = await store.ensureDeliveries(report(), {
    id: 17,
    photo: "photo-id"
  });
  assert.equal(call, 2);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].status, "sent");
});

test("an untouched review row is queued only after automatic mode is explicit", async () => {
  const patches = [];
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    now: () => new Date("2026-09-12T14:00:00Z"),
    fetchImplementation: async (_url, options = {}) => {
      if (options.method === "POST") {
        return Response.json({
          errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }]
        }, { status: 400 });
      }
      if (options.method === "PATCH") {
        const payload = JSON.parse(options.body);
        patches.push(payload);
        return Response.json({ data: { id: 88, ...payload } });
      }
      return Response.json({ data: [{
        id: 88,
        dedupe_key:
          "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
        rule_id: "police_crosswalk_v1",
        route: "police_mayor",
        status: "review",
        attempt_count: 0,
        preparation_attempt_count: 0,
        preview_attempt_count: 1,
        preview_generated_at: "2026-09-12T13:50:00Z",
        preview_subject: "[TEST] old preview",
        recipient_to: ["old-chief@example.gov"],
        recipient_cc: [],
        photo_id: "photo-id",
        report_snapshot: {}
      }] });
    }
  });
  const deliveries = await store.ensureDeliveries(report(), {
    id: 17,
    photo: "photo-id"
  });
  assert.equal(deliveries[0].status, "queued");
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].recipient_to, ["chief@example.gov"]);
  assert.deepEqual(patches[0].recipient_cc, ["mayor@example.gov"]);
  assert.equal(patches[0].destination_mode, "official");
  assert.equal(patches[0].next_attempt_at, "2026-09-12T14:00:00.000Z");
  assert.equal(patches[0].preview_generated_at, null);
  assert.equal(patches[0].preview_subject, null);
  assert.equal(patches[0].preview_attempt_count, 0);
});

test("destination authorization mismatch creates no outbox request", async () => {
  let requests = 0;
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    fetchImplementation: async () => {
      requests += 1;
      throw new Error("Directus must not be contacted");
    }
  });
  const deliveries = await store.ensureDeliveries({
    ...report(),
    official_email_destination_authorized: "test"
  }, {
    id: 17,
    photo: "photo-id"
  });
  assert.deepEqual(deliveries, []);
  assert.equal(requests, 0);
});

test("expired sending leases become uncertain instead of retry", async () => {
  const patches = [];
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    now: () => new Date("2026-09-12T14:00:00Z"),
    fetchImplementation: async (_url, options = {}) => {
      if (options.method === "PATCH") {
        const payload = JSON.parse(options.body);
        patches.push(payload);
        return Response.json({ data: { id: 88, ...payload } });
      }
      return Response.json({ data: [{ id: 88, status: "sending" }] });
    }
  });
  const count = await store.recoverExpiredLeases();
  assert.equal(count, 1);
  assert.equal(patches[0].status, "uncertain");
  assert.equal(patches[0].next_attempt_at, null);
});

test("expired preparing leases are safe to retry because Gmail was not called", async () => {
  const patches = [];
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    now: () => new Date("2026-09-12T14:00:00Z"),
    fetchImplementation: async (_url, options = {}) => {
      if (options.method === "PATCH") {
        const payload = JSON.parse(options.body);
        patches.push(payload);
        return Response.json({ data: { id: 89, ...payload } });
      }
      return Response.json({ data: [{
        id: 89,
        status: "preparing",
        preparation_attempt_count: 1
      }] });
    }
  });
  const count = await store.recoverExpiredLeases();
  assert.equal(count, 1);
  assert.equal(patches[0].status, "retry");
  assert.equal(patches[0].next_attempt_at, "2026-09-12T14:00:00.000Z");
  assert.equal(patches[0].last_error_code, "stale_preparing_lease");
});

test("rolling recipient accounting includes uncertain Gmail outcomes", async () => {
  let requestedUrl = "";
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config(),
    fetchImplementation: async (url) => {
      requestedUrl = url;
      return Response.json({ data: [{
        recipient_to: ["chief@example.gov"],
        recipient_cc: ["mayor@example.gov"]
      }] });
    }
  });
  const count = await store.countRecentRecipients(
    new Date("2026-09-11T14:00:00Z")
  );
  assert.equal(count, 2);
  assert.match(requestedUrl, /sending%2Csent%2Cuncertain/);
});

test("review mode creates a due row and lists only pending private previews", async () => {
  const calls = [];
  const store = createOfficialEmailStore({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    config: config({ mode: "review" }),
    now: () => new Date("2026-09-12T14:00:00Z"),
    fetchImplementation: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "POST") {
        const payload = JSON.parse(options.body);
        return Response.json({ data: { id: 88, ...payload } });
      }
      return Response.json({ data: [{ id: 88, status: "review" }] });
    }
  });

  const deliveries = await store.ensureDeliveries(report(), {
    id: 17,
    photo: "photo-id"
  });
  assert.equal(deliveries[0].status, "review");
  assert.equal(deliveries[0].next_attempt_at, "2026-09-12T14:00:00.000Z");

  const pending = await store.listPendingReview();
  assert.equal(pending.length, 1);
  const listUrl = calls.at(-1).url;
  assert.match(listUrl, /status.*review/);
  assert.match(listUrl, /preview_generated_at.*null/);
  assert.match(listUrl, /next_attempt_at.*lte/);
});
