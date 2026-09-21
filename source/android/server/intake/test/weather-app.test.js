import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

function reportPayload() {
  return {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    observed_at: "2026-09-18T12:35:00-04:00",
    categories: ["sidewalk_safety"],
    severity: "low",
    police_response: "not_involved",
    details: "Weather integration test",
    latitude: 40.0337,
    longitude: -76.5044,
    location: { type: "Point", coordinates: [-76.5044, 40.0337] },
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
}

function multipart(report, boundary = "weather-boundary") {
  return {
    boundary,
    body: [
      `--${boundary}`,
      'Content-Disposition: form-data; name="report"',
      "Content-Type: application/json",
      "",
      JSON.stringify(report),
      `--${boundary}--`,
      ""
    ].join("\r\n")
  };
}

test("stores server-derived weather fields with a report", async () => {
  let stored = null;
  let enrichCalls = 0;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    weatherEnricher: async (report) => {
      enrichCalls += 1;
      assert.equal(report.weather_status, undefined);
      return {
        weather_status: "estimated",
        weather_provider: "open-meteo",
        weather_dataset: "forecast",
        weather_summary: "Estimated weather near the reported location: 81°F.",
        weather_event_time_utc: "2026-09-18T16:35:00.000Z",
        weather_valid_time_utc: "2026-09-18T17:00:00.000Z",
        weather_time_delta_minutes: 25,
        weather_retrieved_at_utc: "2026-09-18T18:00:00.000Z",
        weather_attribution: "Weather data by Open-Meteo.com (CC BY 4.0).",
        weather_data: { estimate_kind: "model_derived" }
      };
    },
    fetchImplementation: async (url, options = {}) => {
      if (!options.method) return Response.json({ data: [] });
      stored = JSON.parse(options.body);
      return Response.json({ data: { id: 42, ...stored } });
    },
    logger: false
  });
  const form = multipart({
    ...reportPayload(),
    // A client cannot forge the server-owned value; validation removes it.
    weather_status: "client_claimed_clear"
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${form.boundary}` },
    payload: form.body
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(enrichCalls, 1);
  assert.equal(stored.weather_status, "estimated");
  assert.equal(stored.weather_provider, "open-meteo");
  assert.equal(stored.weather_data.estimate_kind, "model_derived");
  await app.close();
});

test("weather provider failure never blocks report storage", async () => {
  let stored = null;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    weatherEnricher: async () => {
      const error = new Error("private provider URL must not be logged or stored");
      error.weatherCode = "provider_timeout";
      throw error;
    },
    fetchImplementation: async (_url, options = {}) => {
      if (!options.method) return Response.json({ data: [] });
      stored = JSON.parse(options.body);
      return Response.json({ data: { id: 43, ...stored } });
    },
    logger: false
  });
  const form = multipart(reportPayload(), "weather-failure");
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${form.boundary}` },
    payload: form.body
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(stored.weather_status, "unavailable");
  assert.equal(stored.weather_data.failure_code, "provider_timeout");
  assert.doesNotMatch(JSON.stringify(stored.weather_data), /private provider/);
  await app.close();
});

test("idempotent replay returns the stored row without a weather lookup", async () => {
  let enrichCalls = 0;
  let directusCalls = 0;
  const existing = {
    id: 44,
    client_report_id: reportPayload().client_report_id,
    photo: null,
    weather_status: "estimated",
    weather_summary: "Previously stored estimate"
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    weatherEnricher: async () => {
      enrichCalls += 1;
      throw new Error("must not run for duplicate");
    },
    fetchImplementation: async () => {
      directusCalls += 1;
      return Response.json({ data: [existing] });
    },
    logger: false
  });
  const form = multipart(reportPayload(), "weather-duplicate");
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: { "content-type": `multipart/form-data; boundary=${form.boundary}` },
    payload: form.body
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(enrichCalls, 0);
  assert.equal(directusCalls, 1);
  await app.close();
});
