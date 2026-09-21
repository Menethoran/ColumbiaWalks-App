import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

function adminUser(adminAccess = true) {
  return {
    data: {
      id: "admin-user",
      email: "admin@example.com",
      first_name: "ColumbiaWalks",
      last_name: "Admin",
      role: {
        id: "admin-role",
        name: "Administrator",
        policies: [{ policy: { admin_access: adminAccess } }]
      }
    }
  };
}

function fakeDirectus({ adminAccess = true } = {}) {
  return async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/auth/login") {
      return Response.json({
        data: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires: 900000
        }
      });
    }
    if (path === "/users/me") return Response.json(adminUser(adminAccess));
    if (path === "/auth/logout") return new Response(null, { status: 204 });
    if (path === "/items/safety_reports") {
      return Response.json({
        data: [{
          id: 1,
          date_created: new Date().toISOString(),
          categories: ["unsafe_crossing"],
          severity: "high",
          review_status: "new",
          submission_mode: "web"
        }]
      });
    }
    if (path === "/items/feedback_submissions") return Response.json({ data: [] });
    if (path === "/items/police_complaints") {
      return Response.json(
        { errors: [{ extensions: { code: "FORBIDDEN" } }] },
        { status: 403 }
      );
    }
    if (path === "/items/app_update_events") {
      return Response.json({ data: [{
        id: 2,
        event_id: "cc9fb7b7-f757-4eeb-a4cc-365bdb295f41",
        event_type: "installed",
        from_version_code: 31400,
        from_version_name: "3.14.0",
        target_version_code: 31400,
        target_version_name: "3.14.0",
        occurred_at: new Date().toISOString(),
        platform: "android"
      }] });
    }
    if (path === "/items/beta_tester_requests") {
      return Response.json({ data: [
        {
          id: 31,
          request_id: "85edfb32-0b21-463a-8851-0117dbd55e85",
          date_created: "2026-08-21T15:30:00.000Z",
          platform: "ios",
          account_name: "Ivy Walker",
          account_email: "ivy@example.com",
          columbia_street: "Locust Street",
          comments: "I can test VoiceOver.",
          status: "new"
        },
        {
          id: 32,
          request_id: "2994c36f-0135-4bcc-bcaa-3bd40c2301cc",
          date_created: "2026-08-21T15:35:00.000Z",
          platform: "android",
          account_name: "Andy Walker",
          account_email: "andy@example.com",
          columbia_street: "Cherry Street",
          comments: "",
          status: "invited"
        },
        {
          id: 33,
          platform: "ios",
          account_name: "Already Added",
          account_email: "added@example.com",
          status: "added"
        }
      ] });
    }
    throw new Error(`Unexpected Directus request: ${url} ${options.method || "GET"}`);
  };
}

async function appWith(fetchImplementation) {
  return buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "service-token",
    fetchImplementation,
    logger: false
  });
}

test("serves a no-index admin page with a strict content policy", async () => {
  const app = await appWith(fakeDirectus());
  const response = await app.inject({ method: "GET", url: "/columbiawalks-admin" });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /ColumbiaWalks Admin/);
  assert.match(response.body, /Beta tester requests/);
  assert.match(response.body, /Add people to the Apple beta tester list/);
  assert.match(
    response.body,
    /appstoreconnect\.apple\.com\/apps\/6803712364\/testflight\/groups\/3c145254-5bb7-42d4-9200-9c5ac936b46d/
  );
  assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(
    response.headers["content-security-policy"],
    /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/
  );
  assert.equal(
    response.headers["referrer-policy"],
    "strict-origin-when-cross-origin"
  );
  assert.equal(response.headers["x-frame-options"], "DENY");
  await app.close();
});

test("authenticates Directus administrators with secure HTTP-only cookies", async () => {
  const app = await appWith(fakeDirectus());
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/login",
    headers: { origin: "https://www.columbiawalks.com" },
    payload: { email: "admin@example.com", password: "correct-password" }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.email, "admin@example.com");
  assert.doesNotMatch(response.body, /access-token|refresh-token|correct-password/);
  const cookies = response.headers["set-cookie"];
  assert.ok(Array.isArray(cookies));
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((cookie) => /HttpOnly/.test(cookie)));
  assert.ok(cookies.every((cookie) => /SameSite=Strict/.test(cookie)));
  assert.ok(cookies.every((cookie) => /Secure/.test(cookie)));
  await app.close();
});

