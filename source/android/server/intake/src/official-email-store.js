import { randomUUID } from "node:crypto";

import {
  deliveryDedupeKey,
  officialEmailCandidates,
  snapshotOfficialEmailReport
} from "./official-email-policy.js";
import { officialEmailMessageId } from "./official-email-message.js";

const DELIVERY_FIELDS = [
  "id",
  "delivery_id",
  "dedupe_key",
  "safety_report_id",
  "client_report_id",
  "rule_id",
  "route",
  "destination_mode",
  "status",
  "recipient_to",
  "recipient_cc",
  "photo_id",
  "report_snapshot",
  "rfc822_message_id",
  "message_sha256",
  "photo_sha256",
  "preview_subject",
  "preview_text",
  "preview_html",
  "preview_attachment",
  "preview_generated_at",
  "preview_attempt_count",
  "preparation_attempt_count",
  "attempt_count",
  "next_attempt_at",
  "lease_id",
  "lease_expires_at",
  "last_attempt_at",
  "sent_at",
  "provider_message_id",
  "provider_thread_id",
  "last_error_code",
  "last_error_summary",
  "blocked_reason",
  "date_created",
  "date_updated"
].join(",");

const RECONCILIATION_REPORT_FIELDS = [
  "id",
  "client_report_id",
  "observed_at",
  "categories",
  "severity",
  "details",
  "latitude",
  "longitude",
  "nearest_intersection",
  "weather_status",
  "weather_summary",
  "weather_valid_time_utc",
  "weather_attribution",
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
  "photo"
].join(",");

