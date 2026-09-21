const fs = require("node:fs");
const sqlite3 = require(
  "/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3",
);

const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055")
  .replace(/\/+$/, "");
const adminToken = process.env.ADMIN_TOKEN || "";
const policyId =
  process.env.INTAKE_POLICY_ID || "e162db29-a9fe-4835-8503-771b55fac178";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath = process.env.BACKUP_PATH ||
  "/directus/database/data.db.bak-pre-continuous-reporting-20260824";
const collection = "safety_reports";

const rapidReportChoices = [
  ["Sidewalk issue", "sidewalk"],
  ["Vehicle issue", "vehicle"],
  ["Crosswalk issue", "crosswalk"],
  ["Trip hazard", "trip_hazard"],
  ["Lighting / visibility", "lighting_or_visibility"],
  ["Accessibility / ADA", "accessibility_ada"],
  ["School route", "school_route"],
  ["Police response", "police_response"],
  ["Other", "other"],
];
const sidewalkLipChoices = [
  ["1/4 inch or less", "quarter_inch_or_less"],
  ["More than 1/4 inch", "over_quarter_inch"],
  ["More than 1/2 inch", "over_half_inch"],
  ["More than 1 inch", "over_one_inch"],
  ["In excess of 2 inches", "over_two_inches"],
];
const vehicleIssueChoices = [
  ["Aggressive driving", "aggressive_driving"],
  ["Crosswalk incursion", "crosswalk_incursion"],
  ["Illegal U-turn", "illegal_u_turn"],
  ["Speeding", "speeding"],
  ["Failure to yield", "failure_to_yield"],
  ["Red-light violation", "red_light_violation"],
  ["Stop-sign violation", "stop_sign_violation"],
  ["Blocked crosswalk or sidewalk", "blocked_crosswalk_or_sidewalk"],
  ["Illegal parking", "illegal_parking"],
  ["Distracted driving", "distracted_driving"],
  ["Other", "other"],
];
const locationSourceChoices = [
  ["No location", "none"],
  ["Photo EXIF GPS", "photo_exif"],
  ["Device GPS", "device_gps"],
  ["Manual map pin", "manual_map"],
  ["Manual coordinates", "manual_coordinates"],
  ["Legacy / source not recorded", "legacy"],
];

function choices(values) {
  return values.map(([text, value]) => ({ text, value }));
}

function selectField(field, values, note) {
  return {
    field,
    type: "string",
    schema: { is_nullable: true, max_length: 64 },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      note,
      options: { allowNone: true, choices: choices(values) },
    },
  };
}

const fields = [
  selectField(
    "rapid_report_kind",
    rapidReportChoices,
    "Continuous-report hierarchy selected by the reporter.",
  ),
  selectField(
    "sidewalk_lip_height",
    sidewalkLipChoices,
    "Optional reporter-selected sidewalk lip-height threshold.",
  ),
  selectField(
    "vehicle_issue_type",
    vehicleIssueChoices,
    "Optional reporter-selected vehicle issue.",
  ),
  {
    field: "continuous_session_id",
    type: "uuid",
    schema: { is_nullable: true },
    meta: {
      interface: "input",
      readonly: true,
      note: "Random session UUID grouping rapid reports; not a device identifier.",
    },
  },
  {
    field: "continuous_sequence",
    type: "integer",
    schema: { is_nullable: true },
    meta: {
      interface: "input",
      readonly: true,
      note: "One-based report order within the continuous session.",
      validation: { _gte: 1 },
    },
  },
  {
    field: "location_source",
    type: "string",
    schema: {
      is_nullable: false,
      default_value: "legacy",
      max_length: 32,
    },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      required: true,
      note: "How the final report coordinates were selected.",
      options: { choices: choices(locationSourceChoices) },
    },
  },
  ...[
    ["photo_latitude", "Original latitude read from photo EXIF metadata."],
    ["photo_longitude", "Original longitude read from photo EXIF metadata."],
  ].map(([field, note]) => ({
    field,
    type: "float",
    schema: { is_nullable: true },
    meta: { interface: "input", readonly: true, note },
  })),
  {
    field: "location_overridden",
    type: "boolean",
    schema: { is_nullable: false, default_value: false },
    meta: {
      interface: "boolean",
      readonly: true,
      required: true,
      note:
        "True when photo or device coordinates were intentionally replaced.",
    },
  },
];

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
    database.run(sql, (error) => error ? reject(error) : resolve());
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

