import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfficialEmailMessage,
  officialEmailMessageId
} from "../src/official-email-message.js";

const report = {
  client_report_id: "72ca1d8c-3e93-423b-a334-814d3eedaf76",
  observed_at: "Sep 12, 2026 9:30 AM",
  categories: ["crosswalk_safety"],
  severity: "high",
  details: "Driver entered <the crosswalk> & remained there.",
  latitude: 40.0337,
  longitude: -76.5044,
  nearest_intersection: { label: "3rd Street & Locust Street" },
  weather_status: "estimated",
  weather_summary:
    "Estimated weather near the reported location: 74°F; partly cloudy.",
  weather_attribution:
    "Weather data by Open-Meteo.com (CC BY 4.0); nearest hourly estimate selected by ColumbiaWalks.",
  vehicle_details: {
    license_plate: "abc-1234\r\nBcc: attacker@example.com",
    plate_state: "Pennsylvania",
    year: "2024",
    make: "Ford",
    model: "Explorer",
    color: "Blue",
    body_style: "SUV",
    unit_number: "Unit 7",
    description: "Marked vehicle"
  }
};

test("builds a deterministic police message with a prominent, safe plate", () => {
  const delivery = {
    delivery_id: "cb749124-f70d-48db-abf2-82192708d852",
    dedupe_key:
      "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
    rule_id: "police_crosswalk_v1",
    route: "police_mayor",
    destination_mode: "official",
    recipient_to: ["chief@example.gov"],
    recipient_cc: ["mayor@example.gov"]
  };
  const first = buildOfficialEmailMessage({
    delivery,
    report,
    photoBytes: Buffer.from("jpeg bytes"),
    messageDate: new Date("2026-09-12T13:30:00Z")
  });
  const second = buildOfficialEmailMessage({
    delivery,
    report,
    photoBytes: Buffer.from("jpeg bytes"),
    messageDate: new Date("2026-09-12T13:30:00Z")
  });

  assert.equal(first.messageId, officialEmailMessageId(delivery.dedupe_key));
  assert.equal(first.messageSha256, second.messageSha256);
  assert.equal(first.raw, second.raw);
  assert.deepEqual(first.attachment, {
    filename: "ColumbiaWalks-72ca1d8c-3e93-423b-a334-814d3eedaf76.jpg",
    contentType: "image/jpeg",
    byteLength: Buffer.byteLength("jpeg bytes"),
    sha256: first.photoSha256
  });
  assert.doesNotMatch(first.subject, /^\[TEST\]/);
  assert.match(first.subject, /Plate PENNSYLVANIA ABC-1234/);
  assert.match(first.text, /^LICENSE PLATE: PENNSYLVANIA ABC-1234/);
  assert.doesNotMatch(first.subject, /attacker/i);
  assert.match(first.html, /<h1[^>]*>LICENSE PLATE:/);
  assert.match(first.html, /&lt;the crosswalk&gt; &amp; remained there/);
  assert.match(first.text, /Vehicle year: 2024/);
  assert.match(first.text, /Vehicle make: Ford/);
  assert.match(first.text, /Vehicle model: Explorer/);
  assert.match(first.text, /Vehicle color: Blue/);
  assert.match(first.text, /Vehicle body style: SUV/);
  assert.match(first.text, /Vehicle unit number: Unit 7/);
  assert.match(first.text, /Vehicle description: Marked vehicle/);
  assert.match(first.text, /Weather: Estimated weather near/);
  assert.match(first.text, /Weather source: Weather data by Open-Meteo\.com/);
  assert.match(first.html, /Estimated weather near/);
  assert.match(
    first.text,
    /does not guarantee review, response, enforcement, or correction/
  );
  assert.match(first.text, /retained or disclosed as a public record/);
  assert.match(
    first.html,
    /does not guarantee review, response, enforcement, or correction/
  );
  assert.match(first.html, /retained or disclosed as a public record/);

  const mime = Buffer.from(first.raw, "base64url").toString("utf8");
  assert.match(mime, /^From: ColumbiaWalks <columbiawalks@gmail.com>/);
  assert.match(mime, /To: chief@example.gov/);
  assert.match(mime, /Cc: mayor@example.gov/);
  assert.equal((mime.match(/Content-Disposition: attachment/g) || []).length, 1);
  assert.match(mime, /Content-Type: image\/jpeg/);
  assert.doesNotMatch(mime, /\r\nBcc: attacker@example.com\r\n/);
});

