# ColumbiaWalks for iPhone

This is the native SwiftUI ColumbiaWalks 3.16.1 app. It deliberately keeps
the Android application's report identifiers, shared 84-question checklist,
server payload, offline-first behavior, colors, and privacy rules.

## Open the project

1. Install Xcode and its iOS simulator runtime.
2. Open `ColumbiaWalks.xcodeproj` and choose an iPhone simulator.
3. Select an Apple Development team before running on a physical iPhone.

The generated project is committed. Install XcodeGen and run `xcodegen generate`
from this directory only after changing `project.yml`.

If command-line builds still use Command Line Tools, select the installed Xcode:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

Then verify the app and unit tests with:

```sh
xcodebuild -project ColumbiaWalks.xcodeproj -scheme ColumbiaWalks \
  -destination 'generic/platform=iOS Simulator' build
xcodebuild -project ColumbiaWalks.xcodeproj -scheme ColumbiaWalks \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

No Directus token or other server credential belongs in the app. Standard,
Repeat, and Page of Shame reports plus feedback use the same validated public
intake endpoints as Android. Repeat reports retain one session identifier while
resetting safely after each offline-first save. Photos are inspected for GPS
before being normalized; original photo coordinates are recorded as provenance
when a user chooses device or manual coordinates instead.

The fifth tab is now Community. It keeps App Feedback and adds:

- Contact Us with Robert's current ColumbiaWalks phone number, system Call and
  Text links, and the existing private feedback path;
- a local-only structured draft for a past, non-active anonymous police tip,
  with verified call routes and an explicit handoff to the Police Department's
  official site for evidence, attestation, reCAPTCHA, and final submission;
- separate public-trash-can comments and private can complaints, queued with
  complete file protection and retried on launch/foreground against the 3.16
  trash-can intake endpoint.

The standalone police-tip draft is never sent to a ColumbiaWalks API. Quick
Report can first save a CW report and then prepare a separate tip draft from
those report fields, but ColumbiaWalks does not send that draft or media to
CBPD. The user must personally complete the official form. Version 3.16 does
not attach trash-can media. The Directus 3.16 migration and intake service
1.12.0 must be deployed before distributing this client.

Version 3.16.1 makes the narrowly scoped, server-owned field-test email workflow
an explicit opt-in that is collapsed and off by default.
Only a Quick crosswalk-encroachment report, a Repeat vehicle report explicitly
marked crosswalk incursion, or a missing-sidewalk report can authorize the test
email. A standard Quick report must contain exactly one approved key; mixed or
duplicate Quick selections are ordinary reports without email authorization.
Repeat Vehicle requires zero Quick keys, while Repeat Sidewalk requires exactly
one `missing_sidewalk` key. The app enables the optional control only with a
relevant photo and a confirmed location within 5 km of Columbia Borough center.
Those items remain optional for a standard Quick or Full CW report. Only an
explicit opt-in sends `official_email_authorized: true` together
with `official_email_destination_authorized: "test"`. Every authorized 3.16
message is addressed only to a ColumbiaWalks-controlled test mailbox and uses a
`[TEST]` subject; it is not sent to Police, the Mayor, or Codes. The server—not
the iPhone—is authorized to format and process the message from the
ColumbiaWalks account after a successful upload. Authorization does not confirm
delivery; server delivery safeguards still apply. No Gmail credential, test
mailbox address, or government recipient address is stored in this project.

After a successful report upload, the app retains the intake response's
field-test email status, `destination_mode`, and any per-route blocked reason.
Saved reports clearly
separate report acceptance from queued, review, disabled, blocked, deferred,
completed, uncertain, or unavailable email processing. This status is the
server response at acceptance time, not a live delivery receipt.
