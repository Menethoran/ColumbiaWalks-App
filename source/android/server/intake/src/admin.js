import { readFileSync } from "node:fs";

import { buildAdminDashboard } from "./admin-data.js";

const COOKIE_PATH = "/columbiawalks-api/admin";
const ACCESS_COOKIE = "cw_admin_access";
const REFRESH_COOKIE = "cw_admin_refresh";
const ALLOWED_RANGES = new Map([
  ["30", 30],
  ["90", 90],
  ["365", 365],
  ["all", Number.POSITIVE_INFINITY]
]);
const ADMIN_ORIGINS = new Set([
  "https://columbiawalks.com",
  "https://www.columbiawalks.com",
  "https://directus.rndtech.org"
]);
const ADMIN_IDENTITY_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "role.id",
  "role.name",
  "role.policies.policy.admin_access"
].join(",");
const REPORT_FIELDS = [
  "id",
  "client_report_id",
  "date_created",
  "observed_at",
  "categories",
  "severity",
  "police_response",
  "details",
  "latitude",
  "longitude",
  "location",
  "app_version",
  "assessment_mode",
  "reported_party_type",
  "vehicle_involved",
  "submission_mode",
  "submission_channel",
  "quick_report_type",
  "quick_report_types",
  "nearest_intersection",
  "weather_status",
  "weather_provider",
  "weather_dataset",
  "weather_summary",
  "weather_event_time_utc",
  "weather_valid_time_utc",
  "weather_time_delta_minutes",
  "weather_retrieved_at_utc",
  "weather_attribution",
  "weather_data",
  "review_status",
  "publication_status",
  "photo"
].join(",");
const FEEDBACK_FIELDS = [
  "id",
  "feedback_id",
  "date_created",
  "date_updated",
  "feedback_category",
  "feedback_text",
  "app_version",
  "submission_source",
  "contact_information_provided",
  "consent_to_contact",
  "status",
  "tags"
].join(",");
const UPDATE_EVENT_FIELDS = [
  "id",
  "event_id",
  "event_type",
  "from_version_code",
  "from_version_name",
  "target_version_code",
  "target_version_name",
  "occurred_at",
  "error_code",
  "platform",
  "date_created"
].join(",");
const BETA_TESTER_FIELDS = [
  "id",
  "request_id",
  "date_created",
  "date_updated",
  "platform",
  "account_name",
  "account_email",
  "columbia_street",
  "comments",
  "status"
].join(",");
const TRASH_CAN_INVENTORY_FIELDS = [
  "id",
  "public_trash_can_id",
  "label",
  "address",
  "status"
].join(",");
const TRASH_CAN_SUBMISSION_FIELDS = [
  "id",
  "submission_id",
  "date_created",
  "date_updated",
  "asset_scope",
  "public_trash_can_id",
  "categories",
  "comment",
  "latitude",
  "longitude",
  "address",
  "app_version",
  "submission_source",
  "photo"
];
const TRASH_CAN_COMMENT_FIELDS = [
  ...TRASH_CAN_SUBMISSION_FIELDS,
  "moderation_status",
  "public_comment",
  "approved_at"
].join(",");
const TRASH_CAN_COMPLAINT_FIELDS = [
  ...TRASH_CAN_SUBMISSION_FIELDS,
  "status",
  "privacy_status"
].join(",");
const TRASH_CAN_COMPLAINT_STATUSES = new Set([
  "new",
  "in_review",
  "referred",
  "closed"
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const pageHtml = readFileSync(new URL("./admin/index.html", import.meta.url), "utf8");
const pageCss = readFileSync(new URL("./admin/admin.css", import.meta.url), "utf8");
const pageJs = readFileSync(new URL("./admin/admin.js", import.meta.url), "utf8");
const leafletJs = readFileSync(
  new URL("./admin/vendor/leaflet/leaflet.js", import.meta.url),
  "utf8"
);
const leafletCss = readFileSync(
  new URL("./admin/vendor/leaflet/leaflet.css", import.meta.url),
  "utf8"
);
const leafletImages = new Map(
  ["marker-shadow.png", "marker-icon.png", "marker-icon-2x.png", "layers.png", "layers-2x.png"]
    .map((name) => [
      name,
      readFileSync(new URL(`./admin/vendor/leaflet/images/${name}`, import.meta.url))
    ])
);

export function registerAdminRoutes(app, options) {
  const directusUrl = options.directusUrl.replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation || fetch;

  for (const path of ["/columbiawalks-admin", "/columbiawalks-admin/"]) {
    app.get(path, async (_request, reply) =>
      securePage(reply).type("text/html; charset=utf-8").send(pageHtml)
    );
  }
  app.get("/columbiawalks-admin/admin.css", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("text/css; charset=utf-8")
      .send(pageCss)
  );
  app.get("/columbiawalks-admin/admin.js", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=3600")
      .type("application/javascript; charset=utf-8")
      .send(pageJs)
  );
  app.get("/columbiawalks-admin/vendor/leaflet/leaflet.css", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=86400")
      .type("text/css; charset=utf-8")
      .send(leafletCss)
  );
  app.get("/columbiawalks-admin/vendor/leaflet/leaflet.js", async (_request, reply) =>
    securePage(reply)
      .header("Cache-Control", "public, max-age=86400")
      .type("application/javascript; charset=utf-8")
      .send(leafletJs)
  );
  app.get(
    "/columbiawalks-admin/vendor/leaflet/images/:name",
    async (request, reply) => {
      const image = leafletImages.get(request.params.name);
      if (!image) return reply.code(404).send();
      return securePage(reply)
        .header("Cache-Control", "public, max-age=86400")
        .type("image/png")
        .send(image);
    }
  );

  app.post("/columbiawalks-api/admin/login", async (request, reply) => {
    noStore(reply);
    if (!trustedOrigin(request)) {
      return reply.code(403).send({ error: "This sign-in request is not allowed." });
    }
    const email = request.body?.email;
    const password = request.body?.password;
    if (
      typeof email !== "string" ||
      email.length < 3 ||
      email.length > 320 ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 512
    ) {
      return reply.code(400).send({ error: "Enter a valid email address and password." });
    }

    try {
      const session = await directusJson(
        fetchImplementation,
        directusUrl,
        "/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, mode: "json" })
        }
      );
      const accessToken = session.data?.access_token;
      const refreshToken = session.data?.refresh_token;
      if (!accessToken || !refreshToken) throw new AdminApiError(401);

      const user = await fetchIdentity(fetchImplementation, directusUrl, accessToken);
      if (!isAdministrator(user)) {
        await revokeSession(fetchImplementation, directusUrl, refreshToken);
        clearSession(reply);
        return reply.code(403).send({
          error: "This dashboard is available only to Directus administrators."
        });
      }

      setSession(reply, session.data);
      return reply.send({ data: publicUser(user) });
    } catch (error) {
      if (error.statusCode === 401 || error.statusCode === 400) {
        clearSession(reply);
        return reply.code(401).send({ error: "The email address or password was not accepted." });
      }
      request.log.error({ error }, "Directus admin sign-in failed");
      return reply.code(502).send({ error: "The admin sign-in service is temporarily unavailable." });
    }
  });

  app.get("/columbiawalks-api/admin/session", async (request, reply) => {
    noStore(reply);
    const session = await requireAdministrator(
      request,
      reply,
      fetchImplementation,
      directusUrl
    );
    if (!session) return;
    return reply.send({ data: publicUser(session.user) });
  });

  app.post("/columbiawalks-api/admin/logout", async (request, reply) => {
    noStore(reply);
    if (!trustedOrigin(request)) {
      return reply.code(403).send({ error: "This sign-out request is not allowed." });
    }
    const cookies = parseCookies(request.headers.cookie);
    if (cookies[REFRESH_COOKIE]) {
      await revokeSession(
        fetchImplementation,
        directusUrl,
        cookies[REFRESH_COOKIE]
      );
    }
    clearSession(reply);
    return reply.code(204).send();
  });

  app.get("/columbiawalks-api/admin/dashboard", async (request, reply) => {
    noStore(reply);
    const session = await requireAdministrator(
      request,
      reply,
      fetchImplementation,
      directusUrl
    );
    if (!session) return;

    const requestedRange = String(request.query?.range || "90");
    if (!ALLOWED_RANGES.has(requestedRange)) {
      return reply.code(400).send({ error: "range must be 30, 90, 365, or all." });
    }

    try {
      const [
        reports,
        feedback,
        complaints,
        updateEvents,
        betaTesterRequests,
        trashCanInventory,
        trashCanComments,
        trashCanComplaints
      ] = await Promise.all([
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "safety_reports",
          REPORT_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "feedback_submissions",
          FEEDBACK_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "police_complaints",
          "*"
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "app_update_events",
          UPDATE_EVENT_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "beta_tester_requests",
          BETA_TESTER_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "public_trash_cans",
          TRASH_CAN_INVENTORY_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "trash_can_comments",
          TRASH_CAN_COMMENT_FIELDS
        ),
        fetchCollection(
          fetchImplementation,
          directusUrl,
          session.accessToken,
          "trash_can_complaints",
          TRASH_CAN_COMPLAINT_FIELDS
        )
      ]);
      const data = buildAdminDashboard({
        reports: reports.data,
        feedback: feedback.data,
        complaints: complaints.data,
        trashCanInventory: trashCanInventory.data,
        trashCanComments: trashCanComments.data,
        trashCanComplaints: trashCanComplaints.data,
        updateEvents: updateEvents.data,
        rangeDays: ALLOWED_RANGES.get(requestedRange)
      });
      data.available_collections = {
        safety_reports: reports.available,
        feedback_submissions: feedback.available,
        police_complaints: complaints.available,
        app_update_events: updateEvents.available
      };
      data.available_collections.beta_tester_requests = betaTesterRequests.available;
      data.available_collections.public_trash_cans = trashCanInventory.available;
      data.available_collections.trash_can_comments = trashCanComments.available;
      data.available_collections.trash_can_complaints = trashCanComplaints.available;
      data.beta_tester_requests = buildPendingBetaTesterRequests(betaTesterRequests.data);
      return reply.send({ data });
    } catch (error) {
      request.log.error({ error }, "Could not build the ColumbiaWalks admin dashboard");
      return reply.code(502).send({
        error: "The dashboard data could not be loaded. Please try again."
      });
    }
  });

  app.post(
    "/columbiawalks-api/admin/beta-testers/:requestId/dismiss",
    async (request, reply) => {
      noStore(reply);
      if (!trustedOrigin(request)) {
        return reply.code(403).send({ error: "This request update is not allowed." });
      }
      const requestId = String(request.params?.requestId || "");
      if (!/^[1-9][0-9]{0,18}$/.test(requestId)) {
        return reply.code(400).send({ error: "A valid beta tester request ID is required." });
      }
      const session = await requireAdministrator(
        request,
        reply,
        fetchImplementation,
        directusUrl
      );
      if (!session) return;

      try {
        const query = new URLSearchParams({ fields: "id,status,platform" });
        const result = await directusJson(
          fetchImplementation,
          directusUrl,
          `/items/beta_tester_requests/${encodeURIComponent(requestId)}?${query}`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        if (!result.data) {
          return reply.code(404).send({ error: "That beta tester request was not found." });
        }
        if (result.data.status !== "added") {
          await directusJson(
            fetchImplementation,
            directusUrl,
            `/items/beta_tester_requests/${encodeURIComponent(requestId)}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ status: "added" })
            }
          );
        }
        return reply.send({ data: { id: result.data.id, status: "added" } });
      } catch (error) {
        if (error.statusCode === 404) {
          return reply.code(404).send({ error: "That beta tester request was not found." });
        }
        request.log.error({ error, requestId }, "Beta tester request dismissal failed");
        return reply.code(502).send({
          error: "The beta tester request could not be dismissed. Please try again."
        });
      }
    }
  );

  app.post(
    "/columbiawalks-api/admin/page-of-shame/:reportId/approve",
    async (request, reply) => {
      noStore(reply);
      if (!trustedOrigin(request)) {
        return reply.code(403).send({ error: "This approval request is not allowed." });
      }
      const reportId = String(request.params?.reportId || "");
      if (!/^[1-9][0-9]{0,18}$/.test(reportId)) {
        return reply.code(400).send({ error: "A valid report ID is required." });
      }
      const session = await requireAdministrator(
        request,
        reply,
        fetchImplementation,
        directusUrl
      );
      if (!session) return;

      try {
        const query = new URLSearchParams({
          fields: [
            "id",
            "submission_mode",
            "publication_status",
            "review_status",
            "photo",
            "details",
            "nearest_intersection",
            "latitude",
            "longitude"
          ].join(",")
        });
        const result = await directusJson(
          fetchImplementation,
          directusUrl,
          `/items/safety_reports/${encodeURIComponent(reportId)}?${query}`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );
        const report = result.data;
        if (!report || report.submission_mode !== "pos") {
          return reply.code(409).send({
            error: "Only Page of Shame submissions can be approved here."
          });
        }
        const photoId = normalizeFileId(report.photo);
        if (!photoId) {
          return reply.code(409).send({
            error: "This submission does not have a photo to publish."
          });
        }
        if (report.publication_status !== "published") {
          const latitude = Number(report.latitude);
          const longitude = Number(report.longitude);
          const hasCoordinates =
            report.latitude !== null &&
            report.latitude !== "" &&
            report.longitude !== null &&
            report.longitude !== "" &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude);
          await directusJson(
            fetchImplementation,
            directusUrl,
            `/items/safety_reports/${encodeURIComponent(reportId)}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                publication_status: "published",
                review_status: "approved",
                public_photo: photoId,
                published_at: new Date().toISOString(),
                heatmap_eligible: hasCoordinates,
                public_caption: cleanPublicText(report.details, 500),
                public_location_label: cleanPublicText(
                  report.nearest_intersection?.label,
                  200
                ),
                publish_full_plate: false
              })
            }
          );
        }
        return reply.send({
          data: {
            id: report.id,
            publication_status: "published",
            review_status: "approved"
          }
        });
      } catch (error) {
        if (error.statusCode === 404) {
          return reply.code(404).send({ error: "That submission was not found." });
        }
        request.log.error({ error, reportId }, "Page of Shame approval failed");
        return reply.code(502).send({
          error: "The submission could not be approved. Please try again."
        });
      }
    }
  );

  app.post(
    "/columbiawalks-api/admin/trash-can-comments/:recordId/moderate",
    async (request, reply) => {
      noStore(reply);
      if (!trustedOrigin(request)) {
        return reply.code(403).send({ error: "This moderation request is not allowed." });
      }
      const recordId = String(request.params?.recordId || "");
      if (!validRecordId(recordId)) {
        return reply.code(400).send({ error: "A valid trash-can comment ID is required." });
      }
      const action = request.body?.action;
      if (action !== "approve" && action !== "reject") {
        return reply.code(400).send({ error: "action must be approve or reject." });
      }
      const publicComment = cleanPublicText(request.body?.public_comment, 2000);
      const publicTrashCanId = cleanPublicText(
        request.body?.public_trash_can_id,
        36
      ).toLowerCase();
      if (action === "approve") {
        if (publicComment.length < 3) {
          return reply.code(400).send({
            error: "Approved public text must contain 3 to 2,000 characters."
          });
        }
        if (!UUID_PATTERN.test(publicTrashCanId)) {
          return reply.code(400).send({
            error: "Approval requires an active canonical public trash-can ID."
          });
        }
      }

      const session = await requireAdministrator(
        request,
        reply,
        fetchImplementation,
        directusUrl
      );
      if (!session) return;

      try {
        if (action === "approve") {
          const query = new URLSearchParams();
          query.set("filter[public_trash_can_id][_eq]", publicTrashCanId);
          query.set("filter[status][_eq]", "active");
          query.set("fields", "id,public_trash_can_id");
          query.set("limit", "1");
          const inventory = await directusJson(
            fetchImplementation,
            directusUrl,
            `/items/public_trash_cans?${query}`,
            { headers: { Authorization: `Bearer ${session.accessToken}` } }
          );
          if (!Array.isArray(inventory.data) || inventory.data.length !== 1) {
            return reply.code(409).send({
              error: "The selected canonical trash can is not active."
            });
          }
        }

        const values = action === "approve"
          ? {
              moderation_status: "approved",
              public_comment: publicComment,
              public_trash_can_id: publicTrashCanId,
              approved_at: new Date().toISOString()
            }
          : {
              moderation_status: "rejected",
              public_comment: null,
              approved_at: null
            };
        const result = await directusJson(
          fetchImplementation,
          directusUrl,
          `/items/trash_can_comments/${encodeURIComponent(recordId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(values)
          }
        );
        return reply.send({
          data: {
            id: result.data?.id ?? recordId,
            moderation_status: values.moderation_status,
            public_trash_can_id:
              action === "approve" ? publicTrashCanId : null,
            public_comment: action === "approve" ? publicComment : null,
            approved_at: values.approved_at
          }
        });
      } catch (error) {
        if (error.statusCode === 404) {
          return reply.code(404).send({ error: "That trash-can comment was not found." });
        }
        request.log.error(
          { error, recordId, action },
          "Trash-can comment moderation failed"
        );
        return reply.code(502).send({
          error: "The trash-can comment could not be moderated. Please try again."
        });
      }
    }
  );

  app.post(
    "/columbiawalks-api/admin/trash-can-complaints/:recordId/status",
    async (request, reply) => {
      noStore(reply);
      if (!trustedOrigin(request)) {
        return reply.code(403).send({ error: "This complaint update is not allowed." });
      }
      const recordId = String(request.params?.recordId || "");
      const status = String(request.body?.status || "");
      if (!validRecordId(recordId)) {
        return reply.code(400).send({ error: "A valid trash-can complaint ID is required." });
      }
      if (!TRASH_CAN_COMPLAINT_STATUSES.has(status)) {
        return reply.code(400).send({
          error: "status must be new, in_review, referred, or closed."
        });
      }
      const session = await requireAdministrator(
        request,
        reply,
        fetchImplementation,
        directusUrl
      );
      if (!session) return;

      try {
        const result = await directusJson(
          fetchImplementation,
          directusUrl,
          `/items/trash_can_complaints/${encodeURIComponent(recordId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ status, privacy_status: "private" })
          }
        );
        return reply.send({
          data: {
            id: result.data?.id ?? recordId,
            status,
            privacy_status: "private"
          }
        });
      } catch (error) {
        if (error.statusCode === 404) {
          return reply.code(404).send({ error: "That trash-can complaint was not found." });
        }
        request.log.error(
          { error, recordId, status },
          "Trash-can complaint status update failed"
        );
        return reply.code(502).send({
          error: "The trash-can complaint could not be updated. Please try again."
        });
      }
    }
  );
}

