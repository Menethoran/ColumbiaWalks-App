# ColumbiaWalks iOS 3.16.1 (31601)

This patch source supersedes 3.16.0 for the next Apple build. It has not yet
been archived, signed, uploaded to App Store Connect, or tested on a physical
iPhone.

## Quick Report

- Keeps Location and Identification collapsed until the user opens them.
- Keeps the standard CW report photo optional, including for issue types that
  are eligible for the separate test-email experiment.
- Provides two explicit actions: **Submit complaint to CW** and **Submit to CW
  & Notify CBPD**.
- The CBPD choice saves the CW report, prepares a separate draft from the saved
  fields, and opens the existing official-form handoff. The user must review,
  attach original evidence, attest, complete reCAPTCHA, and submit on CBPD's
  site. Opening the site is not delivery.
- Adds **Notify the Authorities** beside the Page of Shame reporting option for
  users who want to prepare a standalone tip without first saving a CW report.

## Test email

- Replaces automatic authorization with a collapsed opt-in that is off by
  default in Quick and Repeat Reporting.
- Enables the opt-in only when the qualifying report also has a photo and a
  confirmed location within 5 km of Columbia Borough center.
- Keeps the destination pinned to the ColumbiaWalks-controlled test mailbox
  with a `[TEST]` subject. It does not send to Police, the Mayor, or Codes, and
  authorization does not confirm delivery.

## Contact Us

- Adds Contact Us to Community with Robert listed at `(717) 466-9069`.
- Provides system Call and Text links and the existing private App Feedback
  path for app, project, and report follow-up messages.

## Required release verification

- Regenerate the Xcode project from `project.yml` only if XcodeGen is installed.
- Build and run the full test suite with Xcode on macOS.
- Complete Dynamic Type, VoiceOver, camera/library cancellation, offline retry,
  CBPD-handoff, Call/Text, and physical-iPhone visual QA.
- Produce a new signed `3.16.1 (31601)` archive. The previously uploaded
  `3.16.0 (31600)` build does not contain these fixes.
