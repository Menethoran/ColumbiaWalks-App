const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const HISTORICAL_FORECAST_URL =
  "https://historical-forecast-api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const ATTRIBUTION =
  "Weather data by Open-Meteo.com (CC BY 4.0); nearest hourly estimate selected by ColumbiaWalks.";
const RECENT_WINDOW_DAYS = 91;
const HISTORICAL_FORECAST_START = Date.UTC(2022, 0, 1);
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_RESPONSE_BYTES = 512 * 1024;

const COMMON_HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "snowfall",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m"
];

const CONDITION_LABELS = new Map([
  [0, "clear sky"],
  [1, "mainly clear"],
  [2, "partly cloudy"],
  [3, "overcast"],
  [45, "fog"],
  [48, "depositing rime fog"],
  [51, "light drizzle"],
  [53, "moderate drizzle"],
  [55, "dense drizzle"],
  [56, "light freezing drizzle"],
  [57, "dense freezing drizzle"],
  [61, "slight rain"],
  [63, "moderate rain"],
  [65, "heavy rain"],
  [66, "light freezing rain"],
  [67, "heavy freezing rain"],
  [71, "slight snowfall"],
  [73, "moderate snowfall"],
  [75, "heavy snowfall"],
  [77, "snow grains"],
  [80, "slight rain showers"],
  [81, "moderate rain showers"],
  [82, "violent rain showers"],
  [85, "slight snow showers"],
  [86, "heavy snow showers"],
  [95, "thunderstorm"],
  [96, "thunderstorm with slight hail"],
  [99, "thunderstorm with heavy hail"]
]);

/**
 * Build one process-local weather enricher. The cache contains only a rounded
 * coordinate and an hour; it never contains report text, photo data, IDs, or
 * contact information.
 */
export function createWeatherEnricher({
  fetchImplementation = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  now = () => new Date()
} = {}) {
  const cache = new Map();

  return async function enrichReportWeather(report) {
    const requestedAt = validDate(now());
    const latitude = finiteCoordinate(report?.latitude, -90, 90);
    const longitude = finiteCoordinate(report?.longitude, -180, 180);
    if (latitude === null || longitude === null) {
      return skippedWeather(
        "not_requested_no_location",
        "Estimated weather unavailable — no confirmed incident location."
      );
    }

    const eventTime = parseIncidentTime(report?.observed_at);
    if (!eventTime) {
      return skippedWeather(
        "not_requested_invalid_time",
        "Estimated weather unavailable — the incident time could not be matched."
      );
    }
    if (isUnreasonableFutureTime(eventTime, requestedAt)) {
      return skippedWeather(
        "not_requested_future_time",
        "Estimated weather unavailable — the incident time is in the future."
      );
    }

    // Roughly one kilometre at Columbia's latitude. This is sufficient for
    // model-grid weather and avoids sending the provider a street-level pin.
    const providerLatitude = round(latitude, 2);
    const providerLongitude = round(longitude, 2);
    const dataset = chooseDataset(eventTime, requestedAt);
    const cacheKey = [
      dataset.name,
      providerLatitude.toFixed(2),
      providerLongitude.toFixed(2),
      eventTime.queryDate,
      eventTime.hourKey
    ].join(":");

    let selected = readCache(cache, cacheKey, requestedAt.getTime());
    if (!selected) {
      const url = weatherUrl({
        baseUrl: dataset.url,
        dataset: dataset.name,
        latitude: providerLatitude,
        longitude: providerLongitude,
        eventTime
      });
      const response = await fetchImplementation(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ColumbiaWalks weather enrichment"
        },
        signal: AbortSignal.timeout(normalizeTimeout(timeoutMs))
      });
      if (!response?.ok) {
        throw weatherError(
          "provider_http_error",
          Number(response?.status) || null
        );
      }
      const body = await readWeatherJson(response);
      selected = selectNearestHour(body, eventTime, dataset.name);
      writeCache(cache, cacheKey, selected, requestedAt.getTime(), cacheTtlMs);
    }

    return weatherFields(selected, eventTime, requestedAt);
  };
}

export function parseIncidentTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    const instant = new Date(text);
    if (!Number.isFinite(instant.getTime())) return null;
    return instantEventTime(instant);
  }

  const isoLocal = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (isoLocal) {
    return localEventTime({
      year: Number(isoLocal[1]),
      month: Number(isoLocal[2]),
      day: Number(isoLocal[3]),
      hour: Number(isoLocal[4]),
      minute: Number(isoLocal[5]),
      second: Number(isoLocal[6] || 0)
    });
  }

  const friendly = text.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i
  );
  if (!friendly) return null;
  const month = monthNumber(friendly[1]);
  if (!month) return null;
  let hour = Number(friendly[4]);
  if (hour < 1 || hour > 12) return null;
  if (friendly[6].toUpperCase() === "AM") hour %= 12;
  else hour = (hour % 12) + 12;
  return localEventTime({
    year: Number(friendly[3]),
    month,
    day: Number(friendly[2]),
    hour,
    minute: Number(friendly[5]),
    second: 0
  });
}

