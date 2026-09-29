# 3.17.1 (31701) implementation and delivery

Updated September 29, 2026. Public identity is `3.17.1` / `31701` on Android and iOS. The latest user rule makes only a final dot-separated numeric component exactly `0` internal-only. `3.17.10` is eligible for public distribution; `3.17.10.0` is not. This rule is independent of mandatory police-tip TEST labeling, which the user explicitly retained in 3.17.1.

## Trash reporting

Android and iOS trash reporting now offer an optional Hauler field with B&L Carson, Cauler, Good's, Penn Waste, Waste Connections, Shell's, and WM.COM. Residential/Commercial defaults to Residential. Both fields are included in the standalone public-comment/private-complaint forms and in the new Trash can option in Repeat Reporting.

Repeat trash reports use the existing private trash-can complaint intake. Each report requires a photo, confirmed location, and issue category. After local queueing, issue, hauler, property type, and property scope stay selected; comments, photo, and location reset for the next can. Photo sidecars remain with the durable private queue until intake acceptance, and existing text-only queued submissions remain compatible. Repeat reports are not automatically forwarded to the Borough or hauler, and no new private metadata appears in the public feed.

The additive Directus migration adds nullable `hauler` and `property_type` columns to the existing two trash-can collections and extends only existing private intake create permissions. A verified database backup is required before mutation. New submissions that omit property type default to Residential in validation; pre-existing database records remain unlabeled.

September 29 validation: Android debug and signed Internal testing builds/lint passed with 58 unit tests per variant; three new API-36 device tests passed for repeat choices, selection retention after reset/rotation, durable photo queueing, and legacy queue compatibility. All 205 backend tests and six distribution-policy tests passed. Android release/community/UI and iOS static checks passed. Native iOS compilation and device testing still require Xcode on the Mac. No live report or police tip was submitted during these checks.

## Police-tip behavior

New complaints and saved reports can populate the local review draft with issue categories, observation time, location/intersection, vehicle/plate, firsthand narrative, and evidence notes. Private CW report IDs and contact fields are omitted. Long generated titles fall back to a short subject; category details remain in the message. Every prepared word, including optional placeholders, is separated by `[TEST]`.

The user chooses Fill CRIMEWATCH Form. Android WebView and iOS WKWebView fill only the exact verified CBPD form on `https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip`: anonymous radio, Other crime type, subject, message, and empty contact fields. Edited subject/message text is re-marked before a human submits. A repeated page callback does not overwrite the person's edits. The 128-character subject limit includes markers.

The optional CBPD subscription modal (`notice-modal-96127`) is declined only when its agency title, subscription button, and “No thanks, just browsing” control match. The handler also covers delayed display and Bootstrap's completed-show event. Agreement, CAPTCHA, file selection, errors, and receipt dialogs are untouched. No code initiates final form submission or claims receipt. If the official form changes, copy controls and an external browser fallback remain available.

The website at `/police-tip/` provides a local-only marked draft helper with separate subject/message copy buttons. It has no submission endpoint, draft storage, or tip-bearing URL. Ordinary website tabs cannot control a separate CRIMEWATCH tab; the site states that limitation and provides manual instructions.

## September 28 police-tip validation baseline

- Android debug and signed Internal testing variants: 54 unit tests each, zero failures; lint and builds passed.
- Android API 36 emulator: all three instrumentation tests passed, including actual official form autofill and automatic subscription dismissal. Agreement remained unchecked; no tip was submitted.
- JavaScript: 12 tests passed across native form autofill/popup behavior and the website draft helper, including late notices, unrelated dialogs, form/origin changes, edited text, subject limits, and literal hostile input.
- Distribution policy: six regression tests cover public `.10` / `.20`, internal three/four/five-component `.0` versions, malformed versions, CLI artifact guards, and iOS distribution/identity guards.
- Android release/community/UI and iOS static checks passed. Both platforms bundle identical autofill JavaScript. iOS still requires Xcode and physical-iPhone validation on a Mac.
- Intake mock suite: 200 tests passed with updated privacy copy; no live report or police tip was created.
- Live website draft preparation and clipboard worked with synthetic text. The 320px view had no horizontal overflow.

## Artifacts and signing

