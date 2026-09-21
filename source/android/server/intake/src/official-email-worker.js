import { randomUUID } from "node:crypto";

import { GmailApiError } from "./gmail-api.js";
import { buildOfficialEmailMessage } from "./official-email-message.js";
import {
  deliveryDedupeKey,
  officialEmailCandidates
} from "./official-email-policy.js";

export function createOfficialEmailWorker({
  store,
  gmail,
  config,
  logger = console,
  now = () => new Date()
}) {
  if (!store) throw new Error("The official email store is required.");
  if (config.mode === "automatic" && !gmail) {
    throw new Error("The Gmail client is required in automatic mode.");
  }

  async function runOnce() {
    if (config.mode === "disabled") return { mode: "disabled", processed: 0 };

    try {
      await store.recoverExpiredLeases();
    } catch (error) {
      logger.error({ error }, "Could not recover official-email worker leases");
    }
    try {
      await store.reconcileAuthorizedReports();
    } catch (error) {
      logger.error({ error }, "Could not reconcile authorized official-email reports");
    }
    if (config.mode === "review") {
      const pending = await store.listPendingReview(10);
      let processed = 0;
      for (const delivery of pending) {
        await processReviewDelivery(delivery);
        processed += 1;
      }
      return { mode: config.mode, processed };
    }

    const due = await store.listDue(10);
    let processed = 0;
    for (const delivery of due) {
      await processDelivery(delivery);
      processed += 1;
    }
    return { mode: config.mode, processed };
  }

  async function processDelivery(delivery) {
    const reportSnapshot = objectValue(delivery.report_snapshot);
    const candidate = officialEmailCandidates(
      reportSnapshot,
      delivery.photo_id,
      config
    ).find((value) =>
      value.ruleId === delivery.rule_id && value.route === delivery.route
    );
    const expectedDedupeKey = candidate
      ? deliveryDedupeKey(reportSnapshot.client_report_id, candidate.ruleId)
      : null;
    if (
      !candidate ||
      candidate.status !== "queued" ||
      delivery.destination_mode !== candidate.destinationMode ||
      delivery.dedupe_key !== expectedDedupeKey ||
      delivery.client_report_id !== reportSnapshot.client_report_id ||
      delivery.photo_id !== reportSnapshot.photo_id
    ) {
      await store.update(delivery.id, {
        status: "blocked",
        next_attempt_at: null,
        blocked_reason: "policy_mismatch",
        last_error_code: "policy_mismatch",
        last_error_summary:
          "The delivery no longer matches an authorized version 3.15 rule, photo, location, and server route."
      });
      return { status: "blocked" };
    }
    const recipientCount = candidate.recipientCount;
    const since = new Date(now().getTime() - 24 * 60 * 60 * 1000);
    const usedRecipients = await store.countRecentRecipients(since);
    if (usedRecipients + recipientCount > config.dailyRecipientCap) {
      await store.update(delivery.id, {
        status: "held_cap",
        next_attempt_at:
          new Date(now().getTime() + 60 * 60 * 1000).toISOString(),
        blocked_reason: "daily_recipient_cap",
        last_error_code: "daily_recipient_cap",
        last_error_summary:
          "Automatic delivery paused at the configured rolling 24-hour recipient cap."
      });
      return { status: "held_cap" };
    }

    const previousAttempts = Number(delivery.attempt_count || 0);
    if (previousAttempts >= config.maxAttempts) {
      await store.update(delivery.id, {
        status: "blocked",
        next_attempt_at: null,
        blocked_reason: "attempt_limit",
        last_error_code: "attempt_limit",
        last_error_summary: "The configured automatic delivery attempt limit was reached."
      });
      return { status: "blocked" };
    }
    const previousPreparationAttempts = Number(
      delivery.preparation_attempt_count || 0
    );
    if (previousPreparationAttempts >= config.maxAttempts) {
      await store.update(delivery.id, {
        status: "blocked",
        next_attempt_at: null,
        blocked_reason: "preparation_attempt_limit",
        last_error_code: "preparation_attempt_limit",
        last_error_summary:
          "The configured message-preparation attempt limit was reached."
      });
      return { status: "blocked" };
    }

    const leaseId = randomUUID();
    const leaseExpiresAt = new Date(now().getTime() + config.leaseMs);
    const claimedPatch = await store.claim(delivery, leaseId, leaseExpiresAt);
    let claimed = {
      ...delivery,
      ...claimedPatch,
      destination_mode: candidate.destinationMode,
      recipient_to: candidate.to,
      recipient_cc: candidate.cc
    };
    const preparationAttemptCount = previousPreparationAttempts + 1;

    let message;
    try {
      const photoBytes = await store.fetchPhoto(claimed.photo_id);
      message = buildOfficialEmailMessage({
        delivery: claimed,
        report: reportSnapshot,
        photoBytes,
        sender: config.sender,
        messageDate: claimed.date_created || now()
      });
      await store.update(claimed.id, {
        rfc822_message_id: message.messageId,
        message_sha256: message.messageSha256,
        photo_sha256: message.photoSha256,
        destination_mode: candidate.destinationMode,
        recipient_to: candidate.to,
        recipient_cc: candidate.cc
      });
    } catch (error) {
      return handleSafeFailure(
        claimed,
        preparationAttemptCount,
        error,
        "message_preparation",
        "preparation_attempt_limit"
      );
    }

    try {
      const sendingPatch = await store.markSending(claimed);
      claimed = { ...claimed, ...sendingPatch };
    } catch (error) {
      // Gmail has not been called. The durable `preparing` lease can therefore
      // be recovered as a safe retry if this state transition is interrupted.
      logger.error(
        { error, deliveryId: claimed.delivery_id },
        "Could not mark an official email as sending before the Gmail call"
      );
      return { status: "preparing", stateWriteFailed: true };
    }
    const attemptCount = previousAttempts + 1;

    let result;
    try {
      result = await gmail.sendRaw(message.raw);
    } catch (error) {
      if (error instanceof GmailApiError && error.ambiguous) {
        await store.update(claimed.id, {
          status: "uncertain",
          lease_id: null,
          lease_expires_at: null,
          next_attempt_at: null,
          last_error_code: safeErrorCode(error.code),
          last_error_summary:
            "Gmail did not return a definitive result. Review Sent mail using the stored Message-ID; this delivery will not be retried automatically."
        });
        return { status: "uncertain" };
      }
      if (error instanceof GmailApiError && error.retryable) {
        return handleSafeFailure(claimed, attemptCount, error, error.code);
      }
      await store.update(claimed.id, {
        status: "blocked",
        lease_id: null,
        lease_expires_at: null,
        next_attempt_at: null,
        blocked_reason: "provider_rejected",
        last_error_code: safeErrorCode(error?.code || "gmail_rejected"),
        last_error_summary: safeSummary(error)
      });
      return { status: "blocked" };
    }

    try {
      await store.update(claimed.id, {
        status: "sent",
        lease_id: null,
        lease_expires_at: null,
        next_attempt_at: null,
        sent_at: now().toISOString(),
        provider_message_id: result.id,
        provider_thread_id: result.threadId,
        last_error_code: null,
        last_error_summary: null,
        blocked_reason: null
      });
      return { status: "sent", providerMessageId: result.id };
    } catch (error) {
      // Gmail has already accepted the message. Leaving the row in `sending`
      // causes lease recovery to mark it uncertain instead of risking a resend.
      logger.error(
        { error, deliveryId: claimed.delivery_id },
        "Gmail accepted an official email but its delivery state was not saved"
      );
      return { status: "sending", stateWriteFailed: true };
    }
  }

  async function processReviewDelivery(delivery) {
    const reportSnapshot = objectValue(delivery.report_snapshot);
    const candidate = officialEmailCandidates(
      reportSnapshot,
      delivery.photo_id,
      config
    ).find((value) =>
      value.ruleId === delivery.rule_id && value.route === delivery.route
    );
    const expectedDedupeKey = candidate
      ? deliveryDedupeKey(reportSnapshot.client_report_id, candidate.ruleId)
      : null;
    if (
      !candidate ||
      candidate.status !== "review" ||
      delivery.status !== "review" ||
      delivery.destination_mode !== candidate.destinationMode ||
      delivery.dedupe_key !== expectedDedupeKey ||
      delivery.client_report_id !== reportSnapshot.client_report_id ||
      delivery.photo_id !== reportSnapshot.photo_id
    ) {
      await store.update(delivery.id, {
        status: "blocked",
        next_attempt_at: null,
        blocked_reason: "policy_mismatch",
        last_error_code: "policy_mismatch",
        last_error_summary:
          "The review preview no longer matches an authorized version 3.15 rule, photo, location, and server route."
      });
      return { status: "blocked" };
    }

    const previousPreviewAttempts = Number(delivery.preview_attempt_count || 0);
    if (previousPreviewAttempts >= config.maxAttempts) {
      await store.update(delivery.id, {
        status: "blocked",
        next_attempt_at: null,
        blocked_reason: "preview_attempt_limit",
        last_error_code: "preview_attempt_limit",
        last_error_summary:
          "The configured no-send review preview attempt limit was reached."
      });
      return { status: "blocked" };
    }
    const previewAttemptCount = previousPreviewAttempts + 1;

    let message;
    try {
      const photoBytes = await store.fetchPhoto(delivery.photo_id);
      message = buildOfficialEmailMessage({
        delivery: {
          ...delivery,
          destination_mode: candidate.destinationMode,
          recipient_to: candidate.to,
          recipient_cc: candidate.cc
        },
        report: reportSnapshot,
        photoBytes,
        sender: config.sender,
        messageDate: delivery.date_created || now()
      });
    } catch (error) {
      const attemptsRemain = previewAttemptCount < config.maxAttempts;
      await store.update(delivery.id, {
        status: attemptsRemain ? "review" : "blocked",
        next_attempt_at: attemptsRemain
          ? new Date(now().getTime() + retryDelayMs(previewAttemptCount)).toISOString()
          : null,
        preview_attempt_count: previewAttemptCount,
        blocked_reason: attemptsRemain ? null : "preview_attempt_limit",
        last_error_code: attemptsRemain
          ? "review_preview_failed"
          : "preview_attempt_limit",
        last_error_summary: safeSummary(error)
      });
      return { status: attemptsRemain ? "review" : "blocked" };
    }

    try {
      await store.update(delivery.id, {
        status: "review",
        destination_mode: candidate.destinationMode,
        recipient_to: candidate.to,
        recipient_cc: candidate.cc,
        rfc822_message_id: message.messageId,
        message_sha256: message.messageSha256,
        photo_sha256: message.photoSha256,
        preview_subject: message.subject,
        preview_text: message.text,
        preview_html: message.html,
        preview_attachment: {
          photo_id: delivery.photo_id,
          filename: message.attachment.filename,
          content_type: message.attachment.contentType,
          byte_length: message.attachment.byteLength,
          sha256: message.attachment.sha256
        },
        preview_generated_at: now().toISOString(),
        preview_attempt_count: previewAttemptCount,
        next_attempt_at: null,
        blocked_reason: null,
        last_error_code: null,
        last_error_summary: null
      });
      return { status: "review", previewed: true };
    } catch (error) {
      // No provider call occurred. Leaving the row due in review mode makes a
      // future preview rebuild safe; never classify a preview write as an
      // uncertain email send.
      logger.error(
        { error, deliveryId: delivery.delivery_id },
        "Could not save an official-email review preview"
      );
      return { status: "review", stateWriteFailed: true };
    }
  }

  async function handleSafeFailure(
    delivery,
    failureCount,
    error,
    code,
    limitReason = "attempt_limit"
  ) {
    const attemptsRemain = failureCount < config.maxAttempts;
    await store.update(delivery.id, {
      status: attemptsRemain ? "retry" : "blocked",
      lease_id: null,
      lease_expires_at: null,
      next_attempt_at: attemptsRemain
        ? new Date(now().getTime() + retryDelayMs(failureCount)).toISOString()
        : null,
      blocked_reason: attemptsRemain ? null : limitReason,
      last_error_code: safeErrorCode(code),
      last_error_summary: safeSummary(error)
    });
    return { status: attemptsRemain ? "retry" : "blocked" };
  }

  return { runOnce, processDelivery, processReviewDelivery };
}

export function scheduleOfficialEmailWorker({ worker, intervalMs, logger = console }) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await worker.runOnce();
    } catch (error) {
      logger.error({ error }, "Official-email worker cycle failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function retryDelayMs(attemptCount) {
  const schedule = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  return schedule[Math.min(schedule.length - 1, Math.max(0, attemptCount - 1))];
}

function safeErrorCode(value) {
  const normalized = String(value || "delivery_error")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || "delivery_error";
}

function safeSummary(error) {
  return String(error?.message || "Official email delivery failed.")
    .replace(/[\r\n\0]+/g, " ")
    .slice(0, 500);
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

function objectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return {};
}
