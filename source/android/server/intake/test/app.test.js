import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { buildApp } from "../src/app.js";

function reportPayload() {
  return {
    client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
    observed_at: "Jul 29, 2026 12:00 PM",
    categories: ["sidewalk_safety"],
    severity: "low",
    police_response: "not_involved",
    details: "Connectivity test",
    latitude: 40.0337,
    longitude: -76.5044,
    location: {
      type: "Point",
      coordinates: [-76.5044, 40.0337]
    },
    app_version: "0.5.0",
    assessment_mode: "walkability_assessment",
    checklist_responses: {
      walk_05: "needs_attention"
    },
    reported_party_type: "civilian_driver",
    vehicle_involved: true,
    vehicle_details: {
      license_plate: "ABC1234",
      plate_state: "PA",
      emergency_lights: "unknown",
      siren: "unknown"
    },
    police_observations: [],
    police_complaint_details: "",
    submission_mode: "full",
    quick_report_type: null,
    quick_report_types: [],
    nearest_intersection: null
  };
}

function continuousPayload() {
  return {
    ...reportPayload(),
    app_version: "3.14.0",
    submission_mode: "quick",
    categories: ["sidewalk_safety"],
    rapid_report_kind: "sidewalk",
    sidewalk_lip_height: "over_half_inch",
    vehicle_issue_type: null,
    continuous_session_id: "e03e14d7-2f0b-4ec7-b48c-e1386ebd72ca",
    continuous_sequence: 7,
    location_source: "manual_map",
    photo_latitude: 40.03368,
    photo_longitude: -76.50436,
    location_overridden: true
  };
}

test("health endpoint is available without contacting Directus", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    logger: false
  });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  const publicResponse = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/health"
  });
  assert.equal(publicResponse.statusCode, 200);
  assert.deepEqual(publicResponse.json(), { status: "ok" });
  await app.close();
});

test("returns a nearest intersection tag", async () => {
  const fakeIntersectionFetch = async () =>
    new Response(JSON.stringify({
      elements: [
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.0337, lon: -76.5044 }],
          tags: { name: "3rd Street", highway: "secondary" }
        },
        {
          type: "way",
          nodes: [1],
          geometry: [{ lat: 40.0337, lon: -76.5044 }],
          tags: { name: "Locust Street", highway: "residential" }
        }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    intersectionFetchImplementation: fakeIntersectionFetch,
    logger: false
  });
  const response = await app.inject({
    method: "GET",
    url: "/columbiawalks-api/intersection?latitude=40.0337&longitude=-76.5044"
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.label, "3rd Street & Locust Street");
  assert.equal(response.json().data.major, true);
  await app.close();
});

test("accepts a multipart report without a photo", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") {
      const payload = JSON.parse(options.body);
      assert.equal(payload.assessment_mode, "walkability_assessment");
      assert.equal(
        payload.checklist_responses.walk_05,
        "needs_attention"
      );
      assert.equal(payload.reported_party_type, "civilian_driver");
      assert.equal(payload.vehicle_details.license_plate, "ABC1234");
      assert.equal(payload.submission_channel, "android_app");
      assert.equal(payload.rapid_report_kind, null);
      assert.equal(payload.continuous_session_id, null);
      assert.equal(payload.continuous_sequence, null);
      assert.equal(payload.location_source, "legacy");
      assert.equal(payload.photo_latitude, null);
      assert.equal(payload.photo_longitude, null);
      assert.equal(payload.location_overridden, false);
      return new Response(JSON.stringify({
        data: {
          id: 42,
          client_report_id: reportPayload().client_report_id,
          photo: null
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });

  const boundary = "test-boundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(reportPayload()),
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "user-agent": "ColumbiaWalks-Android/0.5.0"
    },
    payload: body
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.id, 42);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /filter%5Bclient_report_id%5D%5B_eq%5D/);
  assert.equal(calls[1].options.method, "POST");
  await app.close();
});

test("requires a picture for continuous rapid reports", async () => {
  const calls = [];
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: async (...args) => {
      calls.push(args);
      return Response.json({ data: [] });
    },
    logger: false
  });
  const report = continuousPayload();
  report.location_source = "device_gps";
  report.photo_latitude = null;
  report.photo_longitude = null;
  report.location_overridden = false;
  const boundary = "continuous-no-photo";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(report),
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "user-agent": "ColumbiaWalks-Android/3.14.0"
    },
    payload: body
  });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(
    response.json().error,
    "Continuous rapid reports require a picture."
  );
  assert.equal(calls.length, 0);
  await app.close();
});