test("blocks authenticated non-admin users", async () => {
  const app = await appWith(fakeDirectus({ adminAccess: false }));
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/login",
    headers: { origin: "https://www.columbiawalks.com" },
    payload: { email: "viewer@example.com", password: "password" }
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("returns sanitized dashboard and pending beta queues only with an admin session", async () => {
  const app = await appWith(fakeDirectus());
  const unauthorized = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/admin/dashboard"
  });
  assert.equal(unauthorized.statusCode, 401);

  const response = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/admin/dashboard?range=90",
    headers: {
      cookie: "cw_admin_access=access-token; cw_admin_refresh=refresh-token"
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.totals.safety_reports, 1);
  assert.equal(response.json().data.available_collections.police_complaints, false);
  assert.equal(response.json().data.available_collections.app_update_events, true);
  assert.equal(response.json().data.available_collections.beta_tester_requests, true);
  assert.equal(response.json().data.update_metrics.confirmed_installs, 1);
  assert.equal(response.json().data.beta_tester_requests.total, 2);
  assert.equal(response.json().data.beta_tester_requests.ios[0].email, "ivy@example.com");
  assert.equal(response.json().data.beta_tester_requests.android[0].email, "andy@example.com");
  assert.doesNotMatch(response.body, /added@example\.com/);
  assert.doesNotMatch(response.body, /contact_email|contact_phone|internal_notes/);
  await app.close();
});

test("allows only an authenticated administrator to dismiss an added beta tester", async () => {
  let dismissedPayload = null;
  const fetchImplementation = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/users/me") return Response.json(adminUser(true));
    if (
      parsed.pathname === "/items/beta_tester_requests/31" &&
      (options.method || "GET") === "GET"
    ) {
      return Response.json({ data: { id: 31, status: "new", platform: "ios" } });
    }
    if (
      parsed.pathname === "/items/beta_tester_requests/31" &&
      options.method === "PATCH"
    ) {
      dismissedPayload = JSON.parse(options.body);
      return Response.json({ data: { id: 31, status: "added" } });
    }
    throw new Error(`Unexpected Directus request: ${url} ${options.method || "GET"}`);
  };
  const app = await appWith(fetchImplementation);

  const unauthorized = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/beta-testers/31/dismiss",
    headers: { origin: "https://www.columbiawalks.com" }
  });
  assert.equal(unauthorized.statusCode, 401);

  const forbiddenOrigin = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/beta-testers/31/dismiss",
    headers: {
      origin: "https://attacker.example",
      cookie: "cw_admin_access=access-token"
    }
  });
  assert.equal(forbiddenOrigin.statusCode, 403);

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/beta-testers/31/dismiss",
    headers: {
      origin: "https://www.columbiawalks.com",
      cookie: "cw_admin_access=access-token"
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data, { id: 31, status: "added" });
  assert.deepEqual(dismissedPayload, { status: "added" });
  await app.close();
});

test("allows only an authenticated administrator to approve a Page of Shame photo", async () => {
  let approvedPayload = null;
  const fetchImplementation = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/users/me") return Response.json(adminUser(true));
    if (
      parsed.pathname === "/items/safety_reports/17" &&
      (options.method || "GET") === "GET"
    ) {
      return Response.json({
        data: {
          id: 17,
          submission_mode: "pos",
          publication_status: "pending_review",
          review_status: "new",
          photo: "80ebdd44-daa3-42b5-bfe1-3d8ef28dad2d",
          details: "A blocked sidewalk",
          nearest_intersection: { label: "Third & Locust" },
          latitude: 40.0337,
          longitude: -76.5044
        }
      });
    }
    if (
      parsed.pathname === "/items/safety_reports/17" &&
      options.method === "PATCH"
    ) {
      approvedPayload = JSON.parse(options.body);
      return Response.json({ data: { id: 17 } });
    }
    throw new Error(`Unexpected Directus request: ${url} ${options.method || "GET"}`);
  };
  const app = await appWith(fetchImplementation);

  const unauthorized = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/page-of-shame/17/approve",
    headers: { origin: "https://www.columbiawalks.com" }
  });
  assert.equal(unauthorized.statusCode, 401);

  const forbiddenOrigin = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/page-of-shame/17/approve",
    headers: {
      origin: "https://attacker.example",
      cookie: "cw_admin_access=access-token"
    }
  });
  assert.equal(forbiddenOrigin.statusCode, 403);

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/admin/page-of-shame/17/approve",
    headers: {
      origin: "https://www.columbiawalks.com",
      cookie: "cw_admin_access=access-token"
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().data, {
    id: 17,
    publication_status: "published",
    review_status: "approved"
  });
  assert.equal(approvedPayload.publication_status, "published");
  assert.equal(approvedPayload.review_status, "approved");
  assert.equal(
    approvedPayload.public_photo,
    "80ebdd44-daa3-42b5-bfe1-3d8ef28dad2d"
  );
  assert.equal(approvedPayload.public_caption, "A blocked sidewalk");
  assert.equal(approvedPayload.public_location_label, "Third & Locust");
  assert.equal(approvedPayload.publish_full_plate, false);
  assert.match(approvedPayload.published_at, /^2026-|^2027-/);
  await app.close();
});

