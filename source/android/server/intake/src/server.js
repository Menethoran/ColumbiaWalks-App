import { readFileSync } from "node:fs";

import { buildApp } from "./app.js";
import { createGmailApiClient } from "./gmail-api.js";
import { normalizeOfficialEmailConfig } from "./official-email-policy.js";
import { createOfficialEmailStore } from "./official-email-store.js";
import {
  createOfficialEmailWorker,
  scheduleOfficialEmailWorker
} from "./official-email-worker.js";
import { scheduleWallpaperRefresh } from "./publication.js";

function loadToken() {
  if (process.env.DIRECTUS_TOKEN) {
    return process.env.DIRECTUS_TOKEN.trim();
  }
  const tokenFile =
    process.env.DIRECTUS_TOKEN_FILE || "/run/secrets/directus_token";
  return readFileSync(tokenFile, "utf8").trim();
}

const directusUrl = process.env.DIRECTUS_URL || "http://directus:8055";
const directusToken = loadToken();
const wallpaperPath = process.env.WALLPAPER_PATH ||
  "/app/generated/page-of-shame-wallpaper.jpg";
const officialEmailConfig = normalizeOfficialEmailConfig({
  mode: process.env.OFFICIAL_EMAIL_MODE,
  destinationMode: process.env.OFFICIAL_EMAIL_DESTINATION_MODE,
  sender: process.env.OFFICIAL_EMAIL_SENDER,
  testRecipient: process.env.OFFICIAL_EMAIL_TEST_RECIPIENT,
  policeChiefEmail: process.env.OFFICIAL_EMAIL_POLICE_CHIEF,
  mayorEmail: process.env.OFFICIAL_EMAIL_MAYOR,
  codesEmail: process.env.OFFICIAL_EMAIL_CODES,
  dailyRecipientCap: process.env.OFFICIAL_EMAIL_DAILY_CAP,
  maxAttempts: process.env.OFFICIAL_EMAIL_MAX_ATTEMPTS,
  workerIntervalMs: process.env.OFFICIAL_EMAIL_WORKER_INTERVAL_MS,
  leaseMs: process.env.OFFICIAL_EMAIL_LEASE_MS
});
const officialEmailStore = createOfficialEmailStore({
  directusUrl,
  directusToken,
  config: officialEmailConfig
});
const gmail = officialEmailConfig.mode === "automatic"
  ? createGmailApiClient({
    clientId: loadRequiredSecret(
      process.env.GMAIL_OAUTH_CLIENT_ID_FILE,
      "GMAIL_OAUTH_CLIENT_ID_FILE"
    ),
    clientSecret: loadRequiredSecret(
      process.env.GMAIL_OAUTH_CLIENT_SECRET_FILE,
      "GMAIL_OAUTH_CLIENT_SECRET_FILE"
    ),
    refreshToken: loadRequiredSecret(
      process.env.GMAIL_OAUTH_REFRESH_TOKEN_FILE,
      "GMAIL_OAUTH_REFRESH_TOKEN_FILE"
    ),
    accountEmail: officialEmailConfig.sender
  })
  : null;

const app = await buildApp({
  directusUrl,
  directusToken,
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES || 6 * 1024 * 1024),
  overpassUrl:
    process.env.OVERPASS_URL ||
    "https://overpass-api.de/api/interpreter",
  weatherEnabled: process.env.WEATHER_ENRICHMENT_ENABLED !== "false",
  weatherTimeoutMs: Number(process.env.WEATHER_TIMEOUT_MS || 3000),
  wallpaperPath,
  officialEmailQueue: officialEmailStore,
  logger: true
});

const stopWallpaperSchedule = scheduleWallpaperRefresh({
  directusUrl,
  directusToken,
  wallpaperPath,
  timezone: process.env.WALLPAPER_TIMEZONE || "America/New_York",
  refreshIntervalMs: Number(
    process.env.WALLPAPER_REFRESH_MS || 5 * 60 * 1000
  ),
  logger: app.log
});
const officialEmailWorker = createOfficialEmailWorker({
  store: officialEmailStore,
  gmail,
  config: officialEmailConfig,
  logger: app.log
});
const stopOfficialEmailSchedule = officialEmailConfig.mode === "disabled"
  ? () => {}
  : scheduleOfficialEmailWorker({
    worker: officialEmailWorker,
    intervalMs: officialEmailConfig.workerIntervalMs,
    logger: app.log
  });

app.addHook("onClose", async () => {
  stopWallpaperSchedule();
  stopOfficialEmailSchedule();
});

await app.listen({
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 8080)
});

function loadRequiredSecret(path, settingName) {
  if (!path) {
    throw new Error(`${settingName} is required in automatic email mode.`);
  }
  const value = readFileSync(path, "utf8").trim();
  if (!value) throw new Error(`${settingName} points to an empty secret.`);
  return value;
}
