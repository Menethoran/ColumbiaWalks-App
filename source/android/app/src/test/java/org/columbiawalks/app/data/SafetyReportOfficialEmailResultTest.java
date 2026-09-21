package org.columbiawalks.app.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class SafetyReportOfficialEmailResultTest {
    @Test
    public void requiredServerOutcomesKeepReportAcceptanceSeparate() {
        assertStatus(
                SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED,
                "Report accepted; [TEST] email to the ColumbiaWalks-controlled "
                        + "test mailbox queued — delivery not confirmed"
        );
        assertStatus(
                SafetyReport.OFFICIAL_EMAIL_RESULT_REVIEW,
                "Report accepted; [TEST] email to the ColumbiaWalks-controlled "
                        + "test mailbox awaiting review"
        );
        assertStatus(
                SafetyReport.OFFICIAL_EMAIL_RESULT_DISABLED,
                "Report accepted; [TEST] email to the ColumbiaWalks-controlled "
                        + "test mailbox disabled"
        );
        assertStatus(
                SafetyReport.OFFICIAL_EMAIL_RESULT_BLOCKED,
                "Report accepted; [TEST] email to the ColumbiaWalks-controlled "
                        + "test mailbox blocked"
        );
        assertStatus(
                SafetyReport.OFFICIAL_EMAIL_RESULT_DEFERRED,
                "Report accepted; [TEST] email to the ColumbiaWalks-controlled "
                        + "test mailbox setup deferred"
        );
    }

    @Test
    public void sentOutcomeDoesNotPromiseRecipientDelivery() {
        String display = submittedReport(
                SafetyReport.OFFICIAL_EMAIL_RESULT_SENT
        ).getOfficialEmailResultForDisplay();

        assertTrue(display.contains("Gmail accepted"));
        assertTrue(display.contains("recipient delivery not confirmed"));
        assertFalse(display.toLowerCase().contains("delivered"));
    }

    @Test
    public void officialDestinationResponseIsShownAsUnexpected() {
        String display = submittedReport(
                SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED,
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL
        ).getOfficialEmailResultForDisplay();

        assertTrue(display.contains("server-reported official-recipient email"));
        assertTrue(display.contains("unexpected in this 3.16 field test"));
        assertTrue(display.contains("delivery not confirmed"));
    }

    @Test
    public void legacyBooleanCannotBePresentedAsTestDestinationConsent() {
        SafetyReport legacy = submittedReport(
                SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED,
                null,
                null
        );

        assertTrue(legacy.isOfficialEmailAuthorized());
        assertFalse(legacy.isOfficialEmailAuthorizedForTestDestination());
        assertEquals("", legacy.getOfficialEmailResultForDisplay());
        assertFalse(legacy.toShareText().contains("Official email:"));
    }

    private static void assertStatus(String result, String expected) {
        assertEquals(
                expected,
                submittedReport(result).getOfficialEmailResultForDisplay()
        );
    }

    private static SafetyReport submittedReport(String officialEmailResult) {
        return submittedReport(officialEmailResult, null);
    }

    private static SafetyReport submittedReport(
            String officialEmailResult,
            String officialEmailDestinationMode
    ) {
        return submittedReport(
                officialEmailResult,
                officialEmailDestinationMode,
                SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST
        );
    }

    private static SafetyReport submittedReport(
            String officialEmailResult,
            String officialEmailDestinationMode,
            String officialEmailDestinationAuthorized
    ) {
        return new SafetyReport(
                1,
                "5b16c166-f60a-4ffd-a08d-5a6535e63562",
                1777150800000L,
                "Aug 25, 2026 9:00 PM",
                "sidewalk_safety",
                "Medium",
                "Not specified",
                "Missing sidewalk",
                "quick_report",
                "{}",
                "unknown",
                false,
                "{}",
                "[]",
                "",
                "quick",
                "[\"missing_sidewalk\"]",
                null,
                "sidewalk",
                null,
                null,
                "2c1ae967-470b-45ee-9e69-b2d3a607c77e",
                1,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "/tmp/report-photo.jpg",
                SafetyReport.STATUS_SUBMITTED,
                "remote-report-id",
                null,
                1777150800000L,
                true,
                officialEmailDestinationAuthorized,
                officialEmailResult,
                officialEmailDestinationMode
        );
    }
}
