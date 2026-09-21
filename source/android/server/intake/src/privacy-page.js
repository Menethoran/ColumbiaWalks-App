const PRIVACY_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

export const PRIVACY_POLICY_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Privacy policy for the ColumbiaWalks pedestrian-safety application.">
  <link rel="canonical" href="https://www.columbiawalks.com/privacy-policy/">
  <title>Privacy Policy | ColumbiaWalks</title>
  <style>
    :root { color-scheme: light; --ink: #173c50; --muted: #52656f; --green: #2f8f68; --paper: #fffdf8; --line: #dce5e2; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: #f2f6f4; font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header, main, footer { width: min(760px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 56px 0 24px; }
    .eyebrow { margin: 0 0 8px; color: var(--green); font-size: .82rem; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(2.25rem, 8vw, 4rem); line-height: 1.05; letter-spacing: 0; }
    .effective { margin: 14px 0 0; color: var(--muted); }
    main { padding: 28px clamp(22px, 5vw, 48px) 42px; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 18px 50px rgba(23, 60, 80, .08); }
    h2 { margin: 34px 0 8px; font-size: 1.35rem; line-height: 1.3; }
    h2:first-child { margin-top: 0; }
    p, ul { margin: 0 0 16px; }
    li + li { margin-top: 8px; }
    a { color: #176848; font-weight: 700; }
    footer { padding: 28px 0 48px; color: var(--muted); font-size: .94rem; }
    @media (max-width: 520px) { header { padding-top: 36px; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">ColumbiaWalks</p>
    <h1>Privacy Policy</h1>
    <p class="effective">Effective September 21, 2026</p>
  </header>
  <main>
    <h2>Overview</h2>
    <p>ColumbiaWalks is an independent community pedestrian-safety application for Columbia, Pennsylvania. This policy explains what information the ColumbiaWalks mobile application and related website submission pages handle and why.</p>

    <h2>Information you choose to provide</h2>
    <ul>
      <li>Safety reports may include a selected, photo-provided, or device-provided location; guided report answers; free-text details; vehicle details; an optional photo; whether you affirmatively opted in to an eligible email; and the specific test or official destination you authorized. A photo is not required for a standard Quick or Full CW report.</li>
      <li>Trash-can submissions include a public-comment or private-complaint type, one to three fixed categories, a required comment, at least one location reference (a canonical public-can ID, address, or coordinates), and an optional photo. The submission record does not ask for or store a name, contact detail, account identifier, or device identifier. "Anonymous" describes that application record; it does not mean network transmission is unobservable.</li>
      <li>App feedback includes a category and message. If you open the optional contact section, it may also include contact details and whether you consent to being contacted.</li>
      <li>Beta tester requests include an iOS or Android choice, name, the Apple or Google account email used for testing access, a Columbia street name without a house number, optional comments, consent, and request status.</li>
    </ul>
    <p>The app does not require an account. Optional contact fields may be left blank.</p>
    <p>The Community police-tip assistant is different from a ColumbiaWalks submission. When opened by itself, its draft stays on your device until you copy it, and ColumbiaWalks does not receive or store that text or your police-tip evidence. When you choose Submit to CW &amp; Notify CBPD, the CW report is saved first and the app prepares a separate tip draft from those report fields. In either path, ColumbiaWalks does not send the draft or media to CBPD. If you continue, the app opens the Columbia Borough Police Department's external website, where you must choose anonymity, paste and review the text, attach any evidence, personally make the site's attestation, complete reCAPTCHA, and press its Submit button. Opening the site is not delivery, and ColumbiaWalks cannot confirm receipt. The Police Department website controls its own collection, receipt, retention, and privacy practices.</p>

    <h2>Photos, location, and device permissions</h2>
    <ul>
      <li>Camera or photo-library access is used only when you choose to attach a photo.</li>
      <li>When available, location metadata embedded in a camera or selected photo is read on your device to suggest the report location. You may review and override the suggested location manually.</li>
      <li>If a photo does not provide a usable location, you may choose device location or enter the location manually. Location is not required for every reporting path.</li>
    </ul>
    <p>ColumbiaWalks removes embedded metadata from report and trash-can photos before saving or uploading the processed copy. You can decline camera, photo-library, or report-location access and use the available manual options instead.</p>

    <h2>Estimated weather context</h2>
    <p>After ColumbiaWalks receives a report with an incident location and time, the server may request model-derived estimated conditions for that place and hour from <a href="https://open-meteo.com/">Open-Meteo</a>. Before making that request, the server rounds the incident coordinates to two decimal places. It sends Open-Meteo only those rounded incident coordinates and the incident calendar date and hour. It does not send the phone's live location, report narrative, photo, contact information, or ColumbiaWalks report or submission ID. The request comes from the ColumbiaWalks server rather than the phone, so it does not expose the reporter's device IP address to Open-Meteo; Open-Meteo may process the server request under its own <a href="https://open-meteo.com/en/terms">terms and privacy information</a>.</p>
    <p>ColumbiaWalks may store the returned estimated conditions with the report together with provenance identifying the provider and the rounded query location and incident time. These values are model-derived estimates, not measurements taken by the phone or proof of the conditions a person experienced. Open-Meteo data is attributed to Open-Meteo under the <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International license (CC BY 4.0)</a>.</p>
    <p>Weather enrichment is best-effort and server-side. An Open-Meteo timeout, outage, or missing result never blocks acceptance or storage of the report; the report continues without estimated weather. This processing adds no phone permission, does not start background location access, and does not cause the mobile app to contact Open-Meteo directly.</p>

    <h2>Optional walking activity</h2>
    <p>If you explicitly start walk tracking, ColumbiaWalks uses location while an Android foreground service and persistent notification are active to calculate distance on your device. Tracking stops when you end it.</p>
    <p>If you explicitly choose Health Connect import on Android 14 or later, ColumbiaWalks requests read access only to walking exercise sessions and distance. After you review and agree to submit, ColumbiaWalks uploads only aggregate distance, duration, time range, activity count, source, and app version. Raw routes, unrelated health records, and device identifiers are not uploaded. You can use the reporting features without starting walk tracking or connecting Health Connect.</p>

    <h2>How information is used</h2>
    <p>We use submitted information to receive, review, and follow up on pedestrian-safety reports and app feedback; calculate aggregate walking statistics when users opt in; manage requested iOS TestFlight and Android Google Play testing access; operate and improve the service; prevent misuse; and support community safety analysis and advocacy.</p>
    <p>Ordinary safety reports, police-interaction reports, feedback, and contact information remain private by default. A report submitted through the Page of Shame path is reviewed by an administrator before its metadata-stripped photo and optional description can appear publicly. The full license plate is not published automatically.</p>
    <p>Trash-can public comments begin in a private moderation queue. Only administrator-approved or redacted public text and its fixed categories may appear in the public trash-can feed, and only when the comment is linked to an active entry in the canonical public trash-can inventory. The raw comment, photo, submitted address or coordinates, submission ID, app version, and submission source are not returned in that feed.</p>
    <p>Trash-can complaints remain in a separate private collection with a new-review status. They and their photos are never included in the public trash-can feed. Submitting a trash-can complaint does not automatically send it to Columbia Borough or another government recipient.</p>
    <p>Reports go first to ColumbiaWalks. Version 3.16.1 defaults to field-test destination mode. The eligible-report control is collapsed, off by default, and enabled only when its separate photo and in-area location safeguards are met. Those safeguards do not block submission of the underlying standard CW report. If you affirmatively opt in specifically for the test destination, ColumbiaWalks may generate an email marked [TEST] and send it only to a ColumbiaWalks-controlled test mailbox. The Police Chief, Mayor, and Codes Department do not receive a field-test message.</p>
    <p>A separate official destination mode may later be enabled. It still requires your destination-specific authorization and is limited to these routes: a crosswalk-encroachment or Repeat Reporting vehicle crosswalk-incursion report to the Police Chief and Mayor, or a missing-sidewalk report to the Codes Department. Authorization for the test mailbox cannot be reused for official routing, and authorization for official routing cannot be reused for testing. No other report category activates automatic official email.</p>
    <p>An eligible official email includes the reported issue, observation time, location and coordinates, reporter comments, a ColumbiaWalks report reference, and the saved metadata-stripped photo. A police-route email also prominently displays a license plate and state when the reporter supplied them; the attached photo remains the underlying evidence.</p>
    <p>Beta tester requests and trash-can complaints remain private and are not included in public maps, public insights, the public trash-can feed, or the Page of Shame.</p>

    <h2>Storage and transmission</h2>
    <p>Pending reports, feedback, trash-can submissions, and walking summaries may be stored on your device until submission succeeds. Submitted information is sent over HTTPS to ColumbiaWalks services. ColumbiaWalks disables Android backup for its private local app data. We retain submitted information for as long as reasonably necessary for the purposes described above, to protect the service, and to meet legal obligations.</p>
    <p>To deliver and protect the service, ColumbiaWalks and its reverse-proxy or hosting providers necessarily process connection metadata, including an IP address, while a request is in transit. That metadata is not written into a trash-can submission record or returned in the public trash-can feed. Infrastructure access or security logs are separate from submission records, access-restricted, and retained under the documented operational retention period.</p>
    <p>The website-distributed Android app may send anonymous self-update lifecycle events containing a random event identifier, event type, current and target app versions, time, platform, and an allowlisted failure reason. These events do not contain a persistent device identifier, contact information, or location. The Google Play build disables this self-update workflow.</p>

    <h2>Sharing and tracking</h2>
    <p>We do not sell personal information and do not use it for third-party advertising or cross-app tracking. A field-test email remains within the configured ColumbiaWalks test mailbox and is not sent to a government recipient. Except for an eligible official-destination email that you specifically authorize as described above, ColumbiaWalks does not routinely send private submissions, contact information, walking summaries, or other user information to a government agency. Information may also be handled by service providers that operate ColumbiaWalks infrastructure, disclosed when required by law or to protect rights and safety, or published as described above after review.</p>
    <p>When you deliberately leave the app for the official Police Department form, information you enter or attach there is sent directly to that external service rather than through ColumbiaWalks. Opening the external page does not itself submit a tip, and ColumbiaWalks cannot confirm anonymity, receipt, investigation, or delivery.</p>
    <p>If official destination mode is enabled and an authorized email reaches a government recipient, that email and its attachment may be retained and may become subject to Pennsylvania public-records, litigation, retention, or disclosure requirements. ColumbiaWalks cannot control, retrieve, or delete a copy after it reaches a recipient.</p>
    <p>ColumbiaWalks is independent and is not a government agency. Sending or authorizing an official email does not guarantee acknowledgment, investigation, correction, enforcement, or any other response. ColumbiaWalks is not an emergency service; contact 911 for an emergency.</p>

    <h2>Your choices</h2>
    <p>You may delete locally saved reports from the app. To ask about access, correction, or deletion of submitted information, use <a href="https://www.columbiawalks.com/report/#contact-us">Contact Us</a> and include enough detail to identify the submission. Robert, the current ColumbiaWalks contact, is also listed at <a href="tel:7174669069">(717) 466-9069</a>. Some information may be retained where legally required or reasonably necessary to protect the service.</p>

    <h2>Children</h2>
    <p>ColumbiaWalks is a general-audience community-safety service and is not directed to children under 13. Do not submit a child's personal contact information.</p>

    <h2>Changes</h2>
    <p>We may update this policy as the app or our practices change. The effective date above identifies the current version.</p>
  </main>
  <footer>
    <a href="https://www.columbiawalks.com/">Return to ColumbiaWalks</a>
  </footer>
</body>
</html>`;

function sendPrivacyPolicy(reply) {
  for (const [name, value] of Object.entries(PRIVACY_HEADERS)) {
    reply.header(name, value);
  }
  return reply.type("text/html; charset=utf-8").send(PRIVACY_POLICY_HTML);
}

export function registerPrivacyPolicyRoutes(app) {
  app.get("/privacy-policy", async (_request, reply) =>
    reply
      .code(308)
      .header("Location", "/privacy-policy/")
      .send()
  );
  app.get("/privacy-policy/", async (_request, reply) =>
    sendPrivacyPolicy(reply)
  );
}
