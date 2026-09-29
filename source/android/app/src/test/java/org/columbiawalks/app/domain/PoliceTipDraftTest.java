package org.columbiawalks.app.domain;

import static org.junit.Assert.*;
import org.junit.Test;

public class PoliceTipDraftTest {
    @Test public void requiresConfirmationAndCoreFields() {
        assertEquals(PoliceTipDraft.ValidationResult.NOT_CONFIRMED_PAST_OR_INACTIVE,
                valid().setPastOrInactiveConfirmed(false).build().validate());
        assertThrows(IllegalStateException.class,
                () -> valid().setPastOrInactiveConfirmed(false).build().prepare());
        assertEquals(PoliceTipDraft.ValidationResult.NO_SUBJECT,
                valid().setSubject(" [TEST] ").build().validate());
        assertEquals(PoliceTipDraft.ValidationResult.NO_OBSERVED_TIME,
                valid().setObservedTime("").build().validate());
        assertEquals(PoliceTipDraft.ValidationResult.NO_LOCATION,
                valid().setLocation(null).build().validate());
        assertEquals(PoliceTipDraft.ValidationResult.NO_FIRSTHAND_OBSERVATION,
                valid().setFirsthandObservation("[test]\u200b").build().validate());
    }
    @Test public void limitsSubjectAfterMarkingWithoutTruncation() {
        assertEquals(PoliceTipDraft.ValidationResult.VALID,
                valid().setSubject("x".repeat(114)).build().validate());
        assertEquals(PoliceTipDraft.ValidationResult.FIELD_TOO_LONG,
                valid().setSubject("x".repeat(115)).build().validate());
        assertEquals(PoliceTipDraft.ValidationResult.FIELD_TOO_LONG,
                valid().setSubject("one ".repeat(20)).build().validate());
    }
    @Test public void marksEveryWordAndCarriesAllProvidedDetails() {
        PoliceTipDraft.PreparedTip tip = valid().setDirection("East")
                .setLicensePlate("TEST-123").setPlateState("PA")
                .setVehicleDescription("Blue sedan").setEvidenceNotes("Test photo")
                .setSourceWasSubmittedToColumbiaWalks(true).build().prepare();
        assertEquals("[TEST] Driver [TEST] failed [TEST] to [TEST] yield [TEST]", tip.getSubject());
        assertMarked(tip.getSubject()); assertMarked(tip.getNarrative());
        String plain = TestTipText.plain(tip.getNarrative());
        for (String detail : new String[]{"September 18", "3rd and Locust", "East", "TEST-123 (PA)",
                "Blue sedan", "Test photo", "saved to ColumbiaWalks", "personally through the official form"}) {
            assertTrue(detail, plain.contains(detail));
        }
        assertTrue(plain.contains("POLICE-ASSISTED COLUMBIAWALKS TEST"));
        assertTrue(tip.getClipboardText().startsWith("[TEST] Subject: [TEST]"));
    }
    @Test public void marksOptionalPlaceholdersAndUnusualWhitespaceIdempotently() {
        assertEquals("[TEST] a [TEST] b [TEST] c [TEST]",
                TestTipText.mark("a\u00a0b\u200bc [test]"));
        assertEquals("[TEST] Not [TEST] provided [TEST]", TestTipText.mark(null));
        String marked = valid().build().prepare().getNarrative();
        assertTrue(marked.contains("[TEST] Not [TEST] provided [TEST]"));
        assertEquals(marked, TestTipText.mark(marked));
        assertMarked(marked);
    }
    private static void assertMarked(String value) {
        String[] tokens = value.split("\\s+");
        assertEquals(1, tokens.length % 2);
        for (int i = 0; i < tokens.length; i++) {
            if (i % 2 == 0) assertEquals("[TEST]", tokens[i]);
            else assertNotEquals("[TEST]", tokens[i]);
        }
    }
    private static PoliceTipDraft.Builder valid() {
        return new PoliceTipDraft.Builder().setPastOrInactiveConfirmed(true)
                .setSubject("Driver failed to yield").setObservedTime("September 18, 2026, 3:15 PM")
                .setLocation("3rd and Locust Streets")
                .setFirsthandObservation("I saw the driver enter the marked crosswalk.");
    }
}
