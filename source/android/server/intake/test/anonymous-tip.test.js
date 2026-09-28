import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import { buildApp } from "../src/app.js";
import { ANONYMOUS_TIP_PATH as path } from "../src/anonymous-tip-routes.js";
import { markTestText, plainTipText, TIP_FIELDS, validateAnonymousTip } from "../src/anonymous-tip-validation.js";

const id = "6abb02ac-7e8d-49cd-a53d-18b041bc9c11";
const input = () => ({
  submission_id: id, app_version: "3.17.0", past_or_inactive_confirmed: true,
  test_only_acknowledged: true,
  fields: { subject: "Fixture test", observed_time: "2026-09-27 10:00 EDT",
    location: "Synthetic location", observation: "Synthetic observation only" }
});
function alternating(text) {
  const tokens = text.split(" ");
  assert.ok(tokens.length >= 3);
  for (let i = 0; i < tokens.length; i += 2) assert.equal(tokens[i], "[TEST]");
  assert.equal(tokens.at(-1), "[TEST]");
}

test("every field is marked, including optional placeholders and existing/case-varied markers", () => {
  for (const value of ["one two three", "[test] one\n[TEST] two", "α\u00a0β\u200bγ", "", "[TEST]"]) {
    const marked = markTestText(value);
    alternating(marked);
    assert.equal(markTestText(marked), marked);
  }
  const result = validateAnonymousTip(input());
  assert.equal(result.ok, true);
  for (const key of [...Object.keys(TIP_FIELDS), "notice"]) alternating(result.tip[key]);
  assert.equal(result.tip.police_contacted, false);
  assert.equal(result.tip.test_mode, true);
});

test("validation blocks destination overrides, identifiers, media, bad confirmation and oversized content", () => {
  for (const extra of [{ test_mode: false }, { destination: "official" }, { email: "test@example.invalid" },
    { device_id: "device" }, { photo: "anything" }, { submission_id: "not-an-id" },
    { past_or_inactive_confirmed: "true" }, { test_only_acknowledged: false },
    { app_version: "3.17.1" }, { app_version: "3.17.0-public" }]) {
    assert.equal(validateAnonymousTip({ ...input(), ...extra }).ok, false);
  }
  for (const fields of [{ email: "test@example.invalid" }, { observation: "[TEST]" },
    { subject: "x".repeat(129) }, { location: {} }, { observation: "x".repeat(5001) }]) {
    assert.equal(validateAnonymousTip({ ...input(), fields: { ...input().fields, ...fields } }).ok, false);
  }
  const max = input(); max.fields.observation = "a ".repeat(2499) + "a";
  assert.equal(validateAnonymousTip(max).ok, true);
  max.fields.observation = markTestText(max.fields.observation);
  assert.equal(validateAnonymousTip(max).ok, true);
  assert.equal(plainTipText(max.fields.observation).length, 4999);
});

async function fixture(t, settings = {}) {
  const rows = new Map(); const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    assert.ok(url.startsWith("http://directus.invalid/items/anonymous_tip_tests"), "No public or official routing");
    if (settings.fail) throw new Error("secret provider body should never reach logs");
    if (options.method !== "POST") {
      return Response.json({ data: rows.has(id) ? [rows.get(id)] : [] });
    }
    const row = JSON.parse(options.body);
    const saved = { ...row, id: 1 }; rows.set(row.submission_id, saved);
    if (settings.ambiguous) { settings.ambiguous = false; throw new Error("connection lost after storage"); }
    if (settings.race) {
      settings.race = false;
      return Response.json({ errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }] }, { status: 409 });
    }
    return Response.json({ data: saved });
  };
  const app = await buildApp({ directusUrl: "http://directus.invalid", directusToken: "fixture-token",
    anonymousTipTestsEnabled: settings.enabled ?? true, fetchImplementation: fakeFetch,
    officialEmailQueue: { enqueue() { assert.fail("Tips must never enter email outbox"); } },
    logger: settings.logger ?? false });
  t.after(() => app.close());
  const send = (payload = input()) => app.inject({ method: "POST", url: path, payload });
  return { app, send, rows, calls };
}

test("endpoint is disabled unless explicitly enabled", async (t) => {
  const { send, calls } = await fixture(t, { enabled: false });
  assert.equal((await send()).statusCode, 503);
  assert.equal(calls.length, 0);
});
test("stored receipt is private, marked, and retry is idempotent", async (t) => {
  const { app, send, rows, calls } = await fixture(t);
  const result = await send();
  assert.equal(result.statusCode, 201);
  assert.equal(result.json().data.reference, `[TEST] CW-TIP-${id}`);
  assert.equal(result.json().data.police_contacted, false);
  const row = rows.get(id);
  for (const key of [...Object.keys(TIP_FIELDS), "notice"]) alternating(row[key]);
  assert.ok(!Object.hasOwn(row, "email") && !Object.hasOwn(row, "ip"));
  assert.equal((await send()).statusCode, 200);
  assert.equal(calls.filter(({options}) => options.method === "POST").length, 1);
  const changed = input(); changed.fields.subject = "Different content";
  assert.equal((await send(changed)).statusCode, 409);
  assert.equal((await app.inject({ url: path })).statusCode, 404);
  assert.equal(result.headers["cache-control"], "no-store");
});
test("connection loss after commit and concurrent duplicate both recover without duplicate storage", async (t) => {
  const f = await fixture(t, { ambiguous: true });
  assert.equal((await f.send()).statusCode, 503);
  assert.equal((await f.send()).statusCode, 200);
  assert.equal(f.rows.size, 1);
  const g = await fixture(t, { race: true });
  assert.equal((await g.send()).statusCode, 200);
  assert.equal(g.rows.size, 1);
});
test("no success on storage failure and no narrative, IP, or provider logging", async (t) => {
  const logs = [];
  const stream = new Writable({ write(chunk, encoding, next) { logs.push(chunk.toString()); next(); } });
  const { app, send } = await fixture(t, { fail: true, logger: { stream } });
  assert.equal((await send()).statusCode, 503);
  const bad = await app.inject({ method: "POST", url: path,
    headers: { "content-type": "application/json" }, payload: "{bad" });
  assert.equal(bad.statusCode, 400);
  const huge = await app.inject({ method: "POST", url: path, payload: { subject: "a".repeat(130 * 1024) } });
  assert.equal(huge.statusCode, 413);
  assert.equal(logs.join(""), "");
});
