#!/usr/bin/env python3
"""Verify 3.16 release copy, limited official-email policy, and Play boundaries."""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


SOURCE = Path(__file__).resolve().parent.parent
ANDROID = "{http://schemas.android.com/apk/res/android}"


def fail(message: str) -> None:
    raise AssertionError(message)


def normalized_text(path: Path) -> str:
    return re.sub(r"\s+", " ", path.read_text(encoding="utf-8")).casefold()


def require_all(path: Path, phrases: tuple[str, ...], description: str) -> str:
    content = normalized_text(path)
    for phrase in phrases:
        if phrase.casefold() not in content:
            fail(f"{path.relative_to(SOURCE)} is missing {description}: {phrase}")
    return content


def require_one(
    path: Path,
    content: str,
    alternatives: tuple[str, ...],
    description: str,
) -> None:
    if not any(phrase.casefold() in content for phrase in alternatives):
        fail(
            f"{path.relative_to(SOURCE)} is missing {description}; expected one of: "
            + ", ".join(alternatives)
        )


def verify_no_obsolete_absolute_claims() -> None:
    paths = (
        SOURCE / "app" / "src" / "main" / "res" / "values" / "strings.xml",
        SOURCE / "play-store" / "STORE_LISTING.md",
        SOURCE / "play-store" / "POLICY_RESUBMISSION.md",
        SOURCE / "play-store" / "PRIVACY_POLICY.md",
        SOURCE / "server" / "intake" / "src" / "privacy-page.js",
        SOURCE / "ghost-theme-overlay-3.14.1" / "page-privacy.hbs",
    )
    obsolete = (
        "does not share submissions or user information with any government agency",
        "does not send or share submissions, contact information, walking summaries, or other user information with a government agency",
        "are not shared with a government agency",
        "submissions through this app go only to columbiawalks and do not file an official report",
    )
    for path in paths:
        content = normalized_text(path)
        matches = [phrase for phrase in obsolete if phrase in content]
        if matches:
            fail(
                f"{path.relative_to(SOURCE)} retains obsolete absolute "
                f"no-forwarding copy: {', '.join(matches)}"
            )
    print("PASS obsolete absolute no-government-sharing claims removed")


def verify_independence_and_app_disclosure() -> None:
    scanned = (
        SOURCE / "app" / "src" / "main" / "res" / "values" / "strings.xml",
        SOURCE / "play-store" / "STORE_LISTING.md",
        SOURCE / "play-store" / "POLICY_RESUBMISSION.md",
        SOURCE / "play-store" / "PRIVACY_POLICY.md",
        SOURCE / "ghost-theme-overlay-3.14.1" / "page-privacy.hbs",
    )
    affiliation_claims = (
        "works with the government",
        "works with government",
        "working with the government",
        "working with government",
        "partnered with the government",
        "government partner",
        "codes department know",
        "bridging residents and borough services",
    )
    for path in scanned:
        content = normalized_text(path)
        matches = [phrase for phrase in affiliation_claims if phrase in content]
        if matches:
            fail(f"{path.relative_to(SOURCE)} contains: {', '.join(matches)}")

    strings_path = (
        SOURCE / "app" / "src" / "main" / "res" / "values" / "strings.xml"
    )
    require_all(
        strings_path,
        (
            "off unless you opt in",
            "only to a ColumbiaWalks-controlled test mailbox",
            "[TEST]-subject",
            "not Police, the Mayor, Codes",
            "photo, location, report details, comments",
            "license-plate information",
            "This app does not contact emergency services",
            "Authorization does not confirm delivery",
            "Reports go first to ColumbiaWalks",
            "all other reports and feedback remain within ColumbiaWalks",
        ),
        "3.16.1 in-app optional field-test email disclosure",
    )

    policy_path = (
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "domain" / "OfficialEmailPolicy.java"
    )
    require_all(
        policy_path,
        (
            '"crosswalk_encroachment"',
            '"crosswalk_incursion"',
            '"missing_sidewalk"',
            "POLICE_AND_MAYOR",
            "CODES",
        ),
        "exact client routing policy",
    )
    mapper_path = (
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "submission" / "DirectusPayloadMapper.java"
    )
    mapper = require_all(
        mapper_path,
        (
            '"official_email_destination_authorized"',
            "OFFICIAL_EMAIL_DESTINATION_TEST",
            "isAuthorizedForTestDestination",
        ),
        "field-test destination authorization pin",
    )
    if "official_email_destination_official" in mapper:
        fail("Android payload mapper must never authorize the official destination.")
    database_path = (
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "data" / "ReportDatabaseHelper.java"
    )
    require_all(
        database_path,
        (
            '"official_email_destination_authorized"',
            '"official_email_destination_mode"',
        ),
        "durable field-test destination state",
    )
    print("PASS independent-project language and in-app authorization disclosure")


