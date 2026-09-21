# ColumbiaWalks Privacy Policy

Last updated: September 21, 2026

ColumbiaWalks is an independent community pedestrian-safety reporting and
analysis service focused on Columbia, Pennsylvania. ColumbiaWalks does not
represent or act on behalf of Columbia Borough, its Police Department, or any
other government entity. This policy explains what the ColumbiaWalks Android
app and website collect and how that information is used.

## Information you choose to provide

When you submit a report, ColumbiaWalks may collect the location you select or
confirm, safety concerns and observations, narrative text, comments, dates and
times, vehicle or agency details, and an optional photograph. A photograph is
not required to save a standard Quick Report to ColumbiaWalks. When you use
Contact Us, you may also choose to provide a name, email address, phone number,
street address, or other contact notes. Contact information is optional, and
permission to contact you is a separate opt-in.

The Community tab also lets you submit a public trash-can comment or a private
can complaint. A trash-can submission includes its type, one fixed category, a
3-2,000-character comment, a written address or location description, the
public/private/unknown property scope where applicable, and an optional
confirmed map pin. These forms do not ask for an account or contact details.

The separate police-tip assistant prepares text only on your device. A
standalone draft is not uploaded to or stored by ColumbiaWalks. After saving a
Quick Report, you may choose **Submit to CW & Notify CBPD** to prepare a draft
from that report. The report is stored by ColumbiaWalks, but ColumbiaWalks does
not send the draft, photograph, or other media to the Columbia Borough Police
Department. If you choose to continue, the app opens the Department's official
external form. You must paste and review the text, choose anonymity, attach any
original evidence there, personally make the official attestation, complete
reCAPTCHA, and press the external site's Submit button. That site controls its
own collection, submission receipt, and privacy practices.

When available, location metadata embedded in a camera or selected photo is
read on your device to suggest the report location. You may review and override
it manually. If a photo has no usable location, you may choose device location
or enter the location manually. ColumbiaWalks removes embedded metadata from
the processed photo before saving or uploading it.

## Estimated weather context

After ColumbiaWalks receives a report with an incident location and time, the
server may request model-derived estimated conditions for that place and hour
from Open-Meteo. Before making the request, the server rounds the incident
coordinates to two decimal places. It sends Open-Meteo only those rounded
incident coordinates and the incident calendar date and hour—not the phone's
live location, report narrative, photo, contact information, or ColumbiaWalks
report or submission ID.

The weather request comes from the ColumbiaWalks server rather than the phone,
so it does not expose the reporter's device IP address to Open-Meteo.
Open-Meteo may process that server request under its own terms and privacy
information at https://open-meteo.com/en/terms.

ColumbiaWalks may store the estimated conditions with the report together with
provenance identifying the provider and rounded query location and incident
time. These values are model-derived estimates, not measurements taken by the
phone or proof of the conditions a person experienced. Weather data is
attributed to Open-Meteo under the Creative Commons Attribution 4.0
International license (CC BY 4.0).

This enrichment is best-effort and server-side. An Open-Meteo timeout, outage,
or missing result never blocks acceptance or storage of the report; the report
continues without estimated weather. It adds no phone permission, does not
start background location access, and does not cause the app to contact
Open-Meteo directly.

If you explicitly start walk tracking, ColumbiaWalks uses location while an
Android foreground service and persistent notification are active to calculate
distance on your device. If you explicitly choose Health Connect import on
Android 14 or later, the app requests read access only to walking exercise
sessions and distance. After you review and agree to submit, ColumbiaWalks
uploads only aggregate distance, duration, time range, activity count, source,
and app version. Raw routes, unrelated health records, and device identifiers
are not uploaded. You can use reporting features without walk tracking or
Health Connect.

## How information is used

Reports go first to ColumbiaWalks. ColumbiaWalks uses submitted information to
receive and organize community safety reports, identify patterns and recurring
issues, support privacy-conscious statistics, calculate aggregate walking
statistics when users opt in, moderate material proposed for public display,
respond to feedback when permission is provided, maintain the service, and
prevent abuse.

Reports and feedback are not sold or shared for advertising. Authorized
administrators and infrastructure providers may process information only as
needed to operate ColumbiaWalks. Information may also be disclosed when
required by law or to protect people, rights, or the service.

## Limited authorized email field test

Version 3.16.1 presents the limited email field test as a collapsed, optional
control that is off by default. A reporter must expand the instructions and
explicitly opt in before submitting an eligible report. The report is still
received and stored by ColumbiaWalks first. Delivery defaults to disabled and
destination defaults to test. If field-test sending is enabled, the
ColumbiaWalks server generates an email from the ColumbiaWalks account and sends
it only to a server-configured ColumbiaWalks test mailbox. The app contains
neither Gmail credentials nor the test mailbox address.

