# ColumbiaWalks

ColumbiaWalks is a private community walking-safety initiative. It is not affiliated with the Borough of Columbia or the Columbia Borough Police Department.

Website: https://www.columbiawalks.com

## 3.17.0 (31700): internal test source

This branch adds anonymous tip **test intake** on Android and iOS. Tips go only to private ColumbiaWalks storage. Every human-readable submitted field has `[TEST]` between every word, enforced by both the clients and the server. Police are not contacted. The app shows an internal-build banner, a marked preview, explicit test acknowledgement, and a verified receipt or a retryable pending state.

Starting with 3.17.0, every version whose patch component is `0` is an **internal test build only**. Public website/GitHub releases, Play production/open/closed testing, external TestFlight, and App Store distribution are prohibited for these versions. Android provides a separately installed local test APK and an explicitly gated signed Play **Internal testing** variant. iOS currently permits Debug/internal device builds only.

[Development, verification, and deployment status](DEVELOPMENT_3.17.md) distinguishes completed local checks from hosted intake and store availability. Source code and a successful local build do not mean the service or store release is live.

## Source and builds

- [`source/android/`](source/android/) contains the Android app, backend intake, Directus migration, and tests. Run `source/android/release-readiness/build-internal-android.sh` to test, lint, and build the separate internal APK.
- [`source/android/release-readiness/build-play-internal.sh`](source/android/release-readiness/build-play-internal.sh) builds and verifies the Play Internal testing bundle with the existing upload key. Configure signing privately outside Git. The bundle keeps `org.columbiawalks.app`; local debug installs use `org.columbiawalks.app.internal`.
- [`source/ios/`](source/ios/) contains the SwiftUI app, Xcode project, and tests. Follow the [3.17.0 iOS handoff](source/ios/INTERNAL_TEST_3.17.0.md) on a Mac. Linux static checks do not replace an Xcode build.
- Backend checks: run `npm ci && npm test` in `source/android/server/intake/` with Node.js 22 or newer.

Prior release and App Store documents remain historical records. Published Android artifacts are listed on the [GitHub releases page](https://github.com/Menethoran/ColumbiaWalks-App/releases); this internal source branch must not be published there as a release.

Generated builds, signing material, credentials, tokens, environment files, and private submissions are excluded from Git.