export function createOfficialEmailStore({
  directusUrl,
  directusToken,
  config,
  fetchImplementation = fetch,
  now = () => new Date(),
  maxAttachmentBytes = 8 * 1024 * 1024
}) {
  const baseUrl = String(directusUrl || "").replace(/\/+$/, "");
  if (!baseUrl || !directusToken) {
    throw new Error("Directus URL and token are required for official email.");
  }

  async function ensureDeliveries(report, storedReport = {}) {
    const reportId = Number(storedReport.id ?? storedReport.safety_report_id);
    const photoId = fileId(storedReport.photo ?? storedReport.photoId);
    const candidates = officialEmailCandidates(report, photoId, config);
    const deliveries = [];
    for (const candidate of candidates) {
      const dedupeKey = deliveryDedupeKey(
        report.client_report_id,
        candidate.ruleId
      );
      const payload = {
        delivery_id: randomUUID(),
        dedupe_key: dedupeKey,
        safety_report_id: Number.isSafeInteger(reportId) ? reportId : null,
        client_report_id: report.client_report_id,
        rule_id: candidate.ruleId,
        route: candidate.route,
        destination_mode: candidate.destinationMode,
        status: candidate.status,
        recipient_to: candidate.to,
        recipient_cc: candidate.cc,
        photo_id: candidate.photoId,
        report_snapshot: snapshotOfficialEmailReport(report, candidate.photoId),
        rfc822_message_id: officialEmailMessageId(dedupeKey),
        preview_attempt_count: 0,
        preparation_attempt_count: 0,
        attempt_count: 0,
        next_attempt_at: candidate.status === "queued" || candidate.status === "review"
          ? now().toISOString()
          : null,
        blocked_reason: candidate.blockedReason
      };
      try {
        const result = await requestJson("/items/official_email_deliveries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        deliveries.push(result.data || payload);
      } catch (error) {
        if (error.directusCode !== "RECORD_NOT_UNIQUE") throw error;
        const existing = await findByDedupeKey(dedupeKey);
        if (!existing) throw error;
        deliveries.push(await reconcileExistingDelivery(
          existing,
          candidate,
          report,
          storedReport
        ));
      }
    }
    return deliveries;
  }

  async function findByDedupeKey(dedupeKey) {
    const query = new URLSearchParams({
      "filter[dedupe_key][_eq]": dedupeKey,
      fields: DELIVERY_FIELDS,
      limit: "1"
    });
    const result = await requestJson(`/items/official_email_deliveries?${query}`);
    return Array.isArray(result.data) ? result.data[0] || null : null;
  }

  async function reconcileExistingDelivery(
    existing,
    candidate,
    report,
    storedReport
  ) {
    // Never rewrite a delivery that has been attempted, resolved, manually
    // held, or marked uncertain. For an untouched row, this permits the
    // deliberate disabled -> review -> automatic rollout while refreshing
    // recipients from server configuration rather than from the client.
    if (
      Number(existing.attempt_count || 0) !== 0 ||
      Number(existing.preparation_attempt_count || 0) !== 0
    ) return existing;
    if (
      existing.status === "blocked" &&
      existing.blocked_reason === "preview_attempt_limit"
    ) return existing;
    if (!["disabled", "review", "blocked"].includes(existing.status)) {
      return existing;
    }
    const transitions = {
      disabled: new Set(["disabled", "review", "queued", "blocked"]),
      review: new Set(["review", "queued", "blocked"]),
      blocked: new Set(["review", "queued", "blocked"])
    };
    if (!transitions[existing.status]?.has(candidate.status)) return existing;
    const reportId = Number(storedReport.id ?? storedReport.safety_report_id);
    const reportSnapshot = snapshotOfficialEmailReport(report, candidate.photoId);
    const reviewNeedsScheduling = candidate.status === "review" &&
      !existing.preview_generated_at &&
      !existing.next_attempt_at;
    const nextAttemptAt = candidate.status === "queued" || candidate.status === "review"
      ? existing.status === candidate.status &&
          existing.next_attempt_at &&
          !reviewNeedsScheduling
        ? existing.next_attempt_at
        : now().toISOString()
      : null;
    if (
      existing.status === candidate.status &&
      existing.destination_mode === candidate.destinationMode &&
      existing.blocked_reason === candidate.blockedReason &&
      fileId(existing.photo_id) === candidate.photoId &&
      sameJson(existing.recipient_to, candidate.to) &&
      sameJson(existing.recipient_cc, candidate.cc) &&
      sameJson(existing.report_snapshot, reportSnapshot) &&
      !reviewNeedsScheduling
    ) {
      return existing;
    }
    return update(existing.id, {
      safety_report_id: Number.isSafeInteger(reportId) ? reportId : null,
      recipient_to: candidate.to,
      recipient_cc: candidate.cc,
      photo_id: candidate.photoId,
      report_snapshot: reportSnapshot,
      destination_mode: candidate.destinationMode,
      status: candidate.status,
      next_attempt_at: nextAttemptAt,
      blocked_reason: candidate.blockedReason,
      last_error_code: null,
      last_error_summary: null,
      preview_subject: null,
      preview_text: null,
      preview_html: null,
      preview_attachment: null,
      preview_generated_at: null,
      preview_attempt_count: 0,
      message_sha256: null,
      photo_sha256: null
    });
  }

  async function listDue(limit = 10) {
    const query = new URLSearchParams({
      "filter[status][_in]": "queued,retry,held_cap",
      "filter[next_attempt_at][_lte]": now().toISOString(),
      fields: DELIVERY_FIELDS,
      sort: "next_attempt_at,date_created",
      limit: String(Math.max(1, Math.min(50, limit)))
    });
    const result = await requestJson(`/items/official_email_deliveries?${query}`);
    return Array.isArray(result.data) ? result.data : [];
  }

  async function listPendingReview(limit = 10) {
    const query = new URLSearchParams({
      "filter[status][_eq]": "review",
      "filter[preview_generated_at][_null]": "true",
      "filter[next_attempt_at][_lte]": now().toISOString(),
      fields: DELIVERY_FIELDS,
      sort: "next_attempt_at,date_created",
      limit: String(Math.max(1, Math.min(50, limit)))
    });
    const result = await requestJson(`/items/official_email_deliveries?${query}`);
    return Array.isArray(result.data) ? result.data : [];
  }

  async function claim(delivery, leaseId, leaseExpiresAt) {
    return update(delivery.id, {
      status: "preparing",
      lease_id: leaseId,
      lease_expires_at: leaseExpiresAt.toISOString(),
      preparation_attempt_count:
        Number(delivery.preparation_attempt_count || 0) + 1,
      last_error_code: null,
      last_error_summary: null,
      blocked_reason: null
    });
  }

  async function markSending(delivery) {
    return update(delivery.id, {
      status: "sending",
      last_attempt_at: now().toISOString(),
      attempt_count: Number(delivery.attempt_count || 0) + 1
    });
  }

  async function update(id, values) {
    const result = await requestJson(
      `/items/official_email_deliveries/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      }
    );
    return result.data || { id, ...values };
  }

  async function recoverExpiredLeases() {
    const query = new URLSearchParams({
      "filter[status][_in]": "preparing,sending",
      "filter[lease_expires_at][_lt]": now().toISOString(),
      fields: DELIVERY_FIELDS,
      limit: "100"
    });
    const result = await requestJson(`/items/official_email_deliveries?${query}`);
    const expired = Array.isArray(result.data) ? result.data : [];
    for (const delivery of expired) {
      if (delivery.status === "preparing") {
        const attempts = Number(delivery.preparation_attempt_count || 0);
        const retry = attempts < config.maxAttempts;
        await update(delivery.id, {
          status: retry ? "retry" : "blocked",
          lease_id: null,
          lease_expires_at: null,
          next_attempt_at: retry ? now().toISOString() : null,
          blocked_reason: retry ? null : "preparation_attempt_limit",
          last_error_code: "stale_preparing_lease",
          last_error_summary: retry
            ? "The worker stopped before calling Gmail; the delivery is safe to retry."
            : "The worker repeatedly stopped while preparing this delivery."
        });
      } else {
        await update(delivery.id, {
          status: "uncertain",
          lease_id: null,
          lease_expires_at: null,
          next_attempt_at: null,
          last_error_code: "stale_sending_lease",
          last_error_summary:
            "The worker stopped after the Gmail request began. Review Sent mail by Message-ID; this delivery will not be retried automatically."
        });
      }
    }
    return expired.length;
  }

  async function countRecentRecipients(since) {
    const query = new URLSearchParams({
      // An uncertain request may already have been accepted by Gmail, so it
      // consumes cap capacity even though it is never automatically retried.
      "filter[status][_in]": "sending,sent,uncertain",
      "filter[last_attempt_at][_gte]": since.toISOString(),
      fields: "recipient_to,recipient_cc",
      limit: "-1"
    });
    const result = await requestJson(`/items/official_email_deliveries?${query}`);
    return (Array.isArray(result.data) ? result.data : []).reduce(
      (total, delivery) =>
        total + jsonArray(delivery.recipient_to).length +
        jsonArray(delivery.recipient_cc).length,
      0
    );
  }

  async function fetchPhoto(photoId) {
    if (!photoId) throw new Error("The delivery has no saved report photo.");
    const response = await fetchImplementation(
      `${baseUrl}/assets/${encodeURIComponent(photoId)}`,
      { headers: directusHeaders(directusToken) }
    );
    if (!response.ok) {
      const error = new Error(`Directus photo request failed with HTTP ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxAttachmentBytes) {
      throw new Error("The saved report photo is empty or exceeds the email limit.");
    }
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new Error("The saved report photo is not the expected normalized JPEG.");
    }
    return bytes;
  }

  async function reconcileAuthorizedReports() {
    const query = new URLSearchParams({
      "filter[official_email_authorized][_eq]": "true",
      fields: RECONCILIATION_REPORT_FIELDS,
      sort: "-date_created",
      limit: "-1"
    });
    const result = await requestJson(`/items/safety_reports?${query}`);
    let ensured = 0;
    for (const report of Array.isArray(result.data) ? result.data : []) {
      const deliveries = await ensureDeliveries(report, report);
      ensured += deliveries.length;
    }
    return ensured;
  }

  async function requestJson(path, options = {}) {
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      ...options,
      headers: directusHeaders(directusToken, options.headers)
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      const error = new Error(`Directus request failed with HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.directusCode = body?.errors?.[0]?.extensions?.code;
      throw error;
    }
    return body;
  }

  return {
    destinationMode: config.destinationMode,
    ensureDeliveries,
    findByDedupeKey,
    listDue,
    listPendingReview,
    claim,
    markSending,
    update,
    recoverExpiredLeases,
    countRecentRecipients,
    fetchPhoto,
    reconcileAuthorizedReports
  };
}

function directusHeaders(token, input = {}) {
  const headers = new Headers(input);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return headers;
}

function fileId(value) {
  if (typeof value === "string") return value;
  return typeof value?.id === "string" ? value.id : null;
}

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sameJson(left, right) {
  const parsedLeft = typeof left === "string" ? parseJson(left) : left;
  const parsedRight = typeof right === "string" ? parseJson(right) : right;
  return JSON.stringify(parsedLeft) === JSON.stringify(parsedRight);
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
