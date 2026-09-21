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
  "/directus/database/data.db.bak-pre-official-email-20260912";
const reportCollection = "safety_reports";
const deliveryCollection = "official_email_deliveries";

const statusChoices = [
  "disabled",
  "review",
  "queued",
  "preparing",
  "sending",
  "retry",
  "sent",
  "held_cap",
  "blocked",
  "uncertain",
  "cancelled",
];
const deliveryFields = [
  uuidField("delivery_id", true, "Stable delivery audit identifier."),
  stringField("dedupe_key", 128, true, "Unique report-and-rule idempotency key."),
  integerField("safety_report_id", false, "Source safety_reports primary key."),
  uuidField("client_report_id", false, "Source client report UUID."),
  selectField("rule_id", [
    ["Police and mayor — crosswalk", "police_crosswalk_v1"],
    ["Codes — missing sidewalk", "codes_missing_sidewalk_v1"],
  ], "Only the two version 3.15 rules are enabled."),
  selectField("route", [
    ["Police chief and mayor", "police_mayor"],
    ["Codes", "codes"],
  ], "Server-selected destination; clients cannot set recipients."),
  selectField("destination_mode", [
    ["ColumbiaWalks test mailbox", "test"],
    ["Designated officials", "official"],
  ], "Auditable server routing mode. Version 3.15 defaults to the internal test mailbox.", "test"),
  selectField(
    "status",
    statusChoices.map((value) => [value.replaceAll("_", " "), value]),
    "Durable official-email delivery state.",
    "review",
  ),
  jsonField("recipient_to", "Server-configured To recipient snapshot."),
  jsonField("recipient_cc", "Server-configured Cc recipient snapshot."),
  uuidField("photo_id", false, "Directus file UUID for the metadata-stripped JPEG."),
  jsonField("report_snapshot", "Immutable allowlisted report data used for the email."),
  stringField("rfc822_message_id", 255, true, "Deterministic Message-ID used for reconciliation."),
  stringField("message_sha256", 64, false, "SHA-256 of the generated MIME message."),
  stringField("photo_sha256", 64, false, "SHA-256 of the attached JPEG."),
  stringField("preview_subject", 500, false, "Inspectable subject rendered in review mode."),
  textField("preview_text", "Inspectable plain-text body rendered in review mode."),
  textField("preview_html", "Inspectable HTML body rendered in review mode."),
  jsonField(
    "preview_attachment",
    "Review-mode attachment metadata: bound photo id, filename, media type, size, and SHA-256.",
  ),
  timestampField("preview_generated_at", "Time the no-send review preview was generated."),
  integerField(
    "preview_attempt_count",
    false,
    "Number of no-send review preview attempts.",
    0,
  ),
  integerField(
    "preparation_attempt_count",
    false,
    "Number of leased message-preparation attempts.",
    0,
  ),
  integerField("attempt_count", false, "Number of Gmail send calls begun.", 0),
  timestampField("next_attempt_at", "Next safe automatic retry time."),
  uuidField("lease_id", false, "Single-worker lease identifier."),
  timestampField("lease_expires_at", "Lease expiry; stale sends become uncertain."),
  timestampField("last_attempt_at", "Most recent Gmail send attempt."),
  timestampField("sent_at", "Time Gmail definitively accepted the message."),
  stringField("provider_message_id", 255, false, "Gmail message ID returned after success."),
  stringField("provider_thread_id", 255, false, "Gmail thread ID returned after success."),
  stringField("last_error_code", 80, false, "Allowlisted operational error category."),
  textField("last_error_summary", "Sanitized error summary; never credentials or tokens."),
  stringField("blocked_reason", 80, false, "Allowlisted reason delivery is not eligible or paused."),
  dateCreatedField(),
  dateUpdatedField(),
];
const reportEmailReadFields = [
  "id",
  "client_report_id",
  "observed_at",
  "categories",
  "severity",
  "details",
  "latitude",
  "longitude",
  "nearest_intersection",
  "quick_report_type",
  "quick_report_types",
  "rapid_report_kind",
  "vehicle_issue_type",
  "sidewalk_lip_height",
  "vehicle_details",
  "app_version",
  "submission_mode",
  "submission_channel",
  "official_email_authorized",
  "official_email_destination_authorized",
  "photo",
  "date_created",
];

function stringField(field, maxLength, unique, note, defaultValue) {
  return {
    field,
    type: "string",
    schema: {
      is_nullable: defaultValue === undefined,
      is_unique: Boolean(unique),
      max_length: maxLength,
      ...(defaultValue === undefined ? {} : { default_value: defaultValue }),
    },
    meta: { interface: "input", readonly: true, note },
  };
}

