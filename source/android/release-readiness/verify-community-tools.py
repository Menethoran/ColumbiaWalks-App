#!/usr/bin/env python3
"""Fail closed when the 3.16 police/trash-can boundaries drift across clients."""

from __future__ import annotations

import re
import sys
from pathlib import Path


SOURCE = Path(__file__).resolve().parent.parent
ROOT = SOURCE.parent
ANDROID = SOURCE / "app" / "src" / "main"
IOS = ROOT / "ios" / "ColumbiaWalks"
SERVER = SOURCE / "server"

TIP_URL = (
    "https://crimewatch.net/us/pa/lancaster/"
    "columbia-boro-pd/10552/submit-tip"
)
TRASH_ENDPOINT = (
    "https://directus.rndtech.org/"
    "columbiawalks-api/trash-can-submissions"
)

PUBLIC_CATEGORIES = {
    "clean_well_maintained",
    "needs_cleaning",
    "full_or_overflowing",
    "damaged",
    "hard_to_access",
    "poor_location",
    "request_new_can",
    "other",
}
COMPLAINT_CATEGORIES = {
    "full_or_overflowing",
    "damaged",
    "missing",
    "odor_or_pests",
    "illegal_dumping",
    "unsafe_or_obstructing",
    "missed_service",
    "other",
}


def fail(message: str) -> None:
    raise AssertionError(message)


