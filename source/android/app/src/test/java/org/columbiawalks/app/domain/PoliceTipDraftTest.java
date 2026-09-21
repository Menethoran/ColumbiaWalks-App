package org.columbiawalks.app.domain;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PoliceTipDraftTest {
    @Test
    public void requiresPastOrInactiveConfirmation() {
        PoliceTipDraft draft = validBuilder()
                .setPastOrInactiveConfirmed(false)
                .build();

        assertEquals(
                PoliceTipDraft.ValidationResult
                        .NOT_CONFIRMED_PAST_OR_INACTIVE,
                draft.validate()
        );
        assertThrows(IllegalStateException.class, draft::prepare);
    }

    @Test
    public void requiresCoreFirsthandFields() {
        assertEquals(
                PoliceTipDraft.ValidationResult.NO_SUBJECT,
                validBuilder().setSubject("  ").build().validate()
        );
        assertEquals(
                PoliceTipDraft.ValidationResult.NO_OBSERVED_TIME,
                validBuilder().setObservedTime("").build().validate()
        );
        assertEquals(
                PoliceTipDraft.ValidationResult.NO_LOCATION,
                validBuilder().setLocation(null).build().validate()
        );
        assertEquals(
                PoliceTipDraft.ValidationResult.NO_FIRSTHAND_OBSERVATION,
                validBuilder().setFirsthandObservation(" ").build().validate()
        );
    }

    @Test
    public void rejectsSubjectLongerThanOfficialFormLimit() {
        assertEquals(
                PoliceTipDraft.ValidationResult.FIELD_TOO_LONG,
                validBuilder().setSubject("x".repeat(129)).build().validate()
        );
    }

    @Test
    public void preparesDeterministicSubjectNarrativeAndClipboardText() {
        PoliceTipDraft.PreparedTip prepared = validBuilder()
                .setDirection("East on Locust Street")
                .setLicensePlate("ABC-1234")
                .setPlateState("PA")
                .setVehicleDescription("Blue four-door sedan")
                .setEvidenceNotes("Original MP4 and two JPG files available.")
                .build()
                .prepare();

        assertEquals(
                "Driver failed to yield",
                prepared.getSubject()
        );
        assertEquals(
                "ANONYMOUS TIP — PAST / NOT IN PROGRESS\n\n"
                        + "Subject: Driver failed to yield\n\n"
                        + "Observed date/time: September 18, 2026, 3:15 PM\n\n"
                        + "Location: 3rd and Locust Streets\n\n"
                        + "Direction of travel: East on Locust Street\n\n"
                        + "License plate: ABC-1234 (PA)\n\n"
                        + "Vehicle description: Blue four-door sedan\n\n"
                        + "Firsthand observation:\n"
                        + "I saw the driver enter the marked crosswalk.\n\n"
                        + "Evidence available:\n"
                        + "Original MP4 and two JPG files available.\n\n"
                        + "Prepared locally in ColumbiaWalks. No tip text "
                        + "or media was sent to ColumbiaWalks or CBPD.",
                prepared.getNarrative()
        );
        assertEquals(
                "Subject:\n" + prepared.getSubject()
                        + "\n\nMessage:\n" + prepared.getNarrative(),
                prepared.getClipboardText()
        );
    }

    @Test
    public void omitsEmptyOptionalSections() {
        String narrative = validBuilder().build().prepare().getNarrative();

        assertFalse(narrative.contains("Direction of travel:"));
        assertFalse(narrative.contains("License plate:"));
        assertFalse(narrative.contains("Vehicle description:"));
        assertFalse(narrative.contains("Evidence available:"));
        assertTrue(narrative.contains("Firsthand observation:"));
    }

    @Test
    public void identifiesCwReportHandoffWithoutClaimingPoliceDelivery() {
        String narrative = validBuilder()
                .setSourceWasSubmittedToColumbiaWalks(true)
                .build()
                .prepare()
                .getNarrative();

        assertTrue(narrative.contains("saved to ColumbiaWalks"));
        assertTrue(narrative.contains("did not send this draft or media to CBPD"));
        assertFalse(narrative.contains("No tip text or media was sent to ColumbiaWalks"));
    }

    private static PoliceTipDraft.Builder validBuilder() {
        return new PoliceTipDraft.Builder()
                .setPastOrInactiveConfirmed(true)
                .setSubject("Driver failed to yield")
                .setObservedTime("September 18, 2026, 3:15 PM")
                .setLocation("3rd and Locust Streets")
                .setFirsthandObservation(
                        "I saw the driver enter the marked crosswalk."
                );
    }
}
