# ColumbiaWalks

ColumbiaWalks is an independent community walking-safety initiative in Columbia, Pennsylvania. It is not affiliated with the Borough or Columbia Borough Police Department.

Website: https://www.columbiawalks.com

## 3.17.1 (31701): public release candidate

Android and iOS prepare a police-tip draft locally and open CBPD's official CRIMEWATCH tip form. The user chooses anonymity, reviews the text, attaches evidence, completes the official form's acknowledgements and verification, and submits there. ColumbiaWalks does not automatically transmit the draft or confirm police receipt.

The website update adds [Contact Us](https://www.columbiawalks.com/contact/) and [anonymous police-tip instructions](https://www.columbiawalks.com/police-tip/), app-store links, and the current founder/contact information. Both founders are Callie Jo Thompson and Robert Burton Thompson V; the project phone is (717) 992-3102 and email is columbiawalks@gmail.com.

See [3.17.1 verification and deployment status](DEVELOPMENT_3.17.1.md) and [website deployment notes](source/website/README.md). The website theme version is separate from the available Android APK. A successful QA build is not a signed public release.

## Source and builds

- `source/android/` contains the app and intake backend. `release-readiness/build-production-android.sh` verifies the original website signing identity before building/staging public artifacts. Signing material stays outside Git. QA debug installs use `org.columbiawalks.app.qa` and disable self-updates.
- `source/ios/` contains the SwiftUI app and Xcode project, version 3.17.1/build 31701. Follow the App Store handoff on a Mac; Linux static checks do not replace Xcode, simulator, or physical-iPhone validation.
- `source/website/` contains the overlay applied to the verified live Ghost theme, the published page HTML, and deployment/rollback notes.
- Backend checks: `npm ci && npm test` from `source/android/server/intake/` with Node.js 22 or newer. Container tests must mount the parent `server/` directory so migration fixtures are available.

## Internal builds remain separate

Starting with 3.17.0, every semantic version whose patch component is `0` is **internal test only**. Public website/GitHub releases, Play production/open/closed testing, external TestFlight, and App Store distribution are blocked for those versions.

The preserved `internal/3.17.0-anonymous-tips` branch contains the private test app. Its text-only intake inserts `[TEST]` between every submitted word and never contacts police. Its backend route remains available for existing internal tests; public 3.17.1 clients do not call it. `DEVELOPMENT_3.17.md` and `source/ios/INTERNAL_TEST_3.17.0.md` describe that separate historical build, not this candidate.

Generated builds, signing material, credentials, environment files, tokens, and private submissions are excluded from Git.