def verify_limited_routing_documents() -> None:
    exact_rule_paths = (
        SOURCE / "play-store" / "PRIVACY_POLICY.md",
        SOURCE / "play-store" / "DATA_SAFETY.md",
        SOURCE / "play-store" / "POLICY_RESUBMISSION.md",
        SOURCE / "ghost-theme-overlay-3.14.1" / "page-privacy.hbs",
    )
    for path in exact_rule_paths:
        content = require_all(
            path,
            (
                "crosswalk_encroachment",
                "crosswalk_incursion",
                "missing_sidewalk",
                "test mailbox",
                "[TEST]",
                "Police",
                "Mayor",
                "Codes",
            ),
            "exact field-test email routing matrix",
        )
        require_one(
            path,
            content,
            (
                "No other report type is automatically forwarded",
                "No other report type generates email",
                "No other report type generates an email",
            ),
            "no-other-trigger boundary",
        )

    privacy_paths = (
        SOURCE / "server" / "intake" / "src" / "privacy-page.js",
        SOURCE / "play-store" / "PRIVACY_POLICY.md",
        SOURCE / "ghost-theme-overlay-3.14.1" / "page-privacy.hbs",
    )
    for path in privacy_paths:
        content = require_all(
            path,
            (
                "Police Chief",
                "Mayor",
                "Codes",
                "photo",
                "location",
                "comments",
                "license plate",
                "does not guarantee",
                "emergency",
                "feedback",
            ),
            "official-email privacy fact",
        )
        require_one(
            path,
            content,
            ("crosswalk_encroachment", "crosswalk-encroachment"),
            "crosswalk-encroachment route",
        )
        require_one(
            path,
            content,
            ("crosswalk_incursion", "crosswalk-incursion"),
            "Repeat Reporting crosswalk-incursion route",
        )
        require_one(
            path,
            content,
            ("missing_sidewalk", "missing-sidewalk"),
            "missing-sidewalk route",
        )
        require_one(
            path,
            content,
            ("public record", "public-records"),
            "public-record warning",
        )
        require_one(
            path,
            content,
            (
                "reports go first to columbiawalks",
                "received and stored by columbiawalks first",
                "columbiawalks may generate an email from its own account",
            ),
            "ColumbiaWalks-first server mediation",
        )

    data_safety = SOURCE / "play-store" / "DATA_SAFETY.md"
    data_safety_text = require_all(
        data_safety,
        (
            "ColumbiaWalks-controlled test mailbox",
            "Shared with a government recipient through 3.16.1 field-test email: **No**",
            "The Android app contains neither Gmail credentials nor any mailbox address",
            "Contact information is not included in field-test email",
        ),
        "Play field-test data-sharing declaration",
    )
    if data_safety_text.count(
        "shared with a government recipient through 3.16.1 field-test email: **no**"
    ) < 3:
        fail(
            "play-store/DATA_SAFETY.md must mark location, photos, and "
            "user-generated content as not shared with government in the field test."
        )
    print("PASS limited routing, public-record, emergency, and Play sharing disclosures")


def verify_website_public_download_boundary() -> None:
    website = SOURCE / "ghost-theme-overlay-3.14.1"
    required_by_file = {
        website / "default.hbs": (
            "columbiawalks website v3.16.1",
            "https://github.com/menethoran/columbiawalks-app/releases/latest",
        ),
        website / "index.hbs": (
            "downloads/columbiawalks-3.14.1.apk",
            "https://github.com/menethoran/columbiawalks-app/releases/tag/v3.14.1",
            "the website apk updates website-distributed 3.13.0 or 3.14.0 installs",
            "google play and website downloads are separate signing channels and cannot update each other",
        ),
        website / "package.json": (
            '"description": "independent columbiawalks community safety theme"',
            '"version": "3.14.1"',
        ),
        website / "page-report.hbs": (
            '"version":"3.16.1"',
            "https://play.google.com/apps/testing/org.columbiawalks.app",
        ),
        website / "PUBLICATION_SETTINGS.md": (
            "independent community initiative documenting pedestrian-safety concerns in columbia, pennsylvania.",
        ),
    }
    for path, required in required_by_file.items():
        content = require_all(path, required, "published website and Android-download fact")
    index = normalized_text(website / "index.hbs")
    for required_download_fact in (
        "columbiawalks-3.14.1.apk",
        "download columbiawalks 3.14.1 apk",
        "latest android app",
    ):
        if required_download_fact not in index:
            fail(
                "Website must keep the public Android download on verified "
                f"3.14.1: {required_download_fact}"
            )

    report = normalized_text(website / "page-report.hbs")
    if "play.google.com/apps/internaltest/" in report:
        fail("Website report page still links to the obsolete Play internal-test track.")
    print("PASS public Android download remains 3.14.1 and web intake identifies as 3.16.1")


