# ColumbiaWalks website 3.17.1

This is an overlay for the existing Ghost site, not a replacement built from an older source export. The baseline was the active theme `columbiawalks-ghost-theme-3.14.0-civic-privacy-2026-09-11` on Gabriel (10.2.76.5), Ghost 6.56.0, verified September 27, 2026.

## Published content

- `pages/contact.html` is the source HTML for `/contact/`. Email: columbiawalks@gmail.com. Phone: (717) 992-3102. Founders: Callie Jo Thompson and Robert Burton Thompson V. Apple and Google Play links distinguish live iPhone distribution from the Android closed beta.
- `pages/police-tip.html` is the source HTML for `/police-tip/`. It links to `https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip`. Users select “I wish to remain anonymous” and submit directly on CRIMEWATCH. Do not send a tip during testing.
- `pages/about.html` preserves the live About content while updating founders and adding contact links.
- The exact Facebook page/group URL remains pending. Do not substitute Ghost's default page, a guessed account, or an unrelated Columbia group.

The two new pages use a Ghost Lexical HTML card to preserve their semantic sections and class names. Their custom templates still render `{{content}}`, so content remains editable in Ghost Admin.

## Theme and artifact boundary

Active theme: `columbiawalks-ghost-theme-3-17-1`, package version 3.17.1.

Apply `ghost-theme/` over a full copy of the verified live baseline. Unchanged scripts, forms, maps, editorial content, vendor files and the downloads directory must remain in that full theme. This directory alone is not a complete theme. The website archive is intentionally uploaded without APK binaries, then the unchanged downloads directory is copied from the backed-up theme before activation.

The website's available direct APK is still 3.14.0; SHA-256 `9774eae6b879a2d0fd807c0530b99c83d1d58515af3e3bcb55d0792f8a9fbd1c`. Do not change this to a 3.17.1 download until an APK signed with the original website certificate has passed the release staging verifier. Starting with 3.17.0, `.0` builds are internal only.

## Privacy endpoint deployment

The live `/privacy-policy/` route is served by the intake container, not Ghost's theme. The narrow `deployment/Dockerfile.privacy` image layers the current privacy HTML onto `columbiawalks-intake:3.17.0-internal`, retaining all deployed intake behavior and private internal-test settings.

Deployed image: `columbiawalks-intake:3.17.1-contact`. Compose includes, in order:

1. `/docker/docker-compose.yml`
2. `/docker/columbiawalks-3.17.0-internal.yml`
3. `/docker/columbiawalks-3.17.1-website.yml`

Only `columbiawalks-intake` was recreated with `--no-deps`. Its health endpoint returned 200/ok after deployment. No Directus schema or submission data changed.

## Rollback and verification

The previous theme remains installed and can be reactivated. Before-state page objects and the publication description, navigation and default social settings are saved privately in Ghost `/tmp/cw3171-before-pages-settings.json` and locally under the ignored `artifacts/website/rollback/` directory.

Full baseline theme archive: `artifacts/website/rollback/active-theme-before-3.17.1.tar`, SHA-256 `3027329ad3ba95959b62a3e5a0a5a8a6a81e4f4317e8f7a7ef04ecfecc1cc620`.

To revert intake, recreate only that service using the first two Compose files, which selects `columbiawalks-intake:3.17.0-internal`. Keep the database and submission volumes unchanged.

After any publication, inspect Contact Us, police-tip instructions, About, homepage app links, report navigation and privacy in a browser; check responsive widths and external link targets. Verify the APK hash rather than trusting its filename. Do not test by submitting reports, messages or police tips.
