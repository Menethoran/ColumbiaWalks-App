# ColumbiaWalks Android 3.16.0 release readiness

This directory contains non-secret release tooling. It does **not** contain a
keystore, passwords, an environment file, or a production APK.

## Current publication gate

Android 3.13.0 established this signing certificate:

```text
SHA-256: A0:C9:E5:AB:C9:9C:AE:C8:D2:EC:31:18:1C:75:C5:77:D0:09:63:E0:AF:3F:65:4A:CA:19:BB:3F:73:55:DC:C4
Subject:  CN=ColumbiaWalks, O=ColumbiaWalks, L=Columbia, ST=Pennsylvania, C=US
Key:      RSA 4096-bit
Created:  2026-08-19 12:39:05 America/New_York
```

The 3.13.0 APK has one signer and APK Signature Scheme v2/v3 signatures. It
does not have a v3.1 proof-of-rotation lineage. Android therefore permits an
in-place 3.16.0 update only when the original 3.13.0 private key signs it.

Do not publish the debug APK and do not create a second production identity
silently. A different signer would be rejected by installed 3.13.0 copies and
by ColumbiaWalks' own signer check.

## Build with a recovered original key

Place the recovered keystore outside the source tree and restrict it to the
owner. Do not paste any password into chat, a shell command, or a text file.

```bash
chmod 600 /absolute/private/path/to/columbiawalks-release.p12

export CW_ANDROID_KEYSTORE=/absolute/private/path/to/columbiawalks-release.p12
export CW_ANDROID_KEY_ALIAS=the-existing-alias

/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/source/release-readiness/build-production-android.sh
```

The script prompts for both passwords without echoing them, confirms that the
keystore certificate is exactly the 3.13.0 certificate, builds 3.16.0, checks
its package/version/signature, and only then stages:

```text
/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/artifacts/ColumbiaWalks-3.16.0.apk
```

The Play artifacts are staged privately as:

```text
/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/artifacts/play/ColumbiaWalks-3.16.0-play.aab
/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/artifacts/play/ColumbiaWalks-3.16.0-native-debug-symbols.zip
/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/artifacts/play/ColumbiaWalks-3.16.0-mapping.txt
```

This source tree and these staging names do not prove publication. The live
website download and Ghost version surfaces intentionally remain at 3.14.1
until a production-signed 3.16.0 artifact has passed every gate below and is
actually published.

## 3.16.0 Community and official-email deployment gates

The current 3.16 candidate is a field-test build. Its two eligible issue rules
remain unchanged, but the Android client pins each new authorization to the
`test` destination. Generated subjects begin with `[TEST]`, and messages go
only to a ColumbiaWalks-controlled test mailbox—not to the Police Chief,
Mayor, Codes, or another government recipient. The test mailbox address and
all recipient configuration remain server-side. Missing, legacy, malformed,
or `official` destination authorization fails closed in this build.

Complete and record each gate before building or publishing a store artifact:

1. Run the backup-first `directus-3.16-trash-cans-upgrade.cjs` and
   `directus-3.16-weather-upgrade.cjs` migrations with a short-lived
   administrator token. Confirm both backups, the private-policy assertions,
   and the weather Create/Read field allowlists; then deploy intake service
   1.11.0. Exercise comment and complaint JSON with
   non-sensitive samples; verify separate private collections and confirm the
   public feed exposes only approved/redacted comments tied to active canonical
   cans. Do not invent or publish an unverified can inventory.
2. Deploy the Directus schema and durable official-email outbox before any
   3.16.0 client can submit an email-authorized report. Confirm older clients
   and rows default to no authorization.
3. Configure only the ColumbiaWalks-controlled mailbox for this field test.
   Keep the eventual Police Chief, Mayor, and Codes destinations disabled and
   server-side; do not package any address in the app or release documentation.
4. Store Gmail OAuth material as server secrets, use only the sending scope,
   and confirm that neither a Gmail password, app password, refresh token, nor
   client secret exists in source, logs, images, APKs, or AABs.
5. Keep delivery disabled while migrating. Then run review-mode dry runs for
   exactly `crosswalk_encroachment`, Repeat Reporting `crosswalk_incursion`, and
   `missing_sidewalk`. Confirm all other categories remain in ColumbiaWalks.
6. Verify the stored photo attachment, confirmed Columbia-area location,
   relevant details and comments, prominent typed license plate on police-route
   email, deterministic deduplication, bounded retry behavior, ambiguous-send
   handling, and the configured daily cap.
7. Confirm the privacy URL serves the 3.16.0 Community-tools and
   limited-forwarding policy. Reconcile Play Data Safety for trash-can
   location/text and moderated publication, and state that the field-test email
   does not share location, photos, or report content with a government
   recipient.
8. Verify the police assistant has no ColumbiaWalks network/persistence/media
   path, preserves the not-submitted warning, opens only the official URLs, and
   requires the user to complete anonymity selection, evidence attachment,
   attestation, reCAPTCHA, and final submission externally.
