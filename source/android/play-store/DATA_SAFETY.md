# Google Play data-safety answers for 3.16.0

These answers describe the Android 3.16.0 `playRelease` field-test bundle and
the matching ColumbiaWalks intake configuration. Delivery defaults to disabled
and destination defaults to test. Eligible messages authorized specifically
for testing go only to a server-configured ColumbiaWalks test mailbox with a
leading `[TEST]` subject; this build does not deliver them to Police, Mayor, or
Codes. Reconfirm the deployed server mode, test recipient, retention, and
access controls in Play Console before saving the declaration. Enabling an
official destination requires a later disclosure and Data Safety review.

## Security and account access

- Data is encrypted in transit: Yes (HTTPS)
- Users can request deletion: Yes, through Community > App Feedback
- Account creation: Not supported or required
- Independent security review: No
- Android backup of ColumbiaWalks private local data: Disabled

The Community tab adds two independently handled features. Police-tip drafts
are prepared locally and copied to the clipboard; ColumbiaWalks does not
collect that text or the evidence the user later chooses on the external
Police Department site. Trash-can comments and complaints are collected by
ColumbiaWalks without account or contact fields and are queued in Android's
no-backup storage until upload succeeds.

A field-test email remains in the ColumbiaWalks-controlled test mailbox. If a
later build separately authorizes and enables an official destination, a
government recipient may retain its copy under its own systems, policies, and
public-records obligations.

## Data collected and shared

Reports are received by ColumbiaWalks first. A user can authorize field-test
email only for these exact report types:

- `crosswalk_encroachment`, or Repeat Reporting `crosswalk_incursion`, to the
  the police-and-mayor logical route;
- `missing_sidewalk` to the Codes logical route.

Both logical routes are intercepted by the one configured ColumbiaWalks test
mailbox in this build; Cc is empty and `[TEST]` is the first subject token. No
other report type generates email. Feedback contact submissions, walking
summaries, and Health Connect summaries are not forwarded through this feature.
The Android app contains neither Gmail credentials nor any mailbox address.

### Location

- Approximate location: optional, collected and shared with Open-Meteo for app
  functionality after server-side rounding to two decimal places
- Precise location: optional, collected for app functionality
- Shared with a government recipient through 3.16 field-test email: **No**

Location is attached when the user selects or confirms a report location.
Automatic official email requires a confirmed report location within 5 km of
Columbia Borough center.
For an authorized eligible field-test report, the report location is sent only
to the configured ColumbiaWalks test mailbox.

While the user explicitly runs walk tracking, location is also processed on the
device by a foreground service to calculate distance. Raw walk routes are not
uploaded or shared through official email.

Trash-can submissions require a written address or location description and
can optionally include an already confirmed report-map pin. Submitted
trash-can addresses and coordinates stay in the private moderation or complaint
record and are not returned by the public trash-can feed.

For a safety report with an incident location and time, the ColumbiaWalks
server may request model-derived estimated conditions from Open-Meteo. It
rounds the incident coordinates to two decimal places and sends only those
rounded coordinates and the incident calendar date and hour. Open-Meteo does
not receive the phone's live location, precise report coordinates, narrative,
photo, contact information, or ColumbiaWalks report or submission ID. The
server may store the estimated conditions and provider/query provenance with
the report. This is used only for app functionality, not advertising or
tracking. Open-Meteo data is attributed under CC BY 4.0. A timeout, outage, or
missing result never blocks report acceptance or storage. The mobile app does
not contact Open-Meteo directly and requests no new permission for this
server-side processing.

### Photos and videos

- Photos: optional, collected for app functionality
- Shared with a government recipient through 3.16 field-test email: **No**

The app removes embedded photo metadata before saving or uploading a processed
report photo. Automatic official email requires a stored report photo, and the
processed photo is attached to an authorized eligible official email.

A photo and optional description submitted through the Page of Shame path may
be published only after the user chooses that path and a ColumbiaWalks
administrator approves the sanitized copy. That separate path is not an
automatic official email.