- Current QA APK: `artifacts/ColumbiaWalks-3.17.1-trash-reporting-qa.apk`, package `org.columbiawalks.app.qa`, 69,243,066 bytes, SHA-256 `62d86f45a4105633718768bf89b3af8a1f7fd4a2f15589a834f0b9aea676f0ea`. This debug-signed, separate-package artifact is for local QA only. The September 28 `ColumbiaWalks-3.17.1-qa.apk` remains preserved.
- Current signed Play Internal testing AAB: `artifacts/play-internal/ColumbiaWalks-3.17.1-internal-testing.aab`, package `org.columbiawalks.app`, 25,106,076 bytes, SHA-256 `fa32ca616d2f03782126635dffc08390336ad2f9e020bdeb8959928e42a51d5a`. Upload certificate SHA-256 `9be8e68554f0f9902e87fccb8199772db31e4186a441c8754e3653a450603e95`. Signature, identity, manifest, four ABI symbol files, and R8 mapping passed staging checks. Earlier bundle/mapping artifacts are preserved under `artifacts/prior-3.17.1-autofill-20260928/`.
- Google Play's upload-key reset has completed: the live App signing page on September 29 shows the pinned replacement certificate without the previous waiting notice. The production-access application was submitted at 10:38 AM EDT and remains under review.
- Google accepted the current AAB, ReTrace mapping, and native debug symbols, then published `3.17.1 (31701) - Trash reporting and tips` to the existing Internal testing track on September 29 at 5:07 PM EDT. The track shows **Available to internal testers**, one version code, with `31701 (3.17.1)` replacing `31300 (3.13.0)`. This is an Internal testing rollout only; production access remains under review. Release details: https://play.google.com/console/u/0/developers/7334945470482705095/app/4972978816375946023/tracks/4701367018287985811/releases/2/details.
- A public website APK still requires the original website signing key to be unlocked. The website continues to serve verified 3.14.0; the QA or Play-upload signer must not replace it.
- No Apple upload or native iOS build was performed on this Linux host. Open `source/ios/ColumbiaWalks.xcodeproj` on the Mac and complete the App Store checklist.

## Website and backend

The updated page and full Ghost theme `columbiawalks-ghost-theme-3-17-1-autofill` are published. Contact links, founders, and the existing 3.14.0 APK are preserved. See `source/website/README.md` for deployment/rollback details.

The intake had been recreated at 20:12 UTC from an older August image using only the base Compose file. This deployment restores the previously deployed 1.13.0 intake image lineage and layers only the new privacy text on it as `columbiawalks-intake:3.17.1-autofill`. Only the intake service was recreated; its persistent data, Directus schema, and other services were not changed. Health returned 200/ok. The before-image and privacy file are preserved under `/docker/columbiawalks-3.17.1-autofill/`.

September 29 trash metadata deployment: `directus-3.17-trash-haulers-upgrade.cjs` added the two fields with verified SQLite backups. The latest backup is `/directus/database/data.db.bak-pre-trash-types-20260929T210227Z` in the Directus container (host database mount `/var/lib/docker-data/directus/database`). No public permission was added. The first hauler-only backup is also retained as `data.db.bak-pre-haulers-20260929T2048Z`.

The live intake image is now `columbiawalks-intake:3.17.1-trash-types`, image ID `sha256:d84eb13d7d5467b7fadc55f8ad752873b7e1a03e039355ca22afd514bbb1c674`. It preserves the existing image lineage and changes only trash validation and privacy text. Container health and external `/columbiawalks-api/health` returned healthy/200, the public trash feed returned 200 with no private records, and the public privacy page contains the new hauler, property-type, and repeat-photo disclosures. Live validation accepted Residential, Commercial, and the legacy default without creating a record.

Recreate only `columbiawalks-intake` with these Compose files in order: `/docker/docker-compose.yml`, `/docker/columbiawalks-3.17.0-internal.yml`, `/docker/columbiawalks-3.17.1-autofill.yml`, `/docker/columbiawalks-3.17.1-haulers.yml`. The last overlay now selects the trash-types image. Deployment files, prior overlay, and image identity are preserved at `/docker/columbiawalks-3.17.1-trash-types-20260929/`. For an application rollback, restore its `compose-overlay-before.yml` as the last overlay and recreate only the intake service; retain the additive nullable columns and both backups. Do not restore the whole database over newer submissions for an application-only rollback.
