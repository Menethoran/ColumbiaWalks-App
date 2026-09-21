# App Privacy answers

These answers describe ColumbiaWalks 3.16.1 (31601). Reconfirm them if the app or server changes.

## Tracking

- Does this app use data for tracking? **No**
- Third-party advertising or advertising measurement: **No**

## Data collected

### Precise Location

- Collected: **Yes**, when a user confirms a report location or deliberately includes the current confirmed pin in a trash-can submission. The source can be picture metadata, device GPS, a map pin, or manually entered coordinates.
- Linked to identity: **No**
- Used for tracking: **No**
- Purpose: **App Functionality**
- Sharing: For a report classified with exactly one approved crosswalk or missing-sidewalk selection, the app exposes a collapsed field-test control that is off by default. It can be enabled only with a confirmed location within 5 km of Columbia Borough center and a photo, but those items remain optional for the underlying standard CW report. Mixed, duplicate, or hierarchy-stray keys do not expose or authorize the control. Version 3.16.1 sends an explicitly authorized message only to a ColumbiaWalks-controlled test mailbox with a `[TEST]` subject, not to Police, the Mayor, or Codes. Authorization does not confirm delivery. Other report types are not authorized for this processing.
- Trash-can handling: A written trash-can location is required; an existing confirmed map pin is optional. Submitted trash-can addresses and coordinates remain in the private moderation/complaint record and are not returned by the public trash-can feed.
- Weather handling: After a safety report reaches ColumbiaWalks, the server may send Open-Meteo only the incident coordinates rounded to two decimal places and the incident calendar date and hour to obtain model-derived estimated conditions. It does not send the phone's live location, precise coordinates, narrative, photo, contact information, report/submission ID, or the reporter's device IP address; the request comes from the ColumbiaWalks server, and Open-Meteo may process that server request under its own terms and privacy information. Estimated conditions and provider/query provenance may be stored with the report. Open-Meteo data is attributed under CC BY 4.0. This is server-side app functionality, not tracking; an outage never blocks the report, the iOS app does not contact Open-Meteo directly, and no new phone permission is added.

### User Content — Photos or Videos

- Collected: **Yes**. A picture is optional for standard reports and required for Repeat and Page of Shame reports.
- Linked to identity: **No**
- Used for tracking: **No**
- Purpose: **App Functionality**
- Page of Shame pictures can become public only after an administrator reviews and approves them. The submission screen discloses that possibility before upload.
- Sharing: For the narrowly qualifying field-test email types, a relevant picture is required and is included if the server processes the disclosed message to the ColumbiaWalks-controlled test mailbox after upload and its delivery safeguards.
- The 3.16 trash-can form does not accept media. The police-tip assistant does not select, read, or upload evidence to CBPD; any evidence is chosen directly on the external official Police Department form after the user leaves ColumbiaWalks. Choosing **Submit to CW & Notify CBPD** first saves the optional CW report photo to ColumbiaWalks, then reminds the user to attach the original relevant file personally on the official form.

### User Content — Other User Content

- Collected: **Yes** (guided report answers, report notes, feedback text, and trash-can comments/complaints)
- Linked to identity: **No**, unless a user voluntarily includes identifying details in free text
- Used for tracking: **No**
- Purpose: **App Functionality**
- Sharing: For the narrowly qualifying field-test email types, submitted details are included only if the user explicitly opts in and the disclosed message is processed. For a crosswalk test message, an optional license plate and plate state are prominently identified when the reporter entered them. The message remains within the ColumbiaWalks-controlled test mailbox in version 3.16.1.
- Trash-can handling: Public comments first enter a private moderation queue. Only approved or redacted text and fixed categories may be published, and only when linked to an active canonical public can. Raw text, submitted location, source metadata, and submission IDs are not published. Can complaints remain in a separate private collection and are not automatically forwarded to the Borough.
- Police-tip handling: A standalone draft is local-only and is not collected by ColumbiaWalks. When the user first submits a CW report, the app can prepare a separate tip draft from the report fields already saved to ColumbiaWalks. ColumbiaWalks does not send either draft or any media to CBPD. Final text, evidence, attestation, reCAPTCHA, and submission occur on the external official Police Department site, and opening that site does not confirm delivery.

### Contact Info

- Name, email address, phone number, physical address, and other contact details may be collected only through the clearly optional Contact Us message fields. Robert's displayed ColumbiaWalks contact number, (717) 466-9069, is app content and is not user data collected by the app.
- Linked to identity: **Yes** when provided
- Used for tracking: **No**
- Purpose: **App Functionality** (support and optional follow-up)

## Data not collected

The app does not collect purchases, financial information, health or fitness information, browsing or search history, contacts, advertising data, diagnostics, or other usage analytics.

## Notes

No account or persistent account identifier is used. Random report, Repeat-session, and trash-can submission identifiers operate queues and sequence; they are not used for tracking or advertising. Embedded picture metadata is inspected for GPS, the original GPS values are retained as report provenance when applicable, and the stored/uploaded JPEG is re-encoded without embedded metadata.

Weather values are model-derived estimates, not measurements made by the iPhone or proof of the conditions a reporter experienced.

ColumbiaWalks is independently operated and does not represent or act on behalf of a government entity. Version 3.16.1 permits explicit field-test-email opt-in only for user-classified, visibly disclosed crosswalk encroachment/crosswalk incursion or missing-sidewalk submissions with a photo and confirmed location within 5 km of Columbia Borough center after successful server upload. The control is off by default, and declining it never prevents the underlying standard CW report. Every authorized 3.16.1 message is generated by the ColumbiaWalks server, sent from the ColumbiaWalks account only to a ColumbiaWalks-controlled test mailbox, and marked `[TEST]`; it is not sent to Police, the Mayor, or Codes. Authorization does not confirm delivery, and server delivery safeguards still apply. The app does not access the user's email account and contains no Gmail password, token, test-mailbox address, or official recipient address. All other report types remain outside this email workflow.
