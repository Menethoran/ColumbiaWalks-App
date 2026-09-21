import { createHash } from "node:crypto";

import { OFFICIAL_EMAIL_RULE_IDS } from "./official-email-policy.js";

export function officialEmailMessageId(dedupeKey) {
  const digest = sha256(Buffer.from(String(dedupeKey), "utf8")).slice(0, 40);
  return `<cw.official.v1.${digest}@columbiawalks.com>`;
}

export function buildOfficialEmailMessage({
  delivery,
  report,
  photoBytes,
  sender = "columbiawalks@gmail.com",
  messageDate = new Date()
}) {
  if (!Buffer.isBuffer(photoBytes) || photoBytes.length === 0) {
    throw new Error("A non-empty saved report photo is required.");
  }
  const to = addressList(delivery?.recipient_to ?? delivery?.to);
  const cc = addressList(delivery?.recipient_cc ?? delivery?.cc);
  if (to.length === 0) throw new Error("At least one configured recipient is required.");

  const dedupeKey = String(delivery?.dedupe_key || delivery?.dedupeKey || "");
  if (!dedupeKey) throw new Error("A delivery dedupe key is required.");
  const destinationMode = String(delivery?.destination_mode || "");
  if (destinationMode !== "test" && destinationMode !== "official") {
    throw new Error("A valid official-email destination mode is required.");
  }
  const messageId = officialEmailMessageId(dedupeKey);
  const route = String(delivery?.route || "");
  const issue = issueLabel(delivery?.rule_id || delivery?.ruleId);
  const location = locationLabel(report);
  const plate = route === "police_mayor" ? plateLabel(report) : "";
  const subjectParts = ["ColumbiaWalks report", issue];
  if (plate) subjectParts.push(`Plate ${plate}`);
  if (location) subjectParts.push(location);
  const subject = cleanHeader(
    `${destinationMode === "test" ? "[TEST] " : ""}${subjectParts.join(" — ")}`
  );
  const body = messageBodies({
    report,
    issue,
    location,
    plate,
    route,
    destinationMode
  });

  const stable = sha256(Buffer.from(dedupeKey, "utf8"));
  const outer = `cw-mixed-${stable.slice(0, 24)}`;
  const alternative = `cw-alt-${stable.slice(24, 48)}`;
  const filename = `ColumbiaWalks-${safeFilename(report?.client_report_id)}.jpg`;
  const headers = [
    `From: ColumbiaWalks <${cleanAddress(sender)}>`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${encodedHeader(subject)}`,
    `Date: ${new Date(messageDate).toUTCString()}`,
    `Message-ID: ${messageId}`,
    `X-ColumbiaWalks-Delivery-ID: ${cleanHeader(delivery?.delivery_id || "")}`,
    `X-ColumbiaWalks-Report-ID: ${cleanHeader(report?.client_report_id || "")}`,
    `X-ColumbiaWalks-Destination-Mode: ${destinationMode}`,
    "Auto-Submitted: auto-generated",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${outer}"`
  ];
  const mime = [
    ...headers,
    "",
    `--${outer}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
    `--${alternative}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldedBase64(Buffer.from(body.text, "utf8")),
    `--${alternative}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldedBase64(Buffer.from(body.html, "utf8")),
    `--${alternative}--`,
    "",
    `--${outer}`,
    `Content-Type: image/jpeg; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${filename}"`,
    "",
    foldedBase64(photoBytes),
    `--${outer}--`,
    ""
  ].join("\r\n");
  const mimeBytes = Buffer.from(mime, "utf8");
  return {
    subject,
    text: body.text,
    html: body.html,
    attachment: Object.freeze({
      filename,
      contentType: "image/jpeg",
      byteLength: photoBytes.length,
      sha256: sha256(photoBytes)
    }),
    messageId,
    messageSha256: sha256(mimeBytes),
    photoSha256: sha256(photoBytes),
    raw: mimeBytes.toString("base64url")
  };
}

