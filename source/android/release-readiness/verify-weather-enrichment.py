#!/usr/bin/env python3
"""Fail closed when the 3.16 server weather contract drifts."""

from __future__ import annotations

import json
import sys
from pathlib import Path


SOURCE = Path(__file__).resolve().parent.parent
ROOT = SOURCE.parent
SERVER = SOURCE / "server"
INTAKE = SERVER / "intake"


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


def verify_service_identity() -> None:
    package = json.loads(read(INTAKE / "package.json"))
    lock = json.loads(read(INTAKE / "package-lock.json"))
    if package.get("version") != "1.12.0":
        fail("Intake package is not version 1.12.0.")
    if lock.get("version") != package["version"]:
        fail("package-lock.json does not match the intake package version.")
    if lock.get("packages", {}).get("", {}).get("version") != package["version"]:
        fail("The root package-lock entry does not match package.json.")
    server = read(INTAKE / "src/server.js")
    require(
        server,
        ("WEATHER_ENRICHMENT_ENABLED", "WEATHER_TIMEOUT_MS"),
        "weather runtime configuration",
    )
    print("PASS intake 1.12.0 identity and weather runtime configuration")


def verify_idempotent_route() -> None:
    app = read(INTAKE / "src/app.js")
    duplicate = app.find("const existing = await findExisting")
    enrichment = app.find("if (weatherEnricher)", duplicate)
    creation = app.find("created = await createReport", enrichment)
    if min(duplicate, enrichment, creation) < 0 or not duplicate < enrichment < creation:
        fail("Weather enrichment is not ordered after dedupe and before storage.")
    require(
        app,
        (
            "...await weatherEnricher(report)",
            "safeWeatherError(error)",
            "storing the report without conditions",
            "reportForStorage",
        ),
        "fail-open report route",
    )
    print("PASS duplicate-first, fail-open weather ingestion order")


def verify_provider_boundary() -> None:
    weather = read(INTAKE / "src/weather.js")
    require(
        weather,
        (
            "https://api.open-meteo.com/v1/forecast",
            "https://historical-forecast-api.open-meteo.com/v1/forecast",
            "https://archive-api.open-meteo.com/v1/archive",
            "round(latitude, 2)",
            "round(longitude, 2)",
            "coordinates rounded to 2 decimal places",
            "model_derived",
            "CC BY 4.0",
            "AbortSignal.timeout",
            "MAX_RESPONSE_BYTES",
            "MAX_CACHE_ENTRIES",
        ),
        "bounded Open-Meteo provider boundary",
    )
    for forbidden in (
        "report?.details",
        "report?.client_report_id",
        "report?.photo",
    ):
        if forbidden in weather:
            fail(f"Weather provider module unexpectedly references {forbidden}.")
    print("PASS rounded allowlisted provider request and bounded response handling")


def verify_schema_and_projection() -> None:
    migration = read(SERVER / "directus-3.16-weather-upgrade.cjs")
    fields = (
        "weather_status",
        "weather_provider",
        "weather_dataset",
        "weather_summary",
        "weather_event_time_utc",
        "weather_valid_time_utc",
        "weather_time_delta_minutes",
        "weather_retrieved_at_utc",
        "weather_attribution",
        "weather_data",
    )
    require(migration, fields, "weather migration fields")
    require(
        migration,
        (
            "VACUUM INTO",
            "PRAGMA quick_check",
            "refusing to create a broader permission automatically",
            'for (const action of ["create", "read"])',
            "verifyPermissionFields",
        ),
        "backup-first narrow weather migration",
    )
    public = read(INTAKE / "src/publication.js")
    require(
        public,
        (
            'record?.weather_status === "estimated"',
            "summary: cleanText(record?.weather_summary)",
            "attribution: cleanText(record?.weather_attribution)",
        ),
        "allowlisted public weather projection",
    )
    print("PASS backup-first schema and allowlisted public projection")


def verify_clients_and_disclosure() -> None:
    continuous = read(
        SOURCE
        / "app/src/main/java/org/columbiawalks/app/ui/ContinuousReportFragment.java"
    )
    require(
        continuous,
        ("continuous_observed_time_pattern", "Locale.US"),
        "deterministic Android Repeat event timestamp",
    )
    ios = read(ROOT / "ios/ColumbiaWalks/Services/APIClient.swift")
    require(
        ios,
        ("ISO8601DateFormatter().string(from: report.observedAt)",),
        "iOS event timestamp",
    )
    privacy = read(INTAKE / "src/privacy-page.js")
    require(
        privacy,
        (
            "Open-Meteo",
            "two decimal places",
            "model-derived estimated",
            "It does not send the phone's live location, report narrative",
            "never blocks acceptance or storage",
            "Creative Commons Attribution 4.0",
        ),
        "hosted weather privacy disclosure",
    )
    print("PASS deterministic supported timestamps and hosted privacy disclosure")


def main() -> int:
    try:
        verify_service_identity()
        verify_idempotent_route()
        verify_provider_boundary()
        verify_schema_and_projection()
        verify_clients_and_disclosure()
    except (AssertionError, json.JSONDecodeError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    print("ColumbiaWalks 3.16 weather-enrichment verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
