import assert from "node:assert/strict";
import test from "node:test";

import { GmailApiError } from "../src/gmail-api.js";
import { normalizeOfficialEmailConfig } from "../src/official-email-policy.js";
import { createOfficialEmailWorker } from "../src/official-email-worker.js";

const fixedNow = new Date("2026-09-12T14:00:00Z");

function config(mode = "automatic", overrides = {}) {
  return normalizeOfficialEmailConfig({
    mode,
    destinationMode: "official",
    policeChiefEmail: "chief@example.gov",
    mayorEmail: "mayor@example.gov",
    codesEmail: "codes@example.gov",
    ...overrides
  });
}

function delivery(overrides = {}) {
  return {
    id: 42,
    delivery_id: "5b68665c-648f-45a3-8ebf-c626de084d7f",
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    dedupe_key:
      "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
    rule_id: "police_crosswalk_v1",
    route: "police_mayor",
    destination_mode: "official",
    status: "queued",
    recipient_to: ["chief@example.gov"],
    recipient_cc: ["mayor@example.gov"],
    photo_id: "photo-id",
    report_snapshot: {
      client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
      observed_at: "Sep 12, 2026 9:30 AM",
      categories: ["crosswalk_safety"],
      severity: "high",
      details: "Crosswalk observation",
      latitude: 40.0337,
      longitude: -76.5044,
      nearest_intersection: { label: "3rd Street & Locust Street" },
      vehicle_details: { license_plate: "ABC1234", plate_state: "PA" },
      photo_id: "photo-id",
      quick_report_types: ["crosswalk_encroachment"],
      submission_mode: "quick",
      official_email_authorized: true,
      official_email_destination_authorized: "official",
      rapid_report_kind: null,
      vehicle_issue_type: null
    },
    preparation_attempt_count: 0,
    attempt_count: 0,
    date_created: "2026-09-12T13:55:00Z",
    ...overrides
  };
}

function fakeStore({
  due = [],
  usedRecipients = 0,
  failSentUpdate = false,
  failPhoto = false
} = {}) {
  const updates = [];
  return {
    updates,
    async recoverExpiredLeases() { return 0; },
    async reconcileAuthorizedReports() { return 0; },
    async listDue() { return due; },
    async listPendingReview() { return due; },
    async countRecentRecipients() { return usedRecipients; },
    async claim(item, leaseId, leaseExpiresAt) {
      const patch = {
        status: "preparing",
        lease_id: leaseId,
        lease_expires_at: leaseExpiresAt.toISOString(),
        preparation_attempt_count:
          Number(item.preparation_attempt_count || 0) + 1
      };
      updates.push({ id: item.id, values: patch });
      return patch;
    },
    async markSending(item) {
      const patch = {
        status: "sending",
        last_attempt_at: fixedNow.toISOString(),
        attempt_count: Number(item.attempt_count || 0) + 1
      };
      updates.push({ id: item.id, values: patch });
      return patch;
    },
    async fetchPhoto() {
      if (failPhoto) throw new Error("saved review photo unavailable");
      return Buffer.from("jpeg bytes");
    },
    async update(id, values) {
      if (failSentUpdate && values.status === "sent") {
        throw new Error("Directus unavailable after send");
      }
      updates.push({ id, values });
      return { id, ...values };
    }
  };
}

test("automatic worker records a definitive Gmail success", async () => {
  const item = delivery();
  const store = fakeStore({ due: [item] });
  const sent = [];
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw(raw) {
        sent.push(raw);
        return { id: "gmail-message", threadId: "gmail-thread" };
      }
    },
    config: config(),
    now: () => new Date(fixedNow)
  });

  const result = await worker.runOnce();
  assert.equal(result.processed, 1);
  assert.equal(sent.length, 1);
  const final = store.updates.at(-1).values;
  assert.equal(final.status, "sent");
  assert.equal(final.provider_message_id, "gmail-message");
  assert.equal(final.provider_thread_id, "gmail-thread");
  assert.equal(final.sent_at, fixedNow.toISOString());
});

test("explicit Gmail 429 schedules a bounded retry", async () => {
  const store = fakeStore();
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw() {
        throw new GmailApiError("rate limited", {
          code: "gmail_rate_limited",
          statusCode: 429,
          retryable: true
        });
      }
    },
    config: config(),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery());
  assert.equal(result.status, "retry");
  const final = store.updates.at(-1).values;
  assert.equal(final.status, "retry");
  assert.equal(final.next_attempt_at, "2026-09-12T14:01:00.000Z");
});

