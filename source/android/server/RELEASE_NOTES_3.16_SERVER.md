# ColumbiaWalks 3.16 server release notes

## Identifier-free trash-can records

- Added `POST /columbiawalks-api/trash-can-submissions` for plain JSON or
  multipart submissions with one optional photo.
- Separated `public_comment` and `private_complaint` into distinct Directus
  collections and workflow states.
- Added UUID idempotency, kind-specific category allowlists, required comment
  text, public/private/unknown asset scope, canonical public-can IDs, and a
  required locator.
- Re-encodes optional images as bounded JPEGs without source metadata and
  removes an uploaded file if record creation fails.
- Rejects contact, account, device, and unrecognized fields so the application
  record contains no submitted identity field. This does not claim that HTTPS
  transmission is technically unobservable.

## Moderated public data

- Added `GET /columbiawalks-api/public/trash-cans` for an allowlisted projection
  of active canonical public cans and administrator-approved public comments.
- The public route does not query the complaint collection and does not expose
  raw comments, photos/file IDs, submitted locations, submission UUIDs, app
  versions, sources, or contact data.
- Approved comments are returned only when their `public_trash_can_id` is in
  the active inventory returned by the same request; orphaned, fake, and
  inactive-can comments remain hidden.

## Directus and privacy

- Added `directus-3.16-trash-cans-upgrade.cjs`, an idempotent, backup-first
  migration for `public_trash_cans`, `trash_can_comments`, and
  `trash_can_complaints`.
- The migration grants only narrow private-intake permissions, creates no
  Directus Public access, and fails closed on foreign policies, unexpected
  actions, or wildcard fields.
- Updated the hosted privacy-policy source for trash-can data, moderation,
  complaint isolation, location handling, metadata-stripped photos, and the
  distinction between identifier-free records and infrastructure connection
  metadata.
- Reduced Fastify request logs to method plus a query-free path, omitting
  client addresses, ports, headers, query strings, and bodies. Directus failure
  logs now retain only safe status/code fields and cannot copy submitted
  trash-can text or addresses into the application log.
- Added an explicit deployment gate for independent Traefik, Docker, and host
  logging configuration and retention.

## Best-effort weather enrichment

- Adds server-side Open-Meteo enrichment for reports that include an incident
  location and time. The outbound request contains only incident coordinates
  rounded to two decimal places and the incident calendar date and hour.
- The Open-Meteo request excludes the phone's live location, narrative, photo,
  contact information, and ColumbiaWalks report or submission ID. The mobile
  apps do not contact Open-Meteo directly and request no new permission.
- Stores model-derived estimated conditions and their provider/query
  provenance with the report. The estimates are contextual data, not phone
  measurements or proof of the conditions a reporter experienced.
- Adds `directus-3.16-weather-upgrade.cjs`, a backup-first, idempotent schema
  migration that adds readonly server weather fields and expands only the
  existing private intake policy's Create and Read field allowlists.
- Open-Meteo data is attributed to Open-Meteo under CC BY 4.0.
- Enrichment is best-effort: a timeout, outage, or missing weather result never
  blocks report acceptance or storage, which continues without weather data.

## Compatibility and verification

- The intake package is now version 1.11.0.
- Added `ios` to the existing feedback `submission_source` allowlist, matching
  the version 3.16 iOS client.
- Added focused validation, route, image, privacy-projection, migration,
  weather, idempotency, fail-open, and iOS-feedback regression tests. The
  complete intake suite passes 191 tests.
