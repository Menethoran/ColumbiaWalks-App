const fs = require("node:fs");
const sqlite3 = require(
  "/directus/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3",
);

const baseUrl = (process.env.DIRECTUS_INTERNAL_URL || "http://127.0.0.1:8055").replace(
  /\/$/,
  "",
);
let adminToken = process.env.ADMIN_TOKEN || "";
const policyId =
  process.env.INTAKE_POLICY_ID || "e162db29-a9fe-4835-8503-771b55fac178";
const databasePath = process.env.DB_FILENAME || "/directus/database/data.db";
const backupPath =
  process.env.BACKUP_PATH ||
  "/directus/database/data.db.bak-pre-police-interactions-20260816T2130Z";
const collection = "police_complaints";

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
    database.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function inspectCollectionInDatabase() {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READONLY);
  try {
    const row = await databaseGet(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [collection],
    );
    return Boolean(row);
  } finally {
    await closeDatabase(database);
  }
}

async function backupDatabase() {
  const database = await openDatabase(databasePath, sqlite3.OPEN_READWRITE);
  database.configure("busyTimeout", 30000);
  try {
    const escapedBackupPath = backupPath.replaceAll("'", "''");
    await databaseRun(database, `VACUUM INTO '${escapedBackupPath}'`);
  } finally {
    await closeDatabase(database);
  }
}

