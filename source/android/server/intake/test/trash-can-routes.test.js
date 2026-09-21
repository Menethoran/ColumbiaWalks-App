import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { buildApp } from "../src/app.js";

const SUBMISSION_ID = "a9927f31-6d65-4bf0-8fa6-7a92481de4a1";
const CAN_ID = "b046815a-1bb7-43a2-bb8f-ddd9cd7a8c84";
const OTHER_CAN_ID = "d60b107e-ebc4-4312-b86a-60f362af569f";

function publicComment() {
  return {
    submission_id: SUBMISSION_ID,
    kind: "public_comment",
    asset_scope: "public",
    public_trash_can_id: CAN_ID,
    categories: ["needs_cleaning"],
    comment: "There is litter around this public trash can.",
    app_version: "3.16.0",
    submission_source: "android"
  };
}

function emptyReadsThen(onCreate) {
  return async (url, options) => {
    const parsed = new URL(url);
    if (options.method === "POST") return onCreate(parsed, options);
    assert.equal(options.headers.get("authorization"), "Bearer private-token");
    return Response.json({ data: [] });
  };
}

test("stores a JSON public comment as moderation pending", async () => {
  const calls = [];
  const fakeFetch = emptyReadsThen(async (url, options) => {
    calls.push({ url, options });
    assert.equal(url.pathname, "/items/trash_can_comments");
    const payload = JSON.parse(options.body);
    assert.equal(payload.moderation_status, "moderation_pending");
    assert.equal(payload.comment, publicComment().comment);
    assert.equal(payload.public_trash_can_id, CAN_ID);
    assert.equal(payload.kind, undefined);
    assert.equal(payload.public_comment, undefined);
    assert.equal(payload.privacy_status, undefined);
    assert.equal(payload.photo, undefined);
    assert.equal(payload.contact_email, undefined);
    return Response.json({ data: { id: 88, ...payload } });
  });
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: fakeFetch,
    logger: false
  });

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload: publicComment()
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.deepEqual(response.json(), {
    data: {
      submission_id: SUBMISSION_ID,
      kind: "public_comment",
      status: "moderation_pending",
      photo_attached: false
    }
  });
  assert.equal(calls.length, 1);
  await app.close();
});

test("stores a JSON complaint in its separate private collection", async () => {
  const payload = {
    ...publicComment(),
    kind: "private_complaint",
    asset_scope: "unknown",
    public_trash_can_id: undefined,
    address: "Locust Street near Third Street",
    categories: ["full_or_overflowing", "odor_or_pests"],
    comment: "The container is overflowing and has a strong odor.",
    submission_source: "ios"
  };
  let stored;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: emptyReadsThen(async (url, options) => {
      assert.equal(url.pathname, "/items/trash_can_complaints");
      stored = JSON.parse(options.body);
      return Response.json({ data: { id: 89 } });
    }),
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(stored.status, "new");
  assert.equal(stored.privacy_status, "private");
  assert.equal(stored.moderation_status, undefined);
  assert.equal(response.json().data.status, "new");
  await app.close();
});

test("treats a replayed UUID as a successful duplicate without writing", async () => {
  let calls = 0;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: async (url, options) => {
      calls += 1;
      assert.equal(options.method, undefined);
      assert.match(url, /items\/trash_can_comments/);
      return Response.json({ data: [{ submission_id: SUBMISSION_ID, photo: null }] });
    },
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload: publicComment()
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(response.json().data.status, "moderation_pending");
  assert.equal(calls, 1);
  await app.close();
});

test("rejects reuse of a UUID across the two submission kinds", async () => {
  let calls = 0;
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: async (url) => {
      calls += 1;
      const collection = new URL(url).pathname.split("/").at(-1);
      return Response.json({
        data: collection === "trash_can_complaints"
          ? [{ submission_id: SUBMISSION_ID }]
          : []
      });
    },
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload: publicComment()
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.match(response.json().error, /already been used/);
  assert.equal(calls, 2);
  await app.close();
});

test("accepts one multipart photo and strips embedded image metadata", async () => {
  const calls = [];
  let uploadedMetadata;
  let stored;
  const fakeFetch = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: options.method || "GET" });
    if (!options.method) return Response.json({ data: [] });
    if (parsed.pathname === "/files") {
      const file = options.body.get("file");
      assert.equal(file.type, "image/jpeg");
      assert.match(file.name, new RegExp(SUBMISSION_ID));
      uploadedMetadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
      return Response.json({ data: { id: "private-photo-id" } });
    }
    if (parsed.pathname === "/items/trash_can_comments") {
      stored = JSON.parse(options.body);
      return Response.json({ data: { id: 90 } });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const photo = await sharp({
    create: {
      width: 20,
      height: 10,
      channels: 3,
      background: "#17805c"
    }
  }).withMetadata({
    exif: { IFD0: { Artist: "Reporter identity must be removed" } }
  }).png().toBuffer();
  const boundary = "trash-can-photo-boundary";
  const beforePhoto = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="submission"',
    "Content-Type: application/json",
    "",
    JSON.stringify(publicComment()),
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="location.png"',
    "Content-Type: image/png",
    "",
    ""
  ].join("\r\n"));
  const afterPhoto = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([beforePhoto, photo, afterPhoto])
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.photo_attached, true);
  assert.equal(uploadedMetadata.format, "jpeg");
  assert.equal(uploadedMetadata.exif, undefined);
  assert.equal(uploadedMetadata.xmp, undefined);
  assert.equal(uploadedMetadata.iptc, undefined);
  assert.equal(stored.photo, "private-photo-id");
  assert.deepEqual(calls.map(({ path }) => path), [
    "/items/trash_can_comments",
    "/items/trash_can_complaints",
    "/files",
    "/items/trash_can_comments"
  ]);
  await app.close();
});

