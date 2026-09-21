# iOS 3.16.0 release status — September 21, 2026

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

The later 3.16.1 (31601) source update supersedes this candidate with the
simplified Quick Report, explicit test-email opt-in, CBPD handoff, and Contact
Us changes. No 3.16.1 signed iOS archive has been produced or uploaded, so the
attached 3.16.0 build must not be submitted as though it contains those fixes.
