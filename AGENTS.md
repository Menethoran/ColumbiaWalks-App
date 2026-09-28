# ColumbiaWalks release policy

- Starting with 3.17.0, every version whose semantic-version patch component ends in the digit 0 is an internal test build only. This is based on the version (for example 3.17.0, 3.17.10 or 3.17.20), not the numeric platform build code.
- Never publish a version whose patch ends in 0 to the public website, a public GitHub release, Play production/open/closed testing, external TestFlight, or the App Store. Use internal distribution only. Do not infer publication permission from a successful build.
- Run `python3 source/android/release-readiness/verify-distribution.py --channel internal` and the relevant client/server checks before handing off artifacts. Public staging commands enforce `--channel public` and must reject versions whose patch ends in 0.
- This branch prepares public 3.17.1. Its police-tip assistant prepares a local draft and opens the official CBPD CRIMEWATCH form; users choose anonymity and complete submission themselves. Never auto-submit or claim delivery. The website follows the same explicit external handoff.
- Public website APK updates require the established original signing certificate. Never substitute the Play upload key or a debug signer.
- The separate 3.17.0 anonymous tip feature uses private ColumbiaWalks test intake only. Every submitted human-readable field must contain [TEST] between every word, including optional placeholders. The server enforces this independently of the app. There is no police forwarding or external official-form handoff in this build.
- Do not introduce names, contact fields, account or installation identifiers, media, or public reads in this test intake. A random request UUID is used solely for retry deduplication.
- Keep release/source baselines intact; use the versioned project and internal branch. Record deployed versus locally tested status separately.