test("ambiguous Gmail network result is never automatically retried", async () => {
  const store = fakeStore();
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw() {
        throw new GmailApiError("connection ended", {
          code: "send_ambiguous_network",
          ambiguous: true
        });
      }
    },
    config: config(),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery());
  assert.equal(result.status, "uncertain");
  const final = store.updates.at(-1).values;
  assert.equal(final.status, "uncertain");
  assert.equal(final.next_attempt_at, null);
});

test("daily recipient cap holds a job before claiming or sending", async () => {
  const store = fakeStore({ usedRecipients: 24 });
  let sends = 0;
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config("automatic", { dailyRecipientCap: 25 }),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery());
  assert.equal(result.status, "held_cap");
  assert.equal(sends, 0);
  assert.equal(store.updates.length, 1);
  assert.equal(store.updates[0].values.blocked_reason, "daily_recipient_cap");
  assert.equal(
    store.updates[0].values.next_attempt_at,
    "2026-09-12T15:00:00.000Z"
  );
});

test("worker ignores outbox recipient edits and uses fixed server recipients", async () => {
  const store = fakeStore();
  let mime = "";
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw(raw) {
        mime = Buffer.from(raw, "base64url").toString("utf8");
        return { id: "gmail-message", threadId: null };
      }
    },
    config: config(),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery({
    recipient_to: ["attacker@example.com"],
    recipient_cc: []
  }));
  assert.equal(result.status, "sent");
  assert.match(mime, /^To: chief@example\.gov$/m);
  assert.match(mime, /^Cc: mayor@example\.gov$/m);
  assert.doesNotMatch(mime, /attacker@example\.com/);
  assert.ok(store.updates.some(({ values }) =>
    Array.isArray(values.recipient_to) &&
    values.recipient_to[0] === "chief@example.gov" &&
    Array.isArray(values.recipient_cc) &&
    values.recipient_cc[0] === "mayor@example.gov"
  ));
});

test("test destination intercepts recipients and persists the actual mode", async () => {
  const store = fakeStore();
  let mime = "";
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw(raw) {
        mime = Buffer.from(raw, "base64url").toString("utf8");
        return { id: "gmail-test-message", threadId: null };
      }
    },
    config: config("automatic", {
      destinationMode: "test",
      testRecipient: "field-test@example.invalid"
    }),
    now: () => new Date(fixedNow)
  });
  const base = delivery();
  const result = await worker.processDelivery(delivery({
    destination_mode: "test",
    recipient_to: ["chief@example.gov"],
    recipient_cc: ["mayor@example.gov"],
    report_snapshot: {
      ...base.report_snapshot,
      official_email_destination_authorized: "test"
    }
  }));
  assert.equal(result.status, "sent");
  assert.match(mime, /^To: field-test@example\.invalid$/m);
  assert.doesNotMatch(mime, /^Cc:/m);
  assert.doesNotMatch(mime, /chief@example\.gov|mayor@example\.gov|codes@example\.gov/);
  assert.ok(store.updates.some(({ values }) =>
    values.destination_mode === "test" &&
    Array.isArray(values.recipient_to) &&
    values.recipient_to[0] === "field-test@example.invalid" &&
    Array.isArray(values.recipient_cc) &&
    values.recipient_cc.length === 0
  ));
});

test("worker blocks a destination-mode mismatch before Gmail", async () => {
  const store = fakeStore();
  let sends = 0;
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config("automatic", {
      destinationMode: "test",
      testRecipient: "field-test@example.invalid"
    }),
    now: () => new Date(fixedNow)
  });
  const base = delivery();
  const result = await worker.processDelivery(delivery({
    destination_mode: "official",
    report_snapshot: {
      ...base.report_snapshot,
      official_email_destination_authorized: "test"
    }
  }));
  assert.equal(result.status, "blocked");
  assert.equal(sends, 0);
  assert.equal(store.updates[0].values.blocked_reason, "policy_mismatch");
});

test("worker blocks a tampered dedupe key before claiming or sending", async () => {
  const store = fakeStore();
  let sends = 0;
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config(),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery({
    dedupe_key: "v1:altered:police_crosswalk_v1"
  }));
  assert.equal(result.status, "blocked");
  assert.equal(sends, 0);
  assert.equal(store.updates.length, 1);
  assert.equal(store.updates[0].values.blocked_reason, "policy_mismatch");
});