def read(path: Path) -> str:
    if not path.is_file():
        fail(f"Required file is missing: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def require(source: str, phrases: tuple[str, ...], description: str) -> None:
    for phrase in phrases:
        if phrase not in source:
            fail(f"{description} is missing {phrase!r}.")


def lower_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


def missing_category_keys(source: str, allowed: set[str]) -> set[str]:
    return {
        key
        for key in allowed
        if key not in source
        and re.search(rf"\bcase\s+{re.escape(lower_camel(key))}\b", source) is None
    }


def verify_identity_and_navigation() -> None:
    android_gradle = read(SOURCE / "app" / "build.gradle.kts")
    ios_project = read(ROOT / "ios" / "project.yml")
    require(
        android_gradle,
        (
            "versionCode = 31600",
            'versionName = "3.16.0"',
            '"TRASH_CAN_ENDPOINT"',
            TRASH_ENDPOINT,
        ),
        "Android 3.16 identity",
    )
    require(
        ios_project,
        ('MARKETING_VERSION: "3.16.0"', 'CURRENT_PROJECT_VERSION: "31600"'),
        "iOS 3.16 identity",
    )

    android_activity = read(
        ANDROID / "java/org/columbiawalks/app/MainActivity.java"
    )
    ios_root = read(IOS / "Views/RootView.swift")
    require(
        android_activity,
        ("CommunityFragment", "PoliceTipFragment", "TrashCanFragment"),
        "Android Community navigation",
    )
    require(
        ios_root,
        ("CommunityView()", 'Label("Community"', ".preferredColorScheme(.light)"),
        "iOS Community navigation",
    )
    print("PASS 3.16 identities and Community navigation")


def verify_police_handoff() -> None:
    android_model = read(
        ANDROID / "java/org/columbiawalks/app/domain/PoliceTipDraft.java"
    )
    android_view = read(
        ANDROID / "java/org/columbiawalks/app/ui/PoliceTipFragment.java"
    )
    android_strings = read(ANDROID / "res/values/strings.xml")
    ios_model = read(IOS / "Models/PoliceTipModels.swift")
    ios_view = read(IOS / "Views/PoliceTipView.swift")
    combined = "\n".join(
        (android_model, android_view, android_strings, ios_model, ios_view)
    )

    require(
        combined,
        (
            TIP_URL,
            "reCAPTCHA",
            "not submitted",
            "past",
            "not currently in progress",
            "Prepared locally in ColumbiaWalks",
            "717-664-1180",
            "1-800-957-2677",
            "717-684-7735",
        ),
        "local-only police handoff",
    )
    for source_name, source in (
        ("Android PoliceTip sources", android_model + android_view),
        ("iOS PoliceTip sources", ios_model + ios_view),
    ):
        forbidden = ("directus.rndtech.org", "URLSession", "HttpURLConnection")
        found = [value for value in forbidden if value in source]
        if found:
            fail(f"{source_name} gained a ColumbiaWalks upload path: {found}")
    print("PASS local-only police draft, official handoff, and call routes")


def verify_trash_contract() -> None:
    android_model = read(
        ANDROID / "java/org/columbiawalks/app/domain/TrashCanSubmissionDraft.java"
    )
    android_client = read(
        ANDROID / "java/org/columbiawalks/app/submission/TrashCanSubmissionClient.java"
    )
    android_strings = read(ANDROID / "res/values/strings.xml")
    ios_model = read(IOS / "Models/TrashCanModels.swift")
    ios_client = read(IOS / "Services/APIClient.swift")
    ios_view = read(IOS / "Views/TrashCanView.swift")
    server_app = read(SERVER / "intake/src/app.js")
    server_validation = read(SERVER / "intake/src/trash-can-validation.js")
    server_routes = read(SERVER / "intake/src/trash-can-routes.js")
    logging_test = read(SERVER / "intake/test/logging-privacy.test.js")

    all_contracts = (android_model, ios_model, server_validation)
    for label, source in zip(("Android", "iOS", "server"), all_contracts):
        missing_public = missing_category_keys(source, PUBLIC_CATEGORIES)
        missing_complaint = missing_category_keys(source, COMPLAINT_CATEGORIES)
        if missing_public:
            fail(
                f"{label} public category contract is missing: "
                f"{sorted(missing_public)}"
            )
        if missing_complaint:
            fail(
                f"{label} complaint category contract is missing: "
                f"{sorted(missing_complaint)}"
            )
        require(
            source,
            ('"public_comment"', '"private_complaint"'),
            f"{label} trash-can kind contract",
        )

    require(
        android_client + ios_client,
        (TRASH_ENDPOINT,),
        "trash-can client endpoint",
    )
    require(
        android_model + ios_model + server_validation,
        ("2_000",),
        "2,000-character client contract",
    )
    require(
        android_strings + ios_view,
        (
            "moderation",
            "not automatically forwarded",
            "private",
        ),
        "trash-can disclosure copy",
    )
    require(
        server_routes,
        (
            '/columbiawalks-api/trash-can-submissions',
            '/columbiawalks-api/public/trash-cans',
            'private_complaint: "trash_can_complaints"',
            'public_comment: "trash_can_comments"',
            "activeTrashCanIds",
            "public_comment",
        ),
        "server trash-can privacy contract",
    )
    require(
        ios_model,
        (
            "normalizedComment.utf16.count >= 3",
            "normalizedComment.utf16.count <= 2_000",
            "normalizedAddress.utf16.count <= 500",
        ),
        "iOS/server Unicode length alignment",
    )
    require(
        server_app + logging_test,
        (
            "privacySafeLogger",
            'rawUrl.split("?", 1)[0]',
            "remoteAddress",
            "PRIVATE_COMMENT_SENTINEL",
        ),
        "privacy-safe application logging",
    )
    if "error.response = body" in server_routes:
        fail("Trash-can Directus errors still retain response bodies for logging.")
    print("PASS aligned trash-can kinds, categories, endpoint, and disclosures")


def verify_storage_and_migration() -> None:
    android_queue = read(
        ANDROID / "java/org/columbiawalks/app/submission/TrashCanQueueStore.java"
    )
    ios_queue = read(IOS / "Services/TrashCanService.swift")
    migration = read(SERVER / "directus-3.16-trash-cans-upgrade.cjs")
    privacy = read(SERVER / "intake/src/privacy-page.js")
    require(
        android_queue,
        ("getNoBackupFilesDir()", "MAX_PAYLOAD_BYTES"),
        "Android private queue",
    )
    require(
        ios_queue,
        ("isExcludedFromBackup = true", ".completeFileProtection"),
        "iOS private queue",
    )
    require(
        migration,
        (
            "VACUUM INTO",
            "assertPrivatePermissions",
            "public_permission_created: false",
            "complaints_publicly_readable: false",
            "raw_comments_publicly_readable: false",
        ),
        "backup-first private Directus migration",
    )
    require(
        privacy,
        (
            "Trash-can public comments begin in a private moderation queue",
            "Trash-can complaints remain in a separate private collection",
            "does not automatically send it to Columbia Borough",
            "network transmission is unobservable",
            "necessarily process connection metadata",
        ),
        "hosted trash-can privacy policy",
    )
    print("PASS private queues, backup-first migration, and privacy copy")


def main() -> int:
    try:
        verify_identity_and_navigation()
        verify_police_handoff()
        verify_trash_contract()
        verify_storage_and_migration()
    except AssertionError as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print("ColumbiaWalks 3.16 Community-tools verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
