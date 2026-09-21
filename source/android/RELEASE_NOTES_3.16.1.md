# ColumbiaWalks Android 3.16.1 (31601)

This patch source mirrors the iOS Quick Report simplification. It is not a
production-signed public Android release; the verified public APK remains on
the existing release track until a newly signed artifact passes release QA.

## Reporting changes

- Collapses the Quick Report location and optional people/vehicle controls by
  default.
- Keeps a photo optional for every standard CW report.
- Adds separate **Submit complaint to CW** and **Submit to CW & Notify CBPD**
  actions.
- Prefills the existing anonymous-tip assistant after a successful CW save,
  while preserving the required user review and official CBPD form submission.
- Adds a standalone **Notify the Authorities** action.

## Test email and contact

- Makes the qualifying test-email route an explicit, collapsed opt-in in Quick
  and Repeat Reporting. It remains off unless the user selects it and its photo
  and in-area location safeguards are met.
- Adds Contact Us to Community with Robert at `(717) 466-9069`, Call and Text
  intents, and the private App Feedback path.

## Release verification

- Run unit tests, lint, release-policy checks, and physical-device accessibility
  QA with JDK 17 and Android SDK 36.
- Verify both report choices, location expansion, optional-photo submission,
  CBPD prefill, and Call/Text intents on a physical device.
- Build with the established release signing identity and verify the APK/AAB
  signatures, checksums, mapping file, and native-symbol archive before release.
