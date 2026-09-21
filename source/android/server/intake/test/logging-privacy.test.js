import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { buildApp } from "../src/app.js";

function captureLogs() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    }
  });
  return {
    stream,
    text() {
      return chunks.join("");
    },
    entries() {
      return chunks.join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }
  };
}

test("request logs omit network identifiers, headers, and query values", async () => {
  const logs = captureLogs();
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    logger: { level: "info", stream: logs.stream }
  });

  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const response = await fetch(
    `${address}/health?latitude=40.0337&private=QUERY_SENTINEL`,
    { headers: { "X-Forwarded-For": "203.0.113.77" } }
  );
  assert.equal(response.status, 200);
  await app.close();

  const entries = logs.entries();
  const incoming = entries.find(({ msg }) => msg === "incoming request");
  assert.ok(incoming);
  assert.deepEqual(incoming.req, { method: "GET", path: "/health" });
  assert.equal(Object.hasOwn(incoming.req, "remoteAddress"), false);
  assert.equal(Object.hasOwn(incoming.req, "remotePort"), false);
  const completed = entries.find(({ msg }) => msg === "request completed");
  assert.equal(completed?.res?.statusCode, 200);
  assert.doesNotMatch(logs.text(), /203\.0\.113\.77|QUERY_SENTINEL|latitude/);
});

test("Directus failures cannot copy private trash-can text into logs", async () => {
  const logs = captureLogs();
  const privateComment = "PRIVATE_COMMENT_SENTINEL";
  const privateAddress = "PRIVATE_ADDRESS_SENTINEL";
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    logger: { level: "info", stream: logs.stream },
    fetchImplementation: async (_url, options) => {
      if (!options.method) return Response.json({ data: [] });
      return Response.json({
        errors: [{
          message: privateComment,
          extensions: { code: "STORAGE_FAILED", address: privateAddress }
        }]
      }, { status: 500 });
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload: {
      submission_id: "7454d551-2e02-421c-89d3-11dc26fd5402",
      kind: "private_complaint",
      categories: ["damaged"],
      comment: privateComment,
      address: privateAddress,
      asset_scope: "unknown",
      app_version: "ios-3.16.0",
      submission_source: "ios"
    }
  });
  assert.equal(response.statusCode, 502, response.body);
  await app.close();

  assert.doesNotMatch(logs.text(), /PRIVATE_COMMENT_SENTINEL|PRIVATE_ADDRESS_SENTINEL/);
  const rejection = logs.entries().find(
    ({ msg }) => msg === "Directus rejected a trash-can submission"
  );
  assert.deepEqual(
    {
      statusCode: rejection?.statusCode,
      directusCode: rejection?.directusCode,
      errorName: rejection?.errorName
    },
    { statusCode: 500, directusCode: "STORAGE_FAILED", errorName: "Error" }
  );
});

test("weather failures cannot copy provider URLs, coordinates, or event times into logs", async () => {
  const logs = captureLogs();
  const privateProviderDetail =
    "https://provider.invalid/?latitude=40.03371&longitude=-76.50441&time=PRIVATE_EVENT_TIME";
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    logger: { level: "info", stream: logs.stream },
    weatherEnricher: async () => {
      const error = new Error(privateProviderDetail);
      error.weatherCode = "provider_timeout";
      error.statusCode = 504;
      throw error;
    },
    fetchImplementation: async (_url, options = {}) => {
      if (!options.method) return Response.json({ data: [] });
      return Response.json({ data: { id: 90 } });
    }
  });
  const report = {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    observed_at: "2026-09-18T12:35:00-04:00",
    categories: ["sidewalk_safety"],
    severity: "low",
    police_response: "not_involved",
    details: "Log privacy test",
    latitude: 40.03371,
    longitude: -76.50441,
    location: { type: "Point", coordinates: [-76.50441, 40.03371] },
    app_version: "3.16.0",
    assessment_mode: "walkability_assessment",
    checklist_responses: {},
    reported_party_type: "civilian_driver",
    vehicle_involved: false,
    vehicle_details: {},
    police_observations: [],
    police_complaint_details: "",
    submission_mode: "full",
    quick_report_type: null,
    quick_report_types: [],
    nearest_intersection: null
  };
  const boundary = "weather-log-privacy";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(report),
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body
  });
  assert.equal(response.statusCode, 201, response.body);
  await app.close();

  assert.doesNotMatch(
    logs.text(),
    /provider\.invalid|40\.03371|-76\.50441|PRIVATE_EVENT_TIME/
  );
  const warning = logs.entries().find(
    ({ msg }) => msg ===
      "Weather enrichment was unavailable; storing the report without conditions"
  );
  assert.deepEqual(
    {
      weatherCode: warning?.weatherCode,
      providerStatus: warning?.providerStatus
    },
    { weatherCode: "provider_timeout", providerStatus: 504 }
  );
});
