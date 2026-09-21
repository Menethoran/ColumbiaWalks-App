package org.columbiawalks.app.domain;

import java.util.List;

public final class ReportValidator {
    public enum ValidationResult {
        VALID,
        NO_CATEGORY,
        OTHER_NEEDS_DETAILS
    }

    private ReportValidator() {
    }

    public static ValidationResult validate(
            List<String> categories,
            String details,
            boolean categoryRequired
    ) {
        if (categoryRequired
                && (categories == null || categories.isEmpty())) {
            return ValidationResult.NO_CATEGORY;
        }
        if (categories != null
                && categories.contains("not_included_elsewhere")
                && (details == null || details.trim().isEmpty())) {
            return ValidationResult.OTHER_NEEDS_DETAILS;
        }
        return ValidationResult.VALID;
    }
}