function validRecordId(value) {
  return /^[1-9][0-9]{0,18}$/.test(value) || UUID_PATTERN.test(value);
}

function buildPendingBetaTesterRequests(records) {
  const pending = (Array.isArray(records) ? records : [])
    .filter((record) => ["new", "invited"].includes(record?.status || "new"))
    .map((record) => ({
      id: record.id,
      request_id: cleanAdminText(record.request_id, 64),
      platform: record.platform === "ios" || record.platform === "android"
        ? record.platform
        : "unknown",
      name: cleanAdminText(record.account_name, 200),
      email: cleanAdminText(record.account_email, 254),
      street: cleanAdminText(record.columbia_street, 200),
      comments: cleanAdminText(record.comments, 2000),
      status: record.status === "invited" ? "invited" : "new",
      received_at: cleanAdminText(record.date_created || record.date_updated, 64)
    }))
    .filter((record) => record.platform !== "unknown");

  return {
    ios: pending.filter((record) => record.platform === "ios"),
    android: pending.filter((record) => record.platform === "android"),
    total: pending.length
  };
}

function normalizeFileId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return "";
}

function cleanPublicText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function cleanAdminText(value, maximumLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maximumLength);
}

async function requireAdministrator(
  request,
  reply,
  fetchImplementation,
  directusUrl
) {
  const cookies = parseCookies(request.headers.cookie);
  let accessToken = cookies[ACCESS_COOKIE];
  let sessionData = null;
  if (!accessToken && cookies[REFRESH_COOKIE]) {
    sessionData = await refreshSession(
      fetchImplementation,
      directusUrl,
      cookies[REFRESH_COOKIE]
    );
    accessToken = sessionData?.access_token;
  }
  if (!accessToken) {
    clearSession(reply);
    reply.code(401).send({ error: "Sign in to view the admin dashboard." });
    return null;
  }

  try {
    let user;
    try {
      user = await fetchIdentity(fetchImplementation, directusUrl, accessToken);
    } catch (error) {
      if (error.statusCode !== 401 || !cookies[REFRESH_COOKIE]) throw error;
      sessionData = await refreshSession(
        fetchImplementation,
        directusUrl,
        cookies[REFRESH_COOKIE]
      );
      accessToken = sessionData?.access_token;
      if (!accessToken) throw error;
      user = await fetchIdentity(fetchImplementation, directusUrl, accessToken);
    }
    if (!isAdministrator(user)) {
      clearSession(reply);
      reply.code(403).send({ error: "Administrator access is required." });
      return null;
    }
    if (sessionData) setSession(reply, sessionData);
    return { accessToken, user };
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      clearSession(reply);
      reply.code(401).send({ error: "Your admin session has expired. Sign in again." });
      return null;
    }
    throw error;
  }
}

