# ColumbiaWalks App Store delivery

This directory is the source of truth for the App Store Connect listing for bundle ID `org.columbiawalks.app`.

- Marketing version: `3.16.0`
- Build: `31600`
- Platform: iPhone, iOS 17.0 or later
- Apple Developer Team: `JKA6EGL5J2`
- Primary language: English (U.S.)
- Category: Navigation
- Secondary category: Lifestyle

The files under `metadata/en-US` contain copy for the U.S. English storefront.
`app-privacy.md`, `age-rating.md`, and `export-compliance.md` record the answers
to enter in App Store Connect. `review-information.md` is the detailed internal
review/test guide; `review-notes-paste-ready.txt` is the condensed text for the
App Review Notes field. The candidate does not contain a 3.16 screenshot set.
Capture and verify the final-build screenshots before storing them by locale
and display class under `screenshots/`.

Uploading a build, inviting testers, or submitting an app for review remains an App Store Connect action. Verify the values in this directory against the final App Store Connect record before submission.

Version 3.16 replaces the Feedback tab with a Community hub while retaining
App Feedback as a nested destination. The hub also provides a local-only police
tip drafting handoff and separate public-comment/private-complaint trash-can
forms. The police draft and media are not sent to ColumbiaWalks; the user must
finish the tip on the official Police Department website. Trash-can JSON is
queued locally and requires intake service 1.12.0 plus the 3.16 Directus schema
before this client can be distributed.

Version 3.16.0 lets users authorize a server-generated field-test email for only
the qualifying report types documented in `app-privacy.md` and
`review-information.md`, and only for a confirmed location within 5 km of
Columbia Borough center. Every 3.16 field-test message is addressed only to a
ColumbiaWalks-controlled test mailbox and uses a `[TEST]` subject; this build
does not authorize email to Police, the Mayor, or Codes. Authorization after
upload does not confirm delivery. Before release, verify the intake server,
destination-mode pin, duplicate suppression, delivery safeguards, and
ColumbiaWalks sending account separately; the iOS build contains no Gmail
credential, test-mailbox address, or official recipient address.
The eligibility shape is exact: standard Quick requires one approved key,
Repeat Vehicle crosswalk requires no Quick key, and Repeat Sidewalk missing
sidewalk requires one `missing_sidewalk` key. Mixed, duplicate, or stray keys
never authorize field-test email.

No App Store Connect upload, TestFlight enrollment, review submission, or live
availability is implied by the source and metadata in this directory.
