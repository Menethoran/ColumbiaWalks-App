# ColumbiaWalks server deployment

The live Directus origin is:

```text
https://directus.rndtech.org
```

Version 0.7.5 sends multi-select Quick and Full reports, structured police/vehicle fields,
category-gated checklist responses, optional coordinates, closest-intersection
estimates, and optional photographs to:

```text
POST /columbiawalks-api/reports
```

Anonymous-by-default product feedback is sent to:

```text
POST /columbiawalks-api/feedback
```

Anonymous Android update lifecycle events are sent to:

```text
POST /columbiawalks-api/app-update-events
```

Run `../directus-3.13-app-update-events-upgrade.cjs` inside the Directus
container before deploying that endpoint. The migration creates the private
`app_update_events` collection and grants the intake policy create-only access.
The payload intentionally excludes device, contact, and location identifiers.

The included `intake` directory is a purpose-built Docker service. It protects
the Directus token, validates the report, normalizes the photograph, and links
the resulting Directus file to `safety_reports.photo`.

## Version 3.16 trash-can comments and complaints

Version 3.16 adds one intake endpoint with two deliberately separate workflows.
Its application records do not accept or store contact, account, or device
identifiers; this is the product's precise meaning of anonymous intake. Network
transmission is not unobservable, and reverse-proxy or hosting infrastructure
may necessarily process connection metadata while delivering and protecting
the service:

```text
POST /columbiawalks-api/trash-can-submissions
```

The endpoint accepts either `application/json`, for reliable queued text and
location submissions, or `multipart/form-data` with one JSON `submission`
field and at most one `photo` file. The JSON object requires a client-generated
`submission_id` UUID, `kind`, one to three allowlisted `categories`, a
3–2,000-character `comment`, and at least one locator: a canonical
`public_trash_can_id` UUID, a nonempty `address`, or a complete
`latitude`/`longitude` pair. `asset_scope` defaults to `public`; its allowed
values are `public`, `private_property`, and `unknown`. Public comments require
public scope. Optional `submission_source` is limited to `android`, `ios`,
`web`, or `unknown`. Contact, account, device, and arbitrary extra fields are
rejected rather than stored.

`kind=public_comment` accepts these categories:

- `clean_well_maintained`
- `needs_cleaning`
- `full_or_overflowing`
- `damaged`
- `hard_to_access`
- `poor_location`
- `request_new_can`
- `other`

`kind=private_complaint` accepts these categories:

- `full_or_overflowing`
- `damaged`
- `missing`
- `odor_or_pests`
- `illegal_dumping`
- `unsafe_or_obstructing`
- `missed_service`
- `other`

Public comments are written only to `trash_can_comments` with
`moderation_status=moderation_pending`. Complaints are written only to
`trash_can_complaints` with `status=new` and `privacy_status=private`. An
optional image is decoded, auto-rotated, bounded to 1,920 by 1,920, and
re-encoded as JPEG without source EXIF, GPS, XMP, IPTC, or filename metadata.
It remains a private evidence file. A UUID replay returns HTTP 200 with
`duplicate=true`; a new submission returns HTTP 201. Reusing a UUID across the
two kinds is rejected with HTTP 409.

The public read endpoint is:

```text
GET /columbiawalks-api/public/trash-cans
```

It returns a fixed projection of active `public_trash_cans` inventory rows and
only approved `trash_can_comments` whose canonical can ID appears in that same
active inventory response. It does not query `trash_can_complaints`. It never
returns raw comments, private photos or file IDs, submitted coordinates or
addresses, submission UUIDs, app versions, submission sources, contact data,
or unlinked/fake/inactive-can comments. Moderators publish a comment by placing
reviewed or redacted text in `public_comment`, setting
`moderation_status=approved`, and recording `approved_at`; the raw `comment`
field is never the public source.

Authenticated Directus administrators also receive trash-can inventory,
public-comment moderation records, and private complaints in the ColumbiaWalks
admin dashboard response. The backend exposes two same-origin,
administrator-only workflow endpoints:

```text
POST /columbiawalks-api/admin/trash-can-comments/:recordId/moderate
POST /columbiawalks-api/admin/trash-can-complaints/:recordId/status
```

Comment moderation accepts only `approve` or `reject`. Approval requires
3–2,000 characters of separately reviewed public text and an active canonical
`public_trash_can_id`; the server records the approval timestamp. Rejection
clears any prior public text and timestamp. Complaint status accepts only
`new`, `in_review`, `referred`, or `closed` and always rewrites
`privacy_status=private`. Both endpoints require an authenticated Directus
administrator session and a trusted same-origin request. They never make a
private complaint public or copy raw submitted comment text into the public
feed.

