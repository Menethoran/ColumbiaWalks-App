/* Additive migration: private trash-can metadata, no new collections or public access. */
const COLLECTIONS = ["trash_can_comments", "trash_can_complaints"];
const HAULERS = [
  ["B&L Carson", "bl_carson"], ["Cauler", "cauler"], ["Good's", "goods"],
  ["Penn Waste", "penn_waste"], ["Waste Connections", "waste_connections"],
  ["Shell's", "shells"], ["WM.COM", "wm_com"],
];

const FIELD_DEFINITIONS = [
  {
    field: "hauler", type: "string", schema: { is_nullable: true, max_length: 64 },
    meta: {
      interface: "select-dropdown", required: false,
      note: "Optional reporter-selected hauler. Private intake metadata; not included in public feeds or automatically forwarded.",
      options: { choices: HAULERS.map(([text, value]) => ({ text, value })) },
    },
  },
  {
    field: "property_type", type: "string", schema: { is_nullable: true, max_length: 32 },
    meta: {
      interface: "select-dropdown", required: false,
      note: "Residential or Commercial. New app submissions default to Residential. Existing records are not relabeled.",
      options: { choices: [
        { text: "Residential", value: "residential" },
        { text: "Commercial", value: "commercial" },
      ] },
    },
  },
];

async function migrate({ request, backup, policyId }) {
  const existing = new Map();
  for (const collection of COLLECTIONS) {
    const result = await request("GET", `/fields/${collection}`);
    for (const definition of FIELD_DEFINITIONS) {
      const field = result.data.find(({ field }) => field === definition.field);
      existing.set(`${collection}.${definition.field}`, field);
      if (field && field.type !== "string") throw new Error(`Unexpected existing ${collection}.${definition.field} type.`);
    }
  }
  const { data: permissions } = await request("GET",
    "/permissions?limit=-1&filter[collection][_in]=" + COLLECTIONS.join(","));
  if (permissions.some((permission) => permission.policy !== policyId)) {
    throw new Error("Unexpected permission on a private trash-can collection; inspect before migrating.");
  }
  for (const collection of COLLECTIONS) {
    if (!permissions.some((p) => p.collection === collection && p.action === "create")) {
      throw new Error(`Missing existing private intake create permission for ${collection}.`);
    }
  }
  await backup();
  for (const collection of COLLECTIONS) {
    for (const definition of FIELD_DEFINITIONS) {
      if (!existing.get(`${collection}.${definition.field}`)) {
        await request("POST", `/fields/${collection}`, definition);
      }
    }
    for (const permission of permissions.filter((p) => p.collection === collection && p.action === "create")) {
      const fields = Array.isArray(permission.fields) ? permission.fields : permission.fields.split(",");
      const missing = FIELD_DEFINITIONS.map(({ field }) => field).filter((field) => !fields.includes(field));
      if (!fields.includes("*") && missing.length) {
        await request("PATCH", `/permissions/${permission.id}`, { fields: [...fields, ...missing] });
      }
    }
    const verified = await request("GET", `/fields/${collection}`);
    for (const definition of FIELD_DEFINITIONS) {
      if (!verified.data.some((field) => field.field === definition.field && field.type === "string" && field.schema?.is_nullable)) {
        throw new Error(`Could not verify nullable ${collection}.${definition.field}.`);
      }
    }
  }
  return { collections: COLLECTIONS, haulers: HAULERS.length, property_types: ["residential", "commercial"], public_access_added: false };
}

async function main() {
  const fs = require("node:fs");
  const sqlite3 = require("/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3");
  const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055").replace(/\/+$/, "");
  const backupPath = process.env.BACKUP_PATH;
  if (!backupPath || fs.existsSync(backupPath)) throw new Error("Set BACKUP_PATH to a new, unused backup file.");
  let token = process.env.ADMIN_TOKEN;
  if (!token) {
    const response = await fetch(baseUrl + "/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    });
    if (!response.ok) throw new Error(`Administrator login failed (${response.status}).`);
    token = (await response.json()).data?.access_token;
  }
  if (!token) throw new Error("Administrator authentication is required.");
  const request = async (method, path, body) => {
    const response = await fetch(baseUrl + path, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}).`);
    return response.json();
  };
  const open = (path, mode) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, mode, (error) => error ? reject(error) : resolve(db));
  });
  const run = (db, sql) => new Promise((resolve, reject) => db.run(sql, (error) => error ? reject(error) : resolve()));
  const all = (db, sql) => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  const backup = async () => {
    const db = await open(process.env.DB_FILENAME || "/directus/database/data.db", sqlite3.OPEN_READWRITE);
    db.configure("busyTimeout", 30000);
    try { await run(db, `VACUUM INTO '${backupPath.replaceAll("'", "''")}'`); }
    finally { await close(db); }
    fs.chmodSync(backupPath, 0o600);
    const copy = await open(backupPath, sqlite3.OPEN_READONLY);
    try {
      const rows = await all(copy, "PRAGMA quick_check");
      if (rows.length !== 1 || rows[0].quick_check !== "ok") throw new Error("Backup integrity failed.");
    } finally { await close(copy); }
  };
  const result = await migrate({ request, backup,
    policyId: process.env.INTAKE_POLICY_ID || "e162db29-a9fe-4835-8503-771b55fac178" });
  console.log(JSON.stringify({ ...result, backup: backupPath }));
}

module.exports = { migrate, HAULERS };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