function uuidField(field, unique, note) {
  return {
    field,
    type: "uuid",
    schema: { is_nullable: true, is_unique: Boolean(unique) },
    meta: { interface: "input", readonly: true, note },
  };
}

function integerField(field, nullable, note, defaultValue) {
  return {
    field,
    type: "integer",
    schema: {
      is_nullable: nullable,
      ...(defaultValue === undefined ? {} : { default_value: defaultValue }),
    },
    meta: { interface: "input", readonly: true, note },
  };
}

function selectField(field, values, note, defaultValue) {
  return {
    field,
    type: "string",
    schema: {
      is_nullable: defaultValue === undefined,
      max_length: 64,
      ...(defaultValue === undefined ? {} : { default_value: defaultValue }),
    },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      note,
      options: {
        choices: values.map(([text, value]) => ({ text, value })),
      },
    },
  };
}

function jsonField(field, note) {
  return {
    field,
    type: "json",
    schema: { is_nullable: true },
    meta: { interface: "input-code", readonly: true, note, options: { language: "json" } },
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

function dateCreatedField() {
  return {
    field: "date_created",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: {
      special: ["date-created"],
      interface: "datetime",
      readonly: true,
      hidden: true,
    },
  };
}

function dateUpdatedField() {
  return {
    field: "date_updated",
    type: "timestamp",
    schema: { is_nullable: true },
    meta: {
      special: ["date-updated"],
      interface: "datetime",
      readonly: true,
      hidden: true,
    },
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

function databaseAll(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => error ? reject(error) : resolve(rows));
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
    throw new Error(
      `${method} ${path} failed with HTTP ${result.response.status}: ` +
      JSON.stringify(result.payload),
    );
  }
  return result.payload;
}

async function ensureCollection(existedBeforeMigration) {
  const current = await rawRequest("GET", `/collections/${deliveryCollection}`);
  if (current.response.status === 200) return "updated";
  if (existedBeforeMigration || ![403, 404].includes(current.response.status)) {
    throw new Error(`Could not safely inspect ${deliveryCollection}.`);
  }
  await request("POST", "/collections", {
    collection: deliveryCollection,
    meta: {
      icon: "outgoing_mail",
      note:
        "Private ColumbiaWalks official-email outbox and delivery audit. Never expose through Public permissions, public maps, insights, or Page of Shame feeds.",
      display_template: "{{status}} — {{rule_id}} — {{client_report_id}}",
    },
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

async function ensureReportAuthorizationField() {
  return ensureField(reportCollection, {
    field: "official_email_authorized",
    type: "boolean",
    schema: { is_nullable: false, default_value: false },
    meta: {
      interface: "boolean",
      required: true,
      readonly: true,
      note:
        "Reporter authorized ColumbiaWalks to forward only a server-allowlisted report by email. False for every historical report.",
    },
  });
}

async function ensureReportDestinationAuthorizationField() {
  return ensureField(reportCollection, {
    field: "official_email_destination_authorized",
    type: "string",
    schema: { is_nullable: true, max_length: 16 },
    meta: {
      interface: "select-dropdown",
      readonly: true,
      note:
        "Destination-specific reporter authorization. Null unless official_email_authorized is true; must equal the active server destination mode before any delivery is created.",
      options: {
        choices: [
          { text: "ColumbiaWalks test mailbox", value: "test" },
          { text: "Designated officials", value: "official" },
        ],
      },
    },
  });
}

async function ensureMissingSidewalkChoice() {
  const current = await request("GET", `/fields/${reportCollection}/quick_report_types`);
  const meta = current.data?.meta || {};
  const options = meta.options || {};
  const choices = Array.isArray(options.choices) ? options.choices : [];
  const expanded = choices.some((choice) => choice?.value === "missing_sidewalk")
    ? choices
    : [...choices, { text: "Missing Sidewalk", value: "missing_sidewalk" }];
  await request("PATCH", `/fields/${reportCollection}/quick_report_types`, {
    // Patch only the mutable options block. A Directus field response can
    // include meta identifiers and other server-owned properties that some
    // editions reject when echoed back in a PATCH request.
    meta: { options: { ...options, choices: expanded } },
  });
  return expanded.length;
}

function permissionQuery(collection, action) {
  return new URLSearchParams({
    "filter[policy][_eq]": policyId,
    "filter[collection][_eq]": collection,
    "filter[action][_eq]": action,
    fields: "id,fields",
    limit: "1",
  });
}

function permissionFieldList(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value;
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

async function expandReportPermission(action, requiredFields) {
  const result = await request(
    "GET",
    `/permissions?${permissionQuery(reportCollection, action)}`,
  );
  const permission = result.data?.[0];
  if (!permission?.id) {
    throw new Error(
      `The intake policy has no safety_reports ${action} permission; refusing to create a broader permission automatically.`,
    );
  }
  const fields = permissionFieldList(permission.fields);
  if (fields === null || fields.includes("*")) {
    return "unchanged";
  }
  const expanded = [...new Set([...fields, ...requiredFields])];
  if (expanded.length === fields.length) return "unchanged";
  await request("PATCH", `/permissions/${permission.id}`, {
    fields: expanded,
  });
  return "expanded";
}

async function ensureDeliveryPermission(action) {
  const query = permissionQuery(deliveryCollection, action);
  const existing = await request("GET", `/permissions?${query}`);
  const body = {
    policy: policyId,
    collection: deliveryCollection,
    action,
    permissions: null,
    validation: null,
    presets: null,
    // This installation's Directus edition treats new field-restricted rules
    // as a licensed custom-permissions feature. The policy belongs only to the
    // private intake service, and the worker needs the complete audit row.
    fields: ["*"],
  };
  if (existing.data?.[0]?.id) {
    await request("PATCH", `/permissions/${existing.data[0].id}`, body);
    return "updated";
  }
  await request("POST", "/permissions", body);
  return "created";
}

async function assertPrivateOutboxPermissions() {
  const query = new URLSearchParams({
    "filter[collection][_eq]": deliveryCollection,
    fields: "id,policy,action",
    limit: "-1",
  });
  const result = await request("GET", `/permissions?${query}`);
  const unexpected = (result.data || []).filter((permission) => {
    const permissionPolicy = permission?.policy?.id ?? permission?.policy;
    return permissionPolicy !== policyId;
  });
  if (unexpected.length > 0) {
    throw new Error(
      "The official-email outbox has an explicit permission outside the private intake policy; refusing to continue.",
    );
  }
  return "private_intake_policy_only";
}

async function refuseDeletePermission() {
  const result = await request(
    "GET",
    `/permissions?${permissionQuery(deliveryCollection, "delete")}`,
  );
  if (result.data?.[0]?.id) {
    throw new Error(
      "The intake policy already has delete access to the official-email audit; remove it deliberately before continuing.",
    );
  }
}

(async () => {
  if (!adminToken) {
    throw new Error("Set ADMIN_TOKEN to a short-lived Directus administrator token.");
  }
  const existedBeforeMigration = await collectionExistsInDatabase(deliveryCollection);
  const identity = await request(
    "GET",
    "/users/me?fields=id,email,role.policies.*.*,policies.*.*",
  );
  const role = identity.data?.role;
  const administrator = Boolean(role?.admin_access) || [
    ...(Array.isArray(role?.policies) ? role.policies : []),
    ...(Array.isArray(identity.data?.policies) ? identity.data.policies : []),
  ].some((entry) => (entry?.policy ?? entry)?.admin_access);
  if (!administrator) {
    throw new Error("The migration session is not a Directus administrator.");
  }

  await createAndVerifyBackup();
  const collection = await ensureCollection(existedBeforeMigration);
  const authorizationField = await ensureReportAuthorizationField();
  const destinationAuthorizationField =
    await ensureReportDestinationAuthorizationField();
  const quickReportChoices = await ensureMissingSidewalkChoice();
  const fields = [];
  for (const definition of deliveryFields) {
    fields.push([definition.field, await ensureField(deliveryCollection, definition)]);
  }
  const reportCreatePermission = await expandReportPermission(
    "create",
    [
      "official_email_authorized",
      "official_email_destination_authorized",
    ],
  );
  const reportReadPermission = await expandReportPermission(
    "read",
    reportEmailReadFields,
  );
  const permissions = {};
  for (const action of ["create", "read", "update"]) {
    permissions[action] = await ensureDeliveryPermission(action);
  }
  await refuseDeletePermission();
  const privacy = await assertPrivateOutboxPermissions();

  const verification = await request("GET", `/fields/${deliveryCollection}`);
  const installed = new Set((verification.data || []).map(({ field }) => field));
  const missing = deliveryFields
    .map(({ field }) => field)
    .filter((field) => !installed.has(field));
  if (missing.length) {
    throw new Error(`Migration verification is missing fields: ${missing.join(", ")}.`);
  }
  console.log(JSON.stringify({
    collection: deliveryCollection,
    collection_status: collection,
    authorization_field: authorizationField,
    destination_authorization_field: destinationAuthorizationField,
    quick_report_choices: quickReportChoices,
    delivery_fields: fields,
    report_create_permission: reportCreatePermission,
    report_read_permission: reportReadPermission,
    delivery_permissions: permissions,
    delete_permission: "absent",
    permission_scope: privacy,
    public_permission_created: false,
    backup: backupPath,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