Before deploying version 3.16 intake, run the idempotent migration inside the
Directus container with a short-lived administrator token:

```bash
ADMIN_TOKEN='SHORT_LIVED_ADMIN_TOKEN' \
  node /directus/directus-3.16-trash-cans-upgrade.cjs
```

The same 3.16 deployment also requires the idempotent weather-field migration
before intake 1.12.0 is started:

```bash
ADMIN_TOKEN='SHORT_LIVED_ADMIN_TOKEN' \
  node /directus/directus-3.16-weather-upgrade.cjs
```

That migration makes and integrity-checks its own SQLite backup, adds only the
readonly server-owned weather fields to `safety_reports`, and expands only the
existing private intake policy's Create and Read field allowlists. It refuses
to invent a broader permission. Run both migrations and inspect their JSON
verification output before setting `WEATHER_ENRICHMENT_ENABLED=true` and
starting the new intake container.

The configured `api.open-meteo.com` and historical hosts are Open-Meteo's
free/open-access service. Before production enablement, confirm ColumbiaWalks
qualifies for that service's noncommercial terms and quotas; otherwise use an
appropriate commercial or self-hosted arrangement. Weather enrichment is
best-effort and has no authority to block report storage.

The migration first creates and integrity-checks a SQLite backup, then creates
or reconciles `public_trash_cans`, `trash_can_comments`, and
`trash_can_complaints`. It gives the private intake policy only the explicit
read/create field allowlists needed by the service and refuses to finish if any
other explicit policy, wildcard field access, or unexpected action exists on
those collections. It creates no Directus Public permission. Public clients
must always read through the allowlisting intake endpoint. Deploy both 3.16
migrations before the version 3.16 intake container.

Version 3.14 continuous reporting adds structured rapid-report hierarchy,
sidewalk lip-height, vehicle issue, session sequence, and photo-location
provenance fields. Before deploying the matching intake or Android build, run
`../directus-3.14-continuous-reporting-upgrade.cjs` inside the Directus
container with a short-lived administrator token:

```bash
ADMIN_TOKEN='SHORT_LIVED_ADMIN_TOKEN' \
  node /directus/directus-3.14-continuous-reporting-upgrade.cjs
```

The migration creates and verifies a SQLite backup, adds or reconciles the nine
`safety_reports` fields, expands an existing intake-policy Create field list
without creating a broader permission, and labels historic locations as
`legacy` or `none`. Deploy the migration first, then intake, then Android; the
intake always forwards normalized provenance fields, including defaults for old
clients.

## Version 3.15 official-email outbox

Version 3.15 records both a reporter's explicit `official_email_authorized`
choice and the exact `official_email_destination_authorized` value (`test` or
`official`). It can prepare a durable server-side email from the ColumbiaWalks
Gmail account. Gmail credentials never belong in Android, iOS, Directus
content, Compose environment values, logs, or the repository.

Only two exact rules are enabled:

- `crosswalk_encroachment`, or the continuous vehicle subtype
  `crosswalk_incursion`, uses the police-and-mayor logical route.
- `missing_sidewalk` uses the Codes logical route.

Logical route and actual destination are separate. Version 3.15 defaults to
`OFFICIAL_EMAIL_DESTINATION_MODE=test`. In test mode, both eligible rules go
only to `OFFICIAL_EMAIL_TEST_RECIPIENT`, Cc is empty, and `[TEST]` is the first
subject token. Police, Mayor, and Codes addresses never appear in a test-mode
message or outbox recipient snapshot. `official` destination mode instead uses
the configured route recipients. A report is eligible only when its stored
destination authorization exactly matches the active destination mode, so
changing the server mode cannot repurpose test consent for an official send.

Generic categories, comments containing similar words, speeding, aggressive
driving, illegal U-turns, and highway/public-works reports do not create an
active delivery. Both rules also require `submission_mode=quick`, so adding an
eligible-looking quick type to a Full or Page of Shame payload cannot activate
email. The policy additionally requires a stored photograph and coordinates
within 5 km of Columbia Borough center. Version 3.15 fixes this center and
radius so mobile disclosure and server enforcement cannot diverge. The report
remains stored if any email prerequisite or email service is unavailable.

Before deploying the 3.15 intake, run the reversible Directus migration inside
the Directus container with a short-lived administrator token:

```bash
ADMIN_TOKEN='SHORT_LIVED_ADMIN_TOKEN' \
  node /directus/directus-3.15-official-email-upgrade.cjs
```

