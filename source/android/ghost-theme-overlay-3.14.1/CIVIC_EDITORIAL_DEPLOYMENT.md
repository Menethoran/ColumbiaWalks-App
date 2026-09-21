# Civic editorial deployment

This addition is intentionally version-neutral. It can be added to the current
complete 3.14.0 Ghost theme without replacing the existing Android download,
release date, footer version, or any other homepage content.

Do **not** upload the `ghost-theme-overlay-3.14.1` directory as a complete Ghost
theme. It remains an incremental overlay and still references the unpublished
3.14.1 Android artifact.

## Files added by the change

- `partials/civic-editorial.hbs`
- `assets/css/civic-editorial.css`
- `assets/js/civic-editorial.js`

The active theme's `index.hbs` receives only two version-neutral additions:

1. The civic stylesheet and deferred script are appended to the existing
   homepage `styles` block.
2. `{{> "civic-editorial"}}` is inserted immediately after the hero's
   `stat-strip` and before the first news feature.

## Safe application

Run the helper against an explicitly named complete theme directory:

```bash
./apply-civic-editorial-to-theme.sh /var/lib/ghost/content/themes/ACTIVE-THEME-NAME
```

The helper rejects broad paths, validates the two insertion anchors, refuses a
second application, and creates a timestamped sibling rollback directory before
changing the active theme. It does not restart Ghost.

After application:

1. Compare the modified `index.hbs` with the rollback copy and verify that APK,
   release, and footer-version lines are unchanged.
2. Restart the `ghost` container to clear the cached theme.
3. Fetch the public homepage with a cache-busting query string.
4. Verify section order, all official-source links, the generated email draft,
   keyboard focus, phone layout, 200% text sizing, and the absence of horizontal
   overflow or clipped text.
5. Keep the rollback directory until the public result has been accepted.

Before packaging or deployment, run `verify-civic-editorial.py` and a JavaScript
syntax check. The verifier checks insertion order, official-source links,
accessibility relationships, responsive/focus safeguards, email privacy and
send boundaries, and the absence of prohibited government-association claims.
