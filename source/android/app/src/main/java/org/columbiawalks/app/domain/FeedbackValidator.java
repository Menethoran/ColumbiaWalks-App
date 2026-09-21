package org.columbiawalks.app.domain;

import java.util.Set;

public final class FeedbackValidator {
    private static final Set<String> CATEGORIES = Set.of(
            "app_feedback",
            "feature_request",
            "bug_report",
            "other"
    );

    public enum ValidationResult {
        VALID,
        NO_CATEGORY,
        UNSUPPORTED_CATEGORY,
        NO_TEXT
    }

    private FeedbackValidator() {
    }

    public static ValidationResult validate(String category, String text) {
        if (category == null || category.trim().isEmpty()) {
            return ValidationResult.NO_CATEGORY;
        }
        if (!CATEGORIES.contains(category)) {
            return ValidationResult.UNSUPPORTED_CATEGORY;
        }
        if (text == null || text.trim().isEmpty()) {
            return ValidationResult.NO_TEXT;
        }
        return ValidationResult.VALID;
    }
}