function messageBodies({
  report,
  issue,
  location,
  plate,
  route,
  destinationMode
}) {
  const reference = text(report?.client_report_id) || "Not recorded";
  const observed = text(report?.observed_at) || "Not recorded";
  const weather = text(report?.weather_summary);
  const weatherAttribution = text(report?.weather_attribution);
  const coordinates = coordinateLabel(report);
  const details = text(report?.details) || "No additional comments were supplied.";
  const severity = humanize(report?.severity) || "Not selected";
  const categories = Array.isArray(report?.categories)
    ? report.categories.map(humanize).filter(Boolean).join(", ")
    : "";
  const supplementalRows = relevantStructuredRows(report, route);
  const mapUrl = mapLink(report);
  const plateText = route === "police_mayor"
    ? `LICENSE PLATE: ${plate || "Not recorded — review attached photograph"}\n\n`
    : "";
  const testNoticeText = destinationMode === "test"
    ? "TEST ROUTING: This field-test message was sent only to the configured ColumbiaWalks test mailbox. It was not delivered to the Police Chief, Mayor, or Codes Department.\n\n"
    : "";
  const plainLines = [
    `${testNoticeText}${plateText}This automated message was generated by ColumbiaWalks from a community-submitted, unverified safety observation. ColumbiaWalks is independent; this message is not an official finding or an emergency request.`,
    "Submission or email delivery does not guarantee review, response, enforcement, or correction. If a message reaches a government recipient, it may be retained or disclosed as a public record.",
    "",
    `Issue: ${issue}`,
    `Observed: ${observed}`,
    ...(weather ? [`Weather: ${weather}`] : []),
    ...(weatherAttribution ? [`Weather source: ${weatherAttribution}`] : []),
    `Location: ${location || "Not recorded"}`,
    `Coordinates: ${coordinates || "Not recorded"}`,
    ...(mapUrl ? [`Map: ${mapUrl}`] : []),
    `Severity selected by reporter: ${severity}`,
    ...(categories ? [`Categories: ${categories}`] : []),
    ...supplementalRows.map(([label, value]) => `${label}: ${value}`),
    `ColumbiaWalks report ID: ${reference}`,
    "",
    "Reporter comments:",
    details,
    "",
    "Attachment: one metadata-stripped JPEG saved with this report."
  ];
  const plateHtml = route === "police_mayor"
    ? `<h1 style="font-size:24px;margin:0 0 18px">LICENSE PLATE: ${escapeHtml(plate || "Not recorded — review attached photograph")}</h1>`
    : "";
  const testNoticeHtml = destinationMode === "test"
    ? "<p style=\"padding:12px;border:2px solid #9b1c1c;color:#7f1d1d;font-weight:800\">TEST ROUTING: Sent only to the configured ColumbiaWalks test mailbox. Not delivered to the Police Chief, Mayor, or Codes Department.</p>"
    : "";
  const rows = [
    ["Issue", issue],
    ["Observed", observed],
    ...(weather ? [["Weather", weather]] : []),
    ...(weatherAttribution ? [["Weather source", weatherAttribution]] : []),
    ["Location", location || "Not recorded"],
    ["Coordinates", coordinates || "Not recorded"],
    ["Severity selected by reporter", severity],
    ...(categories ? [["Categories", categories]] : []),
    ...supplementalRows,
    ["ColumbiaWalks report ID", reference]
  ].map(([label, value]) =>
    `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`
  ).join("");
  return {
    text: plainLines.join("\n"),
    html: `<!doctype html><html><body>${testNoticeHtml}${plateHtml}<p><strong>This automated message was generated by ColumbiaWalks from a community-submitted, unverified safety observation.</strong> ColumbiaWalks is independent; this message is not an official finding or an emergency request.</p><p>Submission or email delivery does not guarantee review, response, enforcement, or correction. If a message reaches a government recipient, it may be retained or disclosed as a public record.</p><table>${rows}</table>${mapUrl ? `<p><a href="${escapeHtml(mapUrl)}">View reported coordinates on a map</a></p>` : ""}<h2>Reporter comments</h2><p style="white-space:pre-wrap">${escapeHtml(details)}</p><p>Attachment: one metadata-stripped JPEG saved with this report.</p></body></html>`
  };
}

