// Run inside Directus after a verified database backup; never enable public access.
const fs = require("node:fs");
const sqlite3 = require("/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3");
const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055").replace(/\/+$/, "");
const adminToken = process.env.ADMIN_TOKEN || "";
const policyId = process.env.INTAKE_POLICY_ID || "e162db29-a9fe-4835-8503-771b55fac178";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath = process.env.BACKUP_PATH || "/directus/database/data.db.bak-pre-anonymous-tip-tests-20260927";
const COLLECTION = "anonymous_tip_tests";
const contentFields = ["subject", "observed_time", "location", "direction", "license_plate", "plate_state", "vehicle_description", "observation", "evidence_notes", "notice"];
const collectionDefinitions = new Map([[COLLECTION, {
  icon: "science",
  note: "[TEST] PRIVATE INTERNAL TEST TIPS ONLY. No police delivery. No Public policy, public feed, identity fields, or media.",
  displayTemplate: "[TEST] {{subject}}",
  fields: [
    uuidField("submission_id", true, false, "Random request ID; never a device identifier."),
    stringField("app_version", 32, false, true, undefined, "Internal .0 source version."),
    stringField("payload_hash", 64, false, true, undefined, "Hash of the marked immutable content for exact retries."),
    stringField("status", 32, false, true, "test_received", "Internal test receipt only."),
    stringField("destination", 64, false, true, "private_columbiawalks_test_intake", "No official destination exists."),
    ...["test_mode", "police_contacted", "past_or_inactive_confirmed", "test_only_acknowledged"].map(field => ({
      field, type: "boolean", schema: { is_nullable: false }, meta: { interface: "boolean", readonly: true }
    })),
    { field: "received_at", type: "timestamp", schema: { is_nullable: false }, meta: { interface: "datetime", readonly: true } },
    ...contentFields.map(field => textField(field, false, "[TEST] Server forces [TEST] between every word, including empty-field placeholders."))
  ]
}]]);
// Directus 12 Core supports unrestricted fields per action. Only Create/Read
// for the private server intake policy; no Update/Delete and no Public role.
const permissionDefinitions = [
  { collection: COLLECTION, action: "create", fields: ["*"] },
  { collection: COLLECTION, action: "read", fields: ["*"] }
];

function stringField(field, maxLength, unique, required, defaultValue, note) {
  return {
    field,
    type: "string",
    schema: {
      is_nullable: !required && defaultValue === undefined,
      is_unique: Boolean(unique),
      max_length: maxLength,
      ...(defaultValue === undefined ? {} : { default_value: defaultValue }),
    },
    meta: { interface: "input", required, note },
  };
}

function uuidField(field, unique, nullable, note, readonly = true) {
  return {
    field,
    type: "uuid",
    schema: { is_nullable: nullable, is_unique: Boolean(unique) },
    meta: { interface: "input", required: !nullable, readonly, note },
  };
}



function textField(field, nullable, note) {
  return {
    field,
    type: "text",
    schema: { is_nullable: nullable },
    meta: { interface: "input-multiline", required: !nullable, note },
  };
}






function openDatabase(path, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(path, mode, (error) =>
      error ? reject(error) : resolve(database));
  });
}

function databaseGet(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parameters, (error, row) =>
      error ? reject(error) : resolve(row));
  });
}

function databaseAll(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, parameters, (error, rows) =>
      error ? reject(error) : resolve(rows));
  });
}

function databaseRun(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, parameters, function (error) {
      if (error) reject(error);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function closeDatabase(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => error ? reject(error) : resolve());
  });
}

