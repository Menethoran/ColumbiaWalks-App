#!/usr/bin/env python3
"""Fail a release when ColumbiaWalks can regress to faded or doubled UI text."""

from __future__ import annotations

import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


SOURCE = Path(__file__).resolve().parent.parent
RES = SOURCE / "app" / "src" / "main" / "res"
ANDROID = "{http://schemas.android.com/apk/res/android}"


def fail(message: str) -> None:
    raise AssertionError(message)


def read_colors() -> dict[str, str]:
    root = ET.parse(RES / "values" / "colors.xml").getroot()
    return {
        node.attrib["name"]: (node.text or "").strip()
        for node in root.findall("color")
    }


def rgb(value: str) -> tuple[int, int, int]:
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        fail(f"Expected an opaque six-digit color, found {value!r}.")
    return tuple(int(value[index:index + 2], 16) for index in (1, 3, 5))


def luminance(value: str) -> float:
    channels = []
    for channel in rgb(value):
        normalized = channel / 255
        channels.append(
            normalized / 12.92
            if normalized <= 0.04045
            else math.pow((normalized + 0.055) / 1.055, 2.4)
        )
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(foreground: str, background: str) -> float:
    lighter, darker = sorted(
        (luminance(foreground), luminance(background)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


def verify_contrast(colors: dict[str, str]) -> None:
    checks = (
        ("cw_text", "cw_surface", 7.0, "primary text"),
        ("cw_text_secondary", "cw_surface", 7.0, "instructional text"),
        ("cw_green", "cw_surface", 4.5, "green status text"),
        ("cw_blue", "white", 4.5, "blue controls"),
        ("cw_error", "cw_surface", 4.5, "error text"),
        ("cw_outline", "cw_surface", 3.0, "input boundaries"),
    )
    for foreground, background, minimum, purpose in checks:
        ratio = contrast(colors[foreground], colors[background])
        if ratio < minimum:
            fail(
                f"{purpose} contrast is {ratio:.2f}:1; expected at least "
                f"{minimum:.1f}:1 ({foreground} on {background})."
            )
        print(f"PASS {purpose}: {ratio:.2f}:1")


def verify_theme() -> None:
    root = ET.parse(RES / "values" / "themes.xml").getroot()
    theme = next(
        (style for style in root.findall("style")
         if style.attrib.get("name") == "Theme.ColumbiaWalks"),
        None,
    )
    if theme is None:
        fail("Theme.ColumbiaWalks is missing.")
    if theme.attrib.get("parent") != "@style/ColumbiaWalksBaseTheme":
        fail("Theme.ColumbiaWalks must inherit the shared clarity theme.")
    base = next(
        (style for style in root.findall("style")
         if style.attrib.get("name") == "ColumbiaWalksBaseTheme"),
        None,
    )
    if base is None or base.attrib.get("parent") != "Theme.Material3.Light.NoActionBar":
        fail("ColumbiaWalks must use the explicit Material 3 light theme.")
    items = {
        item.attrib.get("name", ""): (item.text or "").strip()
        for item in base.findall("item")
    }
    expected = {
        "android:windowBackground": "@color/cw_surface",
        "android:textColorPrimary": "@color/cw_text",
        "android:textColorSecondary": "@color/cw_text_secondary",
        "android:textColorHint": "@color/cw_text_secondary",
        "colorOnSurface": "@color/cw_text",
        "colorOnSurfaceVariant": "@color/cw_text_secondary",
        "colorOutline": "@color/cw_outline",
    }
    for name, value in expected.items():
        if items.get(name) != value:
            fail(f"Theme item {name} must be {value}, found {items.get(name)!r}.")

    deprecated_system_bar_items = {
        "android:statusBarColor",
        "android:navigationBarColor",
        "android:navigationBarDividerColor",
        "android:windowOptOutEdgeToEdgeEnforcement",
    }
    for path in sorted(RES.glob("values*/themes.xml")):
        versioned_root = ET.parse(path).getroot()
        present = {
            item.attrib.get("name", "")
            for style in versioned_root.findall("style")
            for item in style.findall("item")
        } & deprecated_system_bar_items
        if present:
            fail(
                f"{path.relative_to(SOURCE)} retains deprecated system-bar "
                f"theme items: {', '.join(sorted(present))}"
            )

    versioned_items = {
        27: {"android:windowLightNavigationBar": "true"},
        29: {
            "android:windowLightNavigationBar": "true",
            "android:forceDarkAllowed": "false",
        },
    }
    for api, expected_versioned in versioned_items.items():
        versioned_root = ET.parse(
            RES / f"values-v{api}" / "themes.xml"
        ).getroot()
        versioned_theme = next(
            style for style in versioned_root.findall("style")
            if style.attrib.get("name") == "Theme.ColumbiaWalks"
        )
        versioned = {
            item.attrib.get("name", ""): (item.text or "").strip()
            for item in versioned_theme.findall("item")
        }
        if versioned_theme.attrib.get("parent") != (
            "@style/ColumbiaWalksBaseTheme"
        ):
            fail(f"API {api} theme does not inherit the shared clarity theme.")
        for name, value in expected_versioned.items():
            if versioned.get(name) != value:
                fail(
                    f"API {api} theme item {name} must be {value}, "
                    f"found {versioned.get(name)!r}."
                )
    print("PASS fixed pale-light theme and explicit semantic text colors")


def verify_edge_to_edge() -> None:
    gradle = (SOURCE / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    if 'implementation("androidx.core:core:1.17.0")' not in gradle:
        fail("AndroidX Core 1.17.0 is required for current window-inset dispatch.")
    if "targetSdk = 36" not in gradle:
        fail("Target SDK 36 is required for platform-enforced edge-to-edge.")
    if 'implementation("com.google.android.material:material:1.14.0")' not in gradle:
        fail("Material 1.14.0 is required to clear the obsolete sheet edge-to-edge path.")

    support = (
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "ui" / "EdgeToEdgeSupport.java"
    ).read_text(encoding="utf-8")
    required_support = (
        "Build.VERSION_CODES.VANILLA_ICE_CREAM",
        "WindowInsetsCompat.Type.systemBars()",
        "WindowInsetsCompat.Type.displayCutout()",
        "setAppearanceLightStatusBars(true)",
        "setAppearanceLightNavigationBars(true)",
    )
    for phrase in required_support:
        if phrase not in support:
            fail(f"EdgeToEdgeSupport is missing: {phrase}")

    activity_requirements = {
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "MainActivity.java": "R.id.main_root",
        SOURCE / "app" / "src" / "main" / "java" / "org" /
        "columbiawalks" / "app" / "ui" /
        "PermissionsRationaleActivity.java": "R.id.permissions_root",
    }
    for path, root_id in activity_requirements.items():
        content = path.read_text(encoding="utf-8")
        for phrase in (
            "EdgeToEdgeSupport.enable(this)",
            "EdgeToEdgeSupport.applySystemBarPadding",
            root_id,
        ):
            if phrase not in content:
                fail(f"{path.name} is missing edge-to-edge setup: {phrase}")

    main_layout = (RES / "layout" / "activity_main.xml").read_text(encoding="utf-8")
    for phrase in (
        'android:id="@+id/main_root"',
        'app:paddingBottomSystemWindowInsets="false"',
        'app:paddingLeftSystemWindowInsets="false"',
        'app:paddingRightSystemWindowInsets="false"',
    ):
        if phrase not in main_layout:
            fail(f"activity_main.xml is missing edge-to-edge protection: {phrase}")

    manifest = (
        SOURCE / "app" / "src" / "main" / "AndroidManifest.xml"
    ).read_text(encoding="utf-8")
    if 'android:windowSoftInputMode="adjustResize"' not in manifest:
        fail("MainActivity must use adjustResize so IME insets remain usable.")

    forbidden_calls = (
        ".setStatusBarColor(",
        ".setNavigationBarColor(",
        ".setNavigationBarDividerColor(",
        "WindowCompat.enableEdgeToEdge(",
        "WindowCompat.setDecorFitsSystemWindows(",
    )
    for path in sorted((SOURCE / "app" / "src" / "main").rglob("*.java")):
        content = path.read_text(encoding="utf-8")
        matches = [call for call in forbidden_calls if call in content]
        if matches:
            fail(f"{path.relative_to(SOURCE)} uses deprecated window calls: {matches}")
    print(
        "PASS API 35-36 enforced edge-to-edge insets, API 26-34 decor fitting, "
        "and supported system-bar APIs"
    )


def verify_inputs() -> None:
    duplicate_hints: list[str] = []
    unstyled_inputs: list[str] = []
    fixed_multiline: list[str] = []
    for path in sorted((RES / "layout").glob("*.xml")):
        root = ET.parse(path).getroot()
        for layout in root.iter("com.google.android.material.textfield.TextInputLayout"):
            if layout.attrib.get("style") != "@style/Widget.ColumbiaWalks.TextInputLayout":
                unstyled_inputs.append(path.name)
            parent_hint = layout.attrib.get(ANDROID + "hint")
            for child in layout.iter(
                "com.google.android.material.textfield.TextInputEditText"
            ):
                child_hint = child.attrib.get(ANDROID + "hint")
                if parent_hint and child_hint:
                    duplicate_hints.append(
                        f"{path.name}: {parent_hint} plus {child_hint}"
                    )
                input_type = child.attrib.get(ANDROID + "inputType", "")
                height = child.attrib.get(ANDROID + "layout_height", "")
                if "textMultiLine" in input_type and height.endswith("dp"):
                    fixed_multiline.append(f"{path.name}: {height}")
    if duplicate_hints:
        fail("Competing parent/child hints remain: " + "; ".join(duplicate_hints))
    if unstyled_inputs:
        fail("Text inputs without the clarity style: " + ", ".join(unstyled_inputs))
    if fixed_multiline:
        fail("Fixed-height multiline fields remain: " + ", ".join(fixed_multiline))
    print("PASS one label per text box, shared clear-input style, and flexible height")


def verify_roots_and_spinners() -> None:
    pale_roots = (
        "activity_main.xml",
        "activity_permissions_rationale.xml",
        "fragment_community.xml",
        "fragment_continuous_report.xml",
        "fragment_feedback.xml",
        "fragment_police_tip.xml",
        "fragment_pos.xml",
        "fragment_report.xml",
        "fragment_saved_reports.xml",
        "fragment_trash_cans.xml",
        "fragment_walk.xml",
    )
    for filename in pale_roots:
        root = ET.parse(RES / "layout" / filename).getroot()
        if root.attrib.get(ANDROID + "background") != "@color/cw_surface":
            fail(f"{filename} does not paint the pale ColumbiaWalks surface.")

    for path in sorted((RES / "layout").glob("*.xml")):
        root = ET.parse(path).getroot()
        for spinner in root.iter("Spinner"):
            height = spinner.attrib.get(ANDROID + "layout_height")
            minimum = spinner.attrib.get(ANDROID + "minHeight")
            if height != "wrap_content" or minimum != "52dp":
                fail(f"{path.name} contains a spinner that can clip large text.")

    for filename in ("spinner_item.xml", "spinner_dropdown_item.xml"):
        item = ET.parse(RES / "layout" / filename).getroot()
        if item.attrib.get(ANDROID + "textColor") != "@color/cw_text":
            fail(f"{filename} does not force dark, opaque spinner text.")
        if item.attrib.get(ANDROID + "background") != "@color/white":
            fail(f"{filename} does not force a clear white background.")
    print("PASS pale screen roots and large-text-safe high-contrast spinners")


def verify_optional_email_and_collapsed_sections() -> None:
    root = ET.parse(RES / "layout" / "fragment_report.xml").getroot()
    heading_id = "@+id/report_photo_heading"
    headings = [
        node
        for node in root.iter()
        if node.attrib.get(ANDROID + "id") == heading_id
    ]
    if len(headings) != 1:
        fail("fragment_report.xml must contain one report_photo_heading.")
    heading = headings[0]
    if (
        heading.tag != "TextView"
        or heading.attrib.get(ANDROID + "text") != "@string/photo_optional"
    ):
        fail("report_photo_heading must label the actual optional photo section.")

    full_sections = next(
        (
            node
            for node in root.iter()
            if node.attrib.get(ANDROID + "id") == "@+id/full_report_sections"
        ),
        None,
    )
    if full_sections is None:
        fail("fragment_report.xml is missing full_report_sections.")
    if heading in set(full_sections.iter()):
        fail("report_photo_heading must remain visible in the Quick Report path.")
    ids = {
        node.attrib.get(ANDROID + "id"): node
        for node in root.iter()
        if node.attrib.get(ANDROID + "id")
    }
    required_ids = (
        "@+id/official_email_opt_in",
        "@+id/official_email_details",
        "@+id/report_location_details",
        "@+id/identification_details",
        "@+id/save_report_button",
        "@+id/save_report_notify_button",
        "@+id/notify_authorities_button",
    )
    missing = [view_id for view_id in required_ids if view_id not in ids]
    if missing:
        fail("Quick Report is missing simplified controls: " + ", ".join(missing))
    for collapsed_id in (
        "@+id/official_email_details",
        "@+id/report_location_details",
        "@+id/identification_details",
    ):
        if ids[collapsed_id].attrib.get(ANDROID + "visibility") != "gone":
            fail(f"{collapsed_id} must start collapsed.")
    report_fragment = (
        SOURCE
        / "app/src/main/java/org/columbiawalks/app/ui/ReportFragment.java"
    ).read_text(encoding="utf-8")
    if "photoHeading.setText(R.string.photo_optional)" not in report_fragment:
        fail("Quick Report must keep the standard CW photo heading optional.")
    print("PASS optional test email, optional CW photo, two submit choices, and collapsed optional sections")


def verify_version() -> None:
    gradle = (SOURCE / "app" / "build.gradle.kts").read_text(encoding="utf-8")
    if "versionCode = 31601" not in gradle or 'versionName = "3.16.1"' not in gradle:
        fail("The simplified reporting build must be uniquely identified as 3.16.1 (31601).")
    print("PASS unique Android release identity 3.16.1 (31601)")


def verify_release_policy_copy() -> None:
    strings_path = RES / "values" / "strings.xml"
    strings = strings_path.read_text(encoding="utf-8")
    normalized = re.sub(r"\s+", " ", strings).casefold()
    forbidden = (
        "works with the government",
        "works with government",
        "working with the government",
        "working with government",
        "codes department know",
        "bridging residents and borough services",
    )
    present = [phrase for phrase in forbidden if phrase in normalized]
    if present:
        fail("Affiliation-implying release copy remains: " + ", ".join(present))
    if "https://www.columbiawalks.com/privacy-policy/" not in strings:
        fail("The in-app privacy link must use the live /privacy-policy/ URL.")

    manifest = ET.parse(SOURCE / "app" / "src" / "main" / "AndroidManifest.xml")
    application = manifest.getroot().find("application")
    if application is None or application.attrib.get(ANDROID + "allowBackup") != "false":
        fail("Private local app data must remain excluded from Android backup.")
    print("PASS neutral reporting copy, live privacy link, and private-data backup policy")


def main() -> int:
    try:
        verify_version()
        verify_contrast(read_colors())
        verify_theme()
        verify_edge_to_edge()
        verify_inputs()
        verify_roots_and_spinners()
        verify_optional_email_and_collapsed_sections()
        verify_release_policy_copy()
    except (AssertionError, KeyError, ET.ParseError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print("Android UI clarity verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
