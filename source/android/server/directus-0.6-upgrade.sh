#!/usr/bin/env sh
set -eu

DIRECTUS_URL="${DIRECTUS_URL:-https://directus.rndtech.org}"
: "${DIRECTUS_ADMIN_TOKEN:?Set DIRECTUS_ADMIN_TOKEN to a Directus administrator static token.}"

authorization="Authorization: Bearer ${DIRECTUS_ADMIN_TOKEN}"
content_type="Content-Type: application/json"
collection="safety_reports"

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

categories_meta='{"meta":{"interface":"tags","options":{"presets":["sidewalk_safety","vehicle_safety","crosswalk_safety","trip_hazards","aggressive_drivers","police_response","lighting_or_visibility","accessibility_ada","school_route_safety","not_included_elsewhere"]},"note":"Controlled ColumbiaWalks issue categories."}}'
upsert_field \
    "categories" \
    '{"field":"categories","type":"json","schema":{"is_nullable":false},"meta":{"interface":"tags","options":{"presets":["sidewalk_safety","vehicle_safety","crosswalk_safety","trip_hazards","aggressive_drivers","police_response","lighting_or_visibility","accessibility_ada","school_route_safety","not_included_elsewhere"]},"required":true}}' \
    "$categories_meta"

upsert_field \
    "reported_party_type" \
    '{"field":"reported_party_type","type":"string","schema":{"is_nullable":false,"default_value":"unknown","max_length":64},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Unknown / not observed","value":"unknown"},{"text":"Civilian driver","value":"civilian_driver"},{"text":"Police officer","value":"police_officer"},{"text":"Other government driver","value":"other_government_driver"},{"text":"Commercial driver","value":"commercial_driver"}]},"required":true}}' \
    '{"schema":{"is_nullable":false,"default_value":"unknown","max_length":64},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Unknown / not observed","value":"unknown"},{"text":"Civilian driver","value":"civilian_driver"},{"text":"Police officer","value":"police_officer"},{"text":"Other government driver","value":"other_government_driver"},{"text":"Commercial driver","value":"commercial_driver"}]},"required":true}}'

upsert_field \
    "vehicle_involved" \
    '{"field":"vehicle_involved","type":"boolean","schema":{"is_nullable":false,"default_value":false},"meta":{"interface":"boolean","required":true}}' \
    '{"schema":{"is_nullable":false,"default_value":false},"meta":{"interface":"boolean","required":true}}'

upsert_field \
    "vehicle_details" \
    '{"field":"vehicle_details","type":"json","schema":{"is_nullable":true},"meta":{"interface":"input-code","options":{"language":"json"}}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"input-code","options":{"language":"json"}}}'

upsert_field \
    "police_observations" \
    '{"field":"police_observations","type":"json","schema":{"is_nullable":true},"meta":{"interface":"tags"}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"tags"}}'

upsert_field \
    "police_complaint_details" \
    '{"field":"police_complaint_details","type":"text","schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"input-multiline"}}'

upsert_field \
    "submission_mode" \
    '{"field":"submission_mode","type":"string","schema":{"is_nullable":false,"default_value":"full","max_length":16},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Quick Report","value":"quick"},{"text":"Full Report","value":"full"}]},"required":true}}' \
    '{"schema":{"is_nullable":false,"default_value":"full","max_length":16},"meta":{"interface":"select-dropdown","options":{"choices":[{"text":"Quick Report","value":"quick"},{"text":"Full Report","value":"full"}]},"required":true}}'

upsert_field \
    "quick_report_type" \
    '{"field":"quick_report_type","type":"string","schema":{"is_nullable":true,"max_length":64},"meta":{"interface":"select-dropdown","options":{"allowNone":true,"choices":[{"text":"Crosswalk Encroachment","value":"crosswalk_encroachment"},{"text":"Speeding","value":"speeding"},{"text":"Illegal U-Turn","value":"illegal_u_turn"},{"text":"Trip Hazard","value":"trip_hazard"}]}}}' \
    '{"schema":{"is_nullable":true,"max_length":64},"meta":{"interface":"select-dropdown","options":{"allowNone":true,"choices":[{"text":"Crosswalk Encroachment","value":"crosswalk_encroachment"},{"text":"Speeding","value":"speeding"},{"text":"Illegal U-Turn","value":"illegal_u_turn"},{"text":"Trip Hazard","value":"trip_hazard"}]}}}'

upsert_field \
    "quick_report_types" \
    '{"field":"quick_report_types","type":"json","schema":{"is_nullable":true},"meta":{"interface":"select-dropdown","options":{"allowNone":true,"multiple":true,"choices":[{"text":"Crosswalk Encroachment","value":"crosswalk_encroachment"},{"text":"Speeding","value":"speeding"},{"text":"Illegal U-Turn","value":"illegal_u_turn"},{"text":"Trip Hazard","value":"trip_hazard"}]}}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"select-dropdown","options":{"allowNone":true,"multiple":true,"choices":[{"text":"Crosswalk Encroachment","value":"crosswalk_encroachment"},{"text":"Speeding","value":"speeding"},{"text":"Illegal U-Turn","value":"illegal_u_turn"},{"text":"Trip Hazard","value":"trip_hazard"}]}}}'

upsert_field \
    "nearest_intersection" \
    '{"field":"nearest_intersection","type":"json","schema":{"is_nullable":true},"meta":{"interface":"input-code","options":{"language":"json"},"readonly":true}}' \
    '{"schema":{"is_nullable":true},"meta":{"interface":"input-code","options":{"language":"json"},"readonly":true}}'

for nullable_field in location latitude longitude; do
    status="$(field_status "$nullable_field")"
    if [ "$status" = "200" ]; then
        curl --fail --silent --show-error \
            --request PATCH \
            --header "$authorization" \
            --header "$content_type" \
            --data '{"schema":{"is_nullable":true}}' \
            "${DIRECTUS_URL%/}/fields/${collection}/${nullable_field}" \
            >/dev/null
        printf 'Made %s nullable\n' "$nullable_field"
    else
        printf 'Expected existing field %s, but got HTTP %s.\n' \
            "$nullable_field" "$status" >&2
        exit 1
    fi
done

printf '\nDirectus 0.6 fields are ready.\n'
printf 'Remember to add the new fields to the intake policy Create field list.\n'

