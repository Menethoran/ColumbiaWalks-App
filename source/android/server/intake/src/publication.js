import { mkdir, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const PUBLIC_FIELDS = [
  "id",
  "date_created",
  "observed_at",
  "categories",
  "severity",
  "submission_mode",
  "nearest_intersection",
  "vehicle_details",
  "public_caption",
  "public_location_label",
  "public_plate_override",
  "publish_full_plate",
  "public_photo",
  "weather_status",
  "weather_summary",
  "weather_valid_time_utc",
  "weather_attribution",
  "published_at"
].join(",");

const HEATMAP_FIELDS = "latitude,longitude,categories";
const DEFAULT_WALLPAPER_PATH =
  "/app/generated/page-of-shame-wallpaper.jpg";

export function registerPublicRoutes(app, options) {
  const {
    directusUrl,
    directusToken,
    fetchImplementation,
    wallpaperPath = DEFAULT_WALLPAPER_PATH
  } = options;

  app.get("/columbiawalks-api/public/incidents", async (request, reply) => {
    const requested = Number(request.query?.limit || 24);
    const limit = Math.min(48, Math.max(1, Number.isFinite(requested)
      ? Math.floor(requested)
      : 24));
    try {
      const incidents = await fetchPublishedIncidents({
        directusUrl,
        directusToken,
        fetchImplementation,
        limit
      });
      return publicReply(reply).send({
        data: incidents,
        disclaimer:
          "These are unverified community submissions, not findings of guilt or legal violations. Weather is a model-derived estimate near the report location, not a street-level instrument reading. Page of Shame photos appear only after administrator approval and may be removed after review."
      });
    } catch (error) {
      request.log.error({ error }, "Could not load the public incident feed");
      return reply.code(502).send({
        error: "The public incident feed is temporarily unavailable."
      });
    }
  });

  app.get("/columbiawalks-api/public/heatmap", async (request, reply) => {
    try {
      const points = await fetchHeatmap({
        directusUrl,
        directusToken,
        fetchImplementation
      });
      return publicReply(reply).send({
        data: points,
        precision: "approximately 100 metres",
        disclaimer:
          "Locations are deliberately grouped and rounded; exact report coordinates are not published."
      });
    } catch (error) {
      request.log.error({ error }, "Could not load the public heat map");
      return reply.code(502).send({
        error: "The incident heat map is temporarily unavailable."
      });
    }
  });

  app.get("/columbiawalks-api/public/media/:fileId", async (request, reply) => {
    const fileId = String(request.params?.fileId || "");
    if (!/^[0-9a-f-]{16,64}$/i.test(fileId)) {
      return reply.code(404).send({ error: "Media not found." });
    }
    try {
      const allowed = await publishedPhotoExists({
        directusUrl,
        directusToken,
        fetchImplementation,
        fileId
      });
      if (!allowed) {
        return reply.code(404).send({ error: "Media not found." });
      }
      const response = await fetchImplementation(
        `${directusUrl}/assets/${encodeURIComponent(fileId)}?fit=cover&width=1200&height=800&quality=82`,
        { headers: directusHeaders(directusToken) }
      );
      if (!response.ok) {
        return reply.code(404).send({ error: "Media not found." });
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return reply
        .header("Cache-Control", "public, max-age=3600")
        .type(response.headers.get("content-type") || "image/jpeg")
        .send(bytes);
    } catch (error) {
      request.log.error({ error }, "Could not proxy public report media");
      return reply.code(502).send({ error: "Media is temporarily unavailable." });
    }
  });

  app.get("/columbiawalks-api/public/wallpaper", async (request, reply) => {
    try {
      const bytes = await readFile(wallpaperPath);
      return reply
        .header("Cache-Control", "public, max-age=300")
        .type("image/jpeg")
        .send(bytes);
    } catch {
      return reply.code(404).send({
        error: "The Page of Shame photo wallpaper has not been generated yet."
      });
    }
  });
}

export async function fetchPublishedIncidents({
  directusUrl,
  directusToken,
  fetchImplementation = fetch,
  limit = 24
}) {
  const query = new URLSearchParams();
  query.set("filter[publication_status][_eq]", "published");
  query.set("fields", PUBLIC_FIELDS);
  query.set("sort", "-published_at,-date_created");
  query.set("limit", String(limit));
  const body = await requestJson(
    `${directusUrl}/items/safety_reports?${query}`,
    directusToken,
    fetchImplementation
  );
  return Array.isArray(body.data)
    ? prioritizePublishedIncidents(body.data.map(sanitizePublicIncident))
    : [];
}

export async function fetchHeatmap({
  directusUrl,
  directusToken,
  fetchImplementation = fetch
}) {
  const query = new URLSearchParams();
  query.set("filter[heatmap_eligible][_eq]", "true");
  query.set("filter[latitude][_nnull]", "true");
  query.set("filter[longitude][_nnull]", "true");
  query.set("fields", HEATMAP_FIELDS);
  query.set("limit", "-1");
  const body = await requestJson(
    `${directusUrl}/items/safety_reports?${query}`,
    directusToken,
    fetchImplementation
  );
  return aggregateHeatmap(Array.isArray(body.data) ? body.data : []);
}

export function sanitizePublicIncident(record) {
  const vehicle = record?.vehicle_details &&
    typeof record.vehicle_details === "object"
    ? record.vehicle_details
    : {};
  const plate = cleanText(record?.public_plate_override || vehicle.license_plate);
  const state = cleanText(vehicle.plate_state).slice(0, 4).toUpperCase();
  const publicPhoto = normalizeFileId(record?.public_photo);
  const categories = Array.isArray(record?.categories)
    ? record.categories.filter((value) => typeof value === "string").slice(0, 10)
    : [];
  const intersection = record?.nearest_intersection &&
    typeof record.nearest_intersection === "object"
    ? cleanText(record.nearest_intersection.label)
    : "";
  const hasEstimatedWeather = record?.weather_status === "estimated";

  return {
    id: String(record?.id || ""),
    reported_at: record?.published_at || record?.date_created || null,
    observed_at: cleanText(record?.observed_at).slice(0, 100),
    categories,
    severity: ["low", "medium", "high"].includes(record?.severity)
      ? record.severity
      : "low",
    submission_mode: normalizeSubmissionMode(record?.submission_mode),
    caption: cleanText(record?.public_caption).slice(0, 500),
    location_label: cleanText(
      record?.public_location_label || intersection
    ).slice(0, 200),
    plate: plate
      ? formatPlate(state, plate, Boolean(record?.publish_full_plate))
      : "",
    photo_url: publicPhoto
      ? `/columbiawalks-api/public/media/${encodeURIComponent(publicPhoto)}`
      : null,
    weather: hasEstimatedWeather
      ? {
        status: "estimated",
        summary: cleanText(record?.weather_summary).slice(0, 500),
        valid_at: normalizeIsoTimestamp(record?.weather_valid_time_utc),
        attribution: cleanText(record?.weather_attribution).slice(0, 250)
      }
      : null
  };
}

export function prioritizePublishedIncidents(incidents) {
  const rank = { pos: 0, quick: 1, full: 2 };
  return [...incidents].sort((left, right) => {
    const modeDifference =
      (rank[left?.submission_mode] ?? 3) -
      (rank[right?.submission_mode] ?? 3);
    if (modeDifference !== 0) return modeDifference;
    return String(right?.reported_at || "").localeCompare(
      String(left?.reported_at || "")
    );
  });
}

export function selectWallpaperIncidents(
  incidents,
  { limit = 16, rotationSeed = "" } = {}
) {
  const pageOfShamePhotos = prioritizePublishedIncidents(incidents)
    .filter((incident) =>
      incident?.submission_mode === "pos" && incident?.photo_url
    );
  if (pageOfShamePhotos.length === 0) return [];

  const start = hashText(`${rotationSeed}:pos`) % pageOfShamePhotos.length;
  return pageOfShamePhotos
    .slice(start)
    .concat(pageOfShamePhotos.slice(0, start))
    .slice(0, limit);
}

export function aggregateHeatmap(records) {
  const cells = new Map();
  for (const record of records) {
    const latitude = Number(record?.latitude);
    const longitude = Number(record?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const roundedLatitude = Number(latitude.toFixed(3));
    const roundedLongitude = Number(longitude.toFixed(3));
    const key = `${roundedLatitude},${roundedLongitude}`;
    const cell = cells.get(key) || {
      latitude: roundedLatitude,
      longitude: roundedLongitude,
      count: 0,
      categories: {}
    };
    cell.count += 1;
    for (const category of Array.isArray(record.categories)
      ? record.categories
      : []) {
      if (typeof category === "string") {
        cell.categories[category] = (cell.categories[category] || 0) + 1;
      }
    }
    cells.set(key, cell);
  }
  return [...cells.values()].sort((left, right) => right.count - left.count);
}

export function formatPlate(state, plate, showFull) {
  const normalized = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!normalized) {
    return "";
  }
  const visible = showFull
    ? normalized
    : normalized.length <= 4
      ? `${normalized.slice(0, 1)}${"•".repeat(Math.max(2, normalized.length - 1))}`
      : `${normalized.slice(0, 2)}${"•".repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-2)}`;
  return `${state || "PLATE"} · ${visible}`;
}

export async function generateWallpaper({
  directusUrl,
  directusToken,
  fetchImplementation = fetch,
  wallpaperPath = DEFAULT_WALLPAPER_PATH,
  logger = console,
  incidents: suppliedIncidents = null,
  rotationSeed = localDateKey(new Date(), "America/New_York"),
  photoLimit = 16
}) {
  const incidents = suppliedIncidents || await fetchPublishedIncidents({
      directusUrl,
      directusToken,
      fetchImplementation,
      limit: -1
    });
  const photoIds = selectWallpaperIncidents(incidents, {
    limit: photoLimit,
    rotationSeed
  })
    .map((incident) => incident.photo_url?.split("/").pop())
    .filter(Boolean);
  if (photoIds.length === 0) {
    return { generated: false, photos: 0 };
  }

  const tiles = [];
  for (const fileId of photoIds) {
    try {
      const response = await fetchImplementation(
        `${directusUrl}/assets/${encodeURIComponent(fileId)}?fit=cover&width=640&height=420&quality=78`,
        { headers: directusHeaders(directusToken) }
      );
      if (!response.ok) {
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      tiles.push(await sharp(bytes, { failOn: "error" })
        .rotate()
        .resize(480, 360, { fit: "cover" })
        .jpeg({ quality: 76, mozjpeg: true })
        .toBuffer());
    } catch (error) {
      logger.warn?.({ error, fileId }, "Skipped an unreadable public photo");
    }
  }
  if (tiles.length === 0) {
    return { generated: false, photos: 0 };
  }

  const width = 1920;
  const height = 1080;
  const columns = Math.max(1, Math.ceil(Math.sqrt(tiles.length * 16 / 9)));
  const rows = Math.max(1, Math.ceil(tiles.length / columns));
  const tileWidth = Math.ceil(width / columns);
  const tileHeight = Math.ceil(height / rows);
  const composites = [];
  for (let index = 0; index < tiles.length; index += 1) {
    composites.push({
      input: await sharp(tiles[index])
        .resize(tileWidth, tileHeight, { fit: "cover" })
        .jpeg({ quality: 74, mozjpeg: true })
        .toBuffer(),
      left: (index % columns) * tileWidth,
      top: Math.floor(index / columns) * tileHeight
    });
  }
  composites.push({
    input: Buffer.from(
      `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#071e2b" fill-opacity="0.62"/></svg>`
    ),
    left: 0,
    top: 0
  });

  await mkdir(path.dirname(wallpaperPath), { recursive: true });
  const temporaryPath = `${wallpaperPath}.${process.pid}.tmp`;
  try {
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#071e2b"
      }
    })
      .composite(composites)
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(temporaryPath);
    await rename(temporaryPath, wallpaperPath);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
  return { generated: true, photos: tiles.length };
}

export function scheduleWallpaperRefresh(options) {
  let lastFingerprint = "";
  let lastRotationDate = "";
  let stopped = false;
  let timer = null;
  const timezone = options.timezone || "America/New_York";
  const refreshIntervalMs = Math.max(
    60_000,
    Number(options.refreshIntervalMs || 5 * 60_000)
  );

  const tick = async () => {
    if (stopped) return;
    try {
      const incidents = await fetchPublishedIncidents({
        directusUrl: options.directusUrl,
        directusToken: options.directusToken,
        fetchImplementation: options.fetchImplementation,
        limit: -1
      });
      const fingerprint = incidents
        .filter((incident) =>
          incident.submission_mode === "pos" && incident.photo_url
        )
        .map((incident) => [
          incident.id,
          incident.submission_mode,
          incident.photo_url,
          incident.reported_at
        ].join(":"))
        .join("|");
      const rotationDate = localDateKey(new Date(), timezone);
      if (
        fingerprint !== lastFingerprint ||
        rotationDate !== lastRotationDate
      ) {
        const result = await generateWallpaper({
          ...options,
          incidents,
          rotationSeed: rotationDate
        });
        if (result.generated) {
          lastFingerprint = fingerprint;
          lastRotationDate = rotationDate;
        }
      }
    } catch (error) {
      options.logger?.error?.(
        { error },
        "Page of Shame wallpaper refresh failed"
      );
    }
    timer = setTimeout(tick, refreshIntervalMs);
    timer.unref?.();
  };

  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export const scheduleMidnightWallpaper = scheduleWallpaperRefresh;

async function publishedPhotoExists({
  directusUrl,
  directusToken,
  fetchImplementation,
  fileId
}) {
  const query = new URLSearchParams();
  query.set("filter[publication_status][_eq]", "published");
  query.set("filter[public_photo][_eq]", fileId);
  query.set("fields", "id");
  query.set("limit", "1");
  const body = await requestJson(
    `${directusUrl}/items/safety_reports?${query}`,
    directusToken,
    fetchImplementation
  );
  return Array.isArray(body.data) && body.data.length > 0;
}

function normalizeFileId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
}

function normalizeSubmissionMode(value) {
  return ["pos", "quick", "full"].includes(value) ? value : "full";
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localDateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIsoTimestamp(value) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function publicReply(reply) {
  return reply
    .header("Access-Control-Allow-Origin", "*")
    .header("Cache-Control", "public, max-age=120");
}

function directusHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
}

async function requestJson(url, token, fetchImplementation) {
  const response = await fetchImplementation(url, {
    headers: directusHeaders(token)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Directus request failed with HTTP ${response.status}.`);
    error.statusCode = response.status;
    error.response = body;
    throw error;
  }
  return body;
}
