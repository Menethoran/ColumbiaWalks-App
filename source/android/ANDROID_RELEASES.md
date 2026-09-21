# ColumbiaWalks Android releases and updates

## Canonical update host

Production APKs are published as GitHub Release assets in the public
[`Menethoran/ColumbiaWalks-App`](https://github.com/Menethoran/ColumbiaWalks-App)
repository. The app checks this endpoint on each launch:

```text
https://api.github.com/repos/Menethoran/ColumbiaWalks-App/releases/latest
```

GitHub Releases supplies the release tag, release notes, asset size, SHA-256
digest, download URL, and download count. `columbiawalks.com` may link to the
latest release, but it is not the update source of truth.

Release tags must use `vMAJOR.MINOR.PATCH`. Android version codes use
`MAJOR * 10000 + MINOR * 100 + PATCH`; minor and patch components must each be
below 100. Never reuse or decrease a production version code.

## Permanent signing identity

Every release from 3.13.0 onward must use the permanent ColumbiaWalks release
key. Its certificate SHA-256 fingerprint is:

```text
A0:C9:E5:AB:C9:9C:AE:C8:D2:EC:31:18:1C:75:C5:77:D0:09:63:E0:AF:3F:65:4A:CA:19:BB:3F:73:55:DC:C4
```

The build reads signing material only from these environment variables:

```text
CW_ANDROID_KEYSTORE
CW_ANDROID_KEYSTORE_PASSWORD
CW_ANDROID_KEY_ALIAS
CW_ANDROID_KEY_PASSWORD
```

Release builds fail when any variable is absent. Never commit the keystore,
passwords, exported environment files, or signing material.

Versions 3.11.0 and 3.12.0 were distributed with different debug
certificates. Android therefore requires one final uninstall before installing
3.13.0. That uninstall removes reports stored only on the phone, so queued
reports should finish submitting first. Once 3.13.0 is installed, later APKs
signed by the permanent key update it in place without another uninstall.

## App update trust checks

The app performs a conditional GitHub request using the stored ETag. It offers
an update only when the release version code is higher. Before opening
Android's user-confirmed package installer, it verifies all of the following:

1. Release and asset URLs use HTTPS.
2. The byte count matches the GitHub asset size.
3. The APK SHA-256 matches the GitHub asset digest.
4. The package is `org.columbiawalks.app`.
5. The APK version matches the release and is newer than the installed app.
6. The APK signer matches the currently installed app.

Android 8 and newer may ask the user to enable “Allow from this source” for
ColumbiaWalks. The app cannot and does not install an APK silently.

## Anonymous operations data

The app submits update lifecycle events to:

```text
POST https://directus.rndtech.org/columbiawalks-api/app-update-events
```

Events contain a random per-event UUID, event type, source and target versions,
timestamp, platform, and an allowlisted failure code when relevant. They do not
contain a device/install identifier, IP address field, contact information, or
location. Admin dashboard values are event totals, not unique-user or
unique-device counts. GitHub's release asset `download_count` remains the
authoritative download total.

## Release checklist

1. Increase `versionCode` and `versionName` monotonically.
2. Run unit and server tests.
3. Build `assembleRelease` and `bundlePlayRelease` with the four signing
   environment variables.
4. Verify the APK and AAB package, version, SHA-256, and signing certificate;
   validate the AAB with bundletool; and retain its matching mapping and native
   symbol files.
5. Create a non-draft, non-prerelease GitHub Release with a semantic tag and
   exactly one production `.apk` asset.
6. Open the GitHub latest-release API and confirm the asset has a
   `sha256:` digest, HTTPS download URL, correct size, and expected tag.
7. Install over the previous permanent-key release on an Android device and
   confirm Android accepts it as an update.

For Google Play, run `bundlePlayRelease`. The Play variant enables R8 and
places the deobfuscation map inside the AAB. It also creates the matching
MapLibre symbol-table sidecar at
`app/build/outputs/native-debug-symbols/playRelease/native-debug-symbols.zip`.
Upload that ZIP for the same version in App Bundle Explorer so native crash
addresses can be decoded. Never reuse either diagnostic artifact for a
different AAB.

If a release must be withdrawn, remove it from “latest” and publish a fixed APK
under a higher version. Never replace an already published APK while retaining
the same tag and version code.
