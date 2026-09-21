# Physical-iPhone recording checklist

Apple requires this recording to come from a physical iPhone running the latest available iOS. Do not substitute a simulator recording.

## Before recording

1. On the iPhone, open Settings > General > About and record the **Model Name** and **iOS Version** for the App Review response.
2. Install TestFlight from the App Store if needed, accept the invitation sent to the designated internal tester, and install ColumbiaWalks 3.16.1 (31601) from the **ColumbiaWalks Internal** group.
3. To make the permission prompts visible, use a fresh install or reset ColumbiaWalks permissions in Settings. Deleting the app removes its locally saved reports.
4. Use a generic test description and a public map point in Columbia. Avoid showing notifications, personal photos, a home location, or other private information.

## Recording sequence

1. Start iPhone screen recording on the Home Screen, then launch ColumbiaWalks. Keep recording continuously.
2. Show the Map tab. Tap a public point near Columbia to place the report pin.
3. Tap **Use my location** to display the optional location prompt, then choose **Don't Allow** if revealing the device's location is undesirable. The map-pin flow remains usable.
4. Open Report. Show the Quick/Full selector and the collapsed Location and Identification controls. Select **Crosswalk encroachment**, expand the optional test-email control, and show that it is off and cannot be enabled without its own photo and in-area location safeguards. Show both **Submit complaint to CW** and **Submit to CW & Notify CBPD**; the CW submission itself still permits no photo. Add a second Quick type and show that the optional email control disappears. Return to one nonqualifying type, enter `APP REVIEW DEMO — Please disregard.`, cancel **Choose photo**, then cancel **Camera**. This demonstrates that a standard report has no picture requirement and neither picture source traps the user.
5. Tap **Submit complaint to CW** without a photo. Show Saved and wait until the item says Submitted. Open its details, show submission status and map location, then open and dismiss the share sheet. Local deletion is optional.
6. Open Repeat. Keep Sidewalk selected, choose **Missing sidewalk**, and show the collapsed, off-by-default test-mailbox control without opting in. Clear that selector, take a generic public-sidewalk picture, optionally choose a lip height, review location source, and submit the nonqualifying report. Without leaving Repeat, show that it is ready for report #2. Change to Vehicle, choose **Crosswalk incursion**, show the same optional control and plate/state fields, then change to a nonqualifying vehicle choice before taking and submitting the second generic picture. Do not enter or record faces, plates, homes, or bystanders.
7. From Report, open Page of Shame. Demonstrate Choose picture cancellation, Camera cancellation, the administrator-review disclosure, and manual coordinate review. Do not submit this demonstration picture.
8. Open Community and then **Contact Us**. Show Robert's listed number, Call and Text links, and the private-message path without placing a call or sending a message. Return and open **Prepare an Anonymous Police Tip**. Show the local-only/no-submission disclosure, emergency call routes, past/not-in-progress toggle, evidence-format instructions, and official-site handoff warning. Do not enter real incident information, open an attachment, or file a tip.
9. Return to Community and open **Trash Cans**. Show Public Comment as the default with moderation disclosure. Switch to Private Complaint and show the no-publication/no-Borough-forwarding disclosure. Do not submit either demonstration.
10. Return to Community and open **App Feedback**. Select a reason, enter a short sample message, enable the optional contact fields to show the separate contact-consent toggle, then disable them. Do not submit the sample feedback.
11. End the recording. Confirm the video contains the uninterrupted launch and core flow, is readable, and does not expose private information.

## Files and values needed for resubmission

- The `.mov` screen recording from the physical iPhone.
- Exact physical iPhone model.
- Exact iOS version.

Upload and select the verified 3.16.1 (31601) build before attaching this recording and response.