The 3.16 mobile trash-can form does not accept photos or video. The local
police-tip assistant does not select, read, or upload evidence; if the user
continues, evidence is chosen directly on the external Police Department form
under that site's handling and privacy terms.

### Health and fitness

- Fitness information, including walking activity, distance, duration, and time
  range: optional, collected for app functionality and analytics
- Shared with third parties: No

Users may explicitly start ColumbiaWalks walk tracking or import walking
exercise sessions from Health Connect on Android 14 or newer. After an explicit
sharing agreement, the app uploads only aggregate distance, duration, time
range, activity count, source, and app version. It does not upload routes,
unrelated health records, or device identifiers. Health and fitness data is not
included in official email.

### Personal information

- Name: optional, collected for developer communications
- Email address: optional, collected for developer communications
- Phone number: optional, collected for developer communications
- Address: optional, collected for developer communications
- Other information supplied by the user: optional, collected for app
  functionality and developer communications
- Shared with third parties through automatic official email: No

These contact fields appear only when a user chooses to offer contact
information in Feedback. Permission to contact the user is a separate opt-in.
Feedback contact information is not included in automatic official email.

### User-generated content

- Other user-generated content: collected for app functionality
- Shared with a government recipient through 3.16 field-test email: **No**

This includes safety-report selections, narratives, comments, observed vehicle
information, pedestrian-profile answers, and police-interaction observations.
For an authorized eligible field-test report, relevant report details and
comments are sent only to the ColumbiaWalks test mailbox with the photo and
location. For a police-route template, any license plate
and plate jurisdiction typed by the user are displayed prominently in the email.
ColumbiaWalks does not infer or guarantee a plate number from the photograph.

Trash-can public comments are collected for moderation. Only approved or
redacted comment text and fixed categories may later be published, and only
when linked to a verified active public-can inventory item. The raw comment,
submitted address or coordinates, submission identifier, and source metadata
are not published. Can complaints use a separate private collection and are
not automatically forwarded to Columbia Borough or another government agency.
Police-tip draft text is not collected by ColumbiaWalks.

## Data not collected by the Play build

- Financial information
- Contacts
- Messages outside text deliberately entered into a ColumbiaWalks form
- Audio
- Files and documents
- Calendar data
- Web-browsing history
- App activity outside ColumbiaWalks
- Device or advertising identifiers

The external Police Department site may accept file, image, video, or audio
attachments after the user leaves ColumbiaWalks. Those external selections are
not data collected by the ColumbiaWalks Play build.

The website-distributed APK has an opt-in/self-update workflow that sends
anonymous update lifecycle events. `playRelease` disables that workflow and
does not request package-install permission.

## Play Console reconciliation checklist

Before rollout, verify that the Play Console form matches this file:

- Approximate location: collected; shared with Open-Meteo for app functionality
  only as incident coordinates rounded to two decimal places; not shared with
  government through the field-test email feature.
- Precise location: collected; not shared with government through the
  field-test email feature and not sent to Open-Meteo.
- Photos: collected; not shared with government through the field-test email
  feature. Reconcile the separately moderated Page of Shame path in the final
  Play Console answer.
- Other user-generated content: collected; not shared with government through
  the field-test email feature. Reconcile separately approved public content in
  the final Play Console answer, including moderated public trash-can comments.
- Trash-can locations and comment/complaint text: collected for app
  functionality; complaints remain private, while approved/redacted public-can
  comments may be published as disclosed in the form.
- Police-tip drafts and police-tip evidence: not collected by ColumbiaWalks;
  final entry, attachment, attestation, reCAPTCHA, and submission occur on the
  external official Police Department site.
- Feedback contact fields: collected for developer communications and not
  shared through the automatic official-email feature.
- Health and fitness aggregates: collected and not shared.
- Open-Meteo processing is server-side, is not used for advertising or
  tracking, adds no phone permission, and cannot block report acceptance.
- Data is encrypted in transit, deletion requests are supported, and account
  creation is not required.
