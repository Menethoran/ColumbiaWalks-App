import assert from "node:assert/strict";
import test from "node:test";

import {
  conditionLabel,
  createWeatherEnricher,
  parseIncidentTime,
  safeWeatherError
} from "../src/weather.js";

function hourlyResponse(overrides = {}) {
  return {
    latitude: 40.04,
    longitude: -76.5,
    elevation: 121,
    utc_offset_seconds: 0,
    timezone: "GMT",
    timezone_abbreviation: "GMT",
    hourly_units: {
      temperature_2m: "°F",
      apparent_temperature: "°F",
      relative_humidity_2m: "%",
      precipitation: "inch",
      rain: "inch",
      snowfall: "inch",
      weather_code: "wmo code",
      wind_speed_10m: "mp/h",
      wind_direction_10m: "°",
      wind_gusts_10m: "mp/h",
      visibility: "m",
      is_day: ""
    },
    hourly: {
      time: ["2026-09-18T16:00", "2026-09-18T17:00"],
      temperature_2m: [79.1, 81.2],
      apparent_temperature: [80.3, 82.4],
      relative_humidity_2m: [58, 55],
      precipitation: [0, 0.012],
      rain: [0, 0.012],
      snowfall: [0, 0],
      weather_code: [1, 2],
      wind_speed_10m: [7.1, 8.2],
      wind_direction_10m: [300, 320],
      wind_gusts_10m: [11, 13.1],
      visibility: [32_000, 34_600],
      is_day: [1, 1]
    },
    ...overrides
  };
}

test("parses offset ISO and legacy Android local incident times", () => {
  const instant = parseIncidentTime("2026-09-18T12:35:00-04:00");
  assert.equal(instant.kind, "instant");
  assert.equal(new Date(instant.epochMs).toISOString(), "2026-09-18T16:35:00.000Z");

  const local = parseIncidentTime("Sep 18, 2026 12:35 PM");
  assert.equal(local.kind, "local");
  assert.equal(local.queryDate, "2026-09-18");
  assert.equal(local.hourKey, "2026-09-18T12");
  assert.equal(parseIncidentTime("Feb 30, 2026 2:00 PM"), null);
  assert.equal(parseIncidentTime("not a date"), null);
});

test("enriches an ISO report from the closest hourly model value", async () => {
  let requestedUrl = null;
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async (url) => {
      requestedUrl = new URL(url);
      return Response.json(hourlyResponse());
    }
  });

  const weather = await enrich({
    observed_at: "2026-09-18T12:35:00-04:00",
    latitude: 40.03372,
    longitude: -76.50439,
    details: "This must never be sent to the provider",
    client_report_id: "private-id"
  });

  assert.equal(requestedUrl.origin, "https://api.open-meteo.com");
  assert.equal(requestedUrl.searchParams.get("latitude"), "40.03");
  assert.equal(requestedUrl.searchParams.get("longitude"), "-76.50");
  assert.equal(requestedUrl.searchParams.get("timezone"), "GMT");
  assert.equal(requestedUrl.searchParams.get("start_date"), "2026-09-18");
  assert.doesNotMatch(requestedUrl.href, /private-id|must%20never/i);
  assert.equal(weather.weather_status, "estimated");
  assert.equal(weather.weather_dataset, "forecast");
  assert.equal(weather.weather_event_time_utc, "2026-09-18T16:35:00.000Z");
  assert.equal(weather.weather_valid_time_utc, "2026-09-18T17:00:00.000Z");
  assert.equal(weather.weather_time_delta_minutes, 25);
  assert.equal(weather.weather_data.condition_label, "partly cloudy");
  assert.equal(weather.weather_data.temperature_f, 81.2);
  assert.equal(weather.weather_data.visibility_miles, 21.5);
  assert.match(weather.weather_summary, /^Estimated weather near/);
  assert.match(weather.weather_summary, /81°F/);
  assert.match(weather.weather_attribution, /Open-Meteo\.com \(CC BY 4\.0\)/);
});

test("uses incident-coordinate timezone resolution for legacy local time", async () => {
  let requestedUrl = null;
  const response = hourlyResponse({
    utc_offset_seconds: -14_400,
    timezone: "America/New_York",
    timezone_abbreviation: "EDT",
    hourly: {
      ...hourlyResponse().hourly,
      time: ["2026-09-18T12:00", "2026-09-18T13:00"]
    }
  });
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async (url) => {
      requestedUrl = new URL(url);
      return Response.json(response);
    }
  });
  const weather = await enrich({
    observed_at: "Sep 18, 2026 12:15 PM",
    latitude: 40.0337,
    longitude: -76.5044
  });

  assert.equal(requestedUrl.searchParams.get("timezone"), "auto");
  assert.equal(weather.weather_event_time_utc, "2026-09-18T16:15:00.000Z");
  assert.equal(weather.weather_valid_time_utc, "2026-09-18T16:00:00.000Z");
  assert.equal(weather.weather_time_delta_minutes, 15);
  assert.equal(weather.weather_data.provider_timezone, "America/New_York");
});

test("rejects a local wall-clock time that resolves to the future", async () => {
  const response = hourlyResponse({
    utc_offset_seconds: -14_400,
    timezone: "America/New_York",
    timezone_abbreviation: "EDT",
    hourly: {
      ...hourlyResponse().hourly,
      time: ["2026-09-18T15:00", "2026-09-18T16:00"]
    }
  });
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => Response.json(response)
  });
  const weather = await enrich({
    observed_at: "Sep 18, 2026 3:00 PM",
    latitude: 40.0337,
    longitude: -76.5044
  });
  assert.equal(weather.weather_status, "not_requested_future_time");
});

