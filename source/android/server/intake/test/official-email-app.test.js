import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { buildApp } from "../src/app.js";

const REPORT_ID = "72ca1d8c-3e93-423b-a334-814d3eedaf76";

function authorizedQuickReport(type = "missing_sidewalk") {
  const policeRoute = type === "crosswalk_encroachment";
  return {
    client_report_id: REPORT_ID,
    observed_at: "2026-09-12T14:00:00Z",
    categories: [policeRoute ? "crosswalk_safety" : "sidewalk_safety"],
    severity: "medium",
    police_response: "not_involved",
    details: policeRoute ? "Incoming altered report" : "Missing sidewalk",
    latitude: 40.0337,
    longitude: -76.5044,
    location: {
      type: "Point",
      coordinates: [-76.5044, 40.0337]
    },
    app_version: "3.15.0",
    assessment_mode: "quick_report",
    checklist_responses: {},
    reported_party_type: "unknown",
    vehicle_involved: policeRoute,
    vehicle_details: policeRoute
      ? { license_plate: "REPLAY1", plate_state: "PA" }
      : {},
    police_observations: [],
    police_complaint_details: "",
    submission_mode: "quick",
    quick_report_type: type,
    quick_report_types: [type],
    nearest_intersection: {
      label: "3rd Street & Locust Street",
      latitude: 40.0337,
      longitude: -76.5044,
      distance_meters: 12,
      major: true
    },
    official_email_authorized: true,
    official_email_destination_authorized: "test"
  };
}

async function multipartPayload(report, { photo = false, boundary = "official-email" } = {}) {
  const before = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(report)
  ];
  if (!photo) {
    return {
      boundary,
      body: Buffer.from([...before, `--${boundary}--`, ""].join("\r\n"))
    };
  }
  const bytes = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#0A2A43"
    }
  }).png().toBuffer();
  const photoHeader = Buffer.from([
    ...before,
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="evidence.png"',
    "Content-Type: image/png",
    "",
    ""
  ].join("\r\n"));
  return {
    boundary,
    body: Buffer.concat([
      photoHeader,
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
  };
}

test("outbox failure never rolls back a stored report or its photo", async () => {
  const directusCalls = [];
  const fakeFetch = async (url, options = {}) => {
    directusCalls.push({ url, options });
    if (url.includes("/items/safety_reports?") && !options.method) {
      return Response.json({ data: [] });
    }
    if (url.endsWith("/files") && options.method === "POST") {
      return Response.json({ data: { id: "saved-photo-id" } });
    }
    if (url.endsWith("/items/safety_reports") && options.method === "POST") {
      const payload = JSON.parse(options.body);
      return Response.json({
        data: {
          id: 315,
          client_report_id: payload.client_report_id,
          photo: payload.photo
        }
      });
    }
    throw new Error(`Unexpected Directus request: ${options.method || "GET"} ${url}`);
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    officialEmailQueue: {
      destinationMode: "test",
      async ensureDeliveries() {
        throw new Error("outbox temporarily unavailable");
      }
    },
    logger: false
  });
  const multipart = await multipartPayload(authorizedQuickReport(), {
    photo: true,
    boundary: "outbox-failure"
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${multipart.boundary}` },
    payload: multipart.body
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.id, 315);
  assert.equal(response.json().official_email.status, "deferred");
  assert.equal(response.json().official_email.destination_mode, "test");
  assert.equal(
    directusCalls.some(({ options }) => options.method === "DELETE"),
    false
  );
  assert.equal(directusCalls.length, 3);
  await app.close();
});

test("duplicate reconciliation uses only the complete stored report", async () => {
  const stored = {
    ...authorizedQuickReport("missing_sidewalk"),
    id: 77,
    details: "Authoritative stored report",
    photo: "stored-photo-id",
    submission_channel: "android_app"
  };
  const directusCalls = [];
  const queueCalls = [];
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: async (url, options = {}) => {
      directusCalls.push({ url, options });
      return Response.json({ data: [stored] });
    },
    officialEmailQueue: {
      destinationMode: "test",
      async ensureDeliveries(report, storedReport) {
        queueCalls.push({ report, storedReport });
        return [{
          rule_id: "codes_missing_sidewalk_v1",
          status: "queued",
          destination_mode: "test",
          blocked_reason: null
        }];
      }
    },
    logger: false
  });
  const incoming = authorizedQuickReport("crosswalk_encroachment");
  const multipart = await multipartPayload(incoming, { boundary: "stored-wins" });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${multipart.boundary}` },
    payload: multipart.body
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(response.json().official_email.destination_mode, "test");
  assert.equal(
    response.json().official_email.deliveries[0].destination_mode,
    "test"
  );
  assert.deepEqual(response.json().data, {
    id: 77,
    client_report_id: REPORT_ID,
    photo: "stored-photo-id"
  });
  assert.equal("details" in response.json().data, false);
  assert.equal("official_email_authorized" in response.json().data, false);
  assert.equal(
    "official_email_destination_authorized" in response.json().data,
    false
  );
  assert.equal(queueCalls.length, 1);
  assert.strictEqual(queueCalls[0].report, queueCalls[0].storedReport);
  assert.equal(queueCalls[0].report.details, "Authoritative stored report");
  assert.deepEqual(queueCalls[0].report.quick_report_types, ["missing_sidewalk"]);
  assert.match(directusCalls[0].url, /official_email_authorized/);
  assert.match(
    directusCalls[0].url,
    /official_email_destination_authorized/
  );
  assert.match(directusCalls[0].url, /submission_mode/);
  await app.close();
});

test("a replay cannot add authorization or a new route to a stored report", async () => {
  const stored = {
    ...authorizedQuickReport("missing_sidewalk"),
    id: 78,
    official_email_authorized: false,
    official_email_destination_authorized: null,
    quick_report_type: "sidewalk_issue",
    quick_report_types: ["sidewalk_issue"],
    photo: "older-photo-id"
  };
  let queueCalls = 0;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: async () => Response.json({ data: [stored] }),
    officialEmailQueue: {
      async ensureDeliveries() {
        queueCalls += 1;
        return [];
      }
    },
    logger: false
  });
  const multipart = await multipartPayload(
    authorizedQuickReport("crosswalk_encroachment"),
    { boundary: "no-consent-replay" }
  );
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${multipart.boundary}` },
    payload: multipart.body
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(response.json().official_email, undefined);
  assert.equal(queueCalls, 0);
  await app.close();
});
