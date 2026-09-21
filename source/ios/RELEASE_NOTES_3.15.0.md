# ColumbiaWalks 3.15.0

This development release adds a narrowly scoped, server-owned field-test email
workflow while preserving offline-first report saving and retry:

- Quick **Crosswalk encroachment** and Repeat Vehicle **Crosswalk incursion**
  are the only crosswalk classifications eligible to authorize a field-test
  email after successful upload.
- Quick or Repeat **Missing sidewalk** is the only sidewalk classification
  eligible to authorize a field-test email after successful upload.
- Version 3.15 addresses every authorized message only to a
  ColumbiaWalks-controlled test mailbox and adds `[TEST]` to its subject. It
  does not send these messages to Police, the Mayor, or Codes.
- Standard Quick authorization requires exactly one approved Quick key. Mixed
  or duplicate selections do not show or store test-email authorization. Repeat
  Vehicle crosswalk requires zero Quick keys, and Repeat Sidewalk missing
  sidewalk requires exactly one `missing_sidewalk` key.
- Qualifying forms show a persistent disclosure before submission and require a
  relevant picture plus a confirmed location within 5 km of Columbia Borough
  center. An out-of-area qualifying report is held on the form for coordinate
  correction before any local save; an ordinary nonqualifying report is not
  subject to this gate.
- The iOS payload sends `official_email_authorized: true` only when one of those
  exact structured classifications is selected and the stored consent pin is
  `official_email_destination_authorized: "test"`; every other report sends
  `false` and an explicit null destination authorization. This build never
  emits `official`.
- Repeat Vehicle adds optional license-plate and plate-state fields. They are
  included in that report, then cleared before the next report so an identifier
  cannot accidentally carry over.
- Repeat Reporting preserves the selected issue hierarchy/subtype while safely
  resetting per-event picture, location, comments, lip height, and vehicle
  identifiers.
- After the report server accepts an authorized submission, Saved reports retain
  and display the server's email result and optional `destination_mode`
  separately: queued, held for review, disabled, blocked with a reason,
  deferred, completed, uncertain, or unavailable. Test mode is labeled as the
  ColumbiaWalks-controlled test mailbox; missing or unexpected modes never
  imply an official recipient. A successful report upload is never presented
  as proof of email delivery.

The ColumbiaWalks server, not the iOS app, formats and sends qualifying
field-test email from the ColumbiaWalks account. No Gmail credential, test
mailbox address, or official recipient address belongs in the iOS source or
binary. Version 3.15.0 does not enable automatic forwarding to officials or for
speeding, aggressive driving, other codes/highway issues, Page of Shame, or any
other report type. Submission authorizes only test-mailbox processing after
successful upload; it does not confirm email delivery, and server delivery
safeguards still apply.

Release identity: `3.15.0 (31500)`. No App Store upload, signing, TestFlight
distribution, or official-recipient activation is performed by this source
change.
