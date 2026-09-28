#!/bin/sh
set -eu
case "${CW_RELEASE_VERSION:-${MARKETING_VERSION:-}}" in
  *.*.0)
    if [ "${CONFIGURATION:-}" != "Debug" ] || [ "${CW_DISTRIBUTION_CHANNEL:-internal}" != "internal" ]; then
      echo "error: Versions whose final dot-separated component is exactly 0 are INTERNAL TEST ONLY. Use Debug for local/internal device testing." >&2
      exit 1
    fi
    if [ "${PRODUCT_BUNDLE_IDENTIFIER:-}" != "org.columbiawalks.app.internal" ]; then
      echo "error: Internal test builds must use the separate internal app identifier." >&2
      exit 1
    fi
    ;;
esac