export function conditionLabel(code) {
  return CONDITION_LABELS.get(Number(code)) || "unknown conditions";
}

export function safeWeatherError(error) {
  const code = typeof error?.weatherCode === "string"
    ? error.weatherCode
    : error?.name === "TimeoutError" || error?.name === "AbortError"
      ? "provider_timeout"
      : "provider_unavailable";
  return {
    weather_status: "unavailable",
    weather_provider: "open-meteo",
    weather_dataset: null,
    weather_summary: "Estimated weather is temporarily unavailable.",
    weather_event_time_utc: null,
    weather_valid_time_utc: null,
    weather_time_delta_minutes: null,
    weather_retrieved_at_utc: new Date().toISOString(),
    weather_attribution: ATTRIBUTION,
    weather_data: {
      estimate_kind: "model_derived",
      failure_code: code
    }
  };
}

function chooseDataset(eventTime, now) {
  const approximateTime = eventTime.epochMs ?? eventTime.pseudoEpochMs;
  const ageDays = (now.getTime() - approximateTime) / 86_400_000;
  if (ageDays <= RECENT_WINDOW_DAYS) {
    return { name: "forecast", url: FORECAST_URL };
  }
  if (approximateTime >= HISTORICAL_FORECAST_START) {
    return {
      name: "historical_forecast",
      url: HISTORICAL_FORECAST_URL
    };
  }
  return { name: "historical_reanalysis", url: ARCHIVE_URL };
}

function weatherUrl({
  baseUrl,
  dataset,
  latitude,
  longitude,
  eventTime
}) {
  const fields = dataset === "historical_reanalysis"
    ? COMMON_HOURLY_FIELDS
    : [...COMMON_HOURLY_FIELDS, "visibility"];
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", latitude.toFixed(2));
  url.searchParams.set("longitude", longitude.toFixed(2));
  url.searchParams.set("hourly", fields.join(","));
  url.searchParams.set("start_date", eventTime.queryDate);
  url.searchParams.set("end_date", eventTime.queryDate);
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", eventTime.kind === "instant" ? "GMT" : "auto");
  return url.toString();
}

function selectNearestHour(body, eventTime, dataset) {
  const times = Array.isArray(body?.hourly?.time) ? body.hourly.time : [];
  if (times.length === 0) throw weatherError("provider_missing_hourly_data");
  for (const field of [...COMMON_HOURLY_FIELDS, "visibility"]) {
    const values = body?.hourly?.[field];
    if (values !== undefined && (
      !Array.isArray(values) || values.length !== times.length
    )) {
      throw weatherError("provider_inconsistent_hourly_data");
    }
  }

  const target = eventTime.kind === "instant"
    ? eventTime.epochMs
    : eventTime.pseudoEpochMs;
  let selectedIndex = -1;
  let selectedComparable = null;
  let smallestDelta = Number.POSITIVE_INFINITY;
  for (let index = 0; index < times.length; index += 1) {
    const comparable = parseProviderTime(times[index], eventTime.kind);
    if (comparable === null) continue;
    const delta = Math.abs(comparable - target);
    if (delta < smallestDelta) {
      selectedIndex = index;
      selectedComparable = comparable;
      smallestDelta = delta;
    }
  }
  if (selectedIndex < 0 || selectedComparable === null) {
    throw weatherError("provider_invalid_hourly_time");
  }

  const utcOffsetSeconds = boundedNumber(
    body?.utc_offset_seconds,
    -18 * 60 * 60,
    18 * 60 * 60
  ) ?? 0;
  const validEpochMs = eventTime.kind === "instant"
    ? selectedComparable
    : selectedComparable - utcOffsetSeconds * 1000;
  const values = {};
  for (const field of [...COMMON_HOURLY_FIELDS, "visibility"]) {
    values[field] = hourlyValue(body, field, selectedIndex);
  }
  if (values.temperature_2m === null && values.weather_code === null) {
    throw weatherError("provider_missing_condition_data");
  }

  return {
    dataset,
    validEpochMs,
    selectedComparable,
    utcOffsetSeconds,
    timezone: cleanText(body?.timezone, 80),
    timezoneAbbreviation: cleanText(body?.timezone_abbreviation, 16),
    gridLatitude: finiteNumber(body?.latitude),
    gridLongitude: finiteNumber(body?.longitude),
    gridElevationMeters: finiteNumber(body?.elevation),
    values,
    units: sanitizeUnits(body?.hourly_units)
  };
}

