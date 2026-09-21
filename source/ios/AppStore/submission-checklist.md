# App Store Connect submission checklist

- [ ] Agreements, tax, and banking status allow app creation and distribution
- [ ] Create the app record with bundle ID `org.columbiawalks.app` and name `ColumbiaWalks`
- [ ] Set primary category to Navigation and secondary category to Lifestyle
- [ ] Enter the U.S. English metadata from `metadata/en-US`
- [ ] Deploy the 3.16 privacy-policy source to the public privacy URL and verify
  that the live page covers trash-can text/location/queue handling, moderation,
  private complaints, and the external police handoff
- [ ] Add the verified public privacy-policy URL and support URL
- [ ] Capture and visually verify the required 3.16 App Store screenshots on
  the final iOS build; no 3.16 screenshot set is included in this candidate
- [ ] Store the approved 6.9-inch iPhone screenshots under
  `screenshots/en-US/iphone-6.9`, then upload that exact set
- [ ] Complete App Privacy using `app-privacy.md`
- [ ] Complete the age-rating questionnaire using `age-rating.md`
- [ ] Confirm export compliance using `export-compliance.md`
- [ ] Enter App Review contact details from `review-information.md` and paste
  `review-notes-paste-ready.txt` into App Review Notes; keep the longer
  `review-information.md` as the internal test guide
- [ ] Select build `3.16.0 (31600)` after processing completes
- [ ] Set app availability and pricing (Free) deliberately
- [ ] Add build 31600 to an internal TestFlight group
- [ ] Add beta description, feedback email, and What to Test copy
- [ ] Complete any TestFlight compliance prompt
- [ ] Invite external testers or enable a public link only after choosing the intended audience and completing Beta App Review if required
- [ ] Verify the server is pinned to test destination mode, `[TEST]` subjects, duplicate/idempotency protection, attachment delivery, prominent plate labeling, and the ColumbiaWalks Gmail sender using only the controlled test mailbox
- [ ] Verify only `crosswalk_encroachment`, Repeat vehicle `crosswalk_incursion`, and `missing_sidewalk` can produce `official_email_authorized: true`; confirm every other issue remains false
- [ ] Verify the exact selection shape: standard Quick has exactly one approved key, Repeat Vehicle crosswalk has zero Quick keys, and Repeat Sidewalk missing sidewalk has exactly one `missing_sidewalk`; mixed, duplicate, and hierarchy-stray keys must remain unauthorized
- [ ] Verify qualifying Quick and Repeat submissions require a relevant picture and a confirmed location within exactly 5 km of Columbia Borough center before local save; confirm the same out-of-area location remains usable for an ordinary nonqualifying report
- [ ] Confirm qualifying payloads alone encode `official_email_destination_authorized: "test"`, all others encode null, and this 3.16 build never emits `official`
- [ ] Confirm every disclosure and post-save status says version 3.16 uses only a ColumbiaWalks-controlled test mailbox with a `[TEST]` subject—not Police, the Mayor, or Codes—and does not claim or guarantee email delivery
- [ ] Confirm test `destination_mode` is displayed as the test mailbox and missing, unknown, or inconsistent modes never imply an official recipient
- [ ] Confirm no Gmail credential, token, test-mailbox address, or official recipient address is present in the iOS binary or source
- [ ] Confirm the Community police tool makes no ColumbiaWalks request, does not persist or select media, requires past/not-in-progress confirmation, and opens only the verified official Police Department URLs after a not-submitted warning
- [ ] Run both backup-first 3.16 Directus migrations (trash cans and weather), verify their separate backups and narrow private-policy allowlists, then deploy intake 1.12.0; verify comment/complaint separation and confirm the public feed cannot expose raw comments, submitted locations, media, submission IDs, or any complaint field
- [ ] Inspect a weather-enrichment request and confirm it contains only two-decimal incident coordinates and the incident date/hour; verify stored estimates/provenance and Open-Meteo CC BY 4.0 attribution, then force a timeout/outage and confirm the report is still accepted without weather data
- [ ] Confirm ColumbiaWalks qualifies for the configured Open-Meteo free noncommercial tier and quotas, or arrange the appropriate commercial/self-hosted service before enabling production weather lookups
- [ ] Test the trash-can offline queue, foreground retry, 3-2,000-character bounds, exact category keys, public-scope lock, optional confirmed pin, and private-complaint no-forwarding disclosure
- [ ] Complete large Dynamic Type, VoiceOver, landscape, simulator, and physical-iPhone QA for all three Community destinations
- [ ] Obtain final authorization before submitting the App Store version for Apple review
