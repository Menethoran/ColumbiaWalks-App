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

## Release gates still open

- Deploy both 3.16 Directus migrations and intake service 1.12.0 as described
  in `source/android/DEVELOPMENT_3.16.md`, then verify the separate private
  trash-can collections, public-feed allowlist, and weather safeguards. As of
  this status, `POST /columbiawalks-api/trash-can-submissions` returns HTTP 404
  in production.
- Deploy the privacy-policy source bundled in
  `source/android/server/intake/src/privacy-page.js` and verify the public
  `/privacy-policy/` page. The live page still has an August 20, 2026 effective
  date and does not describe the 3.16 Community tools.
- Replace the four inherited 3.14 App Store screenshots, including the obsolete
  Feedback-tab image, with visually verified 3.16 screenshots.
- Complete 3.16 physical-iPhone acceptance and supply a fresh screen recording,
  device model, and iOS version for App Review.
- Recheck the live server and hosted policy, complete final App Store metadata
  review, and submit the version for Apple review. Release it manually only
  after approval and all production gates pass.

No 3.16.1 source or signed iOS artifact has been verified. This release uses
the 3.16.0 source uploaded to `ColumbiaWalks-App`.
