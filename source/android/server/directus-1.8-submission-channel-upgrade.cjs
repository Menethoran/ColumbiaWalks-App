const fs = require("node:fs");
const sqlite3 = require(
  "/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3",
);

const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055")
  .replace(/\/$/, "");
const adminToken = process.env.ADMIN_TOKEN || "";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath = process.env.BACKUP_PATH ||
  "/directus/database/data.db.bak-pre-submission-channel-20260821";
const collection = "safety_reports";
const field = "submission_channel";

function openDatabase(path, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(path, mode, (error) => {
      if (error) reject(error);
      else resolve(database);
    });
  });
}

function databaseAll(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function databaseRun(database, sql) {
  return new Promise((resolve, reject) => {
    database.run(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function closeDatabase(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => error ? reject(error) : resolve());
  });
}

async function createAndVerifyBackup() {
  if (!fs.existsSync(backupPath)) {
    const database = await openDatabase(databasePath, sqlite3.OPEN_READWRITE);
    database.configure("busyTimeout", 30000);
    try {
      const escaped = backupPath.replaceAll("'", "''");
      await databaseRun(database, `VACUUM INTO '${escaped}'`);
    } finally {
      await closeDatabase(database);
    }
  }
  const backup = await openDatabase(backupPath, sqlite3.OPEN_READONLY);
  try {
    const rows = await databaseAll(backup, "PRAGMA quick_check");
    if (rows.length !== 1 || rows[0].quick_check !== "ok") {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(rows)}`);
    }
  } finally {
    await closeDatabase(backup);
  }
}

async function rawRequest(method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function request(method, path, body) {
  const result = await rawRequest(method, path, body);
  if (!result.response.ok) {
    throw new Error(
      `${method} ${path} failed with HTTP ${result.response.status}: ` +
      JSON.stringify(result.payload),
    );
  }
  return result.payload;
}

async function ensureField() {
  const choices = [
    ["iPhone app", "iphone_app"],
    ["iPhone web", "iphone_web"],
    ["Desktop web", "desktop_web"],
    ["Android web", "android_web"],
    ["Android app", "android_app"],
    ["Web — device not recorded", "web_unknown"],
    ["Legacy / unknown", "unknown"],
  ].map(([text, value]) => ({ text, value }));
  const definition = {
    field,
    type: "string",
    schema: { is_nullable: true, max_length: 32 },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      note: "Server-classified app or web channel; contains no device identifier.",
      options: { choices },
    },
  };
  const fields = await request("GET", `/fields/${collection}`);
  const exists = (fields.data || []).some((item) => item.field === field);
  if (exists) {
    await request("PATCH", `/fields/${collection}/${field}`, {
      schema: definition.schema,
      meta: definition.meta,
    });
    return "updated";
  }
  await request("POST", `/fields/${collection}`, definition);
  return "created";
}

function legacyChannel(appVersion) {
  const version = String(appVersion || "").trim().toLowerCase();
  if (!version || version.includes("unknown")) return "unknown";
  if (version.startsWith("web-") || version.startsWith("wordpress-")) {
    return "web_unknown";
  }
  return "android_app";
}

async function backfillReports() {
  const query = new URLSearchParams({
    fields: `id,app_version,${field}`,
    limit: "-1",
  });
  const reports = await request("GET", `/items/${collection}?${query}`);
  let updated = 0;
  for (const report of reports.data || []) {
    if (report[field]) continue;
    await request(
      "PATCH",
      `/items/${collection}/${encodeURIComponent(report.id)}`,
      { [field]: legacyChannel(report.app_version) },
    );
    updated += 1;
  }
  return { total: reports.data?.length || 0, updated };
}

(async () => {
  if (!adminToken) throw new Error("ADMIN_TOKEN is not configured.");
  const identity = await request(
    "GET",
    "/users/me?fields=id,role.policies.policy.admin_access",
  );
  if (!identity.data?.role?.policies?.some(({ policy }) => policy?.admin_access)) {
    throw new Error("The migration session is not a Directus administrator.");
  }
  await createAndVerifyBackup();
  const fieldStatus = await ensureField();
  const backfill = await backfillReports();
  console.log(JSON.stringify({
    collection,
    field,
    field_status: fieldStatus,
    backup: backupPath,
    reports: backfill,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

