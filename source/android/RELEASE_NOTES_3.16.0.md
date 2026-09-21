# ColumbiaWalks 3.16.0

Development candidate identity: `3.16.0 (31600)`.

## Added

- A new Community destination replaces the single-purpose Feedback tab while
  preserving the existing feedback form.
- A local-only anonymous-police-tip drafting assistant for past, non-active
  matters. It prepares structured subject and narrative text, surfaces verified
  emergency/dispatch/station call routes, and hands the user to the Columbia
  Borough Police Department's official CRIMEWATCH form. ColumbiaWalks does not
  receive the draft or evidence, and the app never represents opening the form
  as submission.
- Separate Trash Can paths:
  - moderated public comments about public trash cans;
  - private can complaints that are not published or automatically forwarded
    to the Borough.
- Offline-safe Android and iOS JSON queues for trash-can submissions.
- A server-side trash-can API with strict field/category validation,
  idempotency, separate collections, metadata-stripped optional-photo support,
  and an allowlisted public feed.
- Backup-first Directus migrations for canonical cans, moderated comments,
  private complaints, and readonly server-derived weather fields.
- Best-effort server-side Open-Meteo enrichment that stores model-derived
  estimated conditions and provenance with a report. Only two-decimal incident
  coordinates and the incident date/hour leave ColumbiaWalks for this request;
  the app adds no permission and weather failure never blocks the report.

## Privacy and safety

- Police-tip text remains on the device until the user deliberately copies it
  into the official external form. Evidence is attached directly on that site.
- The official site, not ColumbiaWalks, controls anonymous submission,
  attestation, reCAPTCHA, evidence acceptance, and final receipt.
- Public trash-can text is private until a moderator approves or redacts it.
  Raw text, private complaints, photos, submitted locations, and submission
  metadata are not exposed by the public endpoint.
- No user account or contact field was added to either trash-can path.
- No unverified trash-can pins or inventory records ship with this candidate.
- Open-Meteo does not receive live phone location, report narrative, photo,
  contact information, or report/submission ID. Its weather data is attributed
  under CC BY 4.0.

## Release status

This source candidate is not a live release. The Directus migrations and server
deployment have not been run, no production-signed mobile artifact has been
created, and no Play Store, TestFlight, App Store, or public-availability state
is implied by these notes.

Local candidate verification completed with 55 Android JVM tests, Android lint
and debug assembly, 191 intake-service tests, all release-readiness/static
contract verifiers, and Android emulator visual QA at normal and enlarged text.
The iOS target still requires an Xcode build/test and simulator/physical-device
visual QA on a Mac.
