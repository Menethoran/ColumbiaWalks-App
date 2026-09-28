#!/usr/bin/env python3
"""Executable distribution policy shared by Android, iOS and public CI."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]

def verify(channel, version=None):
    gradle = (ROOT / "source/android/app/build.gradle.kts").read_text()
    android = re.search(r'appVersionName = "([^"]+)"', gradle).group(1)
    ios = (ROOT / "source/ios/project.yml").read_text()
    ios_logical = re.search(r'CW_RELEASE_VERSION: "([^"]+)"', ios)
    ios_version = (ios_logical or re.search(r'MARKETING_VERSION: "([^"]+)"', ios)).group(1)
    if android != ios_version:
        raise ValueError("Android and iOS versions disagree.")
    value = version or android
    if not re.fullmatch(r'(0|[1-9]\d*)(?:\.(0|[1-9]\d*)){2,}', value):
        raise ValueError("A canonical numeric version with at least three dot-separated components is required.")
    if value.split(".")[-1] == "0" and channel != "internal":
        raise ValueError(f"{value} is INTERNAL TEST ONLY. Public and external distribution are blocked.")
    return value

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", choices=["internal", "public", "external"], required=True)
    parser.add_argument("--version", help="Also validate an artifact version.")
    args = parser.parse_args()
    try:
        # Always guard the source version as well as an optional artifact version.
        verify(args.channel)
        result = verify(args.channel, args.version)
        print(f"PASS {result}: {args.channel} distribution policy")
    except ValueError as error:
        parser.exit(1, str(error) + "\n")
