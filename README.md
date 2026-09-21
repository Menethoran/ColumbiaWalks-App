# ColumbiaWalks

This repository contains the ColumbiaWalks Android and iOS source code and distributes verified installable Android releases.

Official website: https://www.columbiawalks.com

ColumbiaWalks is a private community walking-safety initiative. It is not affiliated with the Borough of Columbia or the Columbia Borough Police Department.

## Current release status

| Version | Build | Status | Summary |
| --- | ---: | --- | --- |
| [3.14.0](https://github.com/Menethoran/ColumbiaWalks-App/releases/tag/v3.14.0) | 31400 | Latest public Android release | Production-signed APK with Repeat Reporting, photo/GPS improvements, walking-distance tools, and Page of Shame reliability fixes. |
| 3.14.1 | 31401 | QA candidate only | UI clarity, accessibility text, privacy-link, backup-policy, and Play-policy corrections were completed locally, but no production-signed public APK was created. |
| 3.15.0 | 31500 | Development candidate | Added faster field-reporting work and a consent-based, test-only official-email design. The required backend deployment, production signing, store review, and physical-device QA were not completed. |
| 3.16.0 | 31600 | Superseded source candidate | Added Community tools, a local-only police-tip drafting handoff, separate public trash-can comments and private complaints, queued submissions, and server-side weather enrichment. |
| 3.16.1 | 31601 | Newest source candidate | Simplifies Quick Report, keeps standard-report photos optional, adds two CW/CBPD choices, makes test email opt-in, and adds Contact Us. No signed 3.16.1 artifact has been produced. |

The newest source available for development testing is 3.16.1. It does not yet have a signed Android APK, iOS archive, TestFlight build, or App Store build. The newest build users can safely install from this repository remains the production-signed [3.14.0 APK](https://github.com/Menethoran/ColumbiaWalks-App/releases/download/v3.14.0/ColumbiaWalks-3.14.0.apk).

## Path to the next public release

Before 3.16.1, or a later replacement build, can be published here, the maintainers must:

1. Back up and migrate the Directus schema, deploy the matching intake service, and verify the public/private data boundaries with non-sensitive test submissions.
2. Reconcile the hosted privacy policy and Google Play Data Safety disclosures with the new Community, trash-can, weather, and any enabled forwarding behavior.
3. Complete Android physical-device testing and build/test the iOS target on a Mac, including accessibility, offline retry, external-site handoff, and device visual QA.
4. Build Android and iOS artifacts with the established production signing identities; verify package IDs, versions, signatures, checksums, archive integrity, mapping files, and native symbols.
5. Complete the applicable Play Store, TestFlight, and App Store review steps and independently verify tester access and public availability.
6. Publish exactly one verified production APK in a non-draft GitHub release, then confirm the latest-release API reports the expected semantic tag, file size, SHA-256 digest, and HTTPS download URL.

Source candidates, successful local builds, and store submissions are not described as public releases until those checks are complete.

## Install

Open the latest release, download the `.apk` file on an Android device, and follow Android's prompt to allow installation from your browser or file manager. You can turn that permission off again after installation.

## Source code

The newest available source candidate is under [`source/`](source/):

- [`source/android/`](source/android/) contains the Android application, Gradle project, release-readiness checks, shared report catalog, server intake service, migration scripts, tests, and release documentation.
- [`source/ios/`](source/ios/) contains the SwiftUI application, Xcode project, tests, App Store documentation, and static verification script.

The current source snapshot identifies itself as `3.16.1 (31601)`. It is a development candidate, not proof of a production deployment or store release.

For Android, use JDK 17 and Android SDK Platform 36 with Build Tools 36.0.0, then run the verification commands documented in [`source/android/DEVELOPMENT_3.16.md`](source/android/DEVELOPMENT_3.16.md). The server intake tests run from `source/android/server/intake/` with `npm test` after installing the locked dependencies.

For iOS, use Xcode and XcodeGen on macOS and follow [`source/ios/README.md`](source/ios/README.md). Linux cannot compile or device-test the SwiftUI target.

Generated builds, dependency folders, local environment files, signing material, credentials, tokens, and private submissions are excluded from this repository. Production Android releases require the established signing identity; the signing key and passwords are never stored here.
