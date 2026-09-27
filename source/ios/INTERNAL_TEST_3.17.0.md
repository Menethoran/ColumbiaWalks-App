# ColumbiaWalks 3.17.0 (31700) — INTERNAL TEST ONLY

Community → [TEST] Anonymous Police Tip sends marked text to private ColumbiaWalks test intake only. No police forwarding, official form, contact fields, or attachments.

Build the Debug configuration with the internal bundle ID `org.columbiawalks.app.internal`. Release/archive and public distribution of every .0 version are blocked. ExportOptions uses development/debugging export only. A Mac with Xcode must compile and test this source before any iPhone distribution; Linux verification does not substitute for that build.

Older AppStore files are historical 3.16.1 release records. Do not submit them for 3.17.0. Current validation and deployment status are in the root DEVELOPMENT_3.17.md.

The private HTTPS endpoint is now deployed and verified, including an Android app submission. On your Mac, check out `internal/3.17.0-anonymous-tips`, open `ColumbiaWalks.xcodeproj`, and build/test the Debug scheme with your development signing. Use synthetic text for this internal build; all submitted text is marked automatically. iOS itself still requires Xcode compilation and device verification.