test("forwards continuous report and location provenance fields", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/files")) {
      return Response.json({ data: { id: "continuous-photo" } });
    }
    if (url.endsWith("/items/safety_reports")) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.photo, "continuous-photo");
      assert.equal(payload.rapid_report_kind, "sidewalk");
      assert.equal(payload.sidewalk_lip_height, "over_half_inch");
      assert.equal(payload.vehicle_issue_type, null);
      assert.equal(
        payload.continuous_session_id,
        "e03e14d7-2f0b-4ec7-b48c-e1386ebd72ca"
      );
      assert.equal(payload.continuous_sequence, 7);
      assert.equal(payload.location_source, "manual_map");
      assert.equal(payload.photo_latitude, 40.03368);
      assert.equal(payload.photo_longitude, -76.50436);
      assert.equal(payload.location_overridden, true);
      return Response.json({
        data: {
          id: 314,
          client_report_id: payload.client_report_id,
          photo: payload.photo
        }
      });
    }
    return Response.json({ data: [] });
  };
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const photo = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#0A2A43"
    }
  }).png().toBuffer();
  const boundary = "continuous-photo-boundary";
  const beforePhoto = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(continuousPayload()),
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="sidewalk.png"',
    "Content-Type: image/png",
    "",
    ""
  ].join("\r\n"));
  const afterPhoto = Buffer.from(`\r\n--${boundary}--\r\n`);

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "user-agent": "ColumbiaWalks-Android/3.14.0"
    },
    payload: Buffer.concat([beforePhoto, photo, afterPhoto])
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.id, 314);
  assert.equal(calls.length, 3);
  await app.close();
});

test("serves the public privacy policy without contacting Directus", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    logger: false
  });

  const redirect = await app.inject({
    method: "GET",
    url: "/privacy-policy"
  });
  assert.equal(redirect.statusCode, 308);
  assert.equal(redirect.headers.location, "/privacy-policy/");

  const response = await app.inject({
    method: "GET",
    url: "/privacy-policy/"
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /^text\/html/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(response.body, /ColumbiaWalks/);
  assert.match(response.body, /Privacy Policy/);
  assert.match(response.body, /Effective September 18, 2026/);
  assert.match(response.body, /location metadata embedded in a camera or selected photo/);
  assert.match(response.body, /Open-Meteo/);
  assert.match(response.body, /rounds the incident coordinates to two decimal places/);
  assert.match(response.body, /incident calendar date and hour/);
  assert.match(response.body, /does not send the phone's live location, report narrative, photo, contact information/);
  assert.match(response.body, /model-derived estimated conditions/);
  assert.match(response.body, /CC BY 4\.0/);
  assert.match(response.body, /does not expose the reporter's device IP address/);
  assert.match(response.body, /Open-Meteo may process the server request/);
  assert.match(response.body, /never blocks acceptance or storage of the report/);
  assert.match(response.body, /adds no phone permission/);
  assert.match(response.body, /foreground service and persistent notification/);
  assert.match(response.body, /Health Connect import/);
  assert.match(response.body, /Raw routes, unrelated health records, and device identifiers are not uploaded/);
  assert.match(response.body, /do not sell personal information/);
  assert.match(response.body, /Health Connect/);
  assert.match(response.body, /disables Android backup/);
  assert.match(response.body, /affirmatively authorize official email/);
  assert.match(response.body, /defaults to field-test destination mode/);
  assert.match(response.body, /send it only to a ColumbiaWalks-controlled test mailbox/);
  assert.match(response.body, /do not receive a field-test message/);
  assert.match(response.body, /Authorization for the test mailbox cannot be reused for official routing/);
  assert.match(
    response.body,
    /crosswalk-encroachment or Repeat Reporting vehicle crosswalk-incursion/
  );
  assert.match(response.body, /missing-sidewalk report to the Codes Department/);
  assert.match(response.body, /No other report category activates automatic official email/);
  assert.match(response.body, /metadata-stripped photo/);
  assert.match(response.body, /The submission record does not ask for or store a name/);
  assert.match(response.body, /network transmission is unobservable/);
  assert.match(response.body, /necessarily process connection metadata/);
  assert.match(response.body, /not written into a trash-can submission record/);
  assert.match(response.body, /private moderation queue/);
  assert.match(response.body, /linked to an active entry/);
  assert.match(response.body, /Trash-can complaints remain in a separate private collection/);
  assert.match(response.body, /does not automatically send it to Columbia Borough/);
  assert.match(response.body, /license plate and state/);
  assert.match(response.body, /Pennsylvania public-records/);
  assert.match(response.body, /does not guarantee acknowledgment, investigation, correction, enforcement/);
  assert.doesNotMatch(
    response.body,
    /mailto:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  await app.close();
});

test("rejects a Page of Shame report without a picture", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: async () => {
      throw new Error("Directus should not be contacted for an invalid report.");
    },
    logger: false
  });
  const report = reportPayload();
  report.submission_mode = "pos";
  const boundary = "pos-without-photo";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(report),
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: body
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /require a picture/i);
  await app.close();
});

