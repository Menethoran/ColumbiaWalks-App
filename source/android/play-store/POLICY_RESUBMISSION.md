# Google Play policy resubmission notes for 3.16.1

## Misleading Claims response

ColumbiaWalks is independently operated and is not a government app. It does
not represent or act on behalf of Columbia Borough, its Police Department, or
another government entity. The Google Play Government apps declaration must
remain **No, this is not a government app**.

Version 3.16.1 retains the narrowly limited email field test as a collapsed,
optional control that is off by default. Reports are received by ColumbiaWalks
first. The app explains what will be sent and records destination-specific
consent for the test mailbox only when the reporter explicitly opts in.
Delivery defaults to disabled and destination defaults to test. If enabled for
the controlled test, the server—not Android—sends only to one server-configured
ColumbiaWalks test mailbox, leaves Cc empty, and puts `[TEST]` first in the
subject. Police, Mayor, and Codes do not receive a field-test message.

The only eligible logical routes in 3.16.1 remain:

- Quick Report `crosswalk_encroachment` and Repeat Reporting vehicle
  `crosswalk_incursion`: Police Chief and Mayor in a future official mode;
- `missing_sidewalk`: Codes in a future official mode.

The email includes the processed photo, confirmed location, relevant report
details, and comments. A police-route email prominently includes any license
plate and plate jurisdiction typed by the reporter. The optional email requires
a photo and confirmed in-area location; those safeguards do not apply to an
ordinary report, whose photo remains optional. No other report type is
automatically forwarded. Contact Us messages and optional contact information
are not forwarded through this feature.

Quick Report also offers **Submit to CW & Notify CBPD**. That choice stores the
report with ColumbiaWalks and prepares an on-device text draft for the official
Columbia Borough Police Department form. ColumbiaWalks does not send the draft
or media to CBPD. The reporter must review and paste the draft, choose anonymity,
attach original evidence, attest, complete reCAPTCHA, and press Submit on the
external site. No official police submission occurs inside the app.

Separately, after a report reaches ColumbiaWalks, the server may request
model-derived estimated conditions from Open-Meteo. The request contains only
incident coordinates rounded to two decimal places and the incident calendar
date and hour. It excludes the phone's live location, precise coordinates,
narrative, photo, contact information, and report or submission ID. Returned
conditions and provider/query provenance may be stored with the report.
Open-Meteo is attributed under CC BY 4.0. This server-side, best-effort step
adds no Android permission, is not advertising or tracking, and never blocks
report acceptance or storage if Open-Meteo is unavailable.

No other trigger is enabled. A separate future official destination cannot use
consent recorded for the test mailbox. The user-facing disclosure explains
that a later, separately authorized official email may become a government
public record and that email is not emergency reporting and does not guarantee
a response, enforcement, investigation, or correction. The listing and privacy
policy retain the independent-project notice and link to the official Columbia
Borough source at https://www.columbiapa.net/.

The previous 3.14.1 absolute statement is replaced with precise field-test and
conditional future official-destination language. This build does not route a
report to a government recipient.

## Reviewer verification path

The routing disclosure can be reviewed without sending a fictitious report:

1. Open **Report** and confirm **Location** starts collapsed and **Photo** is
   optional. Submit a report without a photo and confirm the standard
   ColumbiaWalks path remains available.
2. Select **Crosswalk Encroachment**, expand **Optional test email**, and confirm
   the opt-in starts off. The instructions say `[TEST]`, ColumbiaWalks test
   mailbox, and no Police/Mayor/Codes delivery while listing the photo, location,
   details, comments, and any typed plate. Confirm the opt-in remains unavailable
   until the photo and in-area location safeguards are met.
3. Select only a non-eligible type, such as a trip hazard. Confirm that no
   automatic-official-email disclosure or email-authorizing submit action is
   shown.
4. Open **Repeat reporting**, choose **Vehicle issue**, and choose **Crosswalk
   incursion**. Confirm the test-mailbox disclosure. Change to
   **Aggressive driving** and confirm that the automatic-email disclosure is
   removed.
5. In **Repeat reporting**, choose **Sidewalk issue** and select **Missing
   sidewalk**. Confirm the test-mailbox disclosure. Clear that selection and confirm
   that the automatic-email disclosure is removed.
6. Open **Community**, then **Contact Us**. Confirm Robert's phone number,
   call/text actions, and private-message form are present. Follow the
   privacy-policy link and confirm that it opens
   https://www.columbiawalks.com/privacy-policy/.
7. Return to **Report** and select **Submit to CW & Notify CBPD**. Confirm the
   report saves to ColumbiaWalks and the police-tip assistant explains that
   ColumbiaWalks has not sent the draft or media to CBPD. Also confirm the
   standalone **Notify the Authorities** option remains available beside Page of
   Shame.
8. In the police-tip assistant, confirm the
   screen says the draft remains local and is not submitted, rejects use until
   the event is confirmed past/not in progress, lists attachment formats, and
   hands off only to the official Police Department site. Do not file a sample
   police tip during review.
9. Open **Trash Can Comments & Complaints**. Confirm Public Comment is the
   default, forces public-can scope, and discloses moderation. Switch to Can
   Complaint and confirm it is private and not automatically forwarded to the
   Borough.
10. Review the Play full description for the exact limited routes,
   independent-project notice, public-record warning, emergency disclaimer,
   and official Columbia Borough source URL.

Automatic official email additionally fails closed unless the stored report
has a processed photo, a confirmed location within 5 km of Columbia Borough
center, the exact eligible type, affirmative authorization, and a stored
authorized destination matching the server's test mode. Recipient addresses and Gmail OAuth
credentials are server configuration and are not packaged in the Android app.

## Declarations to reconcile before rollout

- Government apps: not a government app.
- Data safety: use `DATA_SAFETY.md` for 3.16.1. This field-test build does not
  share location, photos, or report content with a government recipient through
  the email feature. It does share two-decimal incident coordinates and the
  incident date/hour with Open-Meteo for server-side weather context. Reconcile
  that transfer and the separate public-content paths in Console.
- Health apps: Activity and Fitness, limited to optional walking distance and
  walking exercise sessions; those summaries are not included in official
  email.
- Foreground service: location, for an explicitly started walk while a
  persistent notification is visible.
- Privacy policy URL: https://www.columbiawalks.com/privacy-policy/.
- App access: provide any reviewer instructions needed to reach the report and
  Repeat Reporting screens; do not provide Gmail credentials.

## Evidence required before resubmission

- The public privacy URL serves the 3.16.1 Community-tools and
  limited-forwarding policy.
- Server schema and recipient configuration are deployed and checked without
  exposing addresses or secrets in the app bundle.
- OAuth uses the sending-only Gmail scope and server-side secret storage.
- Review-mode dry runs prove exclusive test-mailbox interception, empty Cc,
  leading `[TEST]`, destination-consent pinning, the unchanged trigger matrix,
  attachment, prominent typed-plate treatment, deduplication, and daily cap
  before any automatic test is enabled.
- A production-signed 3.16.1 (`31601`) Play AAB passes the release verifiers and
  uses the established upload certificate.
- The trash-can and weather Directus migrations have each run from a verified
  backup, their narrow private-policy allowlists are verified, intake
  service 1.12.0 is live, JSON comment/complaint smoke tests land in separate
  private collections, and the public feed exposes only approved/redacted text
  linked to active canonical cans.
- Open-Meteo request inspection confirms the two-decimal coordinate and
  incident date/hour allowlist, stored provenance and attribution are present,
  and a forced timeout/outage still accepts and stores the report without
  weather data.