9. Complete Android unit, instrumentation, lint, accessibility, offline/retry,
   and physical-device QA. Complete the iOS build and UI/device QA on a Mac; a
   Linux source check is not an iOS release build.
10. Build with the established production/upload signer, verify version name
   `3.16.0` and version code `31600`, record hashes, and retain the mapping and
   native symbols privately.
11. Submit the production artifacts and disclosures for App Store and Google
   Play review. Publication is complete only after each intended store/channel
   and the public website endpoint are independently verified.

Enable automatic delivery only after review-mode evidence is approved. Keep a
documented server-side switch back to review or disabled mode and preserve the
daily cap. Do not use a real recipient as a development test target.

## If the original key is permanently lost

This is a signer reset, not a routine release. It requires explicit approval
because 3.13.0 cannot update in place. Users must finish or export queued
reports, uninstall 3.13.0, and install the reset build. Publishing a differently
signed APK as GitHub's normal latest release would also make 3.13.0 repeatedly
download an update that it must reject. Use a prerelease/manual migration first.

Only after that consequence is explicitly accepted, generate a replacement
identity interactively. The following commands keep passwords out of command
history and keep the plaintext keystore outside every repository:

```bash
umask 077
cw_signing_dir=/home/robert/.local/share/columbiawalks/android-signing
cw_keystore_path="$cw_signing_dir/columbiawalks-release-2026.p12"

install -d -m 700 "$cw_signing_dir"

keytool -genkeypair \
  -keystore "$cw_keystore_path" \
  -storetype PKCS12 \
  -alias columbiawalks-release-2026 \
  -keyalg RSA \
  -keysize 4096 \
  -sigalg SHA256withRSA \
  -validity 10000 \
  -dname "CN=ColumbiaWalks, O=ColumbiaWalks, L=Columbia, ST=Pennsylvania, C=US"

chmod 600 "$cw_keystore_path"
```

`keytool` prompts for the keystore password. With PKCS#12, use that same value
as `CW_ANDROID_KEY_PASSWORD`. Store the password in the owner's password
manager, separately from the keystore.

Audit and record the new public certificate without exposing the private key:

```bash
read -rsp "Keystore password: " CW_KEYSTORE_AUDIT_PASSWORD; echo
export CW_KEYSTORE_AUDIT_PASSWORD

keytool -list -v \
  -keystore "$cw_keystore_path" \
  -alias columbiawalks-release-2026 \
  -storepass:env CW_KEYSTORE_AUDIT_PASSWORD \
  | sed -n '/Owner:/p;/SHA256:/p;/Valid from:/p'

unset CW_KEYSTORE_AUDIT_PASSWORD
```

Before any build or publication, replace the expected certificate constant in
both scripts in this directory and the fingerprint in `source/ANDROID_RELEASES.md`
with the audited new fingerprint. Review those changes as part of the signer
reset.

### Encrypted redundant backups

Use a backup passphrase different from the keystore password. `gpg` prompts
through its secure pinentry; no passphrase belongs on the command line.

```bash
cw_backup_dir=/Backup/ColumbiaWalks-Signing
cw_network_backup_dir=/storage/documents/1-Work/ColumbiaWalks/Signing-Backup
cw_encrypted_backup="$cw_backup_dir/columbiawalks-release-2026.p12.gpg"

install -d -m 700 "$cw_backup_dir"
install -d -m 700 "$cw_network_backup_dir"

gpg --symmetric \
  --cipher-algo AES256 \
  --output "$cw_encrypted_backup" \
  "$cw_keystore_path"

chmod 600 "$cw_encrypted_backup"
install -m 600 \
  "$cw_encrypted_backup" \
  "$cw_network_backup_dir/columbiawalks-release-2026.p12.gpg"

sha256sum \
  "$cw_encrypted_backup" \
  "$cw_network_backup_dir/columbiawalks-release-2026.p12.gpg"

gpg --decrypt "$cw_encrypted_backup" >/dev/null
```

Also copy the encrypted `.gpg` file to an offline removable device. Test that
copy with `gpg --decrypt ... >/dev/null` before treating the reset as complete.
Never copy the plaintext `.p12` to `/Backup`, `/storage`, email, GitHub, or a
cloud drive.

## Release verification

To audit an APK without staging it:

```bash
/home/robert/Documents/1-Work/ColumbiaWalks/ColumbiaWalks-3.16/source/release-readiness/verify-and-stage-android-release.sh \
  /absolute/path/to/app-release.apk
```

The verifier enforces:

- package `org.columbiawalks.app`;
- version name `3.16.0` and version code `31600`;
- the pinned production signer;
- a valid v2 signature;
- absence of an accidentally packaged keystore-like file; and
- a reported SHA-256 digest and byte count.
