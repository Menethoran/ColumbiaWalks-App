import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

import { registerAdminRoutes } from "./admin.js";
import { registerBetaTestingPageRoutes } from "./beta-testing-page.js";
import { validateBetaTesterRequest } from "./beta-tester-validation.js";
import { classifySubmissionChannel } from "./submission-channel.js";
import { registerTrashCanRoutes } from "./trash-can-routes.js";
import { validateAppUpdateEvent } from "./app-update-validation.js";
import { validateFeedback } from "./feedback-validation.js";
import { resolveNearestIntersection } from "./intersection.js";
import { validatePoliceComplaint } from "./police-complaint-validation.js";
import { registerPrivacyPolicyRoutes } from "./privacy-page.js";
import { registerPublicInsightsRoutes } from "./public-insights.js";
import { registerPublicRoutes } from "./publication.js";
import { normalizeLegacyReport, validateReport } from "./validation.js";
import { validateWalkingMetric } from "./walking-metric-validation.js";
import { createWeatherEnricher, safeWeatherError } from "./weather.js";

const DEFAULT_MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const OFFICIAL_EMAIL_REPORT_FIELDS = [
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
  "photo"
].join(",");

export async function buildApp(options) {
  const directusUrl = options.directusUrl.replace(/\/+$/, "");
  const directusToken = options.directusToken;
  const maxPhotoBytes = options.maxPhotoBytes || DEFAULT_MAX_PHOTO_BYTES;
  const fetchImplementation = options.fetchImplementation || fetch;
  const intersectionFetchImplementation =
    options.intersectionFetchImplementation || fetchImplementation;
  const overpassUrl =
    options.overpassUrl || "https://overpass-api.de/api/interpreter";
  const officialEmailQueue = options.officialEmailQueue || null;
  const weatherEnricher = options.weatherEnricher || (
    options.weatherEnabled === true
      ? createWeatherEnricher({
        fetchImplementation: options.weatherFetchImplementation || fetch,
        timeoutMs: options.weatherTimeoutMs
      })
      : null
  );
  const intersectionCache = new Map();

  if (!directusUrl || !directusToken) {
    throw new Error("DIRECTUS_URL and DIRECTUS_TOKEN are required.");
  }

  const app = Fastify({
    logger: privacySafeLogger(options.logger),
    bodyLimit: maxPhotoBytes + 128 * 1024
  });

  const allowedBrowserOrigins = new Set([
    "https://columbiawalks.com",
    "https://www.columbiawalks.com",
    "https://columbiawalks.rbthompsonv.chatgpt.site"
  ]);
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedBrowserOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"]
  });

  registerAdminRoutes(app, {
    directusUrl,
    fetchImplementation
  });
  registerBetaTestingPageRoutes(app);

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: maxPhotoBytes,
      fields: 2,
      parts: 3
    }
  });

  const healthResponse = async () => ({ status: "ok" });
  app.get("/health", healthResponse);
  app.get("/columbiawalks-api/health", healthResponse);
  registerPrivacyPolicyRoutes(app);
  registerPublicRoutes(app, {
    directusUrl,
    directusToken,
    fetchImplementation,
    wallpaperPath: options.wallpaperPath
  });
  registerPublicInsightsRoutes(app, {
    directusUrl,
    directusToken,
    fetchImplementation
  });
  registerTrashCanRoutes(app, {
    directusUrl,
    directusToken,
    fetchImplementation
  });
  app.get("/columbiawalks-api/intersection", async (request, reply) => {
    const latitude = Number(request.query?.latitude);
    const longitude = Number(request.query?.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return reply.code(400).send({
        error: "Valid latitude and longitude are required."
      });
    }

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = intersectionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.header("Cache-Control", "private, max-age=60").send({
        data: cached.data
      });
    }

    try {
      const intersection = await resolveNearestIntersection({
        latitude,
        longitude,
        fetchImplementation: intersectionFetchImplementation,
        overpassUrl,
        majorPreferenceMeters: 35
      });
      intersectionCache.set(cacheKey, {
        data: intersection,
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      return reply.header("Cache-Control", "private, max-age=60").send({
        data: intersection
      });
    } catch (error) {
      request.log.warn(
        { error },
        "Could not resolve the nearest ColumbiaWalks intersection"
      );
      return reply.code(502).send({
        error: "The nearest intersection is temporarily unavailable."
      });
    }
  });

  app.post("/columbiawalks-api/reports", async (request, reply) => {
    let reportValue = null;
    let photoBytes = null;

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "photo" || photoBytes !== null) {
            await part.toBuffer();
            return reply.code(400).send({
              error: "Only one photo field is accepted."
            });
          }
          photoBytes = await part.toBuffer();
          continue;
        }
        if (part.fieldname === "report") {
          reportValue = part.value;
        }
      }
    } catch (error) {
      if (
        error?.code === "FST_REQ_FILE_TOO_LARGE" ||
        error?.code === "FST_FILES_LIMIT"
      ) {
        return reply.code(413).send({
          error: "The photo is larger than the upload limit."
        });
      }
      throw error;
    }

    if (!reportValue) {
      return reply.code(400).send({ error: "The report field is required." });
    }

    let parsed;
    try {
      parsed = typeof reportValue === "string"
        ? JSON.parse(reportValue)
        : reportValue;
    } catch {
      return reply.code(400).send({ error: "The report field is not valid JSON." });
    }

    const userAgent = request.headers["user-agent"];
    const validation = validateReport(normalizeLegacyReport(parsed, {
      fallbackId: randomUUID(),
      userAgent,
      now: new Date()
    }));
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const report = {
      ...validation.report,
      submission_channel: classifySubmissionChannel({
        userAgent,
        appVersion: validation.report.app_version
      })
    };

    if (report.submission_mode === "pos" && photoBytes === null) {
      return reply.code(400).send({
        error: "PoS reports require a picture."
      });
    }
    if (report.rapid_report_kind !== null && photoBytes === null) {
      return reply.code(400).send({
        error: "Continuous rapid reports require a picture."
      });
    }
    if (report.photo_latitude !== null && photoBytes === null) {
      return reply.code(400).send({
        error: "Photo coordinates require an attached picture."
      });
    }

    const existing = await findExisting(
      directusUrl,
      directusToken,
      report.client_report_id,
      fetchImplementation
    );
    if (existing) {
      const officialEmail = await safelyEnsureOfficialEmailDeliveries(
        officialEmailQueue,
        existing,
        existing,
        request.log
      );
      const response = {
        data: duplicateReportResponse(existing),
        duplicate: true
      };
      if (officialEmail) response.official_email = officialEmail;
      return reply.code(200).send(response);
    }

    let reportForStorage = report;
    if (weatherEnricher) {
      try {
        reportForStorage = {
          ...report,
          ...await weatherEnricher(report)
        };
      } catch (error) {
        const weather = safeWeatherError(error);
        reportForStorage = { ...report, ...weather };
        request.log.warn(
          {
            weatherCode: weather.weather_data.failure_code,
            providerStatus: Number.isInteger(error?.statusCode)
              ? error.statusCode
              : null
          },
          "Weather enrichment was unavailable; storing the report without conditions"
        );
      }
    }

    let uploadedFileId = null;
    let created = null;
    try {
      if (photoBytes !== null) {
        if (photoBytes.length === 0) {
          return reply.code(400).send({ error: "The attached photo is empty." });
        }
        let preparedPhoto;
        try {
          preparedPhoto = await sharp(photoBytes, {
            failOn: "error",
            limitInputPixels: 40_000_000
          })
            .rotate()
            .resize({
              width: 1920,
              height: 1920,
              fit: "inside",
              withoutEnlargement: true
            })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer();
        } catch (error) {
          request.log.warn(
            { error, photoBytes: photoBytes.length },
            "Rejected an unreadable ColumbiaWalks photo"
          );
          return reply.code(400).send({
            error: "This picture format could not be read. Try a JPEG or PNG picture."
          });
        }
        uploadedFileId = await uploadPhoto(
          directusUrl,
          directusToken,
          report.client_report_id,
          preparedPhoto,
          fetchImplementation
        );
      }

      created = await createReport(
        directusUrl,
        directusToken,
        reportForStorage,
        uploadedFileId,
        fetchImplementation
      );
    } catch (error) {
      if (uploadedFileId) {
        await safelyDeleteFile(
          directusUrl,
          directusToken,
          uploadedFileId,
          fetchImplementation,
          request.log
        );
      }

      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        const duplicate = await findExisting(
          directusUrl,
          directusToken,
          report.client_report_id,
          fetchImplementation
        );
        if (duplicate) {
          const officialEmail = await safelyEnsureOfficialEmailDeliveries(
            officialEmailQueue,
            duplicate,
            duplicate,
            request.log
          );
          const response = {
            data: duplicateReportResponse(duplicate),
            duplicate: true
          };
          if (officialEmail) response.official_email = officialEmail;
          return reply.code(200).send(response);
        }
      }

      request.log.error({ error }, "Directus rejected a ColumbiaWalks report");
      return reply.code(error.statusCode >= 400 && error.statusCode < 500
        ? 400
        : 502).send({
        error: "The report service could not store this report."
      });
    }

    // Report storage and photo cleanup are complete before email enqueueing.
    // A mail outage must never delete or fail a successfully stored report.
    const officialEmail = await safelyEnsureOfficialEmailDeliveries(
      officialEmailQueue,
      reportForStorage,
      { ...created, id: created?.id, photo: uploadedFileId || created?.photo },
      request.log
    );
    const response = { data: created };
    if (officialEmail) response.official_email = officialEmail;
    return reply.code(201).send(response);
  });

  app.post("/columbiawalks-api/feedback", async (request, reply) => {
    const validation = validateFeedback(request.body);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const feedback = validation.feedback;

    try {
      const created = await createFeedback(
        directusUrl,
        directusToken,
        feedback,
        fetchImplementation
      );
      return reply.code(201).send({ data: created });
    } catch (error) {
      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        return reply.code(200).send({
          data: {
            feedback_id: feedback.feedback_id,
            status: "new"
          },
          duplicate: true
        });
      }

      request.log.error(
        { error },
        "Directus rejected a ColumbiaWalks feedback submission"
      );
      return reply.code(error.statusCode >= 400 && error.statusCode < 500
        ? 400
        : 502).send({
        error: "The feedback service could not store this submission."
      });
    }
  });

  app.post("/columbiawalks-api/beta-testers", async (request, reply) => {
    const validation = validateBetaTesterRequest(request.body);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    try {
      const created = await createBetaTesterRequest(
        directusUrl,
        directusToken,
        validation.request,
        fetchImplementation
      );
      return reply.code(201).send({ data: created });
    } catch (error) {
      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        return reply.code(200).send({
          data: { request_id: validation.request.request_id, status: "new" },
          duplicate: true
        });
      }
      request.log.error({ error }, "Directus rejected a beta tester request");
      return reply.code(error.statusCode >= 400 && error.statusCode < 500
        ? 400
        : 502).send({
        error: "The beta tester request could not be stored. Please try again."
      });
    }
  });

  app.post("/columbiawalks-api/walking-metrics", async (request, reply) => {
    const validation = validateWalkingMetric(request.body);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const metric = validation.metric;
    try {
      const created = await createWalkingMetric(
        directusUrl,
        directusToken,
        metric,
        fetchImplementation
      );
      return reply.code(201).send({ data: created });
    } catch (error) {
      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        return reply.code(200).send({
          data: { feedback_id: metric.metric_id, status: "received" },
          duplicate: true
        });
      }
      request.log.error({ error }, "Directus rejected walking summary data");
      return reply.code(502).send({
        error: "The walking summary could not be stored. It will be retried."
      });
    }
  });

  app.post("/columbiawalks-api/app-update-events", async (request, reply) => {
    const validation = validateAppUpdateEvent(request.body);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const event = validation.event;
    try {
      await createAppUpdateEvent(
        directusUrl,
        directusToken,
        event,
        fetchImplementation
      );
      return reply.code(201).send({ data: { event_id: event.event_id } });
    } catch (error) {
      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        return reply.code(200).send({
          data: { event_id: event.event_id },
          duplicate: true
        });
      }
      request.log.error({ error }, "Directus rejected an app update event");
      return reply.code(error.statusCode >= 400 && error.statusCode < 500
        ? 400
        : 502).send({
        error: "The update event could not be stored."
      });
    }
  });

  app.post("/columbiawalks-api/police-complaints", async (request, reply) => {
    let complaintValue = null;
    let photoBytes = null;

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "photo" || photoBytes !== null) {
            await part.toBuffer();
            return reply.code(400).send({
              error: "Only one optional photo field is accepted."
            });
          }
          photoBytes = await part.toBuffer();
          continue;
        }
        if (part.fieldname === "complaint") complaintValue = part.value;
      }
    } catch (error) {
      if (
        error?.code === "FST_REQ_FILE_TOO_LARGE" ||
        error?.code === "FST_FILES_LIMIT"
      ) {
        return reply.code(413).send({
          error: "The photo is larger than the upload limit."
        });
      }
      throw error;
    }

    if (!complaintValue) {
      return reply.code(400).send({ error: "The complaint field is required." });
    }

    let parsed;
    try {
      parsed = typeof complaintValue === "string"
        ? JSON.parse(complaintValue)
        : complaintValue;
    } catch {
      return reply.code(400).send({
        error: "The complaint field is not valid JSON."
      });
    }

    const validation = validatePoliceComplaint(parsed);
    if (!validation.ok) {
      return reply.code(400).send({ error: validation.error });
    }
    const complaint = validation.complaint;

    let uploadedFileId = null;
    try {
      if (photoBytes !== null) {
        if (photoBytes.length === 0) {
          return reply.code(400).send({ error: "The attached photo is empty." });
        }
        const preparedPhoto = await preparePrivatePhoto(photoBytes);
        uploadedFileId = await uploadPoliceComplaintPhoto(
          directusUrl,
          directusToken,
          complaint.complaint_id,
          preparedPhoto,
          fetchImplementation
        );
      }

      const created = await createPoliceComplaint(
        directusUrl,
        directusToken,
        complaint,
        uploadedFileId,
        fetchImplementation
      );
      return reply.code(201).send({ data: created });
    } catch (error) {
      if (uploadedFileId) {
        await safelyDeleteFile(
          directusUrl,
          directusToken,
          uploadedFileId,
          fetchImplementation,
          request.log
        );
      }
      if (error.directusCode === "RECORD_NOT_UNIQUE") {
        return reply.code(200).send({
          data: {
            complaint_id: complaint.complaint_id,
            reference_number: policeReferenceNumber(complaint.complaint_id),
            status: "new",
            photo: null
          },
          duplicate: true
        });
      }

      request.log.error(
        { error },
        "Directus rejected a private ColumbiaWalks police interaction"
      );
      return reply.code(error.statusCode >= 400 && error.statusCode < 500
        ? 400
        : 502).send({
        error: "The private police interaction service could not store this report."
      });
    }
  });

  return app;
}

