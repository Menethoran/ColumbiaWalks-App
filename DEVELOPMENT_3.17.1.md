# 3.17.1 (31701) implementation and delivery

Updated September 28, 2026. Public identity is `3.17.1` / `31701` on Android and iOS. The latest user rule makes only a final dot-separated numeric component exactly `0` internal-only. `3.17.10` is eligible for public distribution; `3.17.10.0` is not. This rule is independent of mandatory police-tip TEST labeling, which the user explicitly retained in 3.17.1.

## Police-tip behavior

New complaints and saved reports can populate the local review draft with issue categories, observation time, location/intersection, vehicle/plate, firsthand narrative, and evidence notes. Private CW report IDs and contact fields are omitted. Long generated titles fall back to a short subject; category details remain in the message. Every prepared word, including optional placeholders, is separated by `[TEST]`.

The user chooses Fill CRIMEWATCH Form. Android WebView and iOS WKWebView fill only the exact verified CBPD form on `https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip`: anonymous radio, Other crime type, subject, message, and empty contact fields. Edited subject/message text is re-marked before a human submits. A repeated page callback does not overwrite the person's edits. The 128-character subject limit includes markers.

The optional CBPD subscription modal (`notice-modal-96127`) is declined only when its agency title, subscription button, and “No thanks, just browsing” control match. The handler also covers delayed display and Bootstrap's completed-show event. Agreement, CAPTCHA, file selection, errors, and receipt dialogs are untouched. No code initiates final form submission or claims receipt. If the official form changes, copy controls and an external browser fallback remain available.

The website at `/police-tip/` provides a local-only marked draft helper with separate subject/message copy buttons. It has no submission endpoint, draft storage, or tip-bearing URL. Ordinary website tabs cannot control a separate CRIMEWATCH tab; the site states that limitation and provides manual instructions.

## Verified

- Android debug and signed Internal testing variants: 54 unit tests each, zero failures; lint and builds passed.
- Android API 36 emulator: all three instrumentation tests passed, including actual official form autofill and automatic subscription dismissal. Agreement remained unchecked; no tip was submitted.
- JavaScript: 12 tests passed across native form autofill/popup behavior and the website draft helper, including late notices, unrelated dialogs, form/origin changes, edited text, subject limits, and literal hostile input.
- Distribution policy: six regression tests cover public `.10` / `.20`, internal three/four/five-component `.0` versions, malformed versions, CLI artifact guards, and iOS distribution/identity guards.
- Android release/community/UI and iOS static checks passed. Both platforms bundle identical autofill JavaScript. iOS still requires Xcode and physical-iPhone validation on a Mac.
- Intake mock suite: 200 tests passed with updated privacy copy; no live report or police tip was created.
- Live website draft preparation and clipboard worked with synthetic text. The 320px view had no horizontal overflow.

## Artifacts and signing

- QA APK: `artifacts/ColumbiaWalks-3.17.1-qa.apk`, package `org.columbiawalks.app.qa`, 67,746,368 bytes, SHA-256 `b6ac5c5e5b7e21680cb40c49863a2e8a6a1741a4f2120df4c1607a3150db93d2`. This debug-signed, separate-package artifact is for local QA only.
- Signed Play Internal testing AAB: `artifacts/play-internal/ColumbiaWalks-3.17.1-internal-testing.aab`, package `org.columbiawalks.app`, 25,107,692 bytes, SHA-256 `552c6b14cc0bdab807af375b649620b64e3397bd344a54860d6b1082a241baed`. Upload certificate SHA-256 `9be8e68554f0f9902e87fccb8199772db31e4186a441c8754e3653a450603e95`. Signature, identity, manifest, four ABI symbol files, and R8 mapping passed staging checks.
- Google Play was checked live September 28. Its reset notice says the new upload key becomes valid September 29, 2026 at 19:30 UTC (15:30 EDT); new APK/AAB uploads are blocked until then. No 3.17.1 upload or rollout is claimed.
- A public website APK still requires the original website signing key to be unlocked. The website continues to serve verified 3.14.0; the QA or Play-upload signer must not replace it.
- No Apple upload or native iOS build was performed on this Linux host. Open `source/ios/ColumbiaWalks.xcodeproj` on the Mac and complete the App Store checklist.

## Website and backend

The updated page and full Ghost theme `columbiawalks-ghost-theme-3-17-1-autofill` are published. Contact links, founders, and the existing 3.14.0 APK are preserved. See `source/website/README.md` for deployment/rollback details.

The intake had been recreated at 20:12 UTC from an older August image using only the base Compose file. This deployment restores the previously deployed 1.13.0 intake image lineage and layers only the new privacy text on it as `columbiawalks-intake:3.17.1-autofill`. Only the intake service was recreated; its persistent data, Directus schema, and other services were not changed. Health returned 200/ok. The before-image and privacy file are preserved under `/docker/columbiawalks-3.17.1-autofill/`.