test("normalizes a PoS photo and holds it for administrator review", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/files")) {
      return new Response(JSON.stringify({ data: { id: "file-uuid" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.endsWith("/items/safety_reports")) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.photo, "file-uuid");
      assert.equal(payload.publication_status, "pending_review");
      assert.equal(payload.public_photo, undefined);
      assert.equal(payload.publish_full_plate, false);
      assert.equal(payload.public_caption, "Connectivity test");
      assert.equal(payload.published_at, undefined);
      assert.equal(payload.heatmap_eligible, false);
      return new Response(JSON.stringify({
        data: {
          id: 43,
          client_report_id: reportPayload().client_report_id,
          photo: "file-uuid"
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });

  const photo = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#0A2A43"
    }
  }).png().toBuffer();
  const posReport = reportPayload();
  posReport.submission_mode = "pos";
  const boundary = "photo-boundary";
  const beforePhoto = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="report"',
    "Content-Type: application/json",
    "",
    JSON.stringify(posReport),
    `--${boundary}`,
    'Content-Disposition: form-data; name="photo"; filename="test.png"',
    "Content-Type: image/png",
    "",
    ""
  ].join("\r\n"));
  const afterPhoto = Buffer.from(`\r\n--${boundary}--\r\n`);

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/reports",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    },
    payload: Buffer.concat([beforePhoto, photo, afterPhoto])
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.photo, "file-uuid");
  assert.equal(calls.length, 3);
  await app.close();
});

test("accepts feedback and assigns server-controlled tracking fields", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") {
      const payload = JSON.parse(options.body);
      assert.equal(payload.feedback_category, "bug_report");
      assert.equal(payload.submission_source, "wordpress");
      assert.equal(payload.status, "new");
      assert.deepEqual(payload.tags, ["bug_report"]);
      assert.equal(payload.contact_information_provided, true);
      return new Response(JSON.stringify({
        data: {
          id: 9,
          feedback_id: payload.feedback_id,
          status: payload.status
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/feedback",
    payload: {
      feedback_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
      feedback_category: "bug_report",
      feedback_text: "The feedback screen briefly flashed.",
      app_version: "wordpress-0.7.5",
      submission_source: "wordpress",
      contact_information_offered: true,
      contact_name: "A resident",
      contact_phone: "",
      contact_email: "resident@example.com",
      contact_street_address: "",
      contact_notes: "Email works best.",
      consent_to_contact: true
    }
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.json().data.id, 9);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /feedback_submissions/);
  assert.equal(calls[0].options.method, "POST");
  await app.close();
});

test("treats a duplicate feedback id as an idempotent success without read access", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }]
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  };

  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/feedback",
    payload: {
      feedback_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
      feedback_category: "other",
      feedback_text: "Pedestrian Profile\n{}",
      app_version: "wordpress-3.12.2",
      submission_source: "wordpress",
      contact_information_offered: false,
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      contact_street_address: "",
      contact_notes: "",
      consent_to_contact: false
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(
    response.json().data.feedback_id,
    "c5c8fe80-90d5-4778-9cd8-680f227d36b2"
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  await app.close();
});

test("stores an opt-in walking summary without route or device data", async () => {
  const calls = [];
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      const payload = JSON.parse(options.body);
      assert.equal(payload.feedback_category, "app_feedback");
      assert.deepEqual(payload.tags, ["walking_metric", "tracked_walk"]);
      assert.equal(payload.app_version, "3.14.0");
      assert.equal("route" in payload, false);
      assert.equal("device_id" in payload, false);
      return Response.json({ data: { feedback_id: payload.feedback_id } });
    },
    logger: false
  });

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/walking-metrics",
    payload: {
      metric_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
      period_start: "2026-08-18T12:00:00Z",
      period_end: "2026-08-18T12:45:00Z",
      distance_meters: 3218.688,
      duration_seconds: 2700,
      source: "tracked_walk",
      app_version: "3.14.0",
      user_consent: true
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /feedback_submissions/);
  await app.close();
});

