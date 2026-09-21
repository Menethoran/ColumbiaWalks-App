# ColumbiaWalks 3.16.0 for iPhone

Release identity: `3.16.0 (31600)`.

- Replaces the Feedback tab with a Community hub while preserving App
  Feedback as a nested screen.
- Adds a local-only police-tip drafting assistant for past, non-active matters.
  It copies structured Subject and Message text and can open the official
  Columbia Borough Police site, but it does not upload or persist the draft,
  select media, make the user's attestation, solve reCAPTCHA, or claim that a
  tip was submitted.
- Adds moderated public-trash-can comments and a separate private can-complaint
  form with exact category/scoping rules, a required written location, an
  optional confirmed map pin, protected local JSON, and foreground retry.
- Keeps the existing eligible report-email field test pinned to the
  ColumbiaWalks-controlled test mailbox.
- Documents best-effort server-side Open-Meteo context: only two-decimal
  incident coordinates and the incident date/hour are sent for model-derived
  estimates and provenance. No live phone location, narrative, photo, contact,
  or report ID is sent; no iPhone permission is added, and weather failure
  never blocks a report. Open-Meteo data is attributed under CC BY 4.0.

This source has static/parser/project validation on Linux, but it has not been
compiled with Xcode or tested on an iPhone. The trash-can and weather Directus
migrations and intake deployment have not been run. No TestFlight/App Store upload or live
availability is represented by this file.