function privacySafeLogger(logger) {
  if (logger === false) return false;
  const configured = logger && logger !== true && typeof logger === "object"
    ? logger
    : {};
  return {
    ...configured,
    serializers: {
      ...(configured.serializers || {}),
      req(request) {
        const rawUrl = typeof request.url === "string" ? request.url : "";
        return {
          method: request.method,
          path: rawUrl.split("?", 1)[0]
        };
      }
    }
  };
}

async function preparePrivatePhoto(photoBytes) {
  return sharp(photoBytes, {
    failOn: "error",
    limitInputPixels: 40_000_000
  })
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

async function uploadPoliceComplaintPhoto(
  url,
  token,
  complaintId,
  photoBytes,
  fetchImplementation
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([photoBytes], { type: "image/jpeg" }),
    `columbiawalks-private-police-interaction-${complaintId}.jpg`
  );
  form.append("title", `Private ColumbiaWalks police interaction ${complaintId}`);

  const result = await directusRequest(
    url,
    token,
    "/files",
    { method: "POST", body: form },
    fetchImplementation
  );
  if (!result.data?.id) {
    throw new Error("Directus did not return an uploaded file ID.");
  }
  return result.data.id;
}

async function createPoliceComplaint(
  url,
  token,
  complaint,
  photoId,
  fetchImplementation
) {
  const referenceNumber = policeReferenceNumber(complaint.complaint_id);
  const payload = {
    ...complaint,
    reference_number: referenceNumber,
    status: "new",
    tags: complaint.interaction_categories,
    privacy_status: "private"
  };
  if (photoId) payload.photo = photoId;

  const result = await directusRequest(
    url,
    token,
    "/items/police_complaints",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    fetchImplementation
  );
  return result.data || {
    complaint_id: complaint.complaint_id,
    reference_number: referenceNumber,
    status: "new",
    photo: photoId
  };
}

