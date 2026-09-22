# iOS 3.16.1 release status — September 21–22, 2026

Adonai's `b032318` release source declares `3.16.1 (31601)` and supersedes
the uploaded 3.16.0 candidate. The subsequent `c0863fc` fix clears Repeat
Reporting's test-email consent when its photo is removed. That fix is included
in the signed 3.16.1 archive and uploaded IPA.

- Signed archive: `source/ios/build/archives/ColumbiaWalks-3.16.1-31601.xcarchive`.
- Exported IPA: `source/ios/build/export-31601/ColumbiaWalks.ipa`.
- IPA SHA-256:
  `2445f6e7aa64a47cf56d93fcf89a932c8f20cb11b0051b77a2c53d152a770835`.
- `xcodebuild archive` and export succeeded. The app is signed by Apple
  Distribution team `JKA6EGL5J2` with bundle ID `org.columbiawalks.app`.
- Apple's `altool --validate-app` and `--upload-app` both succeeded with no
  errors. Delivery UUID: `80bac17f-4d62-4f68-b875-98b6a726bb7f`.
- App Store Connect reports build 31601 as `VALID` and
  `APP_STORE_ELIGIBLE`. The version is **3.16.1, Waiting for Review**, with
  build 31601 attached and the superseded 31600 build detached. A review
  submission was sent on September 21 at 8:14 p.m. EDT (ID
  `12ee3e4c-610f-4e80-9e3f-6af4432528da`). Description and release notes
  match their source files exactly; App Review notes describe 3.16.1 without
  physical-device placeholders. **Manual release is still saved**, despite the
  user's request to release automatically after approval. Public version 3.14.0
  remains live.
- The static iOS UI-clarity verifier passed. Two simulator test attempts built
  the app and test bundle but stalled before executing any tests in this 4 GB
  VM; both were stopped. Do not claim a 3.16.1 test pass yet. The signed device
  archive compiled and passed Apple's validation independently.

## Current release gates

- The submitted listing still has three inherited 3.14 screenshots, showing
  the old single Report submit action and Feedback tab. Apple locks media editing
  while the version is Waiting for Review. The user approved replacing these
  images and changing to automatic release. Remove the version from review,
  upload the six verified 3.16.1 screenshots, select automatic release after
  approval, save, then resubmit build 31601. App Store Connect signed out during
  this correction and requires the account holder to sign in again.
- GitHub Actions screenshot run `35661755409` passed its 3.16.1 UI capture test
  and produced six visually checked 1320 x 2868 non-alpha PNGs at
  `source/ios/AppStore/screenshots/en-US/iphone-6.9/`. The map tiles loaded and
  the Quick Report, dual submit actions, Saved, Contact Us, and Police Tip
  screens match the release. The earlier local simulator boot did not finish.
- A fresh physical-iPhone review recording with exact model and iOS version is
  still recommended because Apple requested one during an earlier review.
  Complete 3.16.1 physical-device acceptance and resolve the stalled local
  simulator unit-test result when possible; the CI screenshot UI test passed.

## Earlier 3.16.0 candidate (historical snapshot)

The App Store Connect version is **3.16.0, Prepare for Submission**. The live
App Store version remains 3.14.0. Version 3.16.0 is configured for manual
release after approval.

- Bundle ID: `org.columbiawalks.app`; version/build: `3.16.0 (31600)`.
- The signed Release archive succeeded using the ColumbiaWalks App Store
  provisioning profile and Apple Distribution team `JKA6EGL5J2`.
- The IPA passed `altool --validate-app` without errors and uploaded without
  errors. Delivery UUID: `1543a13b-84b1-4b9a-a0c7-a146656a4129`.
- Apple reports build 31600 as `VALID` and `APP_STORE_ELIGIBLE`. It is attached
  to the 3.16.0 App Store version and appears in the ColumbiaWalks Internal
  TestFlight group.
- IPA SHA-256:
  `5325054ae2fb3a3a18dc38480b7933fab83cfa5cd6d52633667b232e350b4a13`.
- The 3.16 iOS static UI-clarity verifier passed. The iPhone 17 simulator test
  suite passed 46 tests with no failures. A Swift switch-expression compile
  error found during the first build was fixed in `ReportModels.swift` before
  the successful simulator build, tests, and signed archive.
- The App Store description, promotional text, release notes, and App Review
  notes now describe 3.16.0 and its Community tab.
- On September 21, Adonai reported that the backend deployment is completely
  ready. A fresh independent check returned HTTP 200 and empty public trash-can
  and comment arrays, while malformed submission JSON returned the expected
  HTTP 400 validation error. Both live Cloudflare privacy-page addresses served
  the September 18 policy with the 3.16 topics. The latest GitHub changes after
  the uploaded build affect only Directus migration code/tests; the iOS project
  still declares `3.16.0 (31600)`. The App Store draft still has that build
  attached in Prepare for Submission.

## Release gates still open

- Retain Adonai's deployment verification for the separate backups and narrow
  private-policy allowlists from both 3.16 Directus migrations, and the weather
  safeguards described in `source/android/DEVELOPMENT_3.16.md`. These host-side
  details cannot be inspected from this Mac. The first valid private QA submission
  and public-feed request returned 502 during deployment. Later on September
  21, the same private complaint returned 201 `new`, then 200 with
  `duplicate: true`; a separate public comment returned 201
  `moderation_pending`. The public feed returned 200 with empty can/comment
  arrays and exposed neither QA record's text nor UUID. In Directus, close
  private QA complaint `93b899a0-ce9d-4f2c-9796-618b4097c402` and reject
  public QA comment `c8359304-458b-4c20-b447-6a36d3279399`; both are
  explicitly marked as tests with no physical location.
- The deployed public `/privacy-policy/` page now shows an effective date of
  September 18, 2026 and mentions the 3.16 Community tools, trash-can handling,
  moderation, and Open-Meteo. Both live Cloudflare addresses were checked.
- Replace the three remaining inherited 3.14 App Store screenshots with
  visually verified 3.16 screenshots. The obsolete Feedback-tab image was
  removed from the draft. A 6.9-inch iPhone 17 Pro Max simulator booted and
  installed the 3.16 app, but it displayed a white app screen under severe
  host load; that capture was rejected and not uploaded.
- Complete 3.16 physical-iPhone acceptance and supply a fresh screen recording,
  device model, and iOS version for App Review.
- Recheck the live server and hosted policy, complete final App Store metadata
  review, and submit the version for Apple review. Release it manually only
  after approval and all production gates pass.

The 3.16.1 (31601) source and uploaded archive now supersede this candidate
with the simplified Quick Report, explicit test-email opt-in, CBPD handoff,
and Contact Us changes. The 3.16.0 build must not be submitted as though it
contains those fixes.
