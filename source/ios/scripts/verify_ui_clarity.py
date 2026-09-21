#!/usr/bin/env python3
"""Static release guard for ColumbiaWalks' pale, high-contrast iOS UI."""

from __future__ import annotations

import math
import re
import sys
from pathlib import Path


IOS = Path(__file__).resolve().parent.parent
APP = IOS / "ColumbiaWalks"


def fail(message: str) -> None:
    raise AssertionError(message)


def luminance(rgb: tuple[int, int, int]) -> float:
    channels = []
    for channel in rgb:
        normalized = channel / 255
        channels.append(
            normalized / 12.92
            if normalized <= 0.04045
            else math.pow((normalized + 0.055) / 1.055, 2.4)
        )
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(foreground: tuple[int, int, int], background: tuple[int, int, int]) -> float:
    lighter, darker = sorted(
        (luminance(foreground), luminance(background)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


def color(source: str, name: str) -> tuple[int, int, int]:
    pattern = re.compile(
        rf"static let {re.escape(name)} = Color\(red: (\d+) / 255, "
        rf"green: (\d+) / 255, blue: (\d+) / 255\)"
    )
    match = pattern.search(source)
    if not match:
        fail(f"Could not read opaque app color {name}.")
    return tuple(map(int, match.groups()))


def verify_versions_and_appearance() -> None:
    project = (IOS / "project.yml").read_text(encoding="utf-8")
    info = (APP / "Info.plist").read_text(encoding="utf-8")
    api_client = (APP / "Services" / "APIClient.swift").read_text(encoding="utf-8")
    pbx = (IOS / "ColumbiaWalks.xcodeproj" / "project.pbxproj").read_text(
        encoding="utf-8"
    )
    if 'MARKETING_VERSION: "3.16.1"' not in project:
        fail("project.yml is not versioned as 3.16.1.")
    if 'CURRENT_PROJECT_VERSION: "31601"' not in project:
        fail("project.yml is not build 31601.")
    if project.count("UIUserInterfaceStyle: Light") != 1:
        fail("XcodeGen must explicitly generate a light-only application.")
    if "<key>UIUserInterfaceStyle</key>" not in info or "<string>Light</string>" not in info:
        fail("The committed Info.plist must explicitly select Light appearance.")
    if pbx.count("MARKETING_VERSION = 3.16.1;") != 2:
        fail("The generated Xcode project has stale marketing versions.")
    if pbx.count("CURRENT_PROJECT_VERSION = 31601;") != 2:
        fail("The generated Xcode project has stale build versions.")
    if 'static let version = "3.16.1"' not in api_client:
        fail("The API payload and User-Agent version are stale.")

    required_handoff_copy = {
        "AppStore/README.md": ("3.16.1", "31601", "Community"),
        "AppStore/submission-checklist.md": ("3.16.1 (31601)", "build 31601"),
        "AppStore/physical-device-recording.md": ("3.16.1 (31601)", "Community"),
    }
    for relative_path, required_values in required_handoff_copy.items():
        source = (IOS / relative_path).read_text(encoding="utf-8")
        for value in required_values:
            if value not in source:
                fail(f"{relative_path} is missing release identity {value}.")
    print("PASS unique iOS identity 3.16.1 (31601) and explicit Light appearance")


def verify_palette() -> None:
    source = (APP / "AppState.swift").read_text(encoding="utf-8")
    surface = color(source, "cwSurface")
    checks = (
        ("cwText", 7.0, "primary text"),
        ("cwTextSecondary", 7.0, "instructional text"),
        ("cwGreen", 4.5, "green status text"),
        ("cwError", 4.5, "error text"),
        ("cwWarning", 4.5, "warning text"),
    )
    for name, minimum, purpose in checks:
        ratio = contrast(color(source, name), surface)
        if ratio < minimum:
            fail(f"{purpose} is only {ratio:.2f}:1; expected {minimum:.1f}:1.")
        print(f"PASS {purpose}: {ratio:.2f}:1")


def verify_views() -> None:
    swift_files = sorted(APP.rglob("*.swift"))
    combined = "\n".join(path.read_text(encoding="utf-8") for path in swift_files)
    forbidden = (
        ".foregroundStyle(.secondary)",
        "Color.secondary",
        ".foregroundStyle(.primary)",
        ".foregroundStyle(.red)",
        ".foregroundStyle(.orange)",
    )
    for value in forbidden:
        if value in combined:
            fail(f"Device-dependent or low-contrast style remains: {value}")

    root = (APP / "Views" / "RootView.swift").read_text(encoding="utf-8")
    if ".preferredColorScheme(.light)" not in root:
        fail("RootView does not lock the intended pale-light appearance.")
    if "func columbiaWalksScrollSurface()" not in root:
        fail("The shared pale scroll-surface modifier is missing.")

    required_modifier_counts = {
        "CommunityView.swift": 2,
        "ReportFormView.swift": 1,
        "FeedbackView.swift": 1,
        "PoliceTipView.swift": 1,
        "RepeatReportView.swift": 2,
        "SavedReportsView.swift": 2,
        "TrashCanView.swift": 1,
    }
    for filename, expected in required_modifier_counts.items():
        source = (APP / "Views" / filename).read_text(encoding="utf-8")
        count = source.count(".columbiaWalksScrollSurface()")
        if count != expected:
            fail(f"{filename} has {count} clear surfaces; expected {expected}.")

    repeat = (APP / "Views" / "RepeatReportView.swift").read_text(encoding="utf-8")
    if 'TextField(\n                        "Optional comments"' not in repeat:
        fail("Repeat comments do not have a short, separate field prompt.")
    if 'TextField("Optional description"' not in repeat:
        fail("Page of Shame description does not have a short field prompt.")
    if repeat.count('Text("Add only useful details the picture does not show.")') != 2:
        fail("Comment guidance must appear once outside each affected field.")
    print("PASS opaque instructional colors, pale scroll surfaces, and separated guidance")


def verify_community_contract() -> None:
    root = (APP / "Views" / "RootView.swift").read_text(encoding="utf-8")
    app = (APP / "ColumbiaWalksApp.swift").read_text(encoding="utf-8")
    api = (APP / "Services" / "APIClient.swift").read_text(encoding="utf-8")
    police_model = (APP / "Models" / "PoliceTipModels.swift").read_text(
        encoding="utf-8"
    )
    police_view = (APP / "Views" / "PoliceTipView.swift").read_text(
        encoding="utf-8"
    )
    report_view = (APP / "Views" / "ReportFormView.swift").read_text(
        encoding="utf-8"
    )
    community_view = (APP / "Views" / "CommunityView.swift").read_text(
        encoding="utf-8"
    )
    trash_model = (APP / "Models" / "TrashCanModels.swift").read_text(
        encoding="utf-8"
    )
    trash_view = (APP / "Views" / "TrashCanView.swift").read_text(
        encoding="utf-8"
    )
    tests = (IOS / "ColumbiaWalksTests" / "ValidatorTests.swift").read_text(
        encoding="utf-8"
    )

    required = {
        "Community tab": 'Label("Community", systemImage: "person.3")',
        "Community root": "CommunityView()",
        "police past confirmation model": "isPastAndNotInProgress = false",
        "police past confirmation copy": "Past / not currently in progress",
        "police delivery boundary": "did not send this draft or any media to CBPD",
        "labeled clipboard text": '"Subject:\\n\\(subject)\\n\\nMessage:\\n\\(narrative)"',
        "clipboard handoff": "UIPasteboard.general.string = prepared.clipboardText",
        "official police tip URL": "columbia-boro-pd/10552/submit-tip",
        "formal police report URL": "columbia-boro-pd/10552/report",
        "officer complaint URL": "citizen-complaint-form",
        "911 call path": 'number: "911"',
        "county dispatch": 'number: "7176641180"',
        "toll-free dispatch": 'number: "18009572677"',
        "station phone": 'number: "7176847735"',
        "trash intake endpoint": "trash-can-submissions",
        "trash service environment": ".environmentObject(trashCans)",
        "trash launch retry": "await trashCans.submitPending()",
        "trash minimum": "normalizedComment.utf16.count >= 3",
        "trash maximum": "normalizedComment.utf16.count <= 2_000",
        "trash address maximum": "normalizedAddress.utf16.count <= 500",
        "public scope enforcement": "kind == .publicComment, assetScope != .publicProperty",
        "trash app version": 'appVersion: "ios-\\(APIClient.version)"',
        "trash contract test": "testCategoryKeysExactlyMatchThe316Contract",
        "trash encoding test": "testJSONEncodingUsesExactTrashCanContractKeysAndValues",
        "police builder test": "testBuilderProducesDeterministicLabeledClipboardText",
        "two CW submit choices": "Submit to CW & Notify CBPD",
        "optional test email": "Opt in to the [TEST] email",
        "Contact Us phone": "(717) 466-9069",
    }
    combined = "\n".join(
        (
            root,
            app,
            api,
            police_model,
            police_view,
            report_view,
            community_view,
            trash_model,
            trash_view,
            tests,
        )
    )
    for purpose, value in required.items():
        if value not in combined:
            fail(f"Missing {purpose}: {value}")

    if "APIClient.shared" in police_view:
        fail("The local-only police-tip view must not call a ColumbiaWalks API.")
    reset_form = re.search(
        r"private func resetForm\(\) \{(?P<body>.*?)\n    \}",
        trash_view,
        re.DOTALL,
    )
    if not reset_form or "kind = .publicComment" in reset_form.group("body"):
        fail(
            "A queued private complaint must remain in private mode so its "
            "confirmation is not cleared by the kind-change handler."
        )
    print("PASS Community police handoff and trash-can submission contracts")


def verify_independent_project_copy() -> None:
    app_store = IOS / "AppStore"
    paths = (
        app_store / "metadata" / "en-US" / "description.txt",
        app_store / "metadata" / "en-US" / "beta-description.txt",
        app_store / "app-privacy.md",
        app_store / "review-information.md",
        app_store / "review-response-2.1.md",
    )
    combined = re.sub(
        r"\s+",
        " ",
        "\n".join(path.read_text(encoding="utf-8") for path in paths),
    ).casefold()
    forbidden = (
        "works with the government",
        "works with government",
        "working with the government",
        "working with government",
        "government partner",
        "bridging residents and borough services",
    )
    for phrase in forbidden:
        if phrase in combined:
            fail(f"Affiliation-implying App Store copy remains: {phrase}")
    required = (
        "does not represent or act on behalf of a government entity",
        "columbiawalks-controlled test mailbox",
        "[test]",
        "not to police, the mayor, or codes",
        "within 5 km of columbia borough center",
        "authorization does not confirm delivery",
    )
    for phrase in required:
        if phrase not in combined:
            fail(f"App Store copy is missing the controlled field-test disclosure: {phrase}")
    print("PASS independent-project and test-mailbox-only App Store copy")


def verify_app_store_handoff() -> None:
    app_store = IOS / "AppStore"
    paste_ready = app_store / "review-notes-paste-ready.txt"
    if not paste_ready.is_file():
        fail("The paste-ready App Review Notes file is missing.")
    note_bytes = paste_ready.read_bytes()
    if not note_bytes or len(note_bytes) > 4_000:
        fail(
            "Paste-ready App Review Notes must be nonempty and no larger than "
            "4,000 UTF-8 bytes."
        )

    checklist = (app_store / "submission-checklist.md").read_text(encoding="utf-8")
    required = (
        "review-notes-paste-ready.txt",
        "no 3.16 screenshot set is included",
        "Deploy the 3.16 privacy-policy source",
    )
    for value in required:
        if value not in checklist:
            fail(f"App Store checklist is missing release gate: {value}")
    print(
        "PASS paste-ready App Review Notes fit the 4,000-byte field and "
        "unproduced release assets remain explicit"
    )


def verify_official_email_contract() -> None:
    model = (APP / "Models" / "ReportModels.swift").read_text(encoding="utf-8")
    api = (APP / "Services" / "APIClient.swift").read_text(encoding="utf-8")
    report_store = (APP / "Services" / "ReportStore.swift").read_text(encoding="utf-8")
    report_form = (APP / "Views" / "ReportFormView.swift").read_text(encoding="utf-8")
    repeat_form = (APP / "Views" / "RepeatReportView.swift").read_text(encoding="utf-8")
    saved_reports = (APP / "Views" / "SavedReportsView.swift").read_text(encoding="utf-8")
    tests = (IOS / "ColumbiaWalksTests" / "ValidatorTests.swift").read_text(
        encoding="utf-8"
    )
    app_source = "\n".join(
        path.read_text(encoding="utf-8") for path in sorted(APP.rglob("*.swift"))
    )

    required = {
        "Quick missing-sidewalk identifier": 'case missingSidewalk = "missing_sidewalk"',
        "central eligibility policy": "enum OfficialEmailPolicy",
        "Columbia service-area latitude": "latitude: 40.0337",
        "Columbia service-area longitude": "longitude: -76.5044",
        "authorization model field": "var officialEmailAuthorized: Bool? = nil",
        "test-destination consent model field": "var officialEmailDestinationAuthorized: String? = nil",
        "authorization payload key": 'case officialEmailAuthorized = "official_email_authorized"',
        "test-destination payload key": 'case officialEmailDestinationAuthorized = "official_email_destination_authorized"',
        "payload policy gate": "report.hasAuthorizedOfficialEmail",
        "test-destination policy gate": 'officialEmailDestinationAuthorized == "test"',
        "duplicate-preserving selection policy": "let quickTypes = Array(quickReportTypes)",
        "exact standard Quick shape": "guard quickTypes.count == 1 else { return [] }",
        "Repeat vehicle zero-Quick shape": "quickTypes.isEmpty",
        "mixed-selection UI notice": "Multiple selections are saved as an ordinary CW report; the optional test-email control is unavailable.",
        "collapsed optional disclosure": 'Section("Optional test email")',
        "explicit test-email opt-in": 'Toggle("Opt in to the [TEST] email"',
        "test mailbox disclosure": "ColumbiaWalks-controlled test mailbox",
        "test subject disclosure": "[TEST]",
        "no officials disclosure": "not Police, the Mayor, or Codes.",
        "5 km policy radius": "static let serviceAreaRadiusMeters: CLLocationDistance = 5_000",
        "service-area policy gate": "OfficialEmailPolicy.isWithinServiceArea",
        "Repeat plate field": 'TextField("License plate (optional)"',
        "Repeat missing-sidewalk quick type": "quickReportTypes: quickTypes",
        "payload regression test": "testRapidMissingSidewalkUsesQuickTypesAndAuthorizesTestEmail",
        "negative policy test": "testOfficialEmailAuthorizationIsForcedFalseForNonqualifyingIssue",
        "service-area boundary test": "testOfficialEmailServiceAreaIncludesCenterAndExactBoundary",
        "service-area outside test": "testOfficialEmailServiceAreaRejectsOutsideAndInvalidCoordinates",
        "out-of-area payload test": "testOfficialEmailAuthorizationIsForcedFalseOutsideServiceArea",
        "server response model": "struct OfficialEmailServerState: Codable, Equatable",
        "server official-email response key": 'case officialEmailServerState = "official_email"',
        "server destination-mode response key": 'case destinationMode = "destination_mode"',
        "recipient-mode compatibility key": 'case recipientMode = "recipient_mode"',
        "test-mode display": 'case "test": "ColumbiaWalks-controlled test mailbox"',
        "server response retention": "reports[index].officialEmailServerState = submission.officialEmailServerState",
        "honest accepted-report message": "emailState.acceptanceSummary",
        "Repeat post-submit server state": "latestOfficialEmailServerState",
        "response decoding test": "testDecodesRecordedOfficialEmailDeliveryStatesAndBlockedReason",
        "missing-status response test": "testAuthorizedSubmissionRecordsMissingServerEmailStatusHonestly",
        "destination pin regression test": "testOfficialEmailRequiresTestDestinationConsentAndNeverEmitsOfficial",
        "destination mode response test": "testDecodesRecipientModeAliasAsTestMailbox",
        "field-test-safe fallback test": "testMissingOrUnexpectedDestinationModeNeverImpliesOfficialRecipient",
        "mixed Quick selection test": "testMixedStandardQuickSelectionsNeverAuthorizeFieldTestEmail",
        "duplicate Quick selection test": "testDuplicateQuickSelectionNeverAuthorizesFieldTestEmail",
        "Repeat vehicle stray-key test": "testRepeatVehicleCrosswalkRejectsEveryStrayQuickKey",
    }
    combined = "\n".join((
        model,
        api,
        report_store,
        report_form,
        repeat_form,
        saved_reports,
        tests,
    ))
    for purpose, value in required.items():
        if value not in combined:
            fail(f"Missing {purpose}: {value}")

    if "sidewalk_issue_type" in api or '"sidewalk_issue_type"' not in tests:
        fail("Repeat missing sidewalk must use quick_report_types, not a new API field.")

    forbidden_client_email = ("MessageUI", "MFMailComposeViewController", "columbiawalks@gmail.com")
    for value in forbidden_client_email:
        if value in app_source:
            fail(f"Client-owned email or credential marker remains in app source: {value}")

    if 'container.encode("official", forKey: .officialEmailDestinationAuthorized)' in api:
        fail("The 3.16 iOS client must never authorize the official destination mode.")
    if "Set(quickReportTypes)" in model:
        fail("Official-email selection validation must not collapse duplicate Quick keys.")
    if 'container.encodeNil(forKey: .officialEmailDestinationAuthorized)' not in api:
        fail("Ineligible reports must explicitly encode a null destination authorization.")
    print("PASS server-owned, exact-rule, test-mailbox-only email contract with no client mail credentials")


def main() -> int:
    try:
        verify_versions_and_appearance()
        verify_palette()
        verify_views()
        verify_community_contract()
        verify_independent_project_copy()
        verify_app_store_handoff()
        verify_official_email_contract()
    except AssertionError as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print("iOS UI clarity verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
