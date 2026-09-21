# Response to Guideline 2.1 — Information Needed

> Historical 3.15 response retained for audit context. Do not submit this as the
> 3.16 review response; use `review-information.md` and the 3.16 checklist.

Thank you for the opportunity to clarify the app's operation. The requested physical-device screen recording is attached. It was captured on `[DEVICE MODEL]` running `[IOS VERSION]` and begins with launching ColumbiaWalks 3.15.0 (build 31500).

1. **Devices and operating systems tested**
   - Physical device: `[DEVICE MODEL]`, `[IOS VERSION]`

2. **Functions, audience, problem, and value**
   - ColumbiaWalks lets residents, visitors, pedestrians, and community advocates in Columbia, Pennsylvania document location-based pedestrian-safety conditions.
   - Users can place a map pin, use device GPS, use picture GPS, or enter coordinates; complete a Quick or Full safety report; optionally attach a picture; save the report locally; and submit it to the ColumbiaWalks HTTPS intake service.
   - Repeat Reporting lets a walking user photograph and save consecutive reports with the same issue hierarchy and minimal stopped interaction. A picture and location are required; sidewalk subtype/lip height, vehicle behavior/plate/state, and comments are optional. Page of Shame is a separate picture-and-location flow with administrator review before any public use.
   - Version 3.15.0 adds a persistent pre-submission disclosure for a narrowly limited field-test email workflow. Standard Quick qualifies only with exactly one approved crosswalk or missing-sidewalk key; Repeat Vehicle crosswalk requires zero Quick keys, and Repeat Sidewalk missing sidewalk requires exactly one `missing_sidewalk` key. Mixed, duplicate, or hierarchy-stray keys do not authorize email. For an exactly qualifying report with a confirmed location within 5 km of Columbia Borough center, submission authorizes the ColumbiaWalks server to attempt an email after successful upload. Every authorized 3.15 message goes only to a ColumbiaWalks-controlled test mailbox with `[TEST]` in its subject—not to Police, the Mayor, or Codes. If processed, the message includes the report picture, confirmed location, and details and prominently identifies any optional plate/state for a crosswalk report. Authorization does not confirm delivery; server delivery safeguards still apply. Every other issue type is excluded.
   - Saved reports show pending/submitted status and support retry, sharing, and local deletion. The Feedback tab accepts anonymous feedback by default and makes both contact details and contact consent optional.
   - The app organizes observations into a consistent format for community awareness and pedestrian-safety advocacy. It is not an emergency service and directs urgent situations to 911.

3. **Setup and access**
   - No account, login, invitation, demo credentials, payment, subscription, sample file, or special hardware is required.
   - Launch the app and use Map > tap a location > Report > Save & submit report. Quick Report may also be submitted without selecting a category or location. Open Repeat to test consecutive photo-first reports.
   - Location, camera, and photo-library permissions can be denied. Standard Quick Report remains usable without them; manual coordinates and either cancellable picture source provide alternatives in photo-first flows.

4. **Accounts, purchases, and user-generated content**
   - There are no account flows or purchases.
   - ColumbiaWalks does not display a public user-generated-content feed. A user cannot see or contact another submitter, so in-app user reporting/blocking controls are not applicable. Reports first upload to ColumbiaWalks; only a qualifying and visibly authorized report enters the limited test-mailbox workflow described above. A Page of Shame picture may appear on the public ColumbiaWalks website only after administrator review and approval; the app discloses this before upload.

5. **External services, tools, and platforms**
   - Apple MapKit, Core Location, PhotosUI, and the iPhone camera.
   - ColumbiaWalks HTTPS intake endpoints at `https://directus.rndtech.org/columbiawalks-api/` for intersection lookup, report submission, and feedback. The server—not the iOS app—uses a ColumbiaWalks-managed Gmail account for the limited field-test email workflow. No Gmail credential, test-mailbox address, or official recipient address is embedded in the app.
   - No ads, analytics SDKs, third-party authentication, payment services, or tracking SDKs are used.

6. **Regional differences**
   - The app behaves consistently in every App Store region. Its map defaults to Columbia, Pennsylvania and the service is intended for reports about that community. There are no storefront-specific features, content, or payment differences.

7. **Regulated or protected material**
   - The app is an independently operated community pedestrian-safety documentation tool. It is not a government, police, medical, legal, financial, or emergency service and does not represent or act on behalf of a government entity. Version 3.15 does not automatically share reports with local officials; the narrowly classified, visibly disclosed field test uses only a ColumbiaWalks-controlled mailbox. It does not provide regulated professional services or protected third-party material. No additional documentation or credentials are required.

The same information has been added to App Review Notes for future submissions. Please let us know if any other detail would help your review.

For reviewer safety, version 3.15 is pinned to a ColumbiaWalks-controlled test mailbox. A successful qualifying upload within the service area authorizes only a `[TEST]`-subject message to that mailbox, never Police, the Mayor, or Codes; authorization does not confirm delivery. Reviewers may submit only generic samples that contain no private person, plate, home, or bystander data.
