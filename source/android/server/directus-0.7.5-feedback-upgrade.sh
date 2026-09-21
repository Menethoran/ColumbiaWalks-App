#!/usr/bin/env sh
set -eu

DIRECTUS_URL="${DIRECTUS_URL:-https://directus.rndtech.org}"
: "${DIRECTUS_ADMIN_TOKEN:?Set DIRECTUS_ADMIN_TOKEN to a Directus administrator static token.}"

authorization="Authorization: Bearer ${DIRECTUS_ADMIN_TOKEN}"
content_type="Content-Type: application/json"
collection="feedback_submissions"

collection_status() {
    curl --silent --show-error \
        --output /dev/null \
        --write-out '%{http_code}' \
        --header "$authorization" \
        "${DIRECTUS_URL%/}/collections/${collection}"
}

field_status() {
    curl --silent --show-error \
        --output /dev/null \
        --write-out '%{http_code}' \
        --header "$authorization" \
        "${DIRECTUS_URL%/}/fields/${collection}/$1"
}

upsert_field() {
    field="$1"
    create_payload="$2"
    update_payload="$3"
    status="$(field_status "$field")"

    if [ "$status" = "200" ]; then
        curl --fail --silent --show-error \
            --request PATCH \
            --header "$authorization" \
            --header "$content_type" \
            --data "$update_payload" \
            "${DIRECTUS_URL%/}/fields/${collection}/${field}" \
            >/dev/null
        printf 'Updated %s\n' "$field"
        return
    fi

    if [ "$status" = "404" ]; then
        curl --fail --silent --show-error \
            --request POST \
            --header "$authorization" \
            --header "$content_type" \
            --data "$create_payload" \
            "${DIRECTUS_URL%/}/fields/${collection}" \
            >/dev/null
        printf 'Created %s\n' "$field"
        return
    fi

    printf 'Could not inspect %s (HTTP %s).\n' "$field" "$status" >&2
    exit 1
}

status="$(collection_status)"
if [ "$status" = "404" ]; then
    curl --fail --silent --show-error \
        --request POST \
        --header "$authorization" \
        --header "$content_type" \
        --data '{"collection":"feedback_submissions","meta":{"icon":"feedback","note":"Anonymous-by-default ColumbiaWalks feedback and optional follow-up contact information.","display_template":"{{feedback_category}} — {{date_created}}"},"schema":{},"fields":[{"field":"id","type":"integer","meta":{"hidden":true,"interface":"input","readonly":true},"schema":{"is_primary_key":true,"has_auto_increment":true}}]}' \
        "${DIRECTUS_URL%/}/collections" \
        >/dev/null
    printf 'Created %s collection\n' "$collection"
elif [ "$status" != "200" ]; then
    printf 'Could not inspect %s collection (HTTP %s).\n' \
        "$collection" "$status" >&2
    exit 1
fi

upsert_field \
    "feedback_id" \
    '{"field":"feedback_id","type":"uuid","schema":{"is_nullable":false,"is_unique":true},"meta":{"interface":"input","required":true,"readonly":true,"note":"Client-generated idempotency key."}}' \
    '{"schema":{"is_nullable":false,"is_unique":true},"meta":{"interface":"input","required":true,"readonly":true,"note":"Client-generated idempotency key."}}'

upsert_field \
    "date_created" \
    '{"field":"date_created","type":"timestamp","schema":{"is_nullable":true},"meta":{"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true}}' \
    '{"schema":{"is_nullable":true},"meta":{"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true}}'

upsert_field \
    "date_updated" \
    '{"field":"date_updated","type":"timestamp","schema":{"is_nullable":true},"meta":{"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true}}' \
    '{"schema":{"is_nullable":true},"meta":{"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true}}'

upsert_field \
    "feedback_category" \
    '{"field":"feedback_category","type":"string","schema":{"is_nullable":false,"max_length":64},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"App Feedback","value":"app_feedback"},{"text":"Feature Request","value":"feature_request"},{"text":"Bug Report","value":"bug_report"},{"text":"Other","value":"other"}]},"required":true}}' \
    '{"schema":{"is_nullable":false,"max_length":64},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"App Feedback","value":"app_feedback"},{"text":"Feature Request","value":"feature_request"},{"text":"Bug Report","value":"bug_report"},{"text":"Other","value":"other"}]},"required":true}}'

