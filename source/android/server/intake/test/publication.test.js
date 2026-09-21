import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateHeatmap,
  formatPlate,
  prioritizePublishedIncidents,
  sanitizePublicIncident,
  selectWallpaperIncidents
} from "../src/publication.js";

test("masks a reported plate by default", () => {
  assert.equal(formatPlate("PA", "ABC-1234", false), "PA · AB•••34");
  assert.equal(formatPlate("PA", "ABC-1234", true), "PA · ABC1234");
});

test("publishes only reviewed display fields", () => {
  const incident = sanitizePublicIncident({
    id: 42,
    date_created: "2026-08-09T12:00:00Z",
    observed_at: "Aug 9, 2026 8:00 AM",
    categories: ["aggressive_drivers"],
    severity: "high",
    latitude: 40.031234,
    longitude: -76.501234,
    public_caption: "Community-reported crosswalk obstruction.",
    public_location_label: "Locust Street & Route 462",
    public_photo: { id: "8d7a7a1b-3466-41bb-b5ed-35eae027dd20" },
    weather_status: "estimated",
    weather_summary:
      "Estimated weather near the reported location: 78°F; mainly clear.",
    weather_valid_time_utc: "2026-08-09T12:00:00Z",
    weather_attribution: "Weather data by Open-Meteo.com (CC BY 4.0).",
    weather_data: {
      provider_grid: { latitude: 40.0312, longitude: -76.5012 },
      private_debug: "DO-NOT-PUBLISH-WEATHER"
    },
    vehicle_details: {
      license_plate: "ABC1234",
      plate_state: "PA",
      vin: "DO-NOT-PUBLISH",
      description: "Do not publish the raw narrative"
    }
  });

  assert.equal(incident.plate, "PA · AB•••34");
  assert.equal(incident.location_label, "Locust Street & Route 462");
  assert.match(incident.photo_url, /public\/media\/8d7a7a1b/);
  assert.deepEqual(incident.weather, {
    status: "estimated",
    summary:
      "Estimated weather near the reported location: 78°F; mainly clear.",
    valid_at: "2026-08-09T12:00:00.000Z",
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)."
  });
  assert.equal("latitude" in incident, false);
  assert.equal(JSON.stringify(incident).includes("DO-NOT-PUBLISH"), false);
  assert.equal(JSON.stringify(incident).includes("provider_grid"), false);
});

test("does not publish unavailable or client-shaped weather data", () => {
  const unavailable = sanitizePublicIncident({
    id: 43,
    weather_status: "unavailable",
    weather_summary: "A forged client summary",
    weather_valid_time_utc: "not-a-date",
    weather_attribution: "forged"
  });
  assert.equal(unavailable.weather, null);
});

test("groups heat-map locations at three decimal places", () => {
  const points = aggregateHeatmap([
    {
      latitude: 40.03371,
      longitude: -76.50441,
      categories: ["crosswalk_safety"]
    },
    {
      latitude: 40.03374,
      longitude: -76.50444,
      categories: ["crosswalk_safety", "vehicle_safety"]
    },
    {
      latitude: 40.0352,
      longitude: -76.5012,
      categories: ["trip_hazards"]
    }
  ]);

  assert.equal(points.length, 2);
  assert.equal(points[0].count, 2);
  assert.equal(points[0].categories.crosswalk_safety, 2);
  assert.equal(points[0].categories.vehicle_safety, 1);
});

test("prioritizes PoS, then Quick, then Full reports", () => {
  const incidents = prioritizePublishedIncidents([
    { id: "full", submission_mode: "full", reported_at: "2026-08-13" },
    { id: "quick", submission_mode: "quick", reported_at: "2026-08-12" },
    { id: "pos", submission_mode: "pos", reported_at: "2026-08-11" }
  ]);
  assert.deepEqual(incidents.map((incident) => incident.id), [
    "pos",
    "quick",
    "full"
  ]);
});

test("builds the wallpaper exclusively from Page of Shame photos", () => {
  const incidents = [
    { id: "p1", submission_mode: "pos", photo_url: "/media/p1" },
    { id: "p2", submission_mode: "pos", photo_url: "/media/p2" },
    { id: "q1", submission_mode: "quick", photo_url: "/media/q1" },
    { id: "f1", submission_mode: "full", photo_url: "/media/f1" },
    { id: "text-only", submission_mode: "pos", photo_url: null }
  ];
  const selected = selectWallpaperIncidents(incidents, {
    limit: 4,
    rotationSeed: "2026-08-13"
  });
  assert.equal(selected.length, 2);
  assert.deepEqual(
    new Set(selected.map((incident) => incident.id)),
    new Set(["p1", "p2"])
  );
  assert.ok(selected.every((incident) => incident.submission_mode === "pos"));
});

test("uses a stable daily seed for Page of Shame wallpaper order", () => {
  const incidents = ["p1", "p2", "p3", "p4"].map((id) => ({
    id,
    submission_mode: "pos",
    photo_url: `/media/${id}`
  }));
  const first = selectWallpaperIncidents(incidents, {
    limit: 3,
    rotationSeed: "2026-08-16"
  });
  const repeated = selectWallpaperIncidents(incidents, {
    limit: 3,
    rotationSeed: "2026-08-16"
  });
  assert.deepEqual(first, repeated);
});