async function fetchIdentity(fetchImplementation, directusUrl, accessToken) {
  const query = new URLSearchParams({ fields: ADMIN_IDENTITY_FIELDS });
  const result = await directusJson(
    fetchImplementation,
    directusUrl,
    `/users/me?${query}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return result.data;
}

function isAdministrator(user) {
  return Boolean(
    user?.role?.policies?.some(({ policy }) => policy?.admin_access === true)
  );
}

function publicUser(user) {
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return {
    email: user?.email,
    name: displayName || user?.role?.name || "Administrator"
  };
}

async function refreshSession(fetchImplementation, directusUrl, refreshToken) {
  if (!refreshToken) return null;
  try {
    const result = await directusJson(
      fetchImplementation,
      directusUrl,
      "/auth/refresh",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken, mode: "json" })
      }
    );
    return result.data;
  } catch {
    return null;
  }
}

async function revokeSession(fetchImplementation, directusUrl, refreshToken) {
  try {
    await directusJson(fetchImplementation, directusUrl, "/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken, mode: "json" })
    });
  } catch {
    // The local cookies are still cleared when Directus has already expired.
  }
}

async function fetchCollection(
  fetchImplementation,
  directusUrl,
  accessToken,
  collection,
  fields
) {
  const data = [];
  const pageSize = 100;
  try {
    for (let offset = 0; offset < 5000; offset += pageSize) {
      const query = new URLSearchParams({
        fields,
        limit: String(pageSize),
        offset: String(offset),
        sort: "-date_created"
      });
      const result = await directusJson(
        fetchImplementation,
        directusUrl,
        `/items/${collection}?${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const page = Array.isArray(result.data) ? result.data : [];
      data.push(...page);
      if (page.length < pageSize) break;
    }
    return { available: true, data };
  } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      return { available: false, data: [] };
    }
    throw error;
  }
}

