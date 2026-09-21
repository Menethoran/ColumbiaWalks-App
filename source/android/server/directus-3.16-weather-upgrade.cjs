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
  "/directus/database/data.db.bak-pre-weather-enrichment-20260918";
const collection = "safety_reports";

const statusChoices = [
  { text: "Model-derived estimate saved", value: "estimated" },
  { text: "Provider unavailable", value: "unavailable" },
  { text: "No confirmed location", value: "not_requested_no_location" },
  { text: "Incident time could not be matched", value: "not_requested_invalid_time" },
  { text: "Incident time is in the future", value: "not_requested_future_time" },
];

const fields = [
  {
    field: "weather_status",
    type: "string",
    schema: { is_nullable: true, max_length: 64 },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      note:
        "Server weather-enrichment result. Estimated means model-derived, not a street-level observation.",
      options: { allowNone: true, choices: statusChoices },
    },
  },
  stringField(
    "weather_provider",
    64,
    "Server-selected provider identifier; currently open-meteo.",
  ),
  stringField(
    "weather_dataset",
    64,
    "Forecast, historical forecast, or historical reanalysis dataset.",
  ),
  textField(
    "weather_summary",
    "Human-readable model-derived conditions near the report location.",
  ),
  timestampField(
    "weather_event_time_utc",
    "Normalized incident instant used for the weather match.",
  ),
  timestampField(
    "weather_valid_time_utc",
    "Provider hour selected as the closest match to the incident time.",
  ),
  {
    field: "weather_time_delta_minutes",
    type: "integer",
    schema: { is_nullable: true },
    meta: {
      interface: "input",
      readonly: true,
      note: "Absolute difference between incident time and selected provider hour.",
    },
  },
  timestampField(
    "weather_retrieved_at_utc",
    "Time ColumbiaWalks retrieved or attempted the weather enrichment.",
  ),
  textField(
    "weather_attribution",
    "Required provider and CC BY 4.0 attribution.",
  ),
  {
    field: "weather_data",
    type: "json",
    schema: { is_nullable: true },
    meta: {
      interface: "input-code",
      readonly: true,
      note:
        "Server-controlled weather values, units, model-grid provenance, and safe failure code. Never supplied by a reporting client.",
      options: { language: "json" },
    },
  },
];

function stringField(field, maxLength, note) {
  return {
    field,
    type: "string",
    schema: { is_nullable: true, max_length: maxLength },
    meta: { interface: "input", readonly: true, note },
  };
}

function textField(field, note) {
  return {
    field,
    type: "text",
    schema: { is_nullable: true },
    meta: { interface: "input-multiline", readonly: true, note },
  };
}

function timestampField(field, note) {
  return {
    field,
    type: "timestamp",
    schema: { is_nullable: true },
    meta: { interface: "datetime", readonly: true, note },
  };
}

function openDatabase(path, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(path, mode, (error) =>
      error ? reject(error) : resolve(database));
  });
}

function databaseAll(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function databaseGet(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parameters, (error, row) =>
      error ? reject(error) : resolve(row));
  });
}

function databaseRun(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, parameters, (error) => error ? reject(error) : resolve());
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
      await databaseRun(
        database,
        `VACUUM INTO '${backupPath.replaceAll("'", "''")}'`,
      );
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
    "/users/me?fields=id,email,role.admin_access,role.policies.policy.admin_access,policies.policy.admin_access",
  );
  const role = identity.data?.role;
  const policyAdmin = [
    ...(Array.isArray(role?.policies) ? role.policies : []),
    ...(Array.isArray(identity.data?.policies) ? identity.data.policies : []),
  ].some((entry) => (entry?.policy ?? entry)?.admin_access === true);
  if (role?.admin_access !== true && !policyAdmin) {
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

async function expandExistingPermission(action) {
  const query = new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": action,
    fields: "id,fields",
    limit: "1",
  });
  const result = await request("GET", `/permissions?${query}`);
  const permission = result.data?.[0];
  if (!permission) {
    throw new Error(
      `The intake policy has no safety_reports ${action} permission; refusing to create a broader permission automatically.`,
    );
  }
  const currentFields = permissionFieldList(permission.fields);
  if (currentFields === null || currentFields.includes("*")) {
    return { action, id: permission.id, changed: false, fields: currentFields };
  }
  const expanded = [...new Set([
    ...currentFields,
    ...fields.map(({ field }) => field),
  ])];
  try {
    await request("PATCH", `/permissions/${encodeURIComponent(permission.id)}`, {
      fields: expanded,
    });
    return { action, id: permission.id, changed: true, fields: expanded };
  } catch (error) {
    if (!String(error.message).includes("custom_permission_rules_enabled")) {
      throw error;
    }
    await expandPermissionDirectly(permission.id, action, expanded);
    return {
      action,
      id: permission.id,
      changed: true,
      fields: expanded,
      method: "verified_sqlite_fallback",
    };
  }
}

