# ColumbiaWalks 3.15 official-email development contract

This document defines the security and release boundaries for the 3.15.0
official-email feature. It is an implementation contract, not proof that the
feature has been deployed or that either store has published the app.

## Fixed routing scope

The server must evaluate normalized machine keys, not user-visible prose.
Email generation is permitted only when `official_email_authorized` is
strictly true, `official_email_destination_authorized` exactly matches the
server destination mode, and one of these exact rules matches:

| Rule | Required selection | Logical official route |
| --- | --- | --- |
| `police_crosswalk_v1` | Quick `crosswalk_encroachment` or Repeat vehicle `crosswalk_incursion` | Police Chief and Mayor |
| `codes_missing_sidewalk_v1` | `missing_sidewalk` | Codes |

Unknown, malformed, combined, renamed, or future categories must not send.
Aggressive driving, speeding, illegal U-turn, and other otherwise police- or
highway-related selections remain ordinary ColumbiaWalks reports in 3.15.0.

## Version 3.15 field-test destination

Delivery state (`disabled`, `review`, or `automatic`) and destination mode
(`test` or `official`) are separate server controls. Delivery defaults to
`disabled`; destination defaults to `test`. In test destination mode every
otherwise eligible crosswalk or missing-sidewalk message goes exclusively to
one server-configured ColumbiaWalks test mailbox, has an empty Cc list, and
begins its subject with `[TEST]`. No Police Chief, Mayor, or Codes address may
appear in its To/Cc headers or outbox recipient snapshot.

The test mailbox address is server configuration and must not be placed in Git,
clients, logs, screenshots, or public documentation. Examples use only the
reserved `example.invalid` domain. Official destination mode is a separate
future operation and may use the logical recipients in the table only when the
stored reporter authorization is specifically `official`; test authorization
cannot be reused after a server mode change.

## Required eligibility gates

The server—not the client—makes the final decision. Every automatic email
requires all of the following:

1. The report was stored successfully and has a stable report identifier.
2. `official_email_authorized` is strictly true. Missing, false, string, or
   legacy values fail closed.
3. `official_email_destination_authorized` equals the active server destination
   mode. Missing, legacy, or mismatched values fail closed.
4. The exact routing rule above matches.
5. A processed, metadata-stripped photo is stored and linked to the report.
6. Coordinates are valid and within 5 km of the fixed Columbia Borough center.
7. The delivery does not duplicate the report/rule/recipient set.
8. Server delivery mode, daily cap, recipient configuration, and OAuth health
   permit processing.

An outbox or email failure must never delete the already stored report or its
linked photo. A duplicate report submission should return the original report
and reconcile a missing outbox row instead of creating a duplicate email.

## Data flow

```text
mobile disclosure and submit
        |
        v
ColumbiaWalks HTTPS intake -> store normalized photo + report
        |
        v
server eligibility policy -> durable Directus delivery row
        |
        v
disabled/review/automatic worker -> ColumbiaWalks Gmail API account
        |
        v
configured ColumbiaWalks test mailbox (3.15 field test)
or separately authorized official role destination(s)
```

The mobile app has no Gmail credential and no authoritative recipient address.
Recipients are server-owned configuration so an officeholder or address can be
updated without shipping a new client. A delivery row snapshots the actual
recipient roles/addresses used so later audits are reproducible.

## Message requirements

- Sender identity is the configured ColumbiaWalks account.
- Test-destination messages have `[TEST]` as the first subject token and an
  explicit body notice that no government recipient received the field test.
- Subject and body identify ColumbiaWalks as an independent project and include
  a stable ColumbiaWalks report reference.
- The email contains the issue, observation time, confirmed location and
  coordinates, relevant selections/details, and comments.
- The processed photo is attached from the stored report object, not from
  untrusted client-supplied attachment metadata.
- Police-route messages display a reporter-typed license plate and jurisdiction
  prominently in the subject/body. If none was typed, state that it was not
  recorded and direct the reader to the attached evidence; do not claim OCR.
- User text is escaped for HTML, sanitized for plain text, and stripped of CR/LF
  before use in any header.
- UTF-8 subjects are folded into RFC 2047 encoded-words no longer than 75
  characters without splitting a Unicode code point; `[TEST]` remains the first
  decoded subject token.
