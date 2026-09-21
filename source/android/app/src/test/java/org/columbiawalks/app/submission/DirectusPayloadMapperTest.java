package org.columbiawalks.app.submission;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.columbiawalks.app.data.ReportLocationSource;
import org.columbiawalks.app.data.SafetyReport;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class DirectusPayloadMapperTest {
    private static final double COORDINATE_TOLERANCE = 0.0000001;

    @Test
    public void continuousSidewalkReportMapsExifSessionSequenceAndLipHeight()
            throws Exception {
        String sessionId = "76c50884-b004-47ba-a692-c587521392e5";
        SafetyReport report = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                "over_half_inch",
                null,
                sessionId,
                3,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.PHOTO_EXIF,
                40.033700,
                -76.504400,
                false
        );

        assertEquals("sidewalk", report.getRapidReportKind());
        assertEquals("over_half_inch", report.getSidewalkLipHeight());
        assertEquals(sessionId, report.getContinuousSessionId());
        assertEquals(3, report.getContinuousSequence());
        assertTrue(report.hasPhotoCoordinates());
        assertFalse(report.isLocationOverridden());

        JSONObject payload = DirectusPayloadMapper.toJson(report);
        JSONArray categories = payload.getJSONArray("categories");
        assertEquals(1, categories.length());
        assertEquals("sidewalk_safety", categories.getString(0));
        assertEquals("quick", payload.getString("submission_mode"));
        assertEquals("sidewalk", payload.getString("rapid_report_kind"));
        assertEquals(
                "over_half_inch",
                payload.getString("sidewalk_lip_height")
        );
        assertExplicitNull(payload, "vehicle_issue_type");
        assertEquals(
                sessionId,
                payload.getString("continuous_session_id")
        );
        assertEquals(3, payload.getInt("continuous_sequence"));
        assertEquals(
                ReportLocationSource.PHOTO_EXIF,
                payload.getString("location_source")
        );
        assertEquals(
                40.033700,
                payload.getDouble("photo_latitude"),
                COORDINATE_TOLERANCE
        );
        assertEquals(
                -76.504400,
                payload.getDouble("photo_longitude"),
                COORDINATE_TOLERANCE
        );
        assertFalse(payload.getBoolean("location_overridden"));
        assertFinalLocation(
                payload,
                40.033700,
                -76.504400
        );
        assertExplicitNull(payload, "quick_report_type");
        assertEquals(0, payload.getJSONArray("quick_report_types").length());
        assertFalse(payload.getBoolean("official_email_authorized"));
    }

    @Test
    public void continuousVehicleReportAllowsOmittedTypeAndPreservesOverride()
            throws Exception {
        String sessionId = "f4a08fa5-ed91-4578-b74c-87568402e8f3";
        SafetyReport report = report(
                "vehicle_safety",
                true,
                "quick",
                "vehicle",
                null,
                null,
                sessionId,
                2,
                true,
                40.033720,
                -76.504360,
                ReportLocationSource.MANUAL_COORDINATES,
                40.033680,
                -76.504310,
                true
        );

        assertEquals("vehicle", report.getRapidReportKind());
        assertNull(report.getVehicleIssueType());
        assertTrue(report.isVehicleInvolved());
        assertTrue(report.hasPhotoCoordinates());
        assertTrue(report.isLocationOverridden());

        JSONObject payload = DirectusPayloadMapper.toJson(report);
        assertEquals("vehicle", payload.getString("rapid_report_kind"));
        assertExplicitNull(payload, "sidewalk_lip_height");
        assertExplicitNull(payload, "vehicle_issue_type");
        assertEquals(
                sessionId,
                payload.getString("continuous_session_id")
        );
        assertEquals(2, payload.getInt("continuous_sequence"));
        assertTrue(payload.getBoolean("vehicle_involved"));
        assertEquals(
                ReportLocationSource.MANUAL_COORDINATES,
                payload.getString("location_source")
        );
        assertTrue(payload.getBoolean("location_overridden"));
        assertEquals(
                40.033680,
                payload.getDouble("photo_latitude"),
                COORDINATE_TOLERANCE
        );
        assertEquals(
                -76.504310,
                payload.getDouble("photo_longitude"),
                COORDINATE_TOLERANCE
        );
        assertFinalLocation(
                payload,
                40.033720,
                -76.504360
        );
        assertExplicitNull(payload, "quick_report_type");
        assertEquals(0, payload.getJSONArray("quick_report_types").length());
        assertFalse(payload.getBoolean("official_email_authorized"));
    }

    @Test
    public void legacyStandardReportEmitsExplicitNullContinuousFields()
            throws Exception {
        SafetyReport report = report(
                "crosswalk_safety",
                false,
                "full",
                null,
                null,
                null,
                null,
                0,
                true,
                40.034100,
                -76.505200,
                ReportLocationSource.LEGACY,
                null,
                null,
                false
        );

        assertNull(report.getRapidReportKind());
        assertNull(report.getContinuousSessionId());
        assertEquals(0, report.getContinuousSequence());
        assertFalse(report.hasPhotoCoordinates());

        JSONObject payload = DirectusPayloadMapper.toJson(report);
        assertEquals("full", payload.getString("submission_mode"));
        assertEquals(
                ReportLocationSource.LEGACY,
                payload.getString("location_source")
        );
        assertFalse(payload.getBoolean("location_overridden"));
        assertExplicitNull(payload, "rapid_report_kind");
        assertExplicitNull(payload, "sidewalk_lip_height");
        assertExplicitNull(payload, "vehicle_issue_type");
        assertExplicitNull(payload, "continuous_session_id");
        assertExplicitNull(payload, "continuous_sequence");
        assertExplicitNull(payload, "photo_latitude");
        assertExplicitNull(payload, "photo_longitude");
        assertExplicitNull(payload, "nearest_intersection");
        assertExplicitNull(payload, "quick_report_type");
        assertFinalLocation(
                payload,
                40.034100,
                -76.505200
        );
        assertFalse(payload.getBoolean("official_email_authorized"));
    }

    @Test
    public void authorizedCrosswalkEmailAndPlateAreMapped() throws Exception {
        SafetyReport report = report(
                "vehicle_safety",
                true,
                "quick",
                "vehicle",
                null,
                "crosswalk_incursion",
                "73bb767d-d150-4e95-ae67-39dcaf1e8e84",
                8,
                true,
                40.033800,
                -76.504500,
                ReportLocationSource.PHOTO_EXIF,
                40.033800,
                -76.504500,
                false,
                "[]",
                "{\"license_plate\":\"ABC1234\",\"plate_state\":\"PA\"}",
                true
        );

        JSONObject payload = DirectusPayloadMapper.toJson(report);
        assertTrue(payload.getBoolean("official_email_authorized"));
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                payload.getString("official_email_destination_authorized")
        );
        assertEquals(
                "ABC1234",
                payload.getJSONObject("vehicle_details")
                        .getString("license_plate")
        );
        assertEquals(
                "PA",
                payload.getJSONObject("vehicle_details")
                        .getString("plate_state")
        );
    }

    @Test
    public void authorizedRepeatMissingSidewalkUsesQuickTypeContract()
            throws Exception {
        SafetyReport report = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                "39ab75df-5a8e-47a7-a946-791c95666064",
                9,
                true,
                40.033750,
                -76.504450,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "[\"missing_sidewalk\"]",
                "{}",
                true
        );

        JSONObject payload = DirectusPayloadMapper.toJson(report);
        assertEquals("quick", payload.getString("submission_mode"));
        assertEquals("sidewalk", payload.getString("rapid_report_kind"));
        assertEquals(
                "missing_sidewalk",
                payload.getString("quick_report_type")
        );
        JSONArray quickTypes = payload.getJSONArray("quick_report_types");
        assertEquals(1, quickTypes.length());
        assertEquals("missing_sidewalk", quickTypes.getString(0));
        assertExplicitNull(payload, "vehicle_issue_type");
        assertTrue(payload.getBoolean("official_email_authorized"));
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                payload.getString("official_email_destination_authorized")
        );
    }

    @Test
    public void storedAuthorizationRequiresQuickModeAndExactReportHierarchy()
            throws Exception {
        SafetyReport fullModeCrosswalk = report(
                "crosswalk_safety",
                false,
                "full",
                null,
                null,
                null,
                null,
                0,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.PHOTO_EXIF,
                40.033700,
                -76.504400,
                false,
                "[\"crosswalk_encroachment\"]",
                "{}",
                true
        );
        SafetyReport sidewalkWithCrosswalkSignal = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                "64aa58df-6e32-4781-a04b-9061bb3d7b3e",
                4,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.PHOTO_EXIF,
                40.033700,
                -76.504400,
                false,
                "[\"crosswalk_encroachment\"]",
                "{}",
                true
        );

        assertFalse(DirectusPayloadMapper.toJson(fullModeCrosswalk)
                .getBoolean("official_email_authorized"));
        assertFalse(DirectusPayloadMapper.toJson(sidewalkWithCrosswalkSignal)
                .getBoolean("official_email_authorized"));
    }

    @Test
    public void mixedOrStrayQuickKeysCannotEmitTestDestinationConsent()
            throws Exception {
        SafetyReport mixedStandardQuick = report(
                "crosswalk_safety",
                false,
                "quick",
                null,
                null,
                null,
                null,
                0,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.PHOTO_EXIF,
                40.033700,
                -76.504400,
                false,
                "[\"crosswalk_encroachment\",\"speeding\"]",
                "{}",
                true
        );
        SafetyReport repeatVehicleWithStrayQuickKey = report(
                "vehicle_safety",
                true,
                "quick",
                "vehicle",
                null,
                "crosswalk_incursion",
                "73bb767d-d150-4e95-ae67-39dcaf1e8e84",
                8,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.PHOTO_EXIF,
                40.033700,
                -76.504400,
                false,
                "[\"crosswalk_encroachment\"]",
                "{\"license_plate\":\"ABC1234\",\"plate_state\":\"PA\"}",
                true
        );

        JSONObject mixedPayload = DirectusPayloadMapper.toJson(
                mixedStandardQuick
        );
        JSONObject repeatPayload = DirectusPayloadMapper.toJson(
                repeatVehicleWithStrayQuickKey
        );
        assertFalse(mixedPayload.getBoolean("official_email_authorized"));
        assertExplicitNull(
                mixedPayload,
                "official_email_destination_authorized"
        );
        assertFalse(repeatPayload.getBoolean("official_email_authorized"));
        assertExplicitNull(
                repeatPayload,
                "official_email_destination_authorized"
        );
    }

    @Test
    public void storedAuthorizationRequiresPhotoConfirmedLocationAndFiveKmGate()
            throws Exception {
        SafetyReport missingPhoto = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                null,
                1,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "[\"missing_sidewalk\"]",
                "{}",
                true,
                null
        );
        SafetyReport unconfirmedLocation = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                null,
                2,
                false,
                40.033700,
                -76.504400,
                ReportLocationSource.NONE,
                null,
                null,
                false,
                "[\"missing_sidewalk\"]",
                "{}",
                true
        );
        SafetyReport outsideColumbiaGate = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                null,
                3,
                true,
                40.100000,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "[\"missing_sidewalk\"]",
                "{}",
                true
        );

        assertFalse(DirectusPayloadMapper.toJson(missingPhoto)
                .getBoolean("official_email_authorized"));
        assertFalse(DirectusPayloadMapper.toJson(unconfirmedLocation)
                .getBoolean("official_email_authorized"));
        assertFalse(DirectusPayloadMapper.toJson(outsideColumbiaGate)
                .getBoolean("official_email_authorized"));
        assertExplicitNull(
                DirectusPayloadMapper.toJson(outsideColumbiaGate),
                "official_email_destination_authorized"
        );
    }

    @Test
    public void destinationConsentPinCanOnlyEmitTestForAnEligibleReport()
            throws Exception {
        SafetyReport missingDestinationPin = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                null,
                1,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "[\"missing_sidewalk\"]",
                "{}",
                true,
                "/tmp/report-photo.jpg",
                null
        );
        SafetyReport officialDestinationPin = report(
                "sidewalk_safety",
                false,
                "quick",
                "sidewalk",
                null,
                null,
                null,
                2,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "[\"missing_sidewalk\"]",
                "{}",
                true,
                "/tmp/report-photo.jpg",
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL
        );

        JSONObject missingPayload = DirectusPayloadMapper.toJson(
                missingDestinationPin
        );
        JSONObject officialPayload = DirectusPayloadMapper.toJson(
                officialDestinationPin
        );
        assertFalse(missingPayload.getBoolean("official_email_authorized"));
        assertExplicitNull(
                missingPayload,
                "official_email_destination_authorized"
        );
        assertFalse(officialPayload.getBoolean("official_email_authorized"));
        assertExplicitNull(
                officialPayload,
                "official_email_destination_authorized"
        );
    }

    private static SafetyReport report(
            String categories,
            boolean vehicleInvolved,
            String submissionMode,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden
    ) {
        return report(
                categories,
                vehicleInvolved,
                submissionMode,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                "[]",
                "{}",
                false
        );
    }

    private static SafetyReport report(
            String categories,
            boolean vehicleInvolved,
            String submissionMode,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String quickReportTypes,
            String vehicleDetails,
            boolean officialEmailAuthorized
    ) {
        return report(
                categories,
                vehicleInvolved,
                submissionMode,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                quickReportTypes,
                vehicleDetails,
                officialEmailAuthorized,
                "/tmp/report-photo.jpg"
        );
    }

    private static SafetyReport report(
            String categories,
            boolean vehicleInvolved,
            String submissionMode,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String quickReportTypes,
            String vehicleDetails,
            boolean officialEmailAuthorized,
            String photoPath
    ) {
        return report(
                categories,
                vehicleInvolved,
                submissionMode,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                quickReportTypes,
                vehicleDetails,
                officialEmailAuthorized,
                photoPath,
                officialEmailAuthorized
                        ? SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST
                        : null
        );
    }

    private static SafetyReport report(
            String categories,
            boolean vehicleInvolved,
            String submissionMode,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String quickReportTypes,
            String vehicleDetails,
            boolean officialEmailAuthorized,
            String photoPath,
            String officialEmailDestinationAuthorized
    ) {
        return new SafetyReport(
                7,
                "4a4d18f1-7eaf-46fb-90d7-f40f1a1e1c73",
                1777060800000L,
                "Aug 24, 2026 8:00 PM",
                categories,
                "Medium",
                "Not specified",
                "Structured compatibility details",
                "quick_report",
                "{}",
                "unknown",
                vehicleInvolved,
                vehicleDetails,
                "[]",
                "",
                submissionMode,
                quickReportTypes,
                null,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                photoPath,
                SafetyReport.STATUS_PENDING,
                null,
                null,
                0,
                officialEmailAuthorized,
                officialEmailDestinationAuthorized,
                null,
                null
        );
    }

    private static void assertExplicitNull(JSONObject payload, String key) {
        assertTrue("Expected payload to include key: " + key, payload.has(key));
        assertTrue("Expected JSON null for key: " + key, payload.isNull(key));
    }

    private static void assertFinalLocation(
            JSONObject payload,
            double expectedLatitude,
            double expectedLongitude
    ) throws Exception {
        assertEquals(
                expectedLatitude,
                payload.getDouble("latitude"),
                COORDINATE_TOLERANCE
        );
        assertEquals(
                expectedLongitude,
                payload.getDouble("longitude"),
                COORDINATE_TOLERANCE
        );
        JSONObject location = payload.getJSONObject("location");
        assertEquals("Point", location.getString("type"));
        JSONArray coordinates = location.getJSONArray("coordinates");
        assertEquals(2, coordinates.length());
        assertEquals(
                expectedLongitude,
                coordinates.getDouble(0),
                COORDINATE_TOLERANCE
        );
        assertEquals(
                expectedLatitude,
                coordinates.getDouble(1),
                COORDINATE_TOLERANCE
        );
    }
}
