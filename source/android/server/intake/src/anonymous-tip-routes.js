import { createHash } from "node:crypto";
import { validateAnonymousTip } from "./anonymous-tip-validation.js";

export const ANONYMOUS_TIP_COLLECTION = "anonymous_tip_tests";
export const ANONYMOUS_TIP_PATH = "/columbiawalks-api/anonymous-tip-tests";

export function registerAnonymousTipRoutes(app, options) {
  const base = options.directusUrl.replace(/\/+$/, "");
  const doFetch = options.fetchImplementation || fetch;
  const headers = { Authorization: `Bearer ${options.directusToken}`, "Content-Type": "application/json" };
  const receipt = (id) => ({ data: {
    submission_id: id, reference: `[TEST] CW-TIP-${id}`,
    test_mode: true, status: "test_received", police_contacted: false,
    destination: "private_columbiawalks_test_intake"
  } });
  const find = async (id) => {
    const query = new URLSearchParams({
      "filter[submission_id][_eq]": id, fields: "submission_id,payload_hash", limit: "1"
    });
    const response = await doFetch(`${base}/items/${ANONYMOUS_TIP_COLLECTION}?${query}`, {
      headers, redirect: "error", signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error("test_store_unavailable");
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error("test_store_invalid_response");
    return body.data[0];
  };

  // No request/IP/body logger for this route. Reverse-proxy logs are a separate
  // operational policy; this is contact-free intake, not a promise of untraceability.
  app.post(ANONYMOUS_TIP_PATH, { bodyLimit: 128 * 1024, logLevel: "silent" }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (options.anonymousTipTestsEnabled !== true) {
      return reply.code(503).send({ error: "[TEST] Private test intake is not enabled. Nothing was submitted." });
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
      return reply.code(415).send({ error: "[TEST] Only JSON text tips are accepted." });
    }
    const validation = validateAnonymousTip(request.body);
    if (!validation.ok) return reply.code(400).send({ error: validation.error });
    const tip = validation.tip;
    const hash = createHash("sha256").update(JSON.stringify(tip)).digest("hex");
    const duplicate = (existing) => {
      if (existing.payload_hash !== hash) {
        return reply.code(409).send({ error: "[TEST] This submission ID already belongs to different content." });
      }
      return reply.code(200).send({ ...receipt(tip.submission_id), duplicate: true });
    };
    try {
      const existing = await find(tip.submission_id);
      if (existing) return duplicate(existing);
      const response = await doFetch(`${base}/items/${ANONYMOUS_TIP_COLLECTION}`, {
        method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ ...tip, payload_hash: hash, received_at: new Date().toISOString() })
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.errors?.some((error) => error.extensions?.code === "RECORD_NOT_UNIQUE")) {
          const saved = await find(tip.submission_id);
          if (saved) return duplicate(saved);
        }
        throw new Error("test_store_rejected");
      }
      if (!body.data?.id || body.data.submission_id !== tip.submission_id) {
        throw new Error("test_store_unconfirmed");
      }
      return reply.code(201).send(receipt(tip.submission_id));
    } catch {
      // Never log provider bodies, narratives, headers, tokens, or destination configuration.
      return reply.code(503).send({ error: "[TEST] Storage could not be confirmed. Retry the same saved test; police were not contacted." });
    }
  });
}
