# ColumbiaWalks Ghost theme 3.14.1 overlay

Apply this incremental directory over the currently deployed complete theme
after the 3.14.0 overlay is present. It preserves the Page of Shame, police-interaction, and 3.14.0 reporting work
while aligning public app links, release copy, privacy language, and web report
metadata with ColumbiaWalks 3.14.1.

The homepage also includes the September 11, 2026 civic editorial directly
below the hero statistic strip. It links to the controlling Borough and
Pennsylvania traffic provisions, explains the crosswalk-yield rule without
dropping its signal or sudden-entry qualifications, and provides a visible,
editable message for contacting the Borough Council and Mayor. The associated
partial, stylesheet, and script must be deployed together with `index.hbs`:

- `partials/civic-editorial.hbs`
- `assets/css/civic-editorial.css`
- `assets/js/civic-editorial.js`

The Page of Shame background states the production behavior explicitly:
Page of Shame (`pos`) photographs appear only after administrator approval,
administrators may remove them afterward, and collage ordering rotates once per
day.

The homepage must link only to a permanent-key-signed, verified 3.14.1 APK and
its release details. Until Google Play production access is available, Play
calls to action continue to link to the beta request page. Do not deploy the QA
debug APK or a Play AAB as a website download.

Google Play and website APK installations use separate signing channels. The
homepage upgrade notice must keep the channel-switch warning; do not imply that
one channel can update an installation made through the other.

## Release order

1. Deploy the tested intake service from this release and verify its
   `/privacy-policy/` response. Production routes that URL to the intake
   service, so `page-privacy.hbs` is a synchronized fallback rather than the
   live policy source.
2. Apply the neutral Ghost publication description in
   `PUBLICATION_SETTINGS.md`. This setting supplies site metadata, RSS, and the
   LLM text feeds; editing a template alone does not replace it.
3. Place the permanent-key-signed APK at
   `assets/downloads/ColumbiaWalks-3.14.1.apk` without removing the prior APK.
4. Apply this overlay to a rollback copy of the complete active theme, publish
   the resulting theme files, restart Ghost to clear its theme cache, and run
   the public version, wording, link, and APK-hash checks.
