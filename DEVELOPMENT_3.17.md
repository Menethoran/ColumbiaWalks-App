# ColumbiaWalks 3.17.0 (31700) — internal test only

## Behavior and boundaries

Community → **[TEST] Anonymous Police Tip** opens a contact-free test form. A saved safety report can prefill the separate form, but opening it never submits a tip. Required fields are subject, observation time, location, and what was observed. Direction, plate/state, vehicle description, and evidence notes are optional. No names/contact fields, account identifiers, device identifiers, or media uploads are included.

The user confirms an inactive/past matter and private test intake before reviewing the marked preview. Every word in every submitted human-readable field is separated by `[TEST]`, including empty-field placeholders. The server repeats normalization and validation, preventing a modified client from removing the marks or selecting a different destination. This does not promise untraceable networking: the hosting proxy may retain operational network logs, and a person could include identifying content in free text.

Submissions use a random UUID per request, persist the marked request privately before sending, and reuse that UUID and content for retries. A lost response can be retried after reopening the screen without duplicating the stored tip. A changed payload with a reused ID is rejected. Success is shown only after the client verifies a receipt for the same request and private test destination. Removing the local pending copy does not delete a server record.

## Backend contract and deployment

`POST /columbiawalks-api/anonymous-tip-tests` accepts JSON only, at most 128 KiB. This route is permanently test-only and defaults to disabled (`ANONYMOUS_TIP_TESTS_ENABLED=false`). There is no public read route, official-form handoff, police forwarding, or email-outbox integration. Invalid bodies, contact/attachment fields, destination overrides, and non-.0 versions are rejected.

`server/directus-3.17-anonymous-tip-tests-upgrade.cjs` creates private `anonymous_tip_tests` with a unique `submission_id`, content hash, test-only flags, timestamps, and marked content. It verifies a database backup before schema changes and permits only create/read for the existing private intake policy. No Public policy is created. The hosted migration and live endpoint were verified on 2026-09-27 as recorded below.

Deployment sequence:

1. Confirm the target Directus instance, database, private intake policy, running image, and rollback path.
2. Back up and verify the database; run the narrowly scoped migration with a privately configured admin session. Review the resulting collection and policy; restart Directus if its policy cache requires it.
3. Deploy the matching intake image with `ANONYMOUS_TIP_TESTS_ENABLED=true` only after the private collection is ready. Keep the previous image/config available for rollback.
4. Verify validation, one explicitly synthetic marked tip, exact retry deduplication, denied public reads, and existing intake health. Do not send a police tip or email as a probe.

## Local verification on 2026-09-27

- Node intake suite: **200 tests passed**.
- Android unit suite: **59 tests passed**; debug lint and APK build passed. The Internal testing variant also passed its unit tests, lint, R8 build, and AAB packaging with a local QA key; this is not an upload-signed bundle. Its package/version, non-debuggable manifest, and absence of the sideload permission were checked.
- Android API 36 emulator: **2 instrumented workflows passed**: preview/submit/receipt/rotation and lost-receipt recovery after reopening the activity with the same request UUID.
- Those two emulator workflows use a loopback-only SQLite fixture implementing the Directus response contract. Hosted Directus verification is recorded separately below.
- UI, Community contract, privacy/release checks passed for Android; iOS static UI/contract checks passed. Screenshots were visually checked locally.
- The intake Docker image built successfully. iOS has not been compiled or run in Xcode on this Linux host.

Local artifacts are excluded from Git. `artifacts/ColumbiaWalks-3.17.0-internal-test.apk` targets the hosted HTTPS endpoint; the separate `*-local-qa.apk` is emulator-only and targets loopback.

To reproduce emulator integration testing, run `node source/android/server/intake/tools/anonymous-tip-qa.mjs` on the host, build with `build-internal-android.sh --qa`, install its app and androidTest APKs on an emulator, and run `org.columbiawalks.app.AnonymousTipIntakeTest`. The fixture contains synthetic data only and is never included in the deployed intake image.

