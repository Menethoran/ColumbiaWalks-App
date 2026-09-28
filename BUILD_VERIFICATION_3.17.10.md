# 3.17.10 internal test verification — September 28, 2026

The distributable internal APK and signed Play Internal testing AAB are built. Neither is a public release. No police tip was submitted by the agent.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| ColumbiaWalks-3.17.10-internal-test.apk | 69,237,526 | `ffff06032c0341f5157b42413ed7b666f59bba43cc6c478285b3b93c859017d5` |
| ColumbiaWalks-3.17.10-internal-testing.aab | 25,107,347 | `acd6989e4dbfd1d32bf032f8402f2b89c6e881247e68ad52303e99926ce5df5d` |

- Android APK identity: `org.columbiawalks.app.internal`, version `3.17.10`, code `31710`, label `ColumbiaWalks [TEST]`, min SDK 26, target 36. Existing internal debug certificate SHA-256: `fe8ceea33ca183c94b0a07d173945b026935605aebde2b3daed44c777100b25c`. Installed 3.17.0 then upgraded to this APK successfully on API 36 without uninstalling.
- Signed AAB identity: `org.columbiawalks.app`, `3.17.10` / `31710`, not debuggable. Upload certificate SHA-256: `9be8e68554f0f9902e87fccb8199772db31e4186a441c8754e3653a450603e95`. Bundletool, JAR signer, manifest, install-permission exclusion, native-symbol and mapping checks passed. Self-update is disabled in both internal variants.
- Android unit tests: 54 passed in Debug and 54 passed in InternalTesting; lint passed for both. This is the same suite in two variants.
- Shared autofill DOM regressions: 6 passed, covering all four values, contact clearing, unchanged agreement/token/file fields, edits and marker reapplication, the marked subject limit, changed form/origin rejection, preservation of user edits, literal handling of script-like text, and identical Android/iOS resources.
- Android API 36 instrumentation: 3 passed. The live official form was fetched and filled with synthetic [TEST] text; Anonymous and Other were selected and the agreement remained unchecked. The tests also verify the origin restriction and saved-report carryover without CW report IDs. No Submit press or official attestation occurred. Screenshot and raw logs are in ignored `artifacts/qa/`.
- Distribution policy: 5 regression tests passed, including .0/.10/.20/.100 rejection for public/external channels, ordinary patch-version allowance, malformed-version rejection, source-version override rejection, and iOS configuration/bundle checks.
- Android Community, UI clarity and release-policy verifiers passed. iOS static UI/source checks passed. iOS compilation, signing, CAPTCHA/file-picker behavior and device testing still require Mac/Xcode; no iOS binary or upload was produced.
- Privacy backend: 200 tests passed. Deployed `columbiawalks-intake:3.17.10-privacy` is healthy. Only privacy-page.js changed; the legacy private tip validator hash remains `d0d0f183bfaee5bc4abab4a5e2328187e02dc81a80dd59c5e8a84206f795f994`. The live browser at https://www.columbiawalks.com/privacy-policy/ displays the September 28 policy, 3.17.10 official autofill disclosure, and current phone number.
- Authenticated Play Console was rechecked on September 28: the replacement certificate matches and “There is a pending request for resetting the upload key of this app” remains visible. Play upload has not been attempted. The previously recorded reset activation time is September 29, 2026 at 19:30 UTC; check the authenticated console before upload. Local signing is not proof of activation.

The APK is also copied to the owner's Downloads folder for direct internal installation. Artifacts, signing files and credentials are excluded from Git.