function relevantStructuredRows(report, route) {
  const rows = [];
  if (report?.sidewalk_lip_height) {
    rows.push(["Sidewalk lip height", humanize(report.sidewalk_lip_height)]);
  }
  if (route !== "police_mayor") return rows;
  const details = report?.vehicle_details && typeof report.vehicle_details === "object"
    ? report.vehicle_details
    : {};
  for (const [key, label] of [
    ["year", "Vehicle year"],
    ["make", "Vehicle make"],
    ["model", "Vehicle model"],
    ["color", "Vehicle color"],
    ["body_style", "Vehicle body style"],
    ["unit_number", "Vehicle unit number"],
    ["description", "Vehicle description"]
  ]) {
    const value = text(details[key]);
    if (value) rows.push([label, value]);
  }
  return rows;
}

function issueLabel(ruleId) {
  if (ruleId === OFFICIAL_EMAIL_RULE_IDS.POLICE_CROSSWALK) {
    return "Crosswalk encroachment";
  }
  if (ruleId === OFFICIAL_EMAIL_RULE_IDS.CODES_MISSING_SIDEWALK) {
    return "Missing sidewalk";
  }
  throw new Error("The delivery rule is not enabled for official email.");
}

function plateLabel(report) {
  const details = report?.vehicle_details && typeof report.vehicle_details === "object"
    ? report.vehicle_details
    : {};
  const plate = plateToken(details.license_plate, 20);
  const state = plateToken(details.plate_state, 32);
  return [state, plate].filter(Boolean).join(" ");
}

function plateToken(value, limit) {
  return String(value || "")
    .split(/[\r\n]/, 1)[0]
    .toUpperCase()
    .replace(/[^A-Z0-9 -]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function locationLabel(report) {
  let intersection = report?.nearest_intersection;
  if (typeof intersection === "string") {
    try {
      intersection = JSON.parse(intersection);
    } catch {
      intersection = null;
    }
  }
  return cleanDisplay(intersection?.label);
}

function coordinateLabel(report) {
  const latitude = Number(report?.latitude);
  const longitude = Number(report?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : "";
}

function mapLink(report) {
  const latitude = Number(report?.latitude);
  const longitude = Number(report?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
    : "";
}

function humanize(value) {
  return cleanDisplay(value).replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

function addressList(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map(cleanAddress).filter(Boolean);
}

function cleanAddress(value) {
  const address = String(value || "").trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error("Official email configuration contains an invalid address.");
  }
  return address;
}

function cleanHeader(value) {
  return Array.from(
    String(value || "").replace(/[\r\n\0]+/g, " ").trim()
  ).slice(0, 500).join("");
}

function cleanDisplay(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function text(value) {
  return cleanDisplay(value).slice(0, 3000);
}

function encodedHeader(value) {
  // RFC 2047 limits each encoded-word to 75 characters. The wrapper consumes
  // 12, and a 45-byte UTF-8 chunk expands to at most 60 Base64 characters.
  // Iterate by Unicode code point so a fold can never split a UTF-8 sequence.
  const chunks = [];
  let chunk = "";
  for (const character of String(value)) {
    if (chunk && Buffer.byteLength(chunk + character, "utf8") > 45) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk || chunks.length === 0) chunks.push(chunk);
  return chunks.map((part) =>
    `=?UTF-8?B?${Buffer.from(part, "utf8").toString("base64")}?=`
  ).join("\r\n ");
}

function foldedBase64(bytes) {
  return bytes.toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function safeFilename(value) {
  return String(value || "report").replace(/[^0-9A-Za-z_-]+/g, "-").slice(0, 80);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
