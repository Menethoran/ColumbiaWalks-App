package org.columbiawalks.app.domain;

import org.columbiawalks.app.data.SafetyReport;
import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Classifies the two narrowly approved automatic official-email routes.
 * Recipient addresses and Gmail credentials intentionally remain server-side.
 */
public final class OfficialEmailPolicy {
    private static final double CENTER_LATITUDE = 40.0337;
    private static final double CENTER_LONGITUDE = -76.5044;
    private static final double SERVICE_RADIUS_KM = 5.0;

    public enum Routing {
        NONE,
        POLICE_AND_MAYOR,
        CODES,
        POLICE_MAYOR_AND_CODES
    }

    private OfficialEmailPolicy() {
    }

    public static Routing classify(
            String quickReportTypesJson,
            String vehicleIssueType
    ) {
        return classify(
                quickReportTypesJson,
                vehicleIssueType == null ? null : "vehicle",
                vehicleIssueType
        );
    }

    public static Routing classify(
            String quickReportTypesJson,
            String rapidReportKind,
            String vehicleIssueType
    ) {
        List<String> quickTypes = parseQuickTypes(quickReportTypesJson);
        if (quickTypes == null) {
            return Routing.NONE;
        }
        if (rapidReportKind == null) {
            if (quickTypes.size() != 1) {
                return Routing.NONE;
            }
            if ("crosswalk_encroachment".equals(quickTypes.get(0))) {
                return Routing.POLICE_AND_MAYOR;
            }
            if ("missing_sidewalk".equals(quickTypes.get(0))) {
                return Routing.CODES;
            }
            return Routing.NONE;
        }
        if ("sidewalk".equals(rapidReportKind)) {
            return quickTypes.size() == 1
                    && "missing_sidewalk".equals(quickTypes.get(0))
                    ? Routing.CODES
                    : Routing.NONE;
        }
        if ("vehicle".equals(rapidReportKind)) {
            return quickTypes.isEmpty()
                    && "crosswalk_incursion".equals(vehicleIssueType)
                    ? Routing.POLICE_AND_MAYOR
                    : Routing.NONE;
        }
        return Routing.NONE;
    }

    public static boolean isAutomaticEmailEligible(
            String quickReportTypesJson,
            String vehicleIssueType
    ) {
        return classify(quickReportTypesJson, vehicleIssueType)
                != Routing.NONE;
    }

    public static boolean isAutomaticEmailEligible(
            String quickReportTypesJson,
            String rapidReportKind,
            String vehicleIssueType
    ) {
        return classify(
                quickReportTypesJson,
                rapidReportKind,
                vehicleIssueType
        ) != Routing.NONE;
    }

    /**
     * Mirrors the server's fail-closed Columbia-area gate. Ordinary reports
     * are not restricted by this radius; it applies only to automatic email.
     */
    public static boolean isOfficialEmailLocationEligible(
            double latitude,
            double longitude
    ) {
        return Double.isFinite(latitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && Double.isFinite(longitude)
                && longitude >= -180.0
                && longitude <= 180.0
                && ColumbiaArea.distanceKm(
                        CENTER_LATITUDE,
                        CENTER_LONGITUDE,
                        latitude,
                        longitude
                ) <= SERVICE_RADIUS_KM;
    }

    public static boolean isAuthorizedForTestDestination(SafetyReport report) {
        return report.isOfficialEmailAuthorizedForTestDestination()
                && "quick".equals(report.getSubmissionMode())
                && isAutomaticEmailEligible(
                report.getQuickReportTypes(),
                report.getRapidReportKind(),
                report.getVehicleIssueType()
        )
                && report.hasPhoto()
                && report.isLocationConfirmed()
                && isOfficialEmailLocationEligible(
                report.getLatitude(),
                report.getLongitude()
        );
    }

    private static List<String> parseQuickTypes(String storedValue) {
        if (storedValue == null || storedValue.trim().isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(storedValue);
            List<String> values = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (int index = 0; index < array.length(); index++) {
                Object rawValue = array.get(index);
                if (!(rawValue instanceof String)) {
                    return null;
                }
                String value = (String) rawValue;
                if (value.isEmpty() || !seen.add(value)) {
                    return null;
                }
                values.add(value);
            }
            return values;
        } catch (JSONException ignored) {
            // Old or malformed local values cannot authorize disclosure.
            return null;
        }
    }
}