test("selects historical forecast and archive endpoints by incident date", async () => {
  const urls = [];
  const fetchImplementation = async (url) => {
    urls.push(new URL(url));
    const date = new URL(url).searchParams.get("start_date");
    const body = hourlyResponse();
    body.hourly.time = [`${date}T12:00`];
    for (const [key, values] of Object.entries(body.hourly)) {
      if (key !== "time") body.hourly[key] = [values[0]];
    }
    return Response.json(body);
  };
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation,
    cacheTtlMs: 0
  });

  const common = { latitude: 40.03, longitude: -76.5 };
  await enrich({ ...common, observed_at: "2024-01-15T12:00:00Z" });
  await enrich({ ...common, observed_at: "2020-01-15T12:00:00Z" });

  assert.equal(urls[0].origin, "https://historical-forecast-api.open-meteo.com");
  assert.equal(urls[1].origin, "https://archive-api.open-meteo.com");
  assert.doesNotMatch(urls[1].searchParams.get("hourly"), /visibility/);
});

test("skips provider calls when location or incident time is unavailable", async () => {
  let calls = 0;
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => {
      calls += 1;
      throw new Error("must not run");
    }
  });
  const noLocation = await enrich({
    observed_at: "2026-09-18T16:00:00Z",
    latitude: null,
    longitude: null
  });
  const noTime = await enrich({
    observed_at: "sometime yesterday",
    latitude: 40.03,
    longitude: -76.5
  });
  const future = await enrich({
    observed_at: "2026-09-20T16:00:00Z",
    latitude: 40.03,
    longitude: -76.5
  });

  assert.equal(calls, 0);
  assert.equal(noLocation.weather_status, "not_requested_no_location");
  assert.equal(noTime.weather_status, "not_requested_invalid_time");
  assert.equal(future.weather_status, "not_requested_future_time");
  assert.equal(noLocation.weather_provider, null);
});

test("rejects unsafe provider response shapes and oversized bodies", async () => {
  const report = {
    observed_at: "2026-09-18T16:10:00Z",
    latitude: 40.03,
    longitude: -76.5
  };
  const inconsistent = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => {
      const body = hourlyResponse();
      body.hourly.temperature_2m = [79.1];
      return Response.json(body);
    }
  });
  await assert.rejects(
    inconsistent(report),
    (error) => error.weatherCode === "provider_inconsistent_hourly_data"
  );

  const invalidJson = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => new Response("not json")
  });
  await assert.rejects(
    invalidJson(report),
    (error) => error.weatherCode === "provider_invalid_json"
  );

  const oversized = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => new Response("{}", {
      headers: { "Content-Length": String(600 * 1024) }
    })
  });
  await assert.rejects(
    oversized(report),
    (error) => error.weatherCode === "provider_response_too_large"
  );

  const httpFailure = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => Response.json(
      { reason: "details must not be retained" },
      { status: 503 }
    )
  });
  await assert.rejects(
    httpFailure(report),
    (error) =>
      error.weatherCode === "provider_http_error" && error.statusCode === 503
  );
});

test("drops out-of-range provider values instead of presenting them", async () => {
  const body = hourlyResponse();
  body.hourly.temperature_2m = [9999, 9999];
  body.hourly.relative_humidity_2m = [-1, 101];
  body.hourly.wind_speed_10m = [-4, 9999];
  body.hourly.visibility = [-1, -1];
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => Response.json(body)
  });
  const weather = await enrich({
    observed_at: "2026-09-18T16:35:00Z",
    latitude: 40.03,
    longitude: -76.5
  });
  assert.equal(weather.weather_data.temperature_f, null);
  assert.equal(weather.weather_data.relative_humidity_percent, null);
  assert.equal(weather.weather_data.wind_speed_mph, null);
  assert.equal(weather.weather_data.visibility_miles, null);
  assert.doesNotMatch(weather.weather_summary, /9999|-4 mph/);
});

test("caches a rounded place and event hour without report identifiers", async () => {
  let calls = 0;
  const enrich = createWeatherEnricher({
    now: () => new Date("2026-09-18T18:00:00Z"),
    fetchImplementation: async () => {
      calls += 1;
      return Response.json(hourlyResponse());
    }
  });
  const base = {
    observed_at: "2026-09-18T16:10:00Z",
    latitude: 40.03371,
    longitude: -76.50441
  };
  const first = await enrich({ ...base, client_report_id: "first" });
  const second = await enrich({
    ...base,
    observed_at: "2026-09-18T16:20:00Z",
    latitude: 40.03379,
    client_report_id: "second"
  });

  assert.equal(calls, 1);
  assert.equal(first.weather_time_delta_minutes, 10);
  assert.equal(second.weather_time_delta_minutes, 20);
});

test("returns safe failure metadata without copying provider details", () => {
  const error = new Error("URL with coordinates and private data");
  error.weatherCode = "provider_http_error";
  error.statusCode = 503;
  const weather = safeWeatherError(error);
  assert.equal(weather.weather_status, "unavailable");
  assert.equal(weather.weather_data.failure_code, "provider_http_error");
  assert.doesNotMatch(JSON.stringify(weather), /coordinates|private data/);
});

test("maps WMO codes and safely labels unknown values", () => {
  assert.equal(conditionLabel(0), "clear sky");
  assert.equal(conditionLabel(95), "thunderstorm");
  assert.equal(conditionLabel(12345), "unknown conditions");
});
