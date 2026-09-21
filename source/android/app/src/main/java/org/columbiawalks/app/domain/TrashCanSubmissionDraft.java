package org.columbiawalks.app.domain;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Set;

/** Validated, single-category trash-can submission prepared for local queueing. */
public final class TrashCanSubmissionDraft {
    public static final String KIND_PUBLIC_COMMENT = "public_comment";
    public static final String KIND_PRIVATE_COMPLAINT = "private_complaint";
    public static final String SCOPE_PUBLIC = "public";
    public static final String SCOPE_PRIVATE_PROPERTY = "private_property";
    public static final String SCOPE_UNKNOWN = "unknown";

    public static final Set<String> PUBLIC_COMMENT_CATEGORIES = Set.of(
            "clean_well_maintained",
            "needs_cleaning",
            "full_or_overflowing",
            "damaged",
            "hard_to_access",
            "poor_location",
            "request_new_can",
            "other"
    );
    public static final Set<String> PRIVATE_COMPLAINT_CATEGORIES = Set.of(
            "full_or_overflowing",
            "damaged",
            "missing",
            "odor_or_pests",
            "illegal_dumping",
            "unsafe_or_obstructing",
            "missed_service",
            "other"
    );
    private static final Set<String> ASSET_SCOPES = Set.of(
            SCOPE_PUBLIC,
            SCOPE_PRIVATE_PROPERTY,
            SCOPE_UNKNOWN
    );

    public enum ValidationResult {
        VALID,
        NO_KIND,
        UNSUPPORTED_KIND,
        NO_CATEGORY,
        UNSUPPORTED_CATEGORY,
        NO_COMMENT,
        COMMENT_TOO_SHORT,
        NO_ADDRESS,
        UNSUPPORTED_ASSET_SCOPE,
        PARTIAL_COORDINATES,
        INVALID_COORDINATES,
        FIELD_TOO_LONG
    }

    private final String kind;
    private final String category;
    private final String comment;
    private final String address;
    private final String assetScope;
    private final Double latitude;
    private final Double longitude;

    private TrashCanSubmissionDraft(Builder builder) {
        kind = clean(builder.kind);
        category = clean(builder.category);
        comment = clean(builder.comment);
        address = clean(builder.address);
        String requestedScope = clean(builder.assetScope);
        assetScope = KIND_PUBLIC_COMMENT.equals(kind)
                ? SCOPE_PUBLIC
                : (requestedScope.isEmpty() ? SCOPE_PUBLIC : requestedScope);
        latitude = builder.latitude;
        longitude = builder.longitude;
    }

    public ValidationResult validate() {
        if (kind.isEmpty()) {
            return ValidationResult.NO_KIND;
        }
        if (!KIND_PUBLIC_COMMENT.equals(kind)
                && !KIND_PRIVATE_COMPLAINT.equals(kind)) {
            return ValidationResult.UNSUPPORTED_KIND;
        }
        if (category.isEmpty()) {
            return ValidationResult.NO_CATEGORY;
        }
        Set<String> allowed = KIND_PUBLIC_COMMENT.equals(kind)
                ? PUBLIC_COMMENT_CATEGORIES
                : PRIVATE_COMPLAINT_CATEGORIES;
        if (!allowed.contains(category)) {
            return ValidationResult.UNSUPPORTED_CATEGORY;
        }
        if (comment.isEmpty()) {
            return ValidationResult.NO_COMMENT;
        }
        if (comment.length() < 3) {
            return ValidationResult.COMMENT_TOO_SHORT;
        }
        if (address.isEmpty()) {
            return ValidationResult.NO_ADDRESS;
        }
        if (!ASSET_SCOPES.contains(assetScope)) {
            return ValidationResult.UNSUPPORTED_ASSET_SCOPE;
        }
        if ((latitude == null) != (longitude == null)) {
            return ValidationResult.PARTIAL_COORDINATES;
        }
        if (latitude != null
                && (!Double.isFinite(latitude)
                || latitude < -90.0
                || latitude > 90.0
                || !Double.isFinite(longitude)
                || longitude < -180.0
                || longitude > 180.0)) {
            return ValidationResult.INVALID_COORDINATES;
        }
        if (comment.length() > 2_000 || address.length() > 500) {
            return ValidationResult.FIELD_TOO_LONG;
        }
        return ValidationResult.VALID;
    }

    public JSONObject toJson(String submissionId, String versionName)
            throws JSONException {
        if (validate() != ValidationResult.VALID) {
            throw new IllegalStateException(
                    "Cannot serialize an invalid trash-can submission."
            );
        }
        if (submissionId == null || submissionId.trim().isEmpty()) {
            throw new IllegalArgumentException("submissionId is required.");
        }
        JSONObject payload = new JSONObject();
        payload.put("submission_id", submissionId);
        payload.put("kind", kind);
        payload.put("categories", new JSONArray().put(category));
        payload.put("comment", comment);
        payload.put("address", address);
        if (latitude != null) {
            payload.put("latitude", latitude);
            payload.put("longitude", longitude);
        }
        payload.put("asset_scope", assetScope);
        payload.put("app_version", "android-" + clean(versionName));
        payload.put("submission_source", "android");
        return payload;
    }

    public String getAssetScope() {
        return assetScope;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public static final class Builder {
        private String kind;
        private String category;
        private String comment;
        private String address;
        private String assetScope = SCOPE_PUBLIC;
        private Double latitude;
        private Double longitude;

        public Builder setKind(String value) {
            kind = value;
            return this;
        }

        public Builder setCategory(String value) {
            category = value;
            return this;
        }

        public Builder setComment(String value) {
            comment = value;
            return this;
        }

        public Builder setAddress(String value) {
            address = value;
            return this;
        }

        public Builder setAssetScope(String value) {
            assetScope = value;
            return this;
        }

        public Builder setCoordinates(Double lat, Double lon) {
            latitude = lat;
            longitude = lon;
            return this;
        }

        public TrashCanSubmissionDraft build() {
            return new TrashCanSubmissionDraft(this);
        }
    }
}
