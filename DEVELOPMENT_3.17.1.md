# 3.17.1 public candidate and website delivery

Prepared September 27, 2026 from the preserved 3.17.0 internal branch. Android and iOS marketing version is 3.17.1; platform build code is 31701. Public native police-tip UI is restored from the verified 3.16.1 source baseline `202cbc85f7f82c0ec19b8152ccd11ec02523af95`, with the new release identity and phone number.

## Website deployed

- `/contact/`: project email, clickable (717) 992-3102, Apple App Store, Google Play beta and listing, and founders Callie Jo Thompson and Robert Burton Thompson V.
- `/police-tip/`: explicit external handoff to CBPD's CRIMEWATCH Submit-a-Tip page, anonymity instructions, 911 guidance, and a clear receipt boundary. No tip form or automatic forwarding is hosted on ColumbiaWalks.
- Homepage, report page, navigation, footer and About page link the new pages and identify both founders.
- Google Play is labeled closed beta. The verified existing 3.14.0 website APK remains available; no 3.17.0 test or debug APK is advertised as a public update.
- Privacy page includes the website handoff and new contact information while preserving the separate 3.17.0 private test-intake disclosure.
- Facebook remains pending the user's exact ColumbiaWalks page/group URL. The previous site setting pointed to Ghost's default Facebook page and was not a ColumbiaWalks identity.

See `source/website/README.md` for exact deployed theme, backend image and rollback locations.

## Verification

- Android 3.17.1 QA: `testDebugUnitTest lintDebug assembleDebug` passed; 56 unit tests passed, zero failures/errors/skips. QA package is `org.columbiawalks.app.qa`; it is not a public artifact.
- Backend: all 200 tests passed after updating the existing privacy assertions for the new phone and version description. Existing private tip enforcement tests remain intact.
- Android community-contract, UI-clarity and release-policy checks pass. iOS source/UI checks pass; no Xcode execution is claimed.
- Distribution checks allow 3.17.1 public source and continue to reject .0 public/external versions.
- Ghost accepted and activated the theme through its Admin API. Contact, official-tip instructions and mobile navigation were inspected in the browser.
- No police tip or real report was submitted during verification.

## Native publication boundaries

The original website APK signing keystore is recovered, but its password has not been recovered. The public build/staging scripts remain pinned to the original certificate, SHA-256 `a0c9e5abc99caec8d2ec31181c75c577d00963e0af3f654aca19bb3f7355dcc4`. The replacement Play upload certificate cannot sign an in-place update to website APK installs.

Therefore **no public 3.17.1 APK, public GitHub release, Play rollout, or Apple upload is claimed**. The website is deployed independently. Use the original signer to produce the website APK when unlocked; finish iOS/Xcode work on the Mac before submission. Preserve 3.17.0 internal artifacts on their original branch.