function policeReferenceNumber(complaintId) {
  return `CW-PC-${complaintId.slice(0, 8).toUpperCase()}`;
}

async function createFeedback(url, token, feedback, fetchImplementation) {
  const payload = {
    ...feedback,
    status: "new",
    tags: [feedback.feedback_category]
  };
  const result = await directusRequest(
    url,
    token,
    "/items/feedback_submissions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    fetchImplementation
  );
  return result.data || {
    feedback_id: feedback.feedback_id,
    status: "new"
  };
}

async function createBetaTesterRequest(
  url,
  token,
  request,
  fetchImplementation
) {
  const result = await directusRequest(
    url,
    token,
    "/items/beta_tester_requests",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    },
    fetchImplementation
  );
  return {
    request_id: result.data?.request_id || request.request_id,
    status: result.data?.status || "new"
  };
}

async function createWalkingMetric(url, token, metric, fetchImplementation) {
  const feedback = {
    feedback_id: metric.metric_id,
    feedback_category: "app_feedback",
    feedback_text: `Walking Metric\n${JSON.stringify({
      submission_type: "walking_metric",
      period_start: metric.period_start,
      period_end: metric.period_end,
      distance_meters: metric.distance_meters,
      duration_seconds: metric.duration_seconds,
      activity_count: metric.activity_count,
      source: metric.source
    })}`,
    app_version: metric.app_version,
    submission_source: "android",
    contact_information_offered: false,
    contact_information_provided: false,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    contact_street_address: "",
    contact_notes: "",
    consent_to_contact: false,
    status: "received",
    tags: ["walking_metric", metric.source]
  };
  const result = await directusRequest(
    url,
    token,
    "/items/feedback_submissions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback)
    },
    fetchImplementation
  );
  return result.data || {
    feedback_id: metric.metric_id,
    status: "received"
  };
}