test("Codes messages omit police plate emphasis", () => {
  const message = buildOfficialEmailMessage({
    delivery: {
      delivery_id: "8ea1fb28-8bc9-4bfd-9331-5a4c84a57dc0",
      dedupe_key:
        "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:codes_missing_sidewalk_v1",
      rule_id: "codes_missing_sidewalk_v1",
      route: "codes",
      destination_mode: "official",
      recipient_to: ["codes@example.gov"],
      recipient_cc: []
    },
    report: { ...report, sidewalk_lip_height: "over_half_inch" },
    photoBytes: Buffer.from("jpeg bytes"),
    messageDate: new Date("2026-09-12T13:30:00Z")
  });
  assert.match(message.subject, /Missing sidewalk/);
  assert.doesNotMatch(message.subject, /Plate/);
  assert.doesNotMatch(message.text, /LICENSE PLATE/);
  assert.doesNotMatch(message.html, /LICENSE PLATE/);
  assert.match(message.text, /community-submitted, unverified safety observation/);
  assert.match(message.text, /Sidewalk lip height: Over Half Inch/);
  assert.match(message.html, /Sidewalk lip height/);
});

test("test destination puts TEST first and uses only the intercepted mailbox", () => {
  const message = buildOfficialEmailMessage({
    delivery: {
      delivery_id: "3b45d447-02d8-4b9f-af5b-1ed6bcb71504",
      dedupe_key:
        "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
      rule_id: "police_crosswalk_v1",
      route: "police_mayor",
      destination_mode: "test",
      recipient_to: ["field-test@example.invalid"],
      recipient_cc: []
    },
    report: {
      ...report,
      vehicle_details: {
        ...report.vehicle_details,
        license_plate: "ABCDEFGHIJKLMNOPQRSTUVWX"
      }
    },
    photoBytes: Buffer.from("jpeg bytes"),
    messageDate: new Date("2026-09-12T13:30:00Z")
  });
  assert.match(message.subject, /^\[TEST\] ColumbiaWalks report/);
  assert.match(message.subject, /ABCDEFGHIJKLMNOPQRST/);
  assert.doesNotMatch(message.subject, /UVWX/);
  assert.match(message.text, /^TEST ROUTING:/);
  assert.match(message.html, /TEST ROUTING:/);
  const mime = Buffer.from(message.raw, "base64url").toString("utf8");
  assert.match(mime, /^To: field-test@example\.invalid$/m);
  assert.doesNotMatch(mime, /^Cc:/m);
  assert.match(mime, /^X-ColumbiaWalks-Destination-Mode: test$/m);
  assert.doesNotMatch(mime, /chief@example\.gov|mayor@example\.gov|codes@example\.gov/);
});

test("long non-ASCII subjects use compliant UTF-8 encoded-word folding", () => {
  const delivery = {
    delivery_id: "3b45d447-02d8-4b9f-af5b-1ed6bcb71504",
    dedupe_key:
      "v1:72ca1d8c-3e93-423b-a334-814d3eedaf76:police_crosswalk_v1",
    rule_id: "police_crosswalk_v1",
    route: "police_mayor",
    destination_mode: "test",
    recipient_to: ["field-test@example.invalid"],
    recipient_cc: []
  };
  const message = buildOfficialEmailMessage({
    delivery,
    report: {
      ...report,
      nearest_intersection: {
        label: "Café 🚶 crossing at Locust Street and a deliberately long intersection label"
      }
    },
    photoBytes: Buffer.from("jpeg bytes"),
    messageDate: new Date("2026-09-12T13:30:00Z")
  });
  const mime = Buffer.from(message.raw, "base64url").toString("utf8");
  const subjectHeader = extractFoldedSubject(mime);
  const encodedWords = subjectHeader.match(/=\?UTF-8\?B\?[^?]*\?=/gi) || [];

  assert.ok(encodedWords.length > 1);
  for (const word of encodedWords) {
    assert.ok(word.length <= 75, `encoded-word is ${word.length} characters`);
  }
  const decoded = encodedWords.map((word) => {
    const match = /^=\?UTF-8\?B\?([^?]*)\?=$/i.exec(word);
    return Buffer.from(match[1], "base64").toString("utf8");
  }).join("");
  assert.equal(decoded, message.subject);
  assert.match(decoded, /^\[TEST\]/);
  assert.match(decoded, /Café 🚶/);
});

function extractFoldedSubject(mime) {
  const lines = mime.split("\r\n");
  const start = lines.findIndex((line) => line.startsWith("Subject: "));
  assert.notEqual(start, -1);
  const values = [lines[start].slice("Subject: ".length)];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!/^[ \t]/.test(lines[index])) break;
    values.push(lines[index].trimStart());
  }
  return values.join(" ");
}
