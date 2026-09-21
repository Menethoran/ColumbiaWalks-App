import assert from "node:assert/strict";
import test from "node:test";

import { validateWalkingMetric } from "../src/walking-metric-validation.js";

function validMetric() {
  return {
    metric_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
    period_start: "2026-08-18T12:00:00Z",
    period_end: "2026-08-18T13:00:00Z",
    distance_meters: 4321.25,
    duration_seconds: 3600,
    activity_count: 2,
    source: "tracked_walk",
    app_version: "3.14.0",
    user_consent: true
  };
}

test("accepts an explicitly consented walking summary", () => {
  const result = validateWalkingMetric(validMetric());
  assert.equal(result.ok, true, result.error);
  assert.equal(result.metric.distance_meters, 4321.3);
  assert.equal(result.metric.activity_count, 2);
});

test("rejects walking data without affirmative sharing consent", () => {
  const metric = validMetric();
  metric.user_consent = false;
  assert.equal(validateWalkingMetric(metric).ok, false);
});

test("rejects unsupported walking data sources and impossible ranges", () => {
  const metric = validMetric();
  metric.source = "pedometer_x";
  assert.equal(validateWalkingMetric(metric).ok, false);
  metric.source = "health_connect";
  metric.distance_meters = -1;
  assert.equal(validateWalkingMetric(metric).ok, false);
});

