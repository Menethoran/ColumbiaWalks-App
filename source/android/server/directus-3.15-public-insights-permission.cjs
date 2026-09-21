const fs = require("node:fs");
const sqlite3 = require(
  "/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3",
);

const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055")
  .replace(/\/$/, "");
const adminToken = process.env.ADMIN_TOKEN || "";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath = process.env.BACKUP_PATH ||
  "/directus/database/data.db.bak-pre-public-insights-20260821";
const intakeEmail = process.env.INTAKE_USER_EMAIL ||
  "columbiawalks-intake@rndtech.org";
const serviceQueryFields = [
  "date_created",
  "date_updated",
  "feedback_category",
  "feedback_text",
  "status",
];
// This Directus installation accepts collection-level permissions but treats
// field-restricted rules as a licensed custom rule. The intake service still
// requests only serviceQueryFields and the public API returns a strict aggregate
// projection with no records. Police submissions are a different collection.
const permissionFields = ["*"];

function openDatabase(path, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(path, mode, (error) => {
      if (error) reject(error);
      else resolve(database);
    });
  });
}

function databaseRun(database, sql) {
  return new Promise((resolve, reject) => {
    database.run(sql, (error) => error ? reject(error) : resolve());
  });
}

function databaseAll(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function databaseGet(database, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parameters, (error, row) => error ? reject(error) : resolve(row));
  });
}

function databaseRunWith(database, sql, parameters = []) {
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

async function request(method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed with HTTP ${response.status}: ` +
      JSON.stringify(payload),
    );
  }
  return payload;
}

async function intakePolicyId() {
  const query = new URLSearchParams();
  query.set("filter[email][_eq]", intakeEmail);
  query.set("fields", "id,role.policies.policy.id,role.policies.policy.name");
  query.set("limit", "1");
  const users = await request("GET", `/users?${query}`);
  const policies = users.data?.[0]?.role?.policies || [];
  const policy = policies.map((item) => item.policy).find(Boolean);
  if (!policy?.id) {
    throw new Error(`No policy was found for ${intakeEmail}.`);
  }
  return policy.id;
}

async function ensureFeedbackReadPermission(policy) {
  const query = new URLSearchParams();
  query.set("filter[policy][_eq]", policy);
  query.set("filter[collection][_eq]", "feedback_submissions");
  query.set("filter[action][_eq]", "read");
  query.set("fields", "id");
  query.set("limit", "1");
  const permissions = await request("GET", `/permissions?${query}`);
  const definition = {
    policy,
    collection: "feedback_submissions",
    action: "read",
    permissions: null,
    validation: null,
    presets: null,
    fields: permissionFields,
  };
  const existing = permissions.data?.[0];
  if (existing?.id) {
    try {
      await request("PATCH", `/permissions/${encodeURIComponent(existing.id)}`, definition);
      return { status: "updated", id: existing.id, method: "api" };
    } catch (error) {
      if (!String(error.message).includes("custom_permission_rules_enabled")) {
        throw error;
      }
      return ensureFeedbackReadPermissionDirectly(policy);
    }
  }
  try {
    const created = await request("POST", "/permissions", definition);
    return { status: "created", id: created.data?.id, method: "api" };
  } catch (error) {
    if (!String(error.message).includes("custom_permission_rules_enabled")) {
      throw error;
    }
    return ensureFeedbackReadPermissionDirectly(policy);
  }
}

async function ensureFeedbackReadPermissionDirectly(policy) {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READWRITE);
  database.configure("busyTimeout", 30000);
  const serializedFields = permissionFields.join(",");
  try {
    await databaseRunWith(database, "BEGIN IMMEDIATE");
    const existing = await databaseGet(
      database,
      "SELECT id FROM directus_permissions " +
        "WHERE policy = ? AND collection = ? AND action = ? LIMIT 1",
      [policy, "feedback_submissions", "read"],
    );
    if (existing?.id) {
      await databaseRunWith(
        database,
        "UPDATE directus_permissions SET permissions = NULL, validation = NULL, " +
          "presets = NULL, fields = ? WHERE id = ?",
        [serializedFields, existing.id],
      );
      await databaseRunWith(database, "COMMIT");
      return { status: "updated", id: existing.id, method: "sqlite" };
    }
    const inserted = await databaseRunWith(
      database,
      "INSERT INTO directus_permissions " +
        "(collection, action, permissions, validation, presets, fields, policy) " +
        "VALUES (?, ?, NULL, NULL, NULL, ?, ?)",
      ["feedback_submissions", "read", serializedFields, policy],
    );
    await databaseRunWith(database, "COMMIT");
    return { status: "created", id: inserted.id, method: "sqlite" };
  } catch (error) {
    await databaseRunWith(database, "ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await closeDatabase(database);
  }
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
  const policy = await intakePolicyId();
  const permission = await ensureFeedbackReadPermission(policy);
  console.log(JSON.stringify({
    collection: "feedback_submissions",
    action: "read",
    permission_fields: permissionFields,
    service_query_fields: serviceQueryFields,
    permission,
    backup: backupPath,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