async function directusJson(fetchImplementation, directusUrl, path, options = {}) {
  const response = await fetchImplementation(directusUrl + path, options);
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) throw new AdminApiError(response.status, body);
  return body;
}

class AdminApiError extends Error {
  constructor(statusCode, response = {}) {
    super(`Directus admin request failed with HTTP ${statusCode}.`);
    this.statusCode = statusCode;
    this.response = response;
  }
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      cookies[name] = "";
    }
  }
  return cookies;
}

function setSession(reply, session) {
  const expiresMilliseconds = Number(session.expires);
  const accessMaxAge = Number.isFinite(expiresMilliseconds)
    ? Math.max(60, Math.floor(expiresMilliseconds / 1000))
    : 900;
  reply.header("Set-Cookie", [
    sessionCookie(ACCESS_COOKIE, session.access_token, accessMaxAge),
    sessionCookie(REFRESH_COOKIE, session.refresh_token, 7 * 24 * 60 * 60)
  ]);
}

function clearSession(reply) {
  reply.header("Set-Cookie", [
    sessionCookie(ACCESS_COOKIE, "", 0),
    sessionCookie(REFRESH_COOKIE, "", 0)
  ]);
}

function sessionCookie(name, value, maxAge) {
  return [
    `${name}=${encodeURIComponent(value || "")}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict"
  ].join("; ");
}

function trustedOrigin(request) {
  const origin = request.headers.origin;
  return !origin || ADMIN_ORIGINS.has(origin);
}

function noStore(reply) {
  return reply
    .header("Cache-Control", "no-store")
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "no-referrer");
}

function securePage(reply) {
  return noStore(reply)
    .header("Referrer-Policy", "strict-origin-when-cross-origin")
    .header("X-Frame-Options", "DENY")
    .header(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
}