def verify_privacy_and_play_boundaries() -> None:
    strings = normalized_text(
        SOURCE / "app" / "src" / "main" / "res" / "values" / "strings.xml"
    )
    if "https://www.columbiawalks.com/privacy-policy/" not in strings:
        fail("In-app privacy link does not use the live /privacy-policy/ URL.")

    for path in (
        SOURCE / "server" / "intake" / "src" / "privacy-page.js",
        SOURCE / "play-store" / "PRIVACY_POLICY.md",
        SOURCE / "ghost-theme-overlay-3.14.1" / "page-privacy.hbs",
    ):
        require_all(
            path,
            (
                "health connect",
                "foreground service",
                "aggregate distance",
                "raw routes",
                "disables android backup",
                "google play build disables this self-update workflow",
            ),
            "existing privacy boundary",
        )

    manifest = ET.parse(SOURCE / "app" / "src" / "main" / "AndroidManifest.xml")
    application = manifest.getroot().find("application")
    if application is None or application.attrib.get(ANDROID + "allowBackup") != "false":
        fail("Android backup must remain disabled for private local app data.")
    expected_backup_attributes = {
        ANDROID + "dataExtractionRules": "@xml/data_extraction_rules",
        ANDROID + "fullBackupContent": "@xml/backup_rules",
    }
    for name, value in expected_backup_attributes.items():
        if application.attrib.get(name) != value:
            fail(f"Android manifest backup rule {name} must be {value}.")

    private_domains = {
        "root", "file", "database", "sharedpref", "external",
        "device_root", "device_file", "device_database",
        "device_sharedpref",
    }
    extraction_root = ET.parse(
        SOURCE / "app" / "src" / "main" / "res" / "xml" /
        "data_extraction_rules.xml"
    ).getroot()
    for section_name in ("cloud-backup", "device-transfer"):
        section = extraction_root.find(section_name)
        if section is None:
            fail(f"Android 12+ backup rules are missing {section_name} exclusions.")
        if section.findall("include"):
            fail(f"Android 12+ {section_name} must not include private app data.")
        excluded = {
            node.attrib.get("domain")
            for node in section.findall("exclude")
            if node.attrib.get("path") == "."
        }
        if excluded != private_domains:
            fail(f"Android 12+ {section_name} does not exclude every private domain.")

    legacy_root = ET.parse(
        SOURCE / "app" / "src" / "main" / "res" / "xml" / "backup_rules.xml"
    ).getroot()
    if legacy_root.findall("include"):
        fail("Legacy Android backup rules must not include private app data.")
    legacy_excluded = {
        node.attrib.get("domain")
        for node in legacy_root.findall("exclude")
        if node.attrib.get("path") == "."
    }
    if legacy_excluded != private_domains:
        fail("Legacy Android backup rules do not exclude every private domain.")

    play_manifest = normalized_text(
        SOURCE / "app" / "src" / "playRelease" / "AndroidManifest.xml"
    )
    if (
        "request_install_packages" not in play_manifest
        or 'tools:node="remove"' not in play_manifest
    ):
        fail("playRelease must explicitly remove REQUEST_INSTALL_PACKAGES.")
    print("PASS privacy, backup exclusions, and Play install boundary")


def verify_release_identity_and_tooling() -> None:
    gradle = normalized_text(SOURCE / "app" / "build.gradle.kts")
    if "versioncode = 31601" not in gradle or 'versionname = "3.16.1"' not in gradle:
        fail("Android app must be 3.16.1 (31601).")

    android_stage = normalized_text(
        SOURCE / "release-readiness" / "verify-and-stage-android-release.sh"
    )
    play_stage = normalized_text(
        SOURCE / "release-readiness" / "verify-and-stage-play-release.sh"
    )
    for name, content in (("APK", android_stage), ("AAB", play_stage)):
        for phrase in ('expected_version_name="3.16.1"', 'expected_version_code="31601"'):
            if phrase not in content:
                fail(f"{name} staging verifier is missing 3.16.1 identity: {phrase}")
    if "columbiawalks-3.16.1.apk" not in android_stage:
        fail("APK staging verifier does not use the 3.16.1 artifact filename.")
    for filename in (
        "columbiawalks-3.16.1-play.aab",
        "columbiawalks-3.16.1-native-debug-symbols.zip",
        "columbiawalks-3.16.1-mapping.txt",
    ):
        if filename not in play_stage:
            fail(f"Play staging verifier is missing artifact filename: {filename}")

    expected_cert = "a0c9e5abc99caec8d2ec31181c75c577d00963e0af3f654aca19bb3f7355dcc4"
    for path in (
        SOURCE / "release-readiness" / "build-production-android.sh",
        SOURCE / "release-readiness" / "verify-and-stage-android-release.sh",
        SOURCE / "release-readiness" / "verify-and-stage-play-release.sh",
    ):
        if expected_cert not in normalized_text(path):
            fail(f"{path.relative_to(SOURCE)} lost the pinned production signer.")
    print("PASS 3.16.1 staging identity and established signer pin")


def main() -> int:
    try:
        verify_no_obsolete_absolute_claims()
        verify_independence_and_app_disclosure()
        verify_limited_routing_documents()
        verify_website_public_download_boundary()
        verify_privacy_and_play_boundaries()
        verify_release_identity_and_tooling()
    except (AssertionError, ET.ParseError, OSError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print("Android 3.16.1 release-policy verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
