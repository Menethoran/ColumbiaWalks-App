# ColumbiaWalks release policy

- From 3.17 onward, any plain semantic version whose third component ends in the digit 0 is INTERNAL TEST ONLY (for example 3.17.0, 3.17.10, 3.17.20, or 3.17.100). This is the version string, not a platform build code.
- Do not distribute test versions through the public website, public GitHub releases, Play production/open/closed testing, external TestFlight, or the App Store. Use local devices or internal testing only. Carry this policy and executable distribution guards forward.
- Run `python3 source/android/release-readiness/verify-distribution.py --channel internal` and relevant client checks before handing off test artifacts. Public and external guards must reject every version whose patch ends in 0.
- 3.17.10 is a police-assisted TEST build. It prepares report details locally and fills the official CBPD CRIMEWATCH form, selecting anonymous and Other. Every prepared subject/message word, including headings and optional placeholders, must be separated by [TEST]. Reapply markers to edits before the user submits the official form.
- The user personally reviews the official form, accepts its attestation, completes any CAPTCHA, and submits. Never automate submission or claim receipt from a successful autofill. Do not include contact identifiers or automatically attach media.
- The original 3.17.0 private test intake remains a separate historical build. Preserve its branch and artifacts. The 3.17.10 police flow must not call that private intake.
- Preserve baselines and distinguish local verification, distribution, official submission, and confirmed receipt.