async function createAppUpdateEvent(url, token, event, fetchImplementation) {
  await directusRequest(
    url,
    token,
    "/items/app_update_events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    },
    fetchImplementation
  );
}

async function findExisting(url, token, clientReportId, fetchImplementation) {
  const query = new URLSearchParams();
  query.set("filter[client_report_id][_eq]", clientReportId);
  // These fields stay server-side. Duplicate reconciliation must use the
  // authoritative saved row, never mutable values from a replayed request.
  query.set("fields", OFFICIAL_EMAIL_REPORT_FIELDS);
  query.set("limit", "1");
  const result = await directusRequest(
    url,
    token,
    `/items/safety_reports?${query}`,
    {},
    fetchImplementation
  );
  return Array.isArray(result.data) && result.data.length > 0
    ? result.data[0]
    : null;
}

function duplicateReportResponse(report) {
  return {
    id: report?.id,
    client_report_id: report?.client_report_id,
    photo: report?.photo || null
  };
}

async function uploadPhoto(
  url,
  token,
  clientReportId,
  photoBytes,
  fetchImplementation
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([photoBytes], { type: "image/jpeg" }),
    `columbiawalks-${clientReportId}.jpg`
  );
  form.append("title", `ColumbiaWalks report ${clientReportId}`);

  const result = await directusRequest(
    url,
    token,
    "/files",
    { method: "POST", body: form },
    fetchImplementation
  );
  if (!result.data?.id) {
    throw new Error("Directus did not return an uploaded file ID.");
  }
  return result.data.id;
}

