import assert from "node:assert/strict";
import test from "node:test";

import { createGmailApiClient, GmailApiError } from "../src/gmail-api.js";

test("refreshes OAuth and sends a raw Gmail API message", async () => {
  const calls = [];
  const client = createGmailApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("oauth2.googleapis.com")) {
        return Response.json({ access_token: "access-token", expires_in: 3600 });
      }
      return Response.json({ id: "gmail-message", threadId: "gmail-thread" });
    }
  });

  const result = await client.sendRaw("cmF3LW1lc3NhZ2U");
  assert.deepEqual(result, { id: "gmail-message", threadId: "gmail-thread" });
  assert.equal(calls.length, 2);
  assert.match(
    calls[1].url,
    /users\/columbiawalks%40gmail\.com\/messages\/send$/
  );
  assert.equal(calls[1].options.headers.Authorization, "Bearer access-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), { raw: "cmF3LW1lc3NhZ2U" });
});

test("rejects a token response that reports broader OAuth scopes", async () => {
  const client = createGmailApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImplementation: async () => Response.json({
      access_token: "access-token",
      expires_in: 3600,
      scope:
        "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
    })
  });
  await assert.rejects(client.sendRaw("cmF3"), (error) => {
    assert.ok(error instanceof GmailApiError);
    assert.equal(error.code, "oauth_scope");
    assert.equal(error.retryable, false);
    return true;
  });
});

test("marks explicit Gmail throttling as safely retryable", async () => {
  const client = createGmailApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImplementation: async (url) => url.includes("oauth2.googleapis.com")
      ? Response.json({ access_token: "access-token", expires_in: 3600 })
      : Response.json({ error: { message: "rate limited" } }, { status: 429 })
  });
  await assert.rejects(client.sendRaw("cmF3"), (error) => {
    assert.ok(error instanceof GmailApiError);
    assert.equal(error.code, "gmail_rate_limited");
    assert.equal(error.retryable, true);
    assert.equal(error.ambiguous, false);
    return true;
  });
});

test("marks a connection loss during send as uncertain and not retryable", async () => {
  let call = 0;
  const client = createGmailApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImplementation: async () => {
      call += 1;
      if (call === 1) {
        return Response.json({ access_token: "access-token", expires_in: 3600 });
      }
      throw new Error("socket reset after upload");
    }
  });
  await assert.rejects(client.sendRaw("cmF3"), (error) => {
    assert.ok(error instanceof GmailApiError);
    assert.equal(error.code, "send_ambiguous_network");
    assert.equal(error.retryable, false);
    assert.equal(error.ambiguous, true);
    assert.doesNotMatch(error.message, /client-secret|refresh-token/);
    return true;
  });
});

test("OAuth network failures remain safe to retry because no send started", async () => {
  const client = createGmailApiClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    fetchImplementation: async () => {
      throw new Error("offline");
    }
  });
  await assert.rejects(client.sendRaw("cmF3"), (error) => {
    assert.ok(error instanceof GmailApiError);
    assert.equal(error.code, "oauth_network");
    assert.equal(error.retryable, true);
    assert.equal(error.ambiguous, false);
    return true;
  });
});
