# ColumbiaWalks for Android

This public repository distributes installable Android releases of ColumbiaWalks.

Official website: https://www.columbiawalks.com

ColumbiaWalks is a private community walking-safety initiative. It is not affiliated with the Borough of Columbia or the Columbia Borough Police Department.

## Current release

ColumbiaWalks for Android 3.13.0 was released August 19, 2026. It establishes a permanent production signing identity and checks this repository's latest GitHub Release when the app launches. Newer APKs are downloaded only over HTTPS and are checked for the expected size, SHA-256 digest, package name, version, and signing certificate before Android's installer opens.

[Download the latest ColumbiaWalks APK](https://github.com/Menethoran/ColumbiaWalks-App/releases/latest)

## Install

Important: versions through 3.12.0 were distributed with temporary debug signing identities. Android therefore requires one final uninstall before installing 3.13.0. First allow any locally saved reports to finish submitting, because uninstalling removes reports that exist only on the phone.

Open the latest release, download the `.apk` file on an Android device, and follow Android's prompt to allow installation from your browser or file manager. You can turn that permission off again after installation.

After 3.13.0 is installed, later ColumbiaWalks releases signed by the permanent key can update it in place. The app always requires the normal Android confirmation before installing an update.

## Privacy and source code

This repository is for public release downloads. Project source code and operational configuration are maintained separately; credentials, tokens, and private submissions are never published here.

Anonymous update events report only the event type, app versions, timestamp, platform, and an allowlisted failure category when needed. They do not include a device identifier, contact information, or location. GitHub's release asset count is used to track downloads.