function weatherFields(selected, eventTime, retrievedAt) {
  const eventEpochMs = eventTime.kind === "instant"
    ? eventTime.epochMs
    : eventTime.pseudoEpochMs - selected.utcOffsetSeconds * 1000;
  if (eventEpochMs > retrievedAt.getTime() + MAX_FUTURE_SKEW_MS) {
    return skippedWeather(
      "not_requested_future_time",
      "Estimated weather unavailable — the incident time is in the future."
    );
  }
  const deltaMinutes = Math.round(
    Math.abs(selected.selectedComparable - (
      eventTime.kind === "instant" ? eventTime.epochMs : eventTime.pseudoEpochMs
    )) / 60_000
  );
  const weatherCode = boundedInteger(selected.values.weather_code, 0, 99);
  const label = conditionLabel(weatherCode);
  const visibilityMiles = visibilityInMiles(
    selected.values.visibility,
    selected.units.visibility
  );
  const data = {
    estimate_kind: "model_derived",
    condition_code: weatherCode,
    condition_label: label,
    temperature_f: boundedRoundedNumber(
      selected.values.temperature_2m,
      -150,
      150,
      1
    ),
    apparent_temperature_f: boundedRoundedNumber(
      selected.values.apparent_temperature,
      -200,
      200,
      1
    ),
    relative_humidity_percent: boundedRoundedNumber(
      selected.values.relative_humidity_2m,
      0,
      100,
      0
    ),
    precipitation_inches: boundedRoundedNumber(
      selected.values.precipitation,
      0,
      100,
      3
    ),
    snowfall: boundedRoundedNumber(selected.values.snowfall, 0, 1000, 3),
    snowfall_unit: cleanText(selected.units.snowfall, 16) || null,
    wind_speed_mph: boundedRoundedNumber(
      selected.values.wind_speed_10m,
      0,
      300,
      1
    ),
    wind_direction_degrees: boundedRoundedNumber(
      selected.values.wind_direction_10m,
      0,
      360,
      0
    ),
    wind_gust_mph: boundedRoundedNumber(
      selected.values.wind_gusts_10m,
      0,
      400,
      1
    ),
    visibility_miles: visibilityMiles,
    provider_timezone: selected.timezone || null,
    provider_timezone_abbreviation: selected.timezoneAbbreviation || null,
    provider_grid: {
      latitude: boundedRoundedNumber(selected.gridLatitude, -90, 90, 4),
      longitude: boundedRoundedNumber(selected.gridLongitude, -180, 180, 4),
      elevation_meters: boundedRoundedNumber(
        selected.gridElevationMeters,
        -500,
        10_000,
        1
      )
    },
    provider_request_precision: "coordinates rounded to 2 decimal places"
  };

  return {
    weather_status: "estimated",
    weather_provider: "open-meteo",
    weather_dataset: selected.dataset,
    weather_summary: weatherSummary(data),
    weather_event_time_utc: new Date(eventEpochMs).toISOString(),
    weather_valid_time_utc: new Date(selected.validEpochMs).toISOString(),
    weather_time_delta_minutes: deltaMinutes,
    weather_retrieved_at_utc: retrievedAt.toISOString(),
    weather_attribution: ATTRIBUTION,
    weather_data: data
  };
}

function weatherSummary(data) {
  const parts = [];
  if (data.temperature_f !== null) {
    parts.push(`${Math.round(data.temperature_f)}°F`);
  }
  if (data.apparent_temperature_f !== null) {
    parts.push(`feels like ${Math.round(data.apparent_temperature_f)}°F`);
  }
  if (data.condition_label) parts.push(data.condition_label);
  if (data.precipitation_inches !== null) {
    parts.push(`precipitation ${data.precipitation_inches.toFixed(2)} in`);
  }
  if (data.wind_speed_mph !== null) {
    const direction = cardinalDirection(data.wind_direction_degrees);
    parts.push(
      `wind ${Math.round(data.wind_speed_mph)} mph${direction ? ` ${direction}` : ""}`
    );
  }
  if (data.wind_gust_mph !== null) {
    parts.push(`gusts ${Math.round(data.wind_gust_mph)} mph`);
  }
  if (data.visibility_miles !== null) {
    parts.push(`visibility ${data.visibility_miles.toFixed(1)} mi`);
  }
  return `Estimated weather near the reported location: ${parts.join("; ")}.`;
}