async function collectionExistsInDatabase(collection) {
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

async function userHasAdministratorPolicy(userId) {
  if (!userId) return false;
  const database = await openDatabase(databasePath, sqlite3.OPEN_READONLY);
  try {
    return Boolean(await databaseGet(
      database,
      `SELECT 1
         FROM directus_access access
         JOIN directus_policies policy ON policy.id = access.policy
         JOIN directus_users user ON user.id = ?
        WHERE policy.admin_access = 1
          AND (access.user = user.id OR
               (access.user IS NULL AND access.role = user.role))
        LIMIT 1`,
      [userId],
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
    const result = await databaseAll(backup, "PRAGMA quick_check");
    if (result.length !== 1 || result[0].quick_check !== "ok") {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(result)}`);
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
    const error = new Error(`${method} ${path} failed with HTTP ${result.response.status}.`);
    // Keep the Directus 12 Core compatibility flag without exposing provider bodies.
    error.corePermissionRestriction = JSON.stringify(result.payload).includes("custom_permission_rules_enabled");
    throw error;
  }
  return result.payload;
}

async function ensureCollection(collection, definition, existedBeforeMigration) {
  const current = await rawRequest("GET", `/collections/${collection}`);
  const meta = {
    icon: definition.icon,
    note: definition.note,
    display_template: definition.displayTemplate,
  };
  if (current.response.status === 200) {
    await request("PATCH", `/collections/${collection}`, { meta });
    return "updated";
  }
  if (existedBeforeMigration || ![403, 404].includes(current.response.status)) {
    throw new Error(`Could not safely inspect ${collection}.`);
  }
  await request("POST", "/collections", {
    collection,
    meta,
    schema: {},
    fields: [{
      field: "id",
      type: "integer",
      meta: { hidden: true, interface: "input", readonly: true },
      schema: { is_primary_key: true, has_auto_increment: true },
    }],
  });
  return "created";
}

async function ensureField(collection, definition) {
  const current = await rawRequest("GET", `/fields/${collection}/${definition.field}`);
  const body = { schema: definition.schema, meta: definition.meta };
  if (current.response.status === 200) {
    await request("PATCH", `/fields/${collection}/${definition.field}`, body);
    return "updated";
  }
  if (![403, 404].includes(current.response.status)) {
    throw new Error(`Could not inspect ${collection}.${definition.field}.`);
  }
  await request("POST", `/fields/${collection}`, definition);
  return "created";
}

function permissionQuery(collection, action) {
  return new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": action,
    fields: "id",
    limit: "1",
  });
}

async function ensurePermission(definition) {
  const query = permissionQuery(definition.collection, definition.action);
  const existing = await request("GET", `/permissions?${query}`);
  const body = {
    policy: policyId,
    collection: definition.collection,
    action: definition.action,
    permissions: null,
    validation: null,
    presets: null,
    fields: definition.fields,
  };
  try {
    if (existing.data?.[0]?.id) {
      await request("PATCH", `/permissions/${existing.data[0].id}`, body);
      return "updated";
    }
    await request("POST", "/permissions", body);
    return "created";
  } catch (error) {
    if (!error.corePermissionRestriction) {
      throw error;
    }
    return ensurePermissionDirectly(definition);
  }
}

async function ensurePermissionDirectly(definition) {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READWRITE);
  database.configure("busyTimeout", 30000);
  const serializedFields = definition.fields.join(",");
  try {
    await databaseRun(database, "BEGIN IMMEDIATE");
    const existing = await databaseGet(
      database,
      "SELECT id FROM directus_permissions " +
        "WHERE policy = ? AND collection = ? AND action = ? LIMIT 1",
      [policyId, definition.collection, definition.action],
    );
    if (existing?.id) {
      await databaseRun(
        database,
        "UPDATE directus_permissions SET permissions = NULL, validation = NULL, " +
          "presets = NULL, fields = ? WHERE id = ?",
        [serializedFields, existing.id],
      );
      await databaseRun(database, "COMMIT");
      return "updated_sqlite";
    }
    await databaseRun(
      database,
      "INSERT INTO directus_permissions " +
        "(collection, action, permissions, validation, presets, fields, policy) " +
        "VALUES (?, ?, NULL, NULL, NULL, ?, ?)",
      [definition.collection, definition.action, serializedFields, policyId],
    );
    await databaseRun(database, "COMMIT");
    return "created_sqlite";
  } catch (error) {
    await databaseRun(database, "ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await closeDatabase(database);
  }
}

async function assertPrivatePermissions() {
  const expected = new Map(permissionDefinitions.map((definition) => [
    `${definition.collection}:${definition.action}`,
    new Set(definition.fields),
  ]));
  const database = await openDatabase(databasePath, sqlite3.OPEN_READONLY);
  try {
    const rows = await databaseAll(
      database,
      "SELECT id, collection, action, policy, fields FROM directus_permissions " +
        "WHERE collection = ?",
      [COLLECTION],
    );
    for (const permission of rows) {
      if (permission.policy !== policyId) {
        throw new Error(
          `${permission.collection} has a permission outside the private intake policy; refusing to continue.`,
        );
      }
      const key = `${permission.collection}:${permission.action}`;
      const expectedFields = expected.get(key);
      if (!expectedFields) {
        throw new Error(
          `${permission.collection} has unexpected ${permission.action} access; refusing to continue.`,
        );
      }
      const actualFields = String(permission.fields || "").trim();
      if (actualFields !== "*") {
        throw new Error(
          `${permission.collection} ${permission.action} must use the Directus 12 Core-compatible unrestricted action.`,
        );
      }
      expected.delete(key);
    }
    if (expected.size > 0) {
      throw new Error(
        `Missing private intake permissions: ${[...expected.keys()].join(", ")}.`,
      );
    }
  } finally {
    await closeDatabase(database);
  }
  return "private_intake_policy_only";
}

(async () => {
  if (!adminToken) {
    throw new Error("Set ADMIN_TOKEN to a short-lived Directus administrator token.");
  }
  const identity = await request(
    "GET",
    "/users/me?fields=id,email,role.admin_access,role.policies.*.*,policies.*.*",
  );
  const role = identity.data?.role;
  const administrator = Boolean(role?.admin_access) || [
    ...(Array.isArray(role?.policies) ? role.policies : []),
    ...(Array.isArray(identity.data?.policies) ? identity.data.policies : []),
  ].some((entry) => (entry?.policy ?? entry)?.admin_access) ||
    await userHasAdministratorPolicy(identity.data?.id);
  if (!administrator) {
    throw new Error("The migration session is not a Directus administrator.");
  }

  await createAndVerifyBackup();
  const collections = {};
  const fields = {};
  for (const [collection, definition] of collectionDefinitions) {
    const existed = await collectionExistsInDatabase(collection);
    collections[collection] = await ensureCollection(collection, definition, existed);
    fields[collection] = [];
    for (const field of definition.fields) {
      fields[collection].push([field.field, await ensureField(collection, field)]);
    }
  }

  const permissions = [];
  for (const definition of permissionDefinitions) {
    permissions.push([
      `${definition.collection}:${definition.action}`,
      await ensurePermission(definition),
    ]);
  }
  const privacy = await assertPrivatePermissions();

  for (const [collection, definition] of collectionDefinitions) {
    const verification = await request("GET", `/fields/${collection}`);
    const installed = new Set((verification.data || []).map(({ field }) => field));
    const missing = definition.fields
      .map(({ field }) => field)
      .filter((field) => !installed.has(field));
    if (missing.length > 0) {
      throw new Error(`${collection} is missing fields: ${missing.join(", ")}.`);
    }
  }

  console.log(JSON.stringify({
    collections,
    fields,
    permissions,
    privacy,
    public_permission_created: false,
    directus_public_read: false,
    public_reads_through_intake_service: false,
    anonymous_tips_publicly_readable: false,
    police_delivery_available: false,
    backup: backupPath,
  }, null, 2));
})().catch((error) => {
  console.error("Anonymous test-tip migration failed:", error.message);
  process.exitCode = 1;
});
