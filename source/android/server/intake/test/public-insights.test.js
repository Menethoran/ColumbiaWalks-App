import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

function fakeDirectus() {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/items/safety_reports") {
      return Response.json({
        data: [{
          id: 12,
          client_report_id: "secret-report-id",
          date_created: new Date().toISOString(),
          categories: ["unsafe_crossing"],
          latitude: 40.03371,
          longitude: -76.50441,
          details: "Private submission text",
          contact_email: "private@example.com"
        }]
      });
    }
    if (parsed.pathname === "/items/feedback_submissions") {
      return Response.json({
        data: [{
          id: 22,
          feedback_id: "secret-profile-id",
          date_created: new Date().toISOString(),
          feedback_category: "other",
          feedback_text: "Pedestrian Profile\n" + JSON.stringify({
            submission_type: "pedestrian_profile",
            responses: {
              walking_days_per_week: "5",
              walking_barriers: ["lighting_or_visibility"],
              walking_purposes: ["exercise"],
              general_walking_safety: "2_unsafe"
            }
          })
        }]
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
}

test("serves a separate indexable public insights page with a strict map policy", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation: fakeDirectus(),
    logger: false
  });
  const redirect = await app.inject({ method: "GET", url: "/columbiawalks-insights" });
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, "/columbiawalks-insights/");

  const response = await app.inject({ method: "GET", url: "/columbiawalks-insights/" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /How Columbia walks/);
  assert.match(response.body, /Aggregate data only/);
  assert.doesNotMatch(response.body, /noindex/);
  assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(
    response.headers["content-security-policy"],
    /https:\/\/tile\.openstreetmap\.org/
  );
  await app.close();
});

test("returns public aggregates without any individual submission fields", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation: fakeDirectus(),
    logger: false
  });
  const response = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/public/insights?range=90"
  });
  assert.equal(response.statusCode, 200, response.body);
  const data = response.json().data;
  assert.equal(data.totals.safety_reports, 1);
  assert.equal(data.totals.pedestrian_profiles, 1);
  assert.equal(data.report_heatmap.points[0].latitude, 40.034);
  assert.equal(data.report_heatmap.points[0].longitude, -76.504);
  assert.equal("records" in data, false);
  assert.doesNotMatch(
    response.body,
    /secret-report-id|secret-profile-id|Private submission text|private@example\.com/
  );
  await app.close();
});