Email eligibility is limited to these exact report types:

- `crosswalk_encroachment`, or Repeat Reporting `crosswalk_incursion`, is sent
  to the police-and-mayor logical route;
- `missing_sidewalk` uses the Codes logical route.

In this field-test build, both logical routes are intercepted by the
ColumbiaWalks test mailbox, `[TEST]` is the first subject token, Cc is empty,
and the Police Chief, Mayor, and Codes Department do not receive the message.
Your authorization is stored for the specific test destination. A future
official destination cannot reuse that test consent and requires a separate,
matching authorization and updated release review.

The email includes the processed report photo, confirmed location, relevant
report selections and details, and comments. A police-route email prominently
displays any license plate and plate jurisdiction that you typed. ColumbiaWalks
does not promise that a plate will be inferred from a photograph. This optional
email opt-in requires a stored photo and confirmed location within 5 km of
Columbia Borough center. Those safeguards do not apply to an ordinary
ColumbiaWalks submission, which can be saved without a photo.

No other report type is automatically forwarded. Contact Us messages, contact
information supplied through Contact Us, walking summaries, and Health Connect
summaries are not automatically forwarded through this feature. A later change
to the eligible types or recipients requires updated user-facing disclosure,
policy review, and release verification.

A field-test email remains in the configured ColumbiaWalks mailbox and is not
sent to a government recipient. If a separately authorized official destination
is later enabled and delivered, that email may become a government public
record and may be retained, disclosed, or processed under the recipient's laws
and policies. After an official email is delivered, ColumbiaWalks cannot
control the recipient's retention or response to it.

ColumbiaWalks is not an emergency service. Automatic email is not a substitute
for 911 or an official emergency channel, and it does not guarantee a response,
enforcement action, investigation, or correction. Call 911 when someone is in
immediate danger or needs urgent medical help.

## Public display

A submitted report or photo is private by default within ColumbiaWalks, subject
to the limited authorized official-email routing above and disclosures required
by law. ColumbiaWalks does not automatically publish raw report photographs or
contact information. A photograph and optional description submitted through
the Page of Shame path can appear publicly only after a moderator selects a
sanitized copy and marks it approved for publication. The full license plate is
not published automatically.

Public trash-can comments begin in a private moderation queue. Only
administrator-approved or redacted text and fixed categories may appear in the
public trash-can feed, and only when linked to an active canonical public-can
record. The raw comment, submitted location, source metadata, and submission
identifier are not published. Can complaints are stored separately, remain
private, and are not automatically sent to Columbia Borough, Public Works, a
trash hauler, or another government recipient.

## Device storage and transmission

The app saves reports, feedback, trash-can submissions, and walking summaries locally before
submission so interrupted uploads can be retried. ColumbiaWalks disables
Android backup for this private local app data. Data sent to ColumbiaWalks is
transmitted over HTTPS. Reasonable administrative and technical safeguards are
used, but no storage or transmission system can be guaranteed completely
secure.

Trash-can JSON is stored in Android's no-backup application directory while it
waits for a network retry. Version 3.16 does not attach trash-can media. The
server can support a future optional photo only after re-encoding it and
removing embedded metadata; introducing that client capability requires a new
disclosure review.

The website-distributed Android app may send anonymous self-update lifecycle
events containing a random event identifier, event type, current and target app
versions, time, platform, and an allowlisted failure reason. These events do not
contain a persistent device identifier, contact information, or location. The
Google Play build disables this self-update workflow.

## Retention and deletion

Information is retained only as long as reasonably needed for the purposes
described above, legal obligations, safety analysis, and service integrity. To
ask about, correct, or request deletion of information you submitted, use
**Contact Us** under Community in the ColumbiaWalks app and include enough
information to identify the submission. You may also call or text Robert at
(717) 466-9069. Requests are evaluated subject to legal, safety, and
record-integrity requirements.

A field-test message remains under ColumbiaWalks' test-mailbox controls. If you
separately authorize a future official destination, a deletion request to
ColumbiaWalks cannot guarantee deletion from that government recipient's email,
records, or systems after delivery. Requests concerning an official recipient's
copy may need to be directed to that recipient.

## Children

ColumbiaWalks is not directed to children under 13 and does not knowingly seek
personal information from children under 13.

## Changes

This policy may be updated as the service changes. The current version and its
effective date will remain available at
https://www.columbiawalks.com/privacy-policy/.