async function expandPermissionDirectly(permissionId, action, expanded) {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READWRITE);
  database.configure("busyTimeout", 30000);
  try {
    await databaseRun(database, "BEGIN IMMEDIATE");
    const existing = await databaseGet(
      database,
      "SELECT id, policy, collection, action FROM directus_permissions " +
        "WHERE id = ? AND policy = ? AND collection = ? AND action = ? LIMIT 1",
      [permissionId, policyId, collection, action],
    );
    if (!existing?.id) {
      throw new Error(`Could not safely locate the intake ${action} permission.`);
    }
    await databaseRun(
      database,
      "UPDATE directus_permissions SET fields = ? WHERE id = ?",
      [expanded.join(","), permissionId],
    );
    await databaseRun(database, "COMMIT");
  } catch (error) {
    await databaseRun(database, "ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await closeDatabase(database);
  }
}

async function verifyPermissionFields(action) {
  const query = new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": action,
    fields: "id,policy,collection,action,fields",
    limit: "1",
  });
  const result = await request("GET", `/permissions?${query}`);
  const permission = result.data?.[0];
  const returnedPolicyId = permission?.policy?.id || permission?.policy;
  if (!permission || returnedPolicyId !== policyId) {
    throw new Error(`Could not verify the intake ${action} permission.`);
  }
  const allowed = permissionFieldList(permission.fields);
  const missing = allowed === null || allowed.includes("*")
    ? []
    : fields.map(({ field }) => field).filter((field) => !allowed.includes(field));
  if (missing.length > 0) {
    throw new Error(
      `The intake ${action} permission is missing weather fields: ${missing.join(", ")}.`,
    );
  }
  return {
    action,
    id: permission.id,
    wildcard: allowed === null || allowed.includes("*"),
    verified_weather_fields: fields.map(({ field }) => field),
  };
}

(async () => {
  if (!adminToken) {
    throw new Error("Set ADMIN_TOKEN to a short-lived Directus administrator token.");
  }
  const administrator = await assertAdministrator();
  const existing = await request("GET", `/collections/${collection}`);
  if (existing.data?.collection !== collection) {
    throw new Error(`Directus collection ${collection} is unavailable.`);
  }
  await createAndVerifyBackup();

  const fieldStatus = {};
  for (const definition of fields) {
    fieldStatus[definition.field] = await ensureField(definition);
  }
  const permissions = [];
  for (const action of ["create", "read"]) {
    permissions.push(await expandExistingPermission(action));
  }

  const verification = await request("GET", `/fields/${collection}`);
  const verifiedFields = new Set(
    (verification.data || []).map(({ field }) => field),
  );
  const missing = fields
    .map(({ field }) => field)
    .filter((field) => !verifiedFields.has(field));
  if (missing.length > 0) {
    throw new Error(`Migration verification is missing fields: ${missing.join(", ")}.`);
  }
  const verifiedPermissions = [];
  for (const action of ["create", "read"]) {
    verifiedPermissions.push(await verifyPermissionFields(action));
  }

  console.log(JSON.stringify({
    administrator,
    collection,
    backup: backupPath,
    fields: fieldStatus,
    intake_permissions: permissions,
    verified_intake_permissions: verifiedPermissions,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
