#!/usr/bin/env bash
set -euo pipefail

DIRECTUS_ORIGIN="${1:-https://directus.rndtech.org}"

echo "Checking $DIRECTUS_ORIGIN"
echo

printf 'Ping:   '
curl --fail --silent --show-error \
    --max-time 15 \
    "$DIRECTUS_ORIGIN/server/ping"
echo

printf 'Intake: '
curl --fail --silent --show-error \
    --max-time 15 \
    "$DIRECTUS_ORIGIN/columbiawalks-api/health"
echo

echo
echo "Directus ping and the ColumbiaWalks intake responded successfully."

