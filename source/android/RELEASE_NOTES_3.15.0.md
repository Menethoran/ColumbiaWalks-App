# ColumbiaWalks 3.15.0 release notes

Status: **development candidate; not signed, submitted, published, or deployed**

- Android version name: `3.15.0`
- Android version code: `31500`
- iOS marketing version: `3.15.0`
- iOS build: `31500`

The public website download and its Ghost version/download surfaces remain at
3.14.1 until a production-signed 3.15.0 build is verified and actually
published. A successful source build or a staged artifact is not a release.

## What is new

### Limited, user-authorized official email

Reports continue to go to ColumbiaWalks first. When the reporter selects one of
the exact eligible issues, the submit screen explains the route and changes the
submit action so the reporter affirmatively authorizes ColumbiaWalks to send
the official email after secure upload.

This 3.15 field-test build defaults to `test` destination mode and disabled
delivery. Every otherwise eligible, test-authorized email is intercepted by one
server-configured ColumbiaWalks test mailbox, uses no Police/Mayor/Codes To or
Cc address, and begins with `[TEST]`. The test mailbox address is not embedded
in either app or this repository. A later official destination is separate and
cannot reuse consent recorded for the test mailbox.

| App selection | Server policy key | Automatic route |
| --- | --- | --- |
| Quick Report: Crosswalk Encroachment | `crosswalk_encroachment` | Configured Police Chief and Mayor |
| Repeat Reporting vehicle issue: Crosswalk Incursion | `crosswalk_incursion` | Configured Police Chief and Mayor |
| Missing Sidewalk | `missing_sidewalk` | Configured Codes recipient |

No other report type automatically generates official email in 3.15.0.
Aggressive driving, speeding, illegal U-turns, other vehicle observations,
other sidewalk issues, police-interaction reports, Page of Shame submissions,
Feedback, walking summaries, and Health Connect summaries continue through
their existing ColumbiaWalks paths without automatic government forwarding.
The field-test destination also does not forward eligible messages to a
government recipient.

Each eligible official email includes the stored, metadata-stripped report
photo; confirmed location; relevant report selections and details; comments;
observation time; and a ColumbiaWalks reference. Police-route email prominently
displays any license plate and plate jurisdiction that the reporter typed. The
photo remains the underlying evidence; 3.15.0 does not promise automatic plate
recognition.

The app does not sign in to Gmail and contains no Gmail password, app password,
OAuth client secret, refresh token, or official recipient address. The
ColumbiaWalks server creates the email and sends it from the ColumbiaWalks
account using server-held configuration after the report and photo are stored.

### Faster field reporting

- Adds Missing Sidewalk to the quick and Repeat Reporting sidewalk paths.
- Preserves the rapid submit-and-reset loop for consecutive observations.
- Adds optional license plate and plate-jurisdiction fields to rapid vehicle
  reporting.
- Keeps photo-derived GPS suggestions and manual location override.
- Shows the automatic-email disclosure only while an exact eligible type is
  selected.
- Requires the stored photo and confirmed location within 5 km of Columbia
  Borough center for automatic official email; report routing fails closed
  when those requirements, the authorization field, or the exact authorized
  destination are absent or mismatched.

## Privacy and safety disclosures

- A field-test email remains in the configured ColumbiaWalks test mailbox and
  is not received by the Police Chief, Mayor, or Codes Department.
- If a separately official-authorized email is later enabled and delivered, it
  may become a government public record and may be retained or disclosed under
  the recipient's laws and policies.
- ColumbiaWalks cannot retrieve or delete a future official recipient's copy
  after a separately authorized delivery.
- ColumbiaWalks is independent and does not represent or act on behalf of
  Columbia Borough, its Police Department, or any other government entity.
- Automatic email is not emergency reporting and does not guarantee
  acknowledgment, investigation, enforcement, correction, or any other
  response. Call 911 for immediate danger or urgent medical help.
- Play Data Safety for this 3.15.0 field test records no government sharing
  through the email feature; separately moderated public-content paths still
  require their own Console reconciliation.

## Delivery controls

The production design uses a durable, deduplicated server outbox. Delivery is
controlled by server mode (`disabled`, `review`, or `automatic`) and the
separate destination mode (`test` by default, or `official`), a daily cap,
recipient configuration, and bounded retry rules. The outbox and intake
response record `destination_mode`. An ambiguous provider result
must be held for review rather than automatically resent. Historical reports
and reports from older clients default to no official-email authorization.
Review mode makes no Gmail call, but uses the same saved-photo validation and
message builder as automatic mode and durably records an inspectable subject,
plain-text/HTML bodies, attachment metadata/hash, MIME hash, and preview time.
It stores neither raw MIME nor a duplicate of the report photo.

## Release gates still required

- Deploy and verify the Directus schema, authorization field, outbox, and
  reconciliation behavior.
- Confirm the ColumbiaWalks test destination outside the mobile apps without
  placing its address in source, logs, screenshots, or release metadata.
- Configure sending-only Gmail OAuth using server secret storage.
- Pass review-mode dry runs for all positive and negative routing cases and
  inspect the persisted subject/body, attachment binding and hashes, plate
  emphasis, destination interception, and deduplication. Separately exercise
  automatic-mode fake-transport tests for caps, retries, and ambiguous outcomes.
- Deploy the updated public privacy policy and reconcile Google Play Data
  Safety before rollout.
- Complete Android test, lint, accessibility, retry/offline, and physical-device
  QA.
- Complete iOS build, signing, and device QA on a Mac.
- Build and verify production-signed APK/AAB/IPA artifacts with the established
  identities; archive hashes, mapping, and native symbols.
- Complete Google Play and App Store review, then independently verify every
  intended store, tester, website, and download surface.

No real Gmail credential or recipient send is part of source development or
local automated tests.