test("rejects feedback with hidden contact fields populated", async () => {
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    logger: false
  });
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/feedback",
    payload: {
      feedback_id: "c5c8fe80-90d5-4778-9cd8-680f227d36b2",
      feedback_category: "app_feedback",
      feedback_text: "General feedback.",
      app_version: "web-0.7.5",
      submission_source: "web",
      contact_information_offered: false,
      contact_name: "Should have been hidden",
      contact_phone: "",
      contact_email: "",
      contact_street_address: "",
      contact_notes: "",
      consent_to_contact: false
    }
  });

  assert.equal(response.statusCode, 400);
  await app.close();
});

test("stores a private positive police interaction with a reference number", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    const payload = JSON.parse(options.body);
    assert.equal(payload.status, "new");
    assert.equal(payload.privacy_status, "private");
    assert.match(payload.reference_number, /^CW-PC-[0-9A-F]{8}$/);
    assert.deepEqual(payload.tags, ["helpful_or_supportive", "went_out_of_way"]);
    assert.equal(payload.interaction_sentiment, "positive");
    assert.equal(payload.reporter_perspective, "calling_for_someone");
    assert.equal(payload.contact_information_provided, false);
    return new Response(JSON.stringify({ data: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const boundary = "police-interaction-boundary";
  const complaint = {
    complaint_id: "f1fd351d-a755-43b9-85a1-164df9da5aa2",
    interaction_sentiment: "positive",
    reporter_perspective: "calling_for_someone",
    interaction_categories: ["helpful_or_supportive", "went_out_of_way"],
    call_context: "called_by_reporter",
    encounter_type: "response_to_call",
    presence_modes: ["cruiser", "on_foot"],
    safety_change: "much_safer",
    response_timeliness: "fast",
    went_out_of_way: "yes",
    safety_before_rating: 4,
    safety_during_rating: 8,
    safety_after_rating: 9,
    respect_rating: 10,
    communication_rating: 9,
    helpfulness_rating: 10,
    professionalism_rating: 9,
    fairness_rating: 9,
    outcome_rating: 9,
    agency: "Columbia Borough Police Department",
    officer_name: "",
    badge_number: "",
    unit_number: "",
    officer_description: "",
    incident_at: "2026-08-09T16:00",
    location_description: "Locust Street and Route 462",
    complaint_text: "The officer stayed and helped everyone get to a safe location.",
    witnesses_or_evidence: "",
    app_version: "web-3.13.0",
    submission_source: "web",
    contact_information_offered: false,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    contact_street_address: "",
    contact_notes: "",
    consent_to_contact: false,
    good_faith_confirmation: true
  };
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="complaint"',
    "Content-Type: application/json",
    "",
    JSON.stringify(complaint),
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/police-complaints",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body
  });

  assert.equal(response.statusCode, 201, response.body);
  assert.match(response.json().data.reference_number, /^CW-PC-/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /police_complaints/);
  assert.equal(calls[0].options.method, "POST");
  await app.close();
});

test("treats a duplicate police interaction as success without read access", async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }]
  }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
  const app = await buildApp({
    directusUrl: "http://directus:8055",
    directusToken: "test-token",
    fetchImplementation: fakeFetch,
    logger: false
  });
  const boundary = "duplicate-police-interaction";
  const complaint = {
    complaint_id: "f1fd351d-a755-43b9-85a1-164df9da5aa2",
    interaction_sentiment: "not_labeled",
    reporter_perspective: "bystander",
    interaction_categories: ["routine_observation"],
    call_context: "already_present",
    encounter_type: "community_presence",
    presence_modes: ["on_foot"],
    safety_change: "no_change",
    response_timeliness: "unknown",
    went_out_of_way: "not_applicable",
    agency: "Columbia Borough Police Department",
    complaint_text: "",
    app_version: "web-3.13.0",
    submission_source: "web",
    contact_information_offered: false,
    consent_to_contact: false,
    good_faith_confirmation: true
  };
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="complaint"',
    "Content-Type: application/json",
    "",
    JSON.stringify(complaint),
    `--${boundary}--`,
    ""
  ].join("\r\n");
  const response = await app.inject({
    method: "POST",
    url: "/columbiawalks-api/police-complaints",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().duplicate, true);
  assert.equal(response.json().data.reference_number, "CW-PC-F1FD351D");
  await app.close();
});
