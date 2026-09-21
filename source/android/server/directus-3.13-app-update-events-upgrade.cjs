const fs = require("node:fs");
const sqlite3 = require(
  "/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3",
);

const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055")
  .replace(/\/$/, "");
let adminToken = process.env.ADMIN_TOKEN || "";
const policyId =
  process.env.INTAKE_POLICY_ID || "e162db29-a9fe-4835-8503-771b55fac178";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath = process.env.BACKUP_PATH ||
  "/directus/database/data.db.bak-pre-app-update-events-20260819";
const collection = "app_update_events";

function openDatabase(path, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(path, mode, (error) => {
      if (error) reject(error);
      else resolve(database);
    });
  });
}

function databaseGet(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parameters, (error, row) => {
      if (error) reject(error);
      else resolve(row);
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

async function collectionExistsInDatabase() {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READONLY);
  try {
    return Boolean(await databaseGet(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [collection],
    ));
  } finally {
    await closeDatabase(database);
  }
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

async function authenticateAdmin() {
  if (adminToken) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Directus administrator credentials are not configured.");
  }
  const response = await fetch(baseUrl + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, mode: "json" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.data?.access_token) {
    throw new Error(`Directus administrator login failed with HTTP ${response.status}.`);
  }
  adminToken = payload.data.access_token;
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
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
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

async function ensureCollection(existedBeforeMigration) {
  const current = await rawRequest("GET", `/collections/${collection}`);
  if (current.response.status === 200) return;
  if (existedBeforeMigration || ![403, 404].includes(current.response.status)) {
    throw new Error(`Could not safely inspect ${collection}.`);
  }
  await request("POST", "/collections", {
    collection,
    meta: {
      icon: "system_update_alt",
      note:
        "Private anonymous Android update lifecycle events. Contains no device, contact, or location identifiers.",
      display_template: "{{event_type}} — {{from_version_name}} → {{target_version_name}}",
    },
    schema: {},
    fields: [{
      field: "id",
      type: "integer",
      meta: { hidden: true, interface: "input", readonly: true },
      schema: { is_primary_key: true, has_auto_increment: true },
    }],
  });
}

const eventChoices = [
  "up_to_date",
  "check_failed",
  "update_available",
  "update_deferred",
  "download_started",
  "download_verified",
  "download_failed",
  "install_permission_denied",
  "installer_opened",
  "install_failed",
  "installed",
];
const fields = [
  {
    field: "event_id",
    type: "uuid",
    schema: { is_nullable: false, is_unique: true },
    meta: {
      interface: "input",
      required: true,
      readonly: true,
      note: "Random event idempotency key; not a device identifier.",
    },
  },
  {
    field: "event_type",
    type: "string",
    schema: { is_nullable: false, max_length: 80 },
    meta: {
      interface: "select-dropdown",
      required: true,
      options: {
        choices: eventChoices.map((value) => ({
          text: value.replaceAll("_", " "),
          value,
        })),
      },
    },
  },
  ...["from_version_code", "target_version_code"].map((field) => ({
    field,
    type: "integer",
    schema: { is_nullable: field.startsWith("target_") },
    meta: { interface: "input", required: !field.startsWith("target_") },
  })),
  ...["from_version_name", "target_version_name"].map((field) => ({
    field,
    type: "string",
    schema: {
      is_nullable: field.startsWith("target_"),
      max_length: 32,
    },
    meta: { interface: "input", required: !field.startsWith("target_") },
  })),
  {
    field: "occurred_at",
    type: "timestamp",
    schema: { is_nullable: false },
    meta: { interface: "datetime", required: true },
  },
  {
    field: "error_code",
    type: "string",
    schema: { is_nullable: true, max_length: 80 },
    meta: {
      interface: "input",
      note: "Allowlisted machine-readable failure category; never a raw exception.",
    },
  },
  {
    field: "platform",
    type: "string",
    schema: { is_nullable: false, max_length: 16, default_value: "android" },
    meta: { interface: "input", required: true, readonly: true },
  },
  {
    field: "date_created",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: {
      special: ["date-created"],
      interface: "datetime",
      readonly: true,
      hidden: true,
    },
  },
];

async function ensureField(definition) {
  const current = await rawRequest("GET", `/fields/${collection}/${definition.field}`);
  const body = { schema: definition.schema, meta: definition.meta };
  if (current.response.status === 200) {
    await request("PATCH", `/fields/${collection}/${definition.field}`, body);
    return;
  }
  if (![403, 404].includes(current.response.status)) {
    throw new Error(`Could not inspect field ${definition.field}.`);
  }
  await request("POST", `/fields/${collection}`, definition);
}

async function ensureCreatePermission() {
  const query = new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": "create",
    fields: "id",
    limit: "1",
  });
  const existing = await request("GET", `/permissions?${query}`);
  const body = {
    policy: policyId,
    collection,
    action: "create",
    permissions: null,
    validation: null,
    presets: null,
    fields: ["*"],
  };
  if (Array.isArray(existing.data) && existing.data.length) {
    await request("PATCH", `/permissions/${existing.data[0].id}`, body);
  } else {
    await request("POST", "/permissions", body);
  }
}

(async () => {
  const existedBeforeMigration = await collectionExistsInDatabase();
  await authenticateAdmin();
  const identity = await request(
    "GET",
    "/users/me?fields=id,email,role.id,role.name,role.policies.policy.admin_access",
  );
  if (!identity.data?.role?.policies?.some(({ policy }) => policy?.admin_access)) {
    throw new Error("The migration session is not a Directus administrator.");
  }
  await createAndVerifyBackup();
  await ensureCollection(existedBeforeMigration);
  for (const field of fields) await ensureField(field);
  await ensureCreatePermission();
  console.log(JSON.stringify({
    collection,
    fields: fields.length + 1,
    backup: backupPath,
    anonymous: true,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

