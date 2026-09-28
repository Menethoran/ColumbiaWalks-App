# ColumbiaWalks 3.17.10 — police-assisted internal test

Version 3.17.10 / platform build 31710 is INTERNAL TEST ONLY. Every plain semantic version whose third component ends in digit 0 is internal-only; .0, .10, .20 and .100 are examples. Keep this artifact off the public website, public GitHub releases, public/external store tracks, and the App Store.

## User flow

- New report: use “Submit to CW & prepare [TEST] tip.” The CW save happens first; review the separate tip draft.
- Previously saved report: open Saved, select the report, then “Prepare [TEST] Police Tip from This Report.”
- Standalone: Community → Columbia Borough Police.
- Confirm the matter is past/inactive, preview marked text, then choose “Fill CRIMEWATCH Form [TEST].”
- The in-app official page selects “I wish to remain anonymous” and “Other,” fills the subject/message, and clears contact fields. Every word in app-prepared text is separated by [TEST]. Markers are reapplied after edits before submission. The subject's 128-character limit includes markers.
- The user reviews, personally accepts the official agreement, completes any CAPTCHA, selects any original attachments, and presses the site's Submit button. Autofill does not establish submission or receipt. Read the official page response. If CRIMEWATCH displays a subscription popup, close it to review the tip.
- If the official form changes or cannot load, the screen reports that autofill is unavailable. Separate copy controls and an external-browser fallback are available. External-browser text must be reviewed and pasted manually.

The official form is https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip. The injection is restricted to this HTTPS origin, agency path and verified form contract. No native tip API or JavaScript-to-native data bridge is added. Neither app accepts the site's attestation, handles CAPTCHA, attaches files automatically, or triggers Submit. The Android activity is not exported. The iOS web view uses a nonpersistent data store.

## Data boundary

This new police flow does not use the private 3.17.0 intake. It drafts locally and makes the marked text available to CRIMEWATCH when the user opens the official form. Existing CW reports remain separate. Contact fields and CW report identifiers are not carried into the police tip. User-written identifying information and manually selected attachments still require personal review. The original 3.17.0 branch and artifacts remain intact.

## Build and checks

`source/android/release-readiness/build-internal-android.sh --qa` runs Android unit tests and lint and builds the separate internal APK and instrumentation APK. Reuses the established internal debug keystore; package `org.columbiawalks.app.internal` updates 3.17.0 in place. Self-update is disabled.

`source/android/release-readiness/build-play-internal.sh` builds the signed, non-debuggable Play Internal testing AAB using the configured upload key. It never uploads. This uses the Play package `org.columbiawalks.app` and is separate from the directly installed internal APK. The recorded Play key reset activation is September 29, 2026 at 19:30 UTC; reverify activation in Play Console before uploading.

Checks: Android unit tests/lint; JavaScript DOM regression tests (`npm ci --prefix source/form-tests`, `npm test --prefix source/form-tests`); five distribution-policy regressions; Android/iOS static UI and release verifiers; read/fill-only live Android instrumentation (no tip submitted), including the saved-report mapping; and backend regression tests for the privacy-only update. Local results and hashes are recorded under ignored `artifacts/qa/` and in `BUILD_VERIFICATION_3.17.10.md`.

Open `source/ios/ColumbiaWalks.xcodeproj` on Mac/Xcode for Debug device verification. The source and shared autofill script are included; Linux validation does not constitute an iOS build, archive, or upload.

## Website privacy deployment

`source/deployment/Dockerfile.privacy` derives from the existing 3.17.1-contact intake image and replaces only privacy-page.js. Deploy with the existing base, private-intake and website Compose layers, plus `source/deployment/columbiawalks-3.17.10-privacy.yml`. No tip routing, schema, or email worker changes are needed. Removing the last override returns to the previous image.
