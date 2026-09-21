# ColumbiaWalks 3.14.0

## Reporting and administration

- Adds a dedicated Repeat Reporting screen for a low-friction
  photograph-submit-next workflow while walking.
- Adds sidewalk rapid reports with an optional lip-height range and vehicle
  rapid reports with optional observed-behavior choices; neither choice nor
  comments are required.
- Reads GPS coordinates from camera or selected pictures when available,
  falls back to a fresh device location, and permits a manual location
  override. Original photo coordinates and the final location source remain
  auditable while embedded photo metadata is removed.
- Keeps the selected reporting hierarchy and continuous session in place after
  submission while clearing the photo, optional answers, comments, and
  location for the next observation.
- Applies the same photo-GPS-first behavior and location provenance fields to
  the existing standard and Page of Shame report paths.
- Accepts older Android and web report payloads through a guarded compatibility
  normalizer while retaining strict validation for 3.13.0 and newer clients.
- Records and aggregates the app version attached to each safety report.
- Adds a private Columbia report-location heatmap to the administrator dashboard.
- Adds aggregate walking totals, average distance, duration, source, and activity
  counts to the administrator dashboard.

## Opt-in walking distance

- Adds a user-started foreground walk tracker that continues while the app is
  minimized and displays a persistent Android notification.
- Adds Health Connect import for walking exercise sessions on Android 14 and
  newer.
- The Play build now emits an R8 deobfuscation map and a matching native-symbol
  ZIP alongside the signed AAB for Play Console crash and ANR decoding.
- Uploads only distance, duration, time range, activity count, source, and app
  version. Raw routes and device identifiers are not uploaded.
- Requires an explicit in-app sharing agreement before tracking or importing.

## Page of Shame

- Lets reporters either take a new picture or attach one from the photo
  library; cancelling either picker returns to the form without reopening the
  camera.
- Page of Shame photos and optional descriptions remain pending until an
  administrator approves them from the private dashboard.
- Full license plates remain hidden by default, and administrators can remove
  or revise material after submission.
- Wallpaper rotation remains daily.

## Release order

1. Run the continuous-reporting Directus schema upgrade, including intake-token
   field permissions, before deploying the expanded intake payload.
2. Deploy the intake service and updated website disclosure, then verify one
   old-format report and one repeat report with a picture.
3. Confirm the Page of Shame approval control with a test submission.
4. Update Google Play Data safety and Health apps declarations for walking
   distance, exercise duration, Health Connect permissions, and the privacy
   policy.
5. Upload the signed `playRelease` AAB only after those declarations are saved.
