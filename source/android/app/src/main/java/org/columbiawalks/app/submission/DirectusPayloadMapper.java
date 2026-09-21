package org.columbiawalks.app.submission;

import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.data.SafetyReport;
import org.columbiawalks.app.domain.OfficialEmailPolicy;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;

final class DirectusPayloadMapper {
    private DirectusPayloadMapper() {
    }

    static JSONObject toJson(SafetyReport report) throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("client_report_id", report.getClientReportId());
        payload.put("observed_at", report.getObservedAt());
        payload.put("categories", categories(report.getCategories()));
        payload.put("severity", normalizeSeverity(report.getSeverity()));
        payload.put(
                "police_response",
                normalizePoliceResponse(report.getPoliceResponse())
        );
        payload.put("details", report.getDetails());
        payload.put("assessment_mode", report.getAssessmentMode());
        payload.put(
                "checklist_responses",
                new JSONObject(report.getChecklistResponses())
        );
        payload.put(
                "reported_party_type",
                report.getReportedPartyType()
        );
        payload.put("vehicle_involved", report.isVehicleInvolved());
        payload.put(
                "vehicle_details",
                new JSONObject(report.getVehicleDetails())
        );
        payload.put(
                "police_observations",
                new JSONArray(report.getPoliceObservations())
        );
        payload.put(
                "police_complaint_details",
                report.getPoliceComplaintDetails()
        );
        payload.put("submission_mode", report.getSubmissionMode());
        JSONArray quickReportTypes =
                quickReportTypes(report.getQuickReportTypes());
        payload.put(
                "quick_report_type",
                quickReportTypes.length() == 0
                        ? JSONObject.NULL
                        : quickReportTypes.getString(0)
        );
        payload.put("quick_report_types", quickReportTypes);
        payload.put(
                "nearest_intersection",
                report.getNearestIntersection() == null
                        ? JSONObject.NULL
                        : new JSONObject(report.getNearestIntersection())
        );
        payload.put(
                "rapid_report_kind",
                nullable(report.getRapidReportKind())
        );
        payload.put(
                "sidewalk_lip_height",
                nullable(report.getSidewalkLipHeight())
        );
        payload.put(
                "vehicle_issue_type",
                nullable(report.getVehicleIssueType())
        );
        payload.put(
                "continuous_session_id",
                nullable(report.getContinuousSessionId())
        );
        payload.put(
                "continuous_sequence",
                report.getContinuousSequence() > 0
                        ? report.getContinuousSequence()
                        : JSONObject.NULL
        );
        payload.put("location_source", report.getLocationSource());
        payload.put(
                "photo_latitude",
                report.getPhotoLatitude() == null
                        ? JSONObject.NULL
                        : report.getPhotoLatitude()
        );
        payload.put(
                "photo_longitude",
                report.getPhotoLongitude() == null
                        ? JSONObject.NULL
                        : report.getPhotoLongitude()
        );
        payload.put(
                "location_overridden",
                report.isLocationOverridden()
        );
        String officialEmailDestination =
                authorizedOfficialEmailDestination(report);
        payload.put(
                "official_email_authorized",
                officialEmailDestination != null
        );
        payload.put(
                "official_email_destination_authorized",
                nullable(officialEmailDestination)
        );
        payload.put("app_version", BuildConfig.VERSION_NAME);

        if (report.isLocationConfirmed()) {
            payload.put("latitude", report.getLatitude());
            payload.put("longitude", report.getLongitude());
            JSONObject location = new JSONObject();
            location.put("type", "Point");
            JSONArray coordinates = new JSONArray();
            coordinates.put(report.getLongitude());
            coordinates.put(report.getLatitude());
            location.put("coordinates", coordinates);
            payload.put("location", location);
        } else {
            payload.put("latitude", JSONObject.NULL);
            payload.put("longitude", JSONObject.NULL);
            payload.put("location", JSONObject.NULL);
        }
        return payload;
    }

    static boolean shouldAuthorizeOfficialEmail(SafetyReport report) {
        return authorizedOfficialEmailDestination(report) != null;
    }

    private static String authorizedOfficialEmailDestination(
            SafetyReport report
    ) {
        return OfficialEmailPolicy.isAuthorizedForTestDestination(report)
                ? SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST
                : null;
    }

    private static Object nullable(String value) {
        return value == null || value.trim().isEmpty()
                ? JSONObject.NULL
                : value;
    }

    private static JSONArray categories(String joinedCategories) {
        JSONArray categories = new JSONArray();
        if (joinedCategories == null || joinedCategories.trim().isEmpty()) {
            return categories;
        }
        for (String category : joinedCategories.split("\\|")) {
            categories.put(toSlug(category));
        }
        return categories;
    }

    private static JSONArray quickReportTypes(String storedValue) {
        if (storedValue == null || storedValue.trim().isEmpty()) {
            return new JSONArray();
        }
        try {
            return new JSONArray(storedValue);
        } catch (JSONException ignored) {
            JSONArray legacyValue = new JSONArray();
            legacyValue.put(storedValue);
            return legacyValue;
        }
    }

    private static String toSlug(String value) {
        return value.toLowerCase(Locale.US)
                .replace("/", " ")
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private static String normalizeSeverity(String severity) {
        String normalized = severity.toLowerCase(Locale.US);
        if (normalized.startsWith("high")) {
            return "high";
        }
        if (normalized.startsWith("low")) {
            return "low";
        }
        return "medium";
    }

    private static String normalizePoliceResponse(String policeResponse) {
        String normalized = policeResponse.toLowerCase(Locale.US);
        if (normalized.startsWith("good")) {
            return "good";
        }
        if (normalized.startsWith("poor")) {
            return "poor";
        }
        if (normalized.startsWith("mixed")) {
            return "mixed";
        }
        return "not_involved";
    }
}