upsert_field \
    "feedback_text" \
    '{"field":"feedback_text","type":"text","schema":{"is_nullable":false},"meta":{"interface":"input-multiline","required":true}}' \
    '{"schema":{"is_nullable":false},"meta":{"interface":"input-multiline","required":true}}'

upsert_field \
    "app_version" \
    '{"field":"app_version","type":"string","schema":{"is_nullable":false,"max_length":32},"meta":{"interface":"input","required":true,"readonly":true}}' \
    '{"schema":{"is_nullable":false,"max_length":32},"meta":{"interface":"input","required":true,"readonly":true}}'

upsert_field \
    "submission_source" \
    '{"field":"submission_source","type":"string","schema":{"is_nullable":false,"max_length":32},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Android","value":"android"},{"text":"Web","value":"web"},{"text":"WordPress","value":"wordpress"}]},"required":true,"readonly":true}}' \
    '{"schema":{"is_nullable":false,"max_length":32},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Android","value":"android"},{"text":"Web","value":"web"},{"text":"WordPress","value":"wordpress"}]},"required":true,"readonly":true}}'

upsert_field \
    "status" \
    '{"field":"status","type":"string","schema":{"is_nullable":false,"default_value":"new","max_length":32},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"New","value":"new"},{"text":"In Review","value":"in_review"},{"text":"Planned","value":"planned"},{"text":"In Progress","value":"in_progress"},{"text":"Completed","value":"completed"},{"text":"Closed","value":"closed"}]},"required":true}}' \
    '{"schema":{"is_nullable":false,"default_value":"new","max_length":32},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"New","value":"new"},{"text":"In Review","value":"in_review"},{"text":"Planned","value":"planned"},{"text":"In Progress","value":"in_progress"},{"text":"Completed","value":"completed"},{"text":"Closed","value":"closed"}]},"required":true}}'

upsert_field \
    "tags" \
    '{"field":"tags","type":"json","schema":{"is_nullable":true},"meta":{"interface":"tags","note":"Initialized with the feedback category; reviewers may add tags."}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"tags","note":"Initialized with the feedback category; reviewers may add tags."}}'

for boolean_field in \
    contact_information_offered \
    contact_information_provided \
    consent_to_contact; do
    upsert_field \
        "$boolean_field" \
        "{\"field\":\"${boolean_field}\",\"type\":\"boolean\",\"schema\":{\"is_nullable\":false,\"default_value\":false},\"meta\":{\"interface\":\"boolean\",\"required\":true}}" \
        '{"schema":{"is_nullable":false,"default_value":false},"meta":{"interface":"boolean","required":true}}'
done

upsert_field \
    "contact_name" \
    '{"field":"contact_name","type":"string","schema":{"is_nullable":true,"max_length":200},"meta":{"interface":"input"}}' \
    '{"schema":{"is_nullable":true,"max_length":200},"meta":{"interface":"input"}}'

upsert_field \
    "contact_phone" \
    '{"field":"contact_phone","type":"string","schema":{"is_nullable":true,"max_length":64},"meta":{"interface":"input"}}' \
    '{"schema":{"is_nullable":true,"max_length":64},"meta":{"interface":"input"}}'

upsert_field \
    "contact_email" \
    '{"field":"contact_email","type":"string","schema":{"is_nullable":true,"max_length":254},"meta":{"interface":"input"}}' \
    '{"schema":{"is_nullable":true,"max_length":254},"meta":{"interface":"input"}}'

upsert_field \
    "contact_street_address" \
    '{"field":"contact_street_address","type":"text","schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}'

upsert_field \
    "contact_notes" \
    '{"field":"contact_notes","type":"text","schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}'

printf '\nDirectus feedback fields are ready.\n'
printf '%s\n' \
    'Give the ColumbiaWalks intake policy Create and Read access to feedback_submissions.' \
    'Do not grant Public Create access to feedback_submissions.'