function skippedWeather(status, summary) {
  return {
    weather_status: status,
    weather_provider: null,
    weather_dataset: null,
    weather_summary: summary,
    weather_event_time_utc: null,
    weather_valid_time_utc: null,
    weather_time_delta_minutes: null,
    weather_retrieved_at_utc: null,
    weather_attribution: null,
    weather_data: { estimate_kind: "not_available" }
  };
}

function instantEventTime(date) {
  const iso = date.toISOString();
  return {
    kind: "instant",
    epochMs: date.getTime(),
    queryDate: iso.slice(0, 10),
    hourKey: iso.slice(0, 13),
    components: null
  };
}

function localEventTime(components) {
  const { year, month, day, hour, minute, second } = components;
  if (
    year < 1940 || year > 2200 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) return null;
  const pseudoEpochMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(pseudoEpochMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return {
    kind: "local",
    pseudoEpochMs,
    queryDate: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
    hourKey: `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}`,
    components
  };
}

function isUnreasonableFutureTime(eventTime, now) {
  const value = eventTime.epochMs ?? eventTime.pseudoEpochMs;
  const allowance = eventTime.kind === "instant"
    ? MAX_FUTURE_SKEW_MS
    : 24 * 60 * 60 * 1000;
  return value > now.getTime() + allowance;
}

function parseProviderTime(value, kind) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }
  if (typeof value !== "string") return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) {
    const parsed = Date.parse(kind === "instant" ? value : `${value}Z`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
}

function hourlyValue(body, field, index) {
  const values = body?.hourly?.[field];
  return Array.isArray(values) ? finiteNumber(values[index]) : null;
}

function sanitizeUnits(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, unit]) =>
        /^[a-z0-9_]+$/i.test(key) && typeof unit === "string"
      )
      .map(([key, unit]) => [key, cleanText(unit, 16)])
  );
}

function visibilityInMiles(value, unit) {
  const number = boundedNumber(value, 0, 10_000_000);
  if (number === null) return null;
  const normalizedUnit = String(unit || "m").toLowerCase();
  if (["mi", "mile", "miles"].includes(normalizedUnit)) {
    return round(number, 1);
  }
  if (["ft", "feet"].includes(normalizedUnit)) {
    return round(number / 5280, 1);
  }
  return round(number / 1609.344, 1);
}

function cardinalDirection(value) {
  const degrees = finiteNumber(value);
  if (degrees === null) return "";
  const names = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  return names[Math.round(normalized / 22.5) % 16];
}

function monthNumber(value) {
  const key = String(value || "").slice(0, 3).toLowerCase();
  return {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12
  }[key] || null;
}

function finiteCoordinate(value, minimum, maximum) {
  const number = finiteNumber(value);
  return number !== null && number >= minimum && number <= maximum
    ? number
    : null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedInteger(value, minimum, maximum) {
  const number = boundedNumber(value, minimum, maximum);
  return number === null ? null : Math.round(number);
}

function boundedNumber(value, minimum, maximum) {
  const number = finiteNumber(value);
  return number !== null && number >= minimum && number <= maximum
    ? number
    : null;
}

function roundedNumber(value, places) {
  const number = finiteNumber(value);
  return number === null ? null : round(number, places);
}

function boundedRoundedNumber(value, minimum, maximum, places) {
  const number = boundedNumber(value, minimum, maximum);
  return number === null ? null : round(number, places);
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function cleanText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeTimeout(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 250 && number <= 10_000
    ? Math.round(number)
    : DEFAULT_TIMEOUT_MS;
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function weatherError(code, statusCode = null) {
  const error = new Error(code);
  error.name = "WeatherLookupError";
  error.weatherCode = code;
  if (statusCode !== null) error.statusCode = statusCode;
  return error;
}

async function readWeatherJson(response) {
  const declaredLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw weatherError("provider_response_too_large");
  }
  let text;
  try {
    text = await response.text();
  } catch {
    throw weatherError("provider_read_error");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw weatherError("provider_response_too_large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw weatherError("provider_invalid_json");
  }
}

function readCache(cache, key, nowMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(cache, key, value, nowMs, ttlMs) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const normalizedTtl = Number.isFinite(Number(ttlMs)) && Number(ttlMs) >= 0
    ? Number(ttlMs)
    : DEFAULT_CACHE_TTL_MS;
  cache.set(key, { value, expiresAt: nowMs + normalizedTtl });
}

export const weatherAttribution = ATTRIBUTION;