- Include an independence disclaimer, public-record warning, non-emergency
  warning, and no-response/enforcement/correction guarantee.
- Use a deterministic RFC 5322 Message-ID derived from the immutable delivery
  identifier and configured sender domain.

## Outbox and send safety

Use a durable delivery collection with unique deduplication and Message-ID
constraints, immutable report and recipient snapshots, attachment/content
hashes, attempt count, lease timestamps, provider identifiers, timestamps, and
safe diagnostic fields. Never store OAuth tokens or raw provider responses in
the delivery row.

Expected lifecycle states include `review`, `queued`, `sending`, `sent`,
`retry`, `uncertain`, `blocked`, `held_cap`, and `cancelled`.

- `disabled`: intake and report storage work, but no delivery is enqueued.
- `review`: the worker revalidates the same rule, destination, location, and
  photo binding as automatic mode; fetches the stored normalized JPEG; and uses
  the same message builder. The private row retains the exact subject,
  plain-text and HTML bodies, attachment filename/type/size/hash, photo and MIME
  hashes, and preview timestamp for human inspection. It does not create a
  Gmail client, call Gmail, store raw MIME, or duplicate the photo bytes.
- `automatic`: a single worker may send after all gates pass.

Retry only explicit transient provider responses such as a bounded 429 or 5xx.
If the connection ends after the request may have reached Gmail, or a sending
lease expires without a definitive response, move the row to `uncertain` and
require explicit review. Automatic resend after an ambiguous result risks a
duplicate public-record email.

Set and test a conservative daily recipient-delivery cap. Cap accounting must
include each destination, not merely each report. Hold excess deliveries for
review; do not silently drop them.

## Gmail and secret handling

- Use server-side OAuth with the narrow Gmail sending scope only.
- Store the OAuth client secret and refresh token in Docker/host secret storage,
  never in Git, Directus content fields, mobile configuration, build output,
  logs, screenshots, or documentation.
- Never use the Gmail password or an app password in either mobile client.
- Redact destination addresses, access tokens, and provider response bodies from
  logs and user-visible errors.
- Local and CI tests use a fake transport and non-routable sample recipients.

## Minimum acceptance matrix

Positive review-mode cases:

- In test destination mode, Quick Crosswalk Encroachment, Repeat vehicle
  Crosswalk Incursion, and Missing Sidewalk each produce exactly one delivery
  to the configured test mailbox, no Cc, and a leading `[TEST]` subject token.
- Each review row durably records the exact subject and both rendered bodies,
  bound-photo attachment metadata and hash, full MIME hash, and preview time;
  review mode makes zero Gmail calls.
- Crosswalk test messages retain prominent plate treatment; Missing Sidewalk
  retains photo, location, details, comments, and optional lip-height context.
- In an explicit official-destination test fixture only, crosswalk uses Police
  Chief plus Mayor Cc and Missing Sidewalk uses Codes.

Negative cases that must store normally and send nothing:

- Eligible type with authorization false, absent, or malformed.
- Eligible type whose destination authorization is missing or differs from the
  active destination mode, including a test-authorized report after a switch to
  official mode.
- Eligible type without a linked processed photo.
- Eligible type without valid confirmed coordinates within 5 km of Columbia
  Borough center.
- Aggressive driving, speeding, illegal U-turn, other vehicle issues, other
  sidewalk issues, Feedback, Page of Shame, walk summaries, and Health Connect.
- Unknown, malformed, or case-variant category values.
- Historical rows and submissions from older clients.
- Any test-mode MIME or outbox row containing a Police, Mayor, or Codes address.

Operational cases:

- Duplicate client submission and worker replay.
- Worker crash before send, during a known pre-send failure, and after an
  ambiguous provider outcome.
- Daily-cap boundary by recipient count.
- OAuth revoked or expired, recipient missing, photo missing, and Directus
  temporarily unavailable.
- Plain-text and HTML escaping, header injection attempts, oversized comments,
  and attachment MIME/size validation.

## Publication boundary

The public 3.14.1 website download remains authoritative until 3.15.0 is signed
and published. Do not change a website artifact link, GitHub latest release,
Play production/closed track, TestFlight group, or App Store version merely
because these sources compile. Follow `release-readiness/README.md` and
`RELEASE_NOTES_3.15.0.md`, and record the actual public endpoint and store state
after each deployment.
