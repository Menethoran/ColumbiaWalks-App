# ColumbiaWalks website 3.17.1

Updated September 28, 2026. The active Ghost theme is `columbiawalks-ghost-theme-3-17-1-autofill` (package version 3.17.1). It was staged from a fresh copy of the previous live theme, preserving the existing site, maps, report flows, contact page, and downloads.

## Published behavior

- `/police-tip/` offers local-only `[TEST]` draft preparation, separate subject/message copy controls, and the official CBPD CRIMEWATCH link. No tip endpoint or persistent draft storage is introduced. Users choose Anonymous and Other, paste, attach files, agree, complete CAPTCHA, and press Submit personally in their browser.
- App 3.17.1 opens the official form inside WebView/WKWebView, fills the marked report details, selects Anonymous and Other, and dismisses only the optional CBPD subscription notice. A normal website tab cannot access or dismiss a separate CRIMEWATCH tab; the page explains this distinction.
- `/contact/` retains founders Callie Jo Thompson and Robert Burton Thompson V, columbiawalks@gmail.com, (717) 992-3102, and Apple/Google links. The exact Facebook URL remains pending; do not invent one.

Source HTML is `pages/police-tip.html`. Ghost stores it as a Lexical HTML card. The corresponding template includes `assets/js/police-tip-draft.js`; styles are in `assets/css/community-contact.css`. Browser checks confirmed preparation/copying, no horizontal overflow at 320px, and empty fields after reload. No real report or police tip was submitted.

## Theme and APK boundary

`ghost-theme/` is an overlay, not a complete theme. Apply it over a fresh full copy of the live theme. The deployed archive excluded APK files; the unchanged downloads directory was copied from the previous theme before activation. The public APK remains 3.14.0, SHA-256 `9774eae6b879a2d0fd807c0530b99c83d1d58515af3e3bcb55d0792f8a9fbd1c`.

Only versions with a final component exactly `0` are internal-only (`3.17.10.0` is internal; `3.17.10` is a public candidate). A version allowed publicly still needs correct signing and release validation. Do not advertise 3.17.1 QA or Play-upload-signed APKs as updates for original website installs.

## Intake/privacy deployment

`/privacy-policy/` is served by Fastify intake, not Ghost. The active image is `columbiawalks-intake:3.17.1-autofill`, layering only `privacy-page.js` onto the previously deployed `columbiawalks-intake:3.17.10-privacy` (intake 1.13.0) image.

At preflight, a 20:12 UTC restart had reverted the service to an August image through the base Compose file. This deployment restored the already-deployed 1.13.0 implementation and updated privacy copy. Only intake was recreated; no database schema or submission data was changed. Health is 200/ok and the live privacy page shows September 28, 2026 and the new autofill/browser behavior.

Run Compose using these files in order, with `up -d --no-deps --no-build columbiawalks-intake`:

1. `/docker/docker-compose.yml`
2. `/docker/columbiawalks-3.17.0-internal.yml`
3. `/docker/columbiawalks-3.17.1-autofill.yml`

Build the narrow image using `deployment/Dockerfile.privacy` with `privacy-page.js` copied into its build context. Using only the base Compose file would select the obsolete backend image again; retain the listed override files in deployment commands.

## Rollback

The previous theme `columbiawalks-ghost-theme-3-17-1` is still installed. Reactivate it and restore the previous police-tip page from Ghost's private `/tmp/cw3171-autofill-before.json`. A fresh theme snapshot and deployment logs are under ignored `artifacts/website/`. No public downloads were overwritten.

Backend before-image and old privacy source are preserved under `/docker/columbiawalks-3.17.1-autofill/`. To return to the last supported pre-autofill backend, use the base Compose file plus the 3.17.0 internal, 3.17.1 website, and 3.17.10 privacy overlays. Avoid rolling back to the obsolete August image unless that is intentional.