async function createReport(
  url,
  token,
  report,
  photoId,
  fetchImplementation
) {
  const payload = { ...report, review_status: "new" };
  if (photoId) {
    payload.photo = photoId;
  }
  if (report.submission_mode === "pos" && photoId) {
    payload.publication_status = "pending_review";
    payload.heatmap_eligible = false;
    payload.public_caption = String(report.details || "").trim().slice(0, 500);
    payload.public_location_label = String(
      report.nearest_intersection?.label || ""
    ).trim().slice(0, 200);
    payload.publish_full_plate = false;
  }
  const result = await directusRequest(
    url,
    token,
    "/items/safety_reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    fetchImplementation
  );
  return result.data || {
    client_report_id: report.client_report_id,
    photo: photoId
  };
}

async function safelyDeleteFile(
  url,
  token,
  fileId,
  fetchImplementation,
  logger
) {
  try {
    await directusRequest(
      url,
      token,
      `/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
      fetchImplementation
    );
  } catch (error) {
    logger.error({ error, fileId }, "Could not remove an orphaned report photo");
  }
}

async function safelyEnsureOfficialEmailDeliveries(
  queue,
  report,
  storedReport,
  logger
) {
  if (!queue || report?.official_email_authorized !== true) return null;
  try {
    const deliveries = await queue.ensureDeliveries(report, storedReport);
    return {
      status: deliveries.length > 0 ? "recorded" : "not_eligible",
      destination_mode:
        deliveries[0]?.destination_mode || queue.destinationMode || null,
      deliveries: deliveries.map((delivery) => ({
        rule_id: delivery.rule_id,
        status: delivery.status,
        destination_mode: delivery.destination_mode || null,
        blocked_reason: delivery.blocked_reason || null
      }))
    };
  } catch (error) {
    logger.error(
      { error, clientReportId: report.client_report_id },
      "Stored report could not be added to the official-email outbox"
    );
    return {
      status: "deferred",
      destination_mode: queue.destinationMode || null,
      deliveries: []
    };
  }
}

async function directusRequest(
  url,
  token,
  path,
  options,
  fetchImplementation
) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  const response = await fetchImplementation(`${url}${path}`, {
    ...options,
    headers
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(`Directus request failed with HTTP ${response.status}.`);
    error.statusCode = response.status;
    error.directusCode = body?.errors?.[0]?.extensions?.code;
    error.response = body;
    throw error;
  }
  return body;
}
