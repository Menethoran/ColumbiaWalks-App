# ColumbiaWalks 3.17.10 (31710) — INTERNAL TEST ONLY

Open `ColumbiaWalks.xcodeproj` on the Mac, or regenerate with XcodeGen using `project.yml`. Build Debug for a local/internal device with bundle ID `org.columbiawalks.app.internal`. Versions whose third semantic component ends in 0 (.0, .10, .20, .100) are internal test builds only.

The Community police-tip screen and the Saved report detail action prepare [TEST]-marked text, then open the official CBPD CRIMEWATCH form in WKWebView. The new-report handoff also carries its details across. The shared bundled script fills subject/message, selects Anonymous and Other, clears contact fields, and reapplies test markers before user submission. The user personally reviews, accepts the agreement, completes any CAPTCHA, and submits. No automated submission, attachment, or receipt confirmation exists.

The 128-character subject limit includes test markers. Original attachments must be selected on the official form. The Browser fallback requires copying the two marked fields manually. The original 3.17.0 private intake is not called by this build.

Android and shared JavaScript validation can run on Linux. iOS UI, signing, WKWebView CAPTCHA/file-picker behavior, and device tests still require Mac/Xcode verification. No iOS archive or upload is represented by this source handoff.