async function verifyBackup() {
  const database = await openDatabase(backupPath, sqlite3.OPEN_READONLY);
  try {
    const rows = await databaseAll(database, "PRAGMA quick_check");
    if (rows.length !== 1 || rows[0].quick_check !== "ok") {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(rows)}`);
    }
  } finally {
    await closeDatabase(database);
  }
}

async function authenticateAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (adminToken) return;
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
  console.log("Authenticated with a short-lived Directus administrator session.");
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
      `${method} ${path} failed with HTTP ${result.response.status}: ${JSON.stringify(
        result.payload,
      )}`,
    );
  }
  return result.payload;
}

async function ensureCollection(existedBeforeMigration) {
  const current = await rawRequest("GET", `/collections/${collection}`);
  if (current.response.status === 200) {
    console.log(`Collection ${collection} already exists.`);
    return;
  }
  if (existedBeforeMigration || ![403, 404].includes(current.response.status)) {
    throw new Error(
      `Could not safely inspect ${collection}: HTTP ${current.response.status}`,
    );
  }

  await request("POST", "/collections", {
    collection,
    meta: {
      icon: "local_police",
      note:
        "Private, anonymous-by-default police interaction reports. Never expose this collection through the Public policy, Page of Shame, or public maps.",
      display_template: "{{reference_number}} — {{interaction_sentiment}} — {{date_created}}",
    },
    schema: {},
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true, interface: "input", readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
    ],
  });
  console.log(`Created collection ${collection}.`);
}

const choiceField = (field, choices, note = undefined) => ({
  field,
  type: "string",
  schema: { is_nullable: false, max_length: 64 },
  meta: {
    interface: "select-dropdown",
    required: true,
    ...(note ? { note } : {}),
    options: {
      choices: choices.map(([text, value]) => ({ text, value })),
    },
  },
});

const fields = [
  {
    field: "complaint_id",
    type: "uuid",
    schema: { is_nullable: false, is_unique: true },
    meta: {
      interface: "input",
      required: true,
      readonly: true,
      note: "Client-generated idempotency key.",
    },
  },
  {
    field: "reference_number",
    type: "string",
    schema: { is_nullable: false, is_unique: true, max_length: 32 },
    meta: { interface: "input", required: true, readonly: true },
  },
  choiceField("interaction_sentiment", [
    ["Positive", "positive"],
    ["Negative", "negative"],
    ["Mixed / neutral", "mixed_neutral"],
    ["Not labeled", "not_labeled"],
  ]),
  choiceField("reporter_perspective", [
    ["Directly involved", "directly_involved"],
    ["Calling for someone", "calling_for_someone"],
    ["Bystander", "bystander"],
  ]),
  {
    field: "interaction_categories",
    type: "json",
    schema: { is_nullable: false },
    meta: {
      interface: "tags",
      required: true,
      note: "Adaptive interaction topics selected by the reporter.",
    },
  },
  {
    field: "complaint_categories",
    type: "json",
    schema: { is_nullable: false },
    meta: {
      interface: "tags",
      required: true,
      hidden: true,
      note: "Backward-compatible copy of interaction_categories.",
    },
  },
  choiceField("call_context", [
    ["Reporter called police", "called_by_reporter"],
    ["Someone else called police", "called_by_someone_else"],
    ["Police initiated the contact", "police_initiated"],
    ["Police were already present", "already_present"],
    ["Unknown", "unknown"],
  ]),
  choiceField("encounter_type", [
    ["Response to a call", "response_to_call"],
    ["Traffic stop", "traffic_stop"],
    ["Pedestrian stop", "pedestrian_stop"],
    ["Community presence", "community_presence"],
    ["Welfare check", "welfare_check"],
    ["Event or crowd", "event_or_crowd"],
    ["Police driving", "police_driving"],
    ["Other", "other"],
    ["Unknown", "unknown"],
  ]),
  {
    field: "presence_modes",
    type: "json",
    schema: { is_nullable: false },
    meta: { interface: "tags", required: true },
  },
  choiceField("safety_change", [
    ["Much safer", "much_safer"],
    ["Somewhat safer", "somewhat_safer"],
    ["No change", "no_change"],
    ["Somewhat less safe", "somewhat_less_safe"],
    ["Much less safe", "much_less_safe"],
    ["Not sure", "not_sure"],
  ]),
  choiceField("response_timeliness", [
    ["Much too slow", "much_too_slow"],
    ["Somewhat slow", "somewhat_slow"],
    ["About right", "about_right"],
    ["Fast", "fast"],
    ["Not applicable", "not_applicable"],
    ["Unknown", "unknown"],
  ]),
  choiceField("went_out_of_way", [
    ["Yes", "yes"],
    ["No", "no"],
    ["Not sure", "not_sure"],
    ["Not applicable", "not_applicable"],
  ]),
  ...[
    "safety_before_rating",
    "safety_during_rating",
    "safety_after_rating",
    "respect_rating",
    "communication_rating",
    "helpfulness_rating",
    "professionalism_rating",
    "fairness_rating",
    "outcome_rating",
  ].map((field) => ({
    field,
    type: "integer",
    schema: { is_nullable: true },
    meta: {
      interface: "input",
      note: "Optional 1–10 rating; null means not rated.",
      validation: {
        _and: [{ _gte: 1 }, { _lte: 10 }],
      },
    },
  })),
  ...[
    ["agency", 200],
    ["officer_name", 200],
    ["badge_number", 64],
    ["unit_number", 64],
    ["incident_at", 100],
    ["app_version", 32],
    ["submission_source", 32],
    ["privacy_status", 32],
    ["contact_name", 200],
    ["contact_phone", 64],
    ["contact_email", 254],
  ].map(([field, maxLength]) => ({
    field,
    type: "string",
    schema: { is_nullable: true, max_length: maxLength },
    meta: { interface: "input" },
  })),
  ...[
    "officer_description",
    "location_description",
    "complaint_text",
    "witnesses_or_evidence",
    "contact_street_address",
    "contact_notes",
  ].map((field) => ({
    field,
    type: "text",
    schema: { is_nullable: true },
    meta: { interface: "input-multiline" },
  })),
  {
    field: "photo",
    type: "uuid",
    schema: {
      is_nullable: true,
      foreign_key_table: "directus_files",
      foreign_key_column: "id",
    },
    meta: {
      interface: "file-image",
      special: ["file"],
      note:
        "Private evidence image. The intake removes metadata. Never copy automatically into a public field.",
    },
  },
  choiceField("status", [
    ["New", "new"],
    ["In Review", "in_review"],
    ["More Information Needed", "more_information_needed"],
    ["Referred", "referred"],
    ["Closed", "closed"],
  ]),
  {
    field: "tags",
    type: "json",
    schema: { is_nullable: true },
    meta: {
      interface: "tags",
      note: "Initialized from interaction topics; reviewers may add private tags.",
    },
  },
  ...[
    "contact_information_offered",
    "contact_information_provided",
    "consent_to_contact",
    "good_faith_confirmation",
  ].map((field) => ({
    field,
    type: "boolean",
    schema: { is_nullable: false, default_value: false },
    meta: { interface: "boolean", required: true },
  })),
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
  {
    field: "date_updated",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: {
      special: ["date-updated"],
      interface: "datetime",
      readonly: true,
      hidden: true,
    },
  },
];

async function ensureField(definition) {
  const current = await rawRequest(
    "GET",
    `/fields/${collection}/${definition.field}`,
  );
  const body = { schema: definition.schema, meta: definition.meta };
  if (current.response.status === 200) {
    await request("PATCH", `/fields/${collection}/${definition.field}`, body);
    console.log(`Updated field ${definition.field}.`);
    return;
  }
  if (![403, 404].includes(current.response.status)) {
    throw new Error(
      `Could not inspect field ${definition.field}: HTTP ${current.response.status}`,
    );
  }
  await request("POST", `/fields/${collection}`, definition);
  console.log(`Created field ${definition.field}.`);
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
    console.log("Updated create permission.");
  } else {
    await request("POST", "/permissions", body);
    console.log("Created create permission.");
  }
}

(async () => {
  const existedBeforeMigration = await inspectCollectionInDatabase();
  console.log(
    `Independent database check: ${collection} ${
      existedBeforeMigration ? "exists" : "does not exist"
    }.`,
  );
  await authenticateAdmin();
  const identity = await request(
    "GET",
    "/users/me?fields=id,email,role.id,role.name,policies.policy.admin_access",
  );
  console.log(
    `Directus session identity: ${identity.data.email} (${identity.data.role?.name || "no role"}).`,
  );
  if (!fs.existsSync(backupPath)) await backupDatabase();
  await verifyBackup();
  console.log(`Verified SQLite backup ${backupPath}.`);
  await ensureCollection(existedBeforeMigration);
  for (const field of fields) await ensureField(field);
  await ensureCreatePermission();

  const collectionCheck = await request("GET", `/collections/${collection}`);
  const permissionQuery = new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    fields: "id,action,fields",
    limit: "-1",
  });
  const permissionCheck = await request("GET", `/permissions?${permissionQuery}`);
  console.log(
    JSON.stringify(
      {
        collection: collectionCheck.data.collection,
        fields: fields.length + 1,
        permissions: permissionCheck.data,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