The migration creates and verifies a SQLite backup, adds
`safety_reports.official_email_authorized` with a false default, adds nullable
`safety_reports.official_email_destination_authorized`, adds the
`missing_sidewalk` Directus choice, and creates the private
`official_email_deliveries` outbox, including review-preview subject/body,
bound-attachment metadata, content hashes, preview time, and a separate preview
attempt counter. It grants the configured intake policy only
Create, Read, and Update access to the outbox and refuses to continue if that
policy has Delete access or if any other explicit policy can access the outbox.
Those three private-service actions use all outbox fields because this Directus
edition does not support adding a new field-restricted custom rule; the outbox
is not exposed to an app or Public token. The migration narrowly expands the
existing `safety_reports`
Create and Read field lists for the two authorization fields and authoritative
duplicate/outbox reconciliation. It never creates a Public permission and does
not authorize any historical report.

### Delivery modes

`OFFICIAL_EMAIL_MODE` is server-controlled:

- `disabled` (the default) records an authorized matching report as disabled
  when the outbox is available and never contacts Gmail.
- `review` fetches the same bound, normalized JPEG and uses the same MIME builder
  as automatic mode, then stores the exact subject, plain-text body, HTML body,
  attachment filename/type/size/hash, photo hash, MIME hash, and preview time on
  the private `review` row. It never constructs a Gmail client or contacts Gmail.
  The raw MIME and a duplicate photo are not stored. This is the safe initial
  production mode while recipients, disclosures, and abuse controls are verified.
- `automatic` starts the single-concurrency worker. This value must be set
  deliberately in deployment configuration; no public request can enable it.

`OFFICIAL_EMAIL_DESTINATION_MODE` is a separate routing control:

- `test` is the version 3.15 default. Review or automatic delivery requires one
  valid `OFFICIAL_EMAIL_TEST_RECIPIENT`; the reserved `example.invalid` value in
  examples is documentation only and must be replaced on the server.
- `official` requires all three server-owned `OFFICIAL_EMAIL_POLICE_CHIEF`,
  `OFFICIAL_EMAIL_MAYOR`, and `OFFICIAL_EMAIL_CODES` values.

The sender is fixed to `columbiawalks@gmail.com`. Do not add a
client-controlled recipient, sender, route, template, or destination-mode
field. Intake responses expose the auditable server result at
`official_email.destination_mode`, and every returned delivery plus its private
Directus row carries the same `destination_mode`.

Automatic mode requires OAuth credentials authorized only for
`https://www.googleapis.com/auth/gmail.send`. Store the three values in
root-managed Docker secret files and uncomment the matching mounts and file
paths in `intake/compose.example.yml`:

```text
/run/secrets/gmail_oauth_client_id
/run/secrets/gmail_oauth_client_secret
/run/secrets/gmail_oauth_refresh_token
```

The account's normal password is never used. Complete the one-time OAuth
authorization outside the container, copy only the resulting client values and
refresh token into these files, set the owner/group and modes consistently with
the existing Directus token secret, and never print them during validation.

Every job has a unique report-and-rule dedupe key and deterministic RFC 5322
`Message-ID`. A successful Gmail response stores Gmail message/thread IDs and a
sent timestamp. Explicit HTTP 429 and 5xx responses receive bounded backoff;
other provider rejections are blocked. A network timeout/reset during send, an
expired `sending` lease, or a crash after Gmail acceptance is `uncertain` and
is never automatically resent. The narrow `gmail.send` scope cannot search
Sent mail, so an administrator must reconcile an uncertain row using its
stored Message-ID. This intentionally favors no duplicate official report over
an unsafe automatic retry.

`OFFICIAL_EMAIL_DAILY_CAP` counts recipients in the rolling 24-hour window,
including uncertain sends. A test-mode message counts as one; an official
police-chief message copied to the mayor counts as two. Jobs above the cap move
to `held_cap` and are checked again after a
one-hour delay; they are not silently discarded. Keep one intake/mailer worker
replica; the Directus lease is crash protection for this single-worker
deployment, not a distributed lock. An expired `preparing` lease is safe to
retry because Gmail was not called; an expired `sending` lease is uncertain and
cannot be retried automatically.

The intake service's September 18, 2026 privacy-policy source explains that
test mode sends only to a ColumbiaWalks-controlled mailbox, while a separately
authorized official-mode message may reach designated government contacts and
become a public record. Deploy that policy and align the mobile-store
disclosures before enabling automatic delivery. ColumbiaWalks remains an
independent project; forwarding does not make a report an official finding or
guarantee emergency response, enforcement, or correction.

