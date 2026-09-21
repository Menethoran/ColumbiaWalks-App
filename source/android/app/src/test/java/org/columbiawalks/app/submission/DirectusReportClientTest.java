package org.columbiawalks.app.submission;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.columbiawalks.app.data.SafetyReport;
import org.junit.Test;

public final class DirectusReportClientTest {
    @Test
    public void recordedResponsePreservesPrimaryDeliveryStates() {
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_REVIEW);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_DISABLED);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_BLOCKED);
    }

    @Test
    public void responsePreservesDeferredAndNotEligibleOutcomes() {
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_DEFERRED,
                response("{\"official_email\":{\"status\":\"deferred\","
                        + "\"deliveries\":[]}}")
                        .getOfficialEmailResult()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE,
                response("{\"official_email\":{\"status\":\"not_eligible\","
                        + "\"deliveries\":[]}}")
                        .getOfficialEmailResult()
        );
    }

    @Test
    public void responseReportsMixedAndUnavailableDeliveryOutcomes() {
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_MIXED,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"deliveries\":[{\"status\":\"queued\"},"
                        + "{\"status\":\"review\"}]}}")
                        .getOfficialEmailResult()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE,
                response("{\"data\":{\"id\":\"report-id\"}}")
                        .getOfficialEmailResult()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE,
                response("not-json").getOfficialEmailResult()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"deliveries\":[{\"status\":\"queued\"},"
                        + "{\"status\":\"future_state\"}]}}")
                        .getOfficialEmailResult()
        );
    }

    @Test
    public void responsePreservesLaterNonDeliveryGuaranteeingStates() {
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_HELD_CAP);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_RETRY);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_PREPARING);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_SENDING);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_SENT);
        assertRecordedDeliveryState(SafetyReport.OFFICIAL_EMAIL_RESULT_UNCERTAIN);
    }

    @Test
    public void responseDecodesOnlyKnownDestinationModes() {
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"destination_mode\":\"test\","
                        + "\"deliveries\":[{\"status\":\"queued\"}]}}")
                        .getOfficialEmailDestinationMode()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"destination_mode\":\"official\","
                        + "\"deliveries\":[{\"status\":\"queued\"}]}}")
                        .getOfficialEmailDestinationMode()
        );
        assertEquals(
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"recipient_mode\":\"test\","
                        + "\"deliveries\":[{\"status\":\"queued\"}]}}")
                        .getOfficialEmailDestinationMode()
        );
        assertNull(response("{\"official_email\":{\"status\":\"recorded\","
                + "\"destination_mode\":\"unexpected\","
                + "\"deliveries\":[{\"status\":\"queued\"}]}}")
                .getOfficialEmailDestinationMode());
        assertNull(response("{\"data\":{\"id\":\"report-id\"}}")
                .getOfficialEmailDestinationMode());
    }

    private static void assertRecordedDeliveryState(String state) {
        assertEquals(
                state,
                response("{\"official_email\":{\"status\":\"recorded\","
                        + "\"deliveries\":[{\"status\":\"" + state
                        + "\"}]}}")
                        .getOfficialEmailResult()
        );
    }

    private static DirectusReportClient.SubmissionResponse response(String body) {
        return new DirectusReportClient.SubmissionResponse(201, body);
    }
}
