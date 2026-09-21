# ColumbiaWalks for Android

This public repository distributes installable Android releases of ColumbiaWalks.

Official website: https://www.columbiawalks.com

ColumbiaWalks is a private community walking-safety initiative. It is not affiliated with the Borough of Columbia or the Columbia Borough Police Department.

## Current release status

| Version | Build | Status | Summary |
| --- | ---: | --- | --- |
| [3.14.0](https://github.com/Menethoran/ColumbiaWalks-App/releases/tag/v3.14.0) | 31400 | Latest public Android release | Production-signed APK with Repeat Reporting, photo/GPS improvements, walking-distance tools, and Page of Shame reliability fixes. |
| 3.14.1 | 31401 | QA candidate only | UI clarity, accessibility text, privacy-link, backup-policy, and Play-policy corrections were completed locally, but no production-signed public APK was created. |
| 3.15.0 | 31500 | Development candidate | Added faster field-reporting work and a consent-based, test-only official-email design. The required backend deployment, production signing, store review, and physical-device QA were not completed. |
| 3.16.0 | 31600 | Newest source/debug candidate | Adds Community tools, a local-only police-tip drafting handoff, separate public trash-can comments and private complaints, queued submissions, and server-side weather enrichment. It is not deployed or production-signed. |

There is no verified 3.16.1 source tree or build artifact in the project records currently available to the maintainers.

The newest build available for development testing is 3.16.0. Its Android APK is debug-signed and must not be distributed as a public update. The newest build users can safely install from this repository remains the production-signed [3.14.0 APK](https://github.com/Menethoran/ColumbiaWalks-App/releases/download/v3.14.0/ColumbiaWalks-3.14.0.apk).

## Path to the next public release

Before 3.16.0, or a later replacement build, can be published here, the maintainers must:

1. Back up and migrate the Directus schema, deploy the matching intake service, and verify the public/private data boundaries with non-sensitive test submissions.
2. Reconcile the hosted privacy policy and Google Play Data Safety disclosures with the new Community, trash-can, weather, and any enabled forwarding behavior.
3. Complete Android physical-device testing and build/test the iOS target on a Mac, including accessibility, offline retry, external-site handoff, and device visual QA.
4. Build Android and iOS artifacts with the established production signing identities; verify package IDs, versions, signatures, checksums, archive integrity, mapping files, and native symbols.
5. Complete the applicable Play Store, TestFlight, and App Store review steps and independently verify tester access and public availability.
6. Publish exactly one verified production APK in a non-draft GitHub release, then confirm the latest-release API reports the expected semantic tag, file size, SHA-256 digest, and HTTPS download URL.

Source candidates, successful local builds, and store submissions are not described as public releases until those checks are complete.

## Install

Open the latest release, download the `.apk` file on an Android device, and follow Android's prompt to allow installation from your browser or file manager. You can turn that permission off again after installation.

## Privacy and source code

This repository is for public release downloads. Project source code and operational configuration are maintained separately; credentials, tokens, and private submissions are never published here.
