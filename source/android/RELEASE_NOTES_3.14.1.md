# ColumbiaWalks 3.14.1

## Clearer, consistent screens

- Keeps ColumbiaWalks on the same pale-white presentation on every supported
  phone, even when the phone itself is set to dark mode.
- Uses darker, fully opaque primary and instructional text plus clearly visible
  form outlines and white input surfaces.
- Gives spinners explicit high-contrast selected and drop-down rows instead of
  inheriting device-dependent text colors.
- Allows headings, spinners, and multiline fields to grow with larger
  accessibility text instead of clipping inside fixed heights.

## Text-box instructions

- Removes the competing in-box hints that could draw on top of one another in
  Repeat Reporting comments, Feedback, Page of Shame descriptions, Additional
  Information, and the dynamic "not included elsewhere" field.
- Each affected input now has one persistent label and, where useful, one
  separate helper sentence below the box.
- Rewords the Repeat Reporting comments helper so it does not imply that a
  submission is sent directly to a public department.

## Privacy and release-policy alignment

- Corrects the in-app privacy-policy link to the live `/privacy-policy/` page.
- Documents optional foreground walk tracking and user-initiated Health Connect
  imports accurately.
- Disables Android cloud backup for private reports, photos, feedback, and
  queued walking summaries stored by ColumbiaWalks on the device.
- Keeps the Google Play release independent of the website self-updater and
  records the independent-project disclaimer and official-information source
  used for Play policy review.

## Release identity

- Advances Android to version `3.14.1` / build `31401`, so the corrected build
  cannot be mistaken for either of the two distinct 3.14.0 APKs.
- The public APK must still be signed with the permanent ColumbiaWalks signing
  identity before publication. The existing 3.14.0 artifacts remain unchanged.