## Distribution and current handoff

Every semantic version ending in `.0` is internal only, starting with 3.17.0. The rule concerns the patch version, not the last digit of the platform build number. Public staging commands, public Gradle variants, and the App Store screenshot-publishing workflow enforce the rule. Run `python3 source/android/release-readiness/verify-distribution.py --channel internal` for the allowed channel; `--channel public` and `--channel external` must fail for 3.17.0.

The signed Android `internalTesting` variant requires `-PcwDistributionChannel=internal`, the established upload key, and non-debuggable packaging. `build-play-internal.sh` verifies the certificate, AAB signature/manifest, version, R8 mapping, and native-symbol files before staging privately. Its only authorized Play destination is **Internal testing**. An AAB cannot technically prevent a console operator from choosing another track; this policy must also be followed in the console.

On 2026-09-27 the signed-in Play Console was accessible and its upload certificate matched the existing pinned SHA-256 ending `7355DCC4`. A password-protected release keystore was subsequently recovered from Gabriel into an owner-only local directory outside the repository. Its private-key alias is `columbiawalks-release`, created August 19, and the local copy matches the server file byte for byte. Unlocking it and checking its certificate are still required before signing; no upload-signed 3.17.0 AAB or track rollout is claimed. The Play Internal testing draft is labeled `[TEST] 3.17.0 (31700) Internal only`; its notes describe private test intake. The private hosted tip endpoint has been deployed and verified as described below.

Internal Play artifacts stage under the project-root `artifacts/play-internal/` directory, outside the source tree. The release helper accepts credentials through an interactive prompt or privately configured environment; credentials and the keystore must never enter Git.

For iOS, see [INTERNAL_TEST_3.17.0.md](source/ios/INTERNAL_TEST_3.17.0.md). The Xcode project includes the new models/service and retains a separate internal bundle ID. The user will finish building and testing iOS on a Mac.

## Hosted private intake verification — 2026-09-27

The backend host `columbiawalks-backend` (Gabriel) ran the backup-first migration using its existing server-side administrator configuration. The intake policy was verified as private and non-administrator before collection changes. The resulting collection permits create/read only for ColumbiaWalks Intake; public access remains denied.

- Verified SQLite backup: `/directus/database/data.db.bak-pre-anonymous-tip-tests-20260927`, with `PRAGMA quick_check=ok` and mode 0600.
- Active intake image: `columbiawalks-intake:3.17.0-internal`, containing package version 1.13.0. The service is running/healthy; Directus remains running. Official-email mode remains disabled.
- Deployment uses `/docker/docker-compose.yml` plus `/docker/columbiawalks-3.17.0-internal.yml`, which sets this image and `ANONYMOUS_TIP_TESTS_ENABLED=true`. Future Compose updates must include that override until the setting is incorporated into the main deployment.
- Rollback: recreate only `columbiawalks-intake` using the original Compose file without the override to restore `columbiawalks-intake:1.12.0`; retain the private collection and its data. No schema rollback is needed to disable this new route.
- Public HTTPS probe: a synthetic tip received HTTP 201; an identical retry received HTTP 200 with `duplicate:true` and the same receipt. Directus inspection confirmed exactly one record with every human-readable field marked and the destination fixed to private test intake.
- An invalid JSON tip received HTTP 400; GET on the tip route returned 404; unauthenticated Directus collection reads returned 403. Service health and the existing public incidents feed returned 200.
- Android API 36 hosted smoke test: **1 test passed** using the distributable internal APK against the real HTTPS endpoint. The app displayed a verified private receipt and that police were not contacted. This test is opt-in via `-e hostedAnonymousTip true` and uses synthetic text only.
- The live privacy page now describes the stored internal-test tips and distinguishes the older 3.16.x external-form workflow.

No police destination or email delivery was enabled. The synthetic verification records are clearly marked test data.