test("worker blocks a photo that does not match the immutable report snapshot", async () => {
  const store = fakeStore();
  let sends = 0;
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config(),
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery({
    photo_id: "unrelated-photo-id"
  }));
  assert.equal(result.status, "blocked");
  assert.equal(sends, 0);
  assert.equal(store.updates.length, 1);
  assert.equal(store.updates[0].values.blocked_reason, "policy_mismatch");
});

test("review mode durably renders the exact test preview but never calls Gmail", async () => {
  let reconciled = 0;
  let sends = 0;
  const base = delivery();
  const reviewDelivery = delivery({
    status: "review",
    destination_mode: "test",
    recipient_to: ["must-not-survive@example.gov"],
    recipient_cc: ["must-not-survive-cc@example.gov"],
    report_snapshot: {
      ...base.report_snapshot,
      official_email_destination_authorized: "test"
    }
  });
  const store = fakeStore({ due: [reviewDelivery] });
  store.reconcileAuthorizedReports = async () => { reconciled += 1; };
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config("review", {
      destinationMode: "test",
      testRecipient: "field-test@example.invalid"
    }),
    now: () => new Date(fixedNow)
  });
  const result = await worker.runOnce();
  assert.equal(result.mode, "review");
  assert.equal(result.processed, 1);
  assert.equal(reconciled, 1);
  assert.equal(sends, 0);
  const preview = store.updates.at(-1).values;
  assert.equal(preview.status, "review");
  assert.equal(preview.destination_mode, "test");
  assert.deepEqual(preview.recipient_to, ["field-test@example.invalid"]);
  assert.deepEqual(preview.recipient_cc, []);
  assert.match(preview.preview_subject, /^\[TEST\] ColumbiaWalks report/);
  assert.match(preview.preview_subject, /Plate PA ABC1234/);
  assert.match(preview.preview_text, /^TEST ROUTING:/);
  assert.match(preview.preview_text, /LICENSE PLATE: PA ABC1234/);
  assert.match(preview.preview_html, /TEST ROUTING:/);
  assert.match(preview.preview_html, /<h1[^>]*>LICENSE PLATE:/);
  assert.equal(preview.preview_attachment.photo_id, "photo-id");
  assert.equal(preview.preview_attachment.content_type, "image/jpeg");
  assert.equal(
    preview.preview_attachment.byte_length,
    Buffer.byteLength("jpeg bytes")
  );
  assert.equal(preview.preview_attachment.sha256, preview.photo_sha256);
  assert.match(preview.message_sha256, /^[a-f0-9]{64}$/);
  assert.equal(preview.preview_generated_at, fixedNow.toISOString());
  assert.equal(preview.preview_attempt_count, 1);
  assert.doesNotMatch(
    JSON.stringify(preview),
    /must-not-survive@example\.gov|must-not-survive-cc@example\.gov/
  );
});

test("review photo failure is safely retryable and never becomes uncertain", async () => {
  let sends = 0;
  const item = delivery({ status: "review" });
  const store = fakeStore({ due: [item], failPhoto: true });
  const worker = createOfficialEmailWorker({
    store,
    gmail: { async sendRaw() { sends += 1; } },
    config: config("review"),
    now: () => new Date(fixedNow)
  });

  const result = await worker.processReviewDelivery(item);
  assert.equal(result.status, "review");
  assert.equal(sends, 0);
  const failure = store.updates.at(-1).values;
  assert.equal(failure.status, "review");
  assert.equal(failure.preview_attempt_count, 1);
  assert.equal(failure.next_attempt_at, "2026-09-12T14:01:00.000Z");
  assert.equal(failure.last_error_code, "review_preview_failed");
  assert.notEqual(failure.status, "uncertain");
});

test("state-write failure after Gmail success leaves the lease for uncertain recovery", async () => {
  const logs = [];
  const store = fakeStore({ failSentUpdate: true });
  const worker = createOfficialEmailWorker({
    store,
    gmail: {
      async sendRaw() {
        return { id: "accepted-message", threadId: "accepted-thread" };
      }
    },
    config: config(),
    logger: { error(value, message) { logs.push({ value, message }); } },
    now: () => new Date(fixedNow)
  });
  const result = await worker.processDelivery(delivery());
  assert.equal(result.status, "sending");
  assert.equal(result.stateWriteFailed, true);
  assert.equal(logs.length, 1);
  assert.equal(
    store.updates.some(({ values }) => values.status === "retry"),
    false
  );
});
