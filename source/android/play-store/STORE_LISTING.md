# ColumbiaWalks Google Play listing

## App name

ColumbiaWalks

## Short description

Document walking-safety concerns in Columbia, Pennsylvania.

## Full description

ColumbiaWalks helps residents and visitors document pedestrian-safety
observations in Columbia, Pennsylvania.

Use the map to select a location, record a walking hazard or unsafe
interaction, add useful details, and securely submit the report to the
independent ColumbiaWalks community project. Reports save on your device first
and can retry automatically when a connection is available.

Features include:

- Repeat Reporting for fast sidewalk and vehicle observations
- Optional sidewalk lip-height and vehicle-behavior choices
- Quick and detailed pedestrian-safety reports
- Two clear Quick Report actions: submit only to ColumbiaWalks, or save to CW
  and prepare a separate anonymous CBPD tip draft
- GPS from camera or selected photos, with device-location fallback and manual
  override
- Optional photos with embedded metadata removed before upload
- A dedicated observational report path for driver and vehicle concerns
- Optional, user-started walk tracking and Health Connect walking-activity
  import
- Camera or photo-library choice for Page of Shame reports
- Saved reports with submission status and retry controls
- A Community hub with Contact Us, Robert's listed phone number, and private app
  feedback
- Local-only preparation for a past, non-active anonymous police tip, followed
  by a deliberate handoff to the official Police Department website
- Moderated public-trash-can comments and a separate private can-complaint form

After a report reaches ColumbiaWalks, the server may add model-derived
estimated weather context for the incident place and hour. It sends Open-Meteo
only the incident coordinates rounded to two decimal places and the incident
date and hour—not live phone location, report text, photos, contact information,
or a report ID. The app requests no new permission, and an Open-Meteo outage
never blocks the report. Weather data is attributed to Open-Meteo under CC BY
4.0.

Reports go first to ColumbiaWalks. Version 3.16.1 keeps a standard report photo
optional and makes the limited email field test a collapsed, off-by-default
opt-in. Its photo and in-area location safeguards apply only to that optional
test:

- Crosswalk Encroachment, including a Repeat Reporting Crosswalk Incursion, is
  assigned the police-and-mayor logical route.
- Missing Sidewalk is assigned the Codes logical route.

For this field-test build, both routes go exclusively to a server-configured
ColumbiaWalks test mailbox, the subject starts with `[TEST]`, and no Police
Chief, Mayor, or Codes recipient receives the email. The app contains no
mailbox address or Gmail credential. Test-destination authorization cannot be
reused for a later official destination.

The email includes the processed photo, confirmed report location, relevant
details, and comments. An email to the police route prominently includes any
license plate and plate jurisdiction you typed. All other report types and all
Contact Us messages remain within ColumbiaWalks unless disclosure is required
by law or needed to protect people, rights, or the service; they are not
automatically forwarded through this feature.

A field-test email remains in the ColumbiaWalks test mailbox. If a separately
authorized official destination is offered in a later release, that email may
become a government public record. Email does not guarantee a response,
enforcement action, investigation, or correction.

Independent-project notice: ColumbiaWalks is independently operated. It does
not represent or act on behalf of Columbia Borough, its Police Department, or
any other government entity. For official Columbia Borough information and
public services, visit https://www.columbiapa.net/.

ColumbiaWalks is not an emergency service. Test email is not emergency
reporting. Call 911 when someone is in immediate danger or needs urgent medical
help.

## Category

Maps & Navigation

## Release name

3.16.1 — Simpler Quick Report and Contact Us

## Release notes

Quick Report now keeps Location collapsed, makes the standard-report photo
optional, and offers separate Submit to CW and Submit to CW & Notify CBPD
actions. The second saves the CW report and prepares a draft that the user must
personally review and submit on CBPD's official form; ColumbiaWalks does not
send it to police. The test-email control is now collapsed, off by default, and
still pinned to the ColumbiaWalks test mailbox—not Police, Mayor, or Codes.
Contact Us lists Robert at (717) 466-9069 with call, text, and private-message
paths.
