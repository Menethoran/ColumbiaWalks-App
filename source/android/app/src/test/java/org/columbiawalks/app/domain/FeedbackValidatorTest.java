package org.columbiawalks.app.domain;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class FeedbackValidatorTest {
    @Test
    public void requiresAReason() {
        assertEquals(
                FeedbackValidator.ValidationResult.NO_CATEGORY,
                FeedbackValidator.validate("", "Useful feedback")
        );
    }

    @Test
    public void requiresFeedbackText() {
        assertEquals(
                FeedbackValidator.ValidationResult.NO_TEXT,
                FeedbackValidator.validate("bug_report", "  ")
        );
    }

    @Test
    public void acceptsOtherWithoutASeparateSubject() {
        assertEquals(
                FeedbackValidator.ValidationResult.VALID,
                FeedbackValidator.validate("other", "A general observation")
        );
    }

    @Test
    public void rejectsUnknownReasons() {
        assertEquals(
                FeedbackValidator.ValidationResult.UNSUPPORTED_CATEGORY,
                FeedbackValidator.validate("billing", "Question")
        );
    }
}

