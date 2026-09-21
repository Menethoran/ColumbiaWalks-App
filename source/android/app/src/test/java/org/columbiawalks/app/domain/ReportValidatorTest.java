package org.columbiawalks.app.domain;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.util.Collections;
import java.util.List;

public class ReportValidatorTest {
    @Test
    public void requiresAtLeastOneCategory() {
        assertEquals(
                ReportValidator.ValidationResult.NO_CATEGORY,
                ReportValidator.validate(
                        Collections.emptyList(),
                        "details",
                        true
                )
        );
    }

    @Test
    public void otherRequiresDetails() {
        assertEquals(
                ReportValidator.ValidationResult.OTHER_NEEDS_DETAILS,
                ReportValidator.validate(
                        List.of("not_included_elsewhere"),
                        "  ",
                        true
                )
        );
    }

    @Test
    public void validReportPasses() {
        assertEquals(
                ReportValidator.ValidationResult.VALID,
                ReportValidator.validate(
                        List.of("crosswalk_safety"),
                        "",
                        true
                )
        );
    }

    @Test
    public void quickReportAllowsNoCategory() {
        assertEquals(
                ReportValidator.ValidationResult.VALID,
                ReportValidator.validate(
                        Collections.emptyList(),
                        "",
                        false
                )
        );
    }
}

