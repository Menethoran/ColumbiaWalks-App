# ColumbiaWalks 3.16 development handoff

This directory is a development candidate for ColumbiaWalks `3.16.1`
(`31601`). It is separate from the preserved 3.15 source tree. Nothing in this
handoff proves a Play Store, App Store, TestFlight, website, intake-service, or
Directus deployment.

## Community tools

The former Feedback destination is now a Community hub with three separate
paths:

1. **Prepare an Anonymous Police Tip** builds a local-only subject and narrative
   for a past, non-active matter. It does not upload the draft or media to
   ColumbiaWalks. The user copies the prepared text, opens the Columbia Borough
   Police Department's official CRIMEWATCH Submit-a-Tip page, selects the
   anonymous option, pastes the text, attaches original evidence there, reads
   and accepts the official attestation, completes reCAPTCHA, and presses the
   official site's Submit button. Opening the site is not submission. Emergency
   and in-progress events are directed to 911; the screen also exposes the
   official dispatch and station telephone routes.
2. **Trash Can Comments & Complaints** sends identifier-free, queued JSON to
   the new ColumbiaWalks trash-can intake endpoint. Public trash-can comments and
   private can complaints are distinct submission kinds with separate category
   allowlists, disclosures, storage collections, and server-controlled status.
3. **App Feedback** retains the pre-existing ColumbiaWalks feedback form.

The police tool is intentionally not connected to the ColumbiaWalks intake
server. The official Police Department form requires a personal truthfulness /
not-in-progress attestation and reCAPTCHA, and no supported submission API is
documented. ColumbiaWalks must not impersonate that attestation, bypass the
anti-abuse control, or claim that a tip was filed when only a draft was
prepared.

## Trash-can privacy boundary

`POST /columbiawalks-api/trash-can-submissions` accepts either a public comment
or a private complaint. Both require one to three kind-specific categories, a
3-2,000-character comment, and at least one location reference. The initial
Android and iOS clients require a typed address or location description and can
optionally include an already confirmed report-map pin. They do not attach
media in 3.16.

- Public comments enter `trash_can_comments` as `moderation_pending` and are
  forced to the `public` asset scope. Raw text, submitted location, photos,
  source metadata, and submission identifiers stay private. A moderator must
  create reviewed or redacted `public_comment` text, approve it, and link it to
  an active canonical `public_trash_cans` row before the allowlisted public feed
  can return it.
- Can complaints enter the separate `trash_can_complaints` collection as
  private `new` items. They are never queried by the public endpoint and are not
  automatically forwarded to Columbia Borough.
- The server accepts an optional photo for a future client. It re-encodes the
  image to JPEG and strips embedded metadata before private storage. The 3.16
  mobile clients use JSON only.
- No canonical public-trash-can inventory was invented for this release. The
  inventory must be populated and verified before a future map or public list
  claims that a can exists at a specific location.

## Build and verification

From `source/`:

Use JDK 17 and an Android SDK containing Platform 36 and Build Tools 36.0.0.
For example, set `JAVA_HOME` and `ANDROID_HOME` to those installations before
running:

```bash
python3 release-readiness/verify-ui-clarity.py
python3 release-readiness/verify-release-policy.py
python3 release-readiness/verify-community-tools.py
python3 release-readiness/verify-weather-enrichment.py
./.gradle-bootstrap/gradle-8.13/bin/gradle --no-daemon \
  testDebugUnitTest lintDebug assembleDebug
```

From `source/server/intake/`:

```bash
npm test
```

From `ios/` on a Mac with Xcode/XcodeGen:

```bash
xcodegen generate
python3 scripts/verify_ui_clarity.py
xcodebuild -project ColumbiaWalks.xcodeproj \
  -scheme ColumbiaWalks -sdk iphonesimulator test
```

The Linux development host cannot compile or device-test the SwiftUI target.
The committed Xcode project, model/API contracts, and static release guard can
be checked here, but a Mac build plus simulator and physical-iPhone testing are
still required before release.

### Completed local verification

- Android JVM tests: 55 passed, 0 failed.
- Android lint: passed with 0 errors.
- Android debug assembly: passed.
- Intake service tests: 191 passed, 0 failed.
- Android UI-clarity, Android release-policy, Community contract, weather
  contract, and iOS static UI-clarity verifiers: passed.
- Android emulator acceptance: passed on Android 16 / API 36 at 1080 x 2400 and
  420 dpi, using normal text, 1.3x enlarged text, and a system-night-mode
  request. Evidence and the exact limitations are indexed in
  `artifacts/qa/android/README.md`.

The source tree's current rebuilt Android debug APK is 67,645,829 bytes with
SHA-256
`cc0d261231e18cbef16d1020c7dabeb2ffc09f3d2acfe6d3f04f36a8d9878f40`.
It is debug-signed and is not a production artifact. The existing emulator
screenshots remain tied to the earlier debug hash recorded in
`artifacts/qa/android/README.md`; they do not replace final visual and physical
device QA for this rebuilt candidate. The intervening Android source change
only makes the submitted event-time locale deterministic for backend parsing.

## Server deployment order

Do not expose the client forms until the new endpoint exists in the live
service.

1. Back up Directus and run `server/directus-3.16-trash-cans-upgrade.cjs` with a
   short-lived Directus administrator token.
2. Run `server/directus-3.16-weather-upgrade.cjs` with the same short-lived
   administrator session. Verify its separate backup, readonly fields, and
   existing-policy Create/Read allowlist checks before enabling weather.
3. Verify both migrations' private-permission assertions and backup paths.
4. Populate and independently verify any canonical public-can inventory that
   will be used.
5. Deploy intake service `1.12.0` with weather enrichment enabled only after
   the weather schema exists.
6. Exercise JSON comment and complaint submissions with non-sensitive test
   data; verify that they land in different private collections.
7. Verify that the public feed exposes only approved/redacted comments linked
   to active canonical cans and never returns complaint data.
8. Inspect one non-sensitive weather request/result and one forced provider
   failure; confirm rounded inputs, stored attribution, and fail-open storage.
9. Confirm the deployment qualifies for Open-Meteo's free noncommercial tier
   and quotas, or arrange the appropriate commercial/self-hosted service.
10. Only then build, sign, and distribute the 3.16 mobile clients.

## Release gates still open

- Run both Directus migrations and deploy intake `1.12.0` in the intended live
  environment.
- Reconcile the hosted privacy policy with the 3.16 policy source.
- Capture and visually verify the final 3.16 App Store screenshot set; no 3.16
  screenshots are included in this candidate.
- Build and test iOS with Xcode, including large text, VoiceOver, external-link
  handoff, offline queue retry, and a physical-device pass.
- Complete Android physical-device testing after emulator QA.
- Produce and verify production-signed Android and iOS artifacts.
- Confirm the exact Play/App Store tracks, review settings, tester access, and
  public availability independently of local build success.