test("rejects an unreadable multipart photo without storing or uploading it", async () => {
  const calls = [];
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: async (url, options) => {
      calls.push({ url, method: options.method || "GET" });
      if (options.method) throw new Error("No write was expected.");
      return Response.json({ data: [] });
    },
    logger: false
  });
  const boundary = "trash-can-bad-photo";
  const body = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="submission"',
    "",
    JSON.stringify(publicComment()),
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="bad.jpg"',
    "Content-Type: image/jpeg",
    "",
    "not an image",
    `--${boundary}--`,
    ""
  ].join("\r\n"));
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.match(response.json().error, /could not be read/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ method }) => method === "GET"));
  await app.close();
});

test("removes an uploaded file when Directus rejects the record", async () => {
  const deleted = [];
  const fakeFetch = async (url, options) => {
    const parsed = new URL(url);
    if (!options.method) return Response.json({ data: [] });
    if (parsed.pathname === "/files" && options.method === "POST") {
      return Response.json({ data: { id: "orphan-photo" } });
    }
    if (parsed.pathname === "/items/trash_can_comments") {
      return Response.json({ errors: [{ message: "failed" }] }, { status: 500 });
    }
    if (parsed.pathname === "/files/orphan-photo" && options.method === "DELETE") {
      deleted.push("orphan-photo");
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request ${options.method} ${url}`);
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const photo = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "white" }
  }).png().toBuffer();
  const boundary = "trash-can-cleanup";
  const before = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="submission"',
    "",
    JSON.stringify(publicComment()),
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="photo.png"',
    "Content-Type: image/png",
    "",
    ""
  ].join("\r\n"));
  const after = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([before, photo, after])
  });
  assert.equal(response.statusCode, 502, response.body);
  assert.deepEqual(deleted, ["orphan-photo"]);
  await app.close();
});

test("public feed returns only allowlisted approved comments linked to active cans", async () => {
  const requested = [];
  const fakeFetch = async (url) => {
    const parsed = new URL(url);
    requested.push(parsed);
    if (parsed.pathname === "/items/public_trash_cans") {
      return Response.json({ data: [{
        public_trash_can_id: CAN_ID,
        label: "Locust Street public can",
        address: "Locust Street",
        latitude: 40.0337,
        longitude: -76.5044,
        description: "Public litter container",
        accessibility_notes: "Beside the curb cut",
        status: "active",
        submission_id: "secret-inventory-source",
        contact_email: "private@example.com"
      }] });
    }
    if (parsed.pathname === "/items/trash_can_comments") {
      return Response.json({ data: [
        {
          public_trash_can_id: CAN_ID,
          categories: ["clean_well_maintained", "contact_email:private@example.com"],
          public_comment: "Thank you for keeping this can clean.",
          approved_at: "2026-09-18T12:00:00Z",
          comment: "Private raw version",
          submission_id: "secret-comment-source",
          photo: "secret-photo",
          submission_source: "ios",
          latitude: 1,
          status: "new",
          complaint_text: "must never appear"
        },
        {
          public_trash_can_id: OTHER_CAN_ID,
          categories: ["other"],
          public_comment: "Approved but linked to an inactive or fake can.",
          approved_at: "2026-09-18T13:00:00Z"
        },
        {
          public_trash_can_id: null,
          categories: ["other"],
          public_comment: "Approved orphan.",
          approved_at: "2026-09-18T14:00:00Z"
        }
      ] });
    }
    throw new Error(`The public route must not query ${url}`);
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const response = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/public/trash-cans"
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers["cache-control"], /public/);
  assert.deepEqual(response.json(), {
    data: {
      trash_cans: [{
        id: CAN_ID,
        label: "Locust Street public can",
        address: "Locust Street",
        latitude: 40.0337,
        longitude: -76.5044,
        description: "Public litter container",
        accessibility_notes: "Beside the curb cut"
      }],
      comments: [{
        public_trash_can_id: CAN_ID,
        categories: ["clean_well_maintained"],
        comment: "Thank you for keeping this can clean.",
        approved_at: "2026-09-18T12:00:00Z"
      }]
    }
  });
  assert.equal(requested.length, 2);
  assert.ok(requested.every(({ pathname }) => !pathname.includes("complaint")));
  const commentRequest = requested.find(({ pathname }) =>
    pathname === "/items/trash_can_comments"
  );
  assert.equal(commentRequest.searchParams.get("filter[moderation_status][_eq]"), "approved");
  assert.equal(commentRequest.searchParams.get("filter[asset_scope][_eq]"), "public");
  assert.equal(
    commentRequest.searchParams.get("fields"),
    "public_trash_can_id,categories,public_comment,approved_at"
  );
  assert.doesNotMatch(
    response.body,
    /secret|private@example|Private raw|submission_source|complaint_text|inactive or fake|Approved orphan/
  );
  await app.close();
});

test("rejects anonymous identifier fields before contacting Directus", async () => {
  const value = publicComment();
  value.contact_email = "person@example.com";
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "private-token",
    fetchImplementation: async () => {
      throw new Error("Directus must not be contacted.");
    },
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/trash-can-submissions",
    payload: value
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.match(response.json().error, /anonymous/i);
  await app.close();
});