For the 3.15 field test, keep `OFFICIAL_EMAIL_MODE=disabled` until the migration
and mailbox configuration are verified. Then use `review` with destination
`test`; inspect that every eligible row has `destination_mode=test`, only the
test mailbox in `recipient_to`, an empty `recipient_cc`, and matching stored
test authorization. Also verify `preview_subject` starts with `[TEST]`, inspect
`preview_text` and `preview_html`, and match `preview_attachment.photo_id` and
its SHA-256 to the stored normalized JPEG. Do not switch destination mode to
`official` as part of the field test.

## Before deploying

In Directus:

1. Add an optional `photo` field to `safety_reports`.
2. Use a UUID field with the Image or File interface and a many-to-one
   relationship to `directus_files`.
3. Add `assessment_mode` as a string field with a `quick_report` default.
4. Add `checklist_responses` as a JSON field with a `{}` default.
5. Add the structured report fields, including `quick_report_types`, listed in
   `../BACKEND_RECOMMENDATION.md`, and make `location`, `latitude`, and
   `longitude` nullable.
6. Run `../directus-0.7.5-feedback-upgrade.sh` to create or update the
   `feedback_submissions` collection.
7. Create a dedicated intake service user and static token.
8. Give that policy only the permissions listed in
   `../BACKEND_RECOMMENDATION.md`.

On the Docker server:

Before deployment, audit logging at every layer. The intake application's
request serializer deliberately omits client address, client port, headers,
query strings, and request bodies. Traefik global access logs and Docker/host
logs are independent of that application setting. Verify whether those logs
are enabled, minimize client-address and header fields wherever operationally
possible, restrict access, configure rotation and a finite retention period,
and make the published privacy policy match the verified configuration. Do not
describe a submission as untraceable.

```bash
cd server/intake
mkdir -p secrets
chmod 700 secrets
printf '%s' 'PASTE_THE_DIRECTUS_SERVICE_TOKEN_HERE' \
  > secrets/directus_token.txt
chown root:1000 secrets/directus_token.txt
chmod 640 secrets/directus_token.txt
cp compose.example.yml compose.yml
```

Edit `compose.yml` to match the existing Traefik resolver and external network
names. The packaged default matches this deployment:

- Traefik network: `St_Peter` (override with `TRAEFIK_NETWORK`)
- Directus internal network: `directus_internal`
- Directus container DNS name: `directus`
- Certificate resolver: `letsencrypt`

Deploy:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 columbiawalks-intake
```

Test:

```bash
curl --fail \
  https://directus.rndtech.org/columbiawalks-api/health
```

Expected:

```json
{"status":"ok"}
```

## Private admin dashboard

The intake service also provides a read-only operations dashboard at:

```text
https://www.columbiawalks.com/columbiawalks-admin
```

Administrators sign in with an existing Directus account. Directus access and
refresh tokens are held only in Secure, HTTP-only, SameSite cookies, and every
data request runs under that administrator's own Directus permissions. The
dashboard combines safety reports, feedback, pedestrian profiles, police
complaints, and anonymous Android update event totals when those collections
are available.

Run `../directus-1.8-submission-channel-upgrade.cjs` inside the Directus
container before deploying submission-channel tracking. The migration adds a
server-controlled, non-identifying `submission_channel` field and labels older
web reports as device not recorded rather than guessing their browser platform.

Aggregate views and CSV exports intentionally exclude contact names, email
addresses, telephone numbers, street addresses, contact notes, and internal
review notes. The Traefik rule must route both `/columbiawalks-api` and
`/columbiawalks-admin` to the intake service; the example Compose file includes
both paths.

After an app report succeeds, disable Public Create access to
`safety_reports`. Do not enable Public Create on `directus_files`.

## Development tests

```bash
cd server/intake
npm install
npm test
```

The test suite covers report and feedback validation, multipart report intake,
photo normalization, Directus file creation, feedback workflow defaults,
administrator access controls, privacy-safe aggregation, the report/file
relationship, exact official-email routing, replay-resistant duplicate
reconciliation, no-send review rendering, RFC-compliant UTF-8 subject folding,
Gmail ambiguity handling, rate caps, and outbox failure safety.
It also covers JSON and multipart trash-can intake, kind-specific category and
locator validation, UUID replay handling, metadata stripping, orphan cleanup,
strict public projection, canonical active-can linkage, complaint isolation,
the migration's fail-closed permission assertions, query-free and
address-free request logging, and suppression of private trash-can text from
Directus failure logs.