async function assertAdministrator() {
  const identity = await request(
    "GET",
    "/users/me?fields=id,email,role.policies.*.*,policies.*.*",
  );
  const role = identity.data?.role;
  const policyAdmin = [
    ...(Array.isArray(role?.policies) ? role.policies : []),
    ...(Array.isArray(identity.data?.policies) ? identity.data.policies : []),
  ].some((entry) => (entry?.policy ?? entry)?.admin_access);
  if (!role?.admin_access && !policyAdmin) {
    throw new Error("The migration session is not a Directus administrator.");
  }
  return identity.data?.email || identity.data?.id;
}

async function ensureField(definition) {
  const current = await rawRequest(
    "GET",
    `/fields/${collection}/${definition.field}`,
  );
  const update = { schema: definition.schema, meta: definition.meta };
  if (current.response.status === 200) {
    await request(
      "PATCH",
      `/fields/${collection}/${definition.field}`,
      update,
    );
    return "updated";
  }
  if (![403, 404].includes(current.response.status)) {
    throw new Error(
      `Could not inspect ${definition.field}: HTTP ${current.response.status}.`,
    );
  }
  await request("POST", `/fields/${collection}`, definition);
  return "created";
}

function permissionFieldList(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value;
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

async function ensureIntakeCreatePermission() {
  const query = new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": "create",
    fields: "id,fields",
    limit: "1",
  });
  const result = await request("GET", `/permissions?${query}`);
  const permission = result.data?.[0];
  if (!permission) {
    throw new Error(
      "The intake policy has no safety_reports create permission; refusing to create a broader permission automatically.",
    );
  }
  const currentFields = permissionFieldList(permission.fields);
  if (currentFields === null || currentFields.includes("*")) {
    return { id: permission.id, changed: false, fields: currentFields };
  }
  const expanded = [...new Set([
    ...currentFields,
    ...fields.map(({ field }) => field),
  ])];
  await request("PATCH", `/permissions/${encodeURIComponent(permission.id)}`, {
    fields: expanded,
  });
  return { id: permission.id, changed: true, fields: expanded };
}

async function backfillLocationProvenance() {
  const query = new URLSearchParams({
    fields: "id,latitude,longitude,location_source,location_overridden",
    limit: "-1",
  });
  const result = await request("GET", `/items/${collection}?${query}`);
  const reports = Array.isArray(result.data) ? result.data : [];
  let updated = 0;
  for (const report of reports) {
    const hasCoordinates =
      report.latitude !== null &&
      report.latitude !== undefined &&
      report.longitude !== null &&
      report.longitude !== undefined &&
      Number.isFinite(Number(report.latitude)) &&
      Number.isFinite(Number(report.longitude));
    const expectedSource = hasCoordinates ? "legacy" : "none";
    const update = {};
    if (!report.location_source || report.location_source === "legacy") {
      if (report.location_source !== expectedSource) {
        update.location_source = expectedSource;
      }
    }
    if (report.location_overridden === null) {
      update.location_overridden = false;
    }
    if (Object.keys(update).length === 0) continue;
    await request(
      "PATCH",
      `/items/${collection}/${encodeURIComponent(report.id)}`,
      update,
    );
    updated += 1;
  }
  return { total: reports.length, updated };
}

(async () => {
  if (!adminToken) {
    throw new Error("Set ADMIN_TOKEN to a short-lived Directus administrator token.");
  }
  const administrator = await assertAdministrator();
  const collectionResult = await request("GET", `/collections/${collection}`);
  if (collectionResult.data?.collection !== collection) {
    throw new Error(`Directus collection ${collection} is unavailable.`);
  }
  await createAndVerifyBackup();

  const fieldStatus = {};
  for (const definition of fields) {
    fieldStatus[definition.field] = await ensureField(definition);
  }
  const permission = await ensureIntakeCreatePermission();
  const backfill = await backfillLocationProvenance();

  const verification = await request("GET", `/fields/${collection}`);
  const verifiedFields = new Set(
    (verification.data || []).map(({ field }) => field),
  );
  const missingFields = fields
    .map(({ field }) => field)
    .filter((field) => !verifiedFields.has(field));
  if (missingFields.length) {
    throw new Error(
      `Migration verification is missing fields: ${missingFields.join(", ")}.`,
    );
  }

  console.log(JSON.stringify({
    administrator,
    collection,
    backup: backupPath,
    fields: fieldStatus,
    intake_permission: permission,
    reports: backfill,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
