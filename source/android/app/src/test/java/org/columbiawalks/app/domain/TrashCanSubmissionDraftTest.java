package org.columbiawalks.app.domain;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.util.Set;

public class TrashCanSubmissionDraftTest {
    @Test
    public void categoryContractsAreExact() {
        assertEquals(
                Set.of(
                        "clean_well_maintained",
                        "needs_cleaning",
                        "full_or_overflowing",
                        "damaged",
                        "hard_to_access",
                        "poor_location",
                        "request_new_can",
                        "other"
                ),
                TrashCanSubmissionDraft.PUBLIC_COMMENT_CATEGORIES
        );
        assertEquals(
                Set.of(
                        "full_or_overflowing",
                        "damaged",
                        "missing",
                        "odor_or_pests",
                        "illegal_dumping",
                        "unsafe_or_obstructing",
                        "missed_service",
                        "other"
                ),
                TrashCanSubmissionDraft.PRIVATE_COMPLAINT_CATEGORIES
        );
    }

    @Test
    public void publicCommentForcesPublicAssetScope() throws Exception {
        TrashCanSubmissionDraft draft = validPublicBuilder()
                .setAssetScope(TrashCanSubmissionDraft.SCOPE_PRIVATE_PROPERTY)
                .build();

        assertEquals(
                TrashCanSubmissionDraft.SCOPE_PUBLIC,
                draft.getAssetScope()
        );
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult.VALID,
                draft.validate()
        );
        JSONObject json = draft.toJson(
                "8c7031d4-f883-4c74-a865-d2b22009bcf8",
                "3.16.0"
        );
        assertEquals("public_comment", json.getString("kind"));
        assertEquals("public", json.getString("asset_scope"));
        assertEquals(
                "clean_well_maintained",
                json.getJSONArray("categories").getString(0)
        );
        assertEquals("android-3.16.0", json.getString("app_version"));
        assertEquals("android", json.getString("submission_source"));
        assertFalse(json.has("latitude"));
        assertFalse(json.has("longitude"));
    }

    @Test
    public void privateComplaintIncludesOptionalConfirmedCoordinates()
            throws Exception {
        TrashCanSubmissionDraft draft = new TrashCanSubmissionDraft.Builder()
                .setKind(TrashCanSubmissionDraft.KIND_PRIVATE_COMPLAINT)
                .setCategory("illegal_dumping")
                .setComment("Bags were left beside the can.")
                .setAddress("400 block of Locust Street")
                .setAssetScope(TrashCanSubmissionDraft.SCOPE_UNKNOWN)
                .setCoordinates(40.0337, -76.5044)
                .build();

        assertEquals(
                TrashCanSubmissionDraft.ValidationResult.VALID,
                draft.validate()
        );
        JSONObject json = draft.toJson(
                "8c7031d4-f883-4c74-a865-d2b22009bcf8",
                "3.16.0"
        );
        assertEquals("private_complaint", json.getString("kind"));
        assertEquals("unknown", json.getString("asset_scope"));
        assertEquals(40.0337, json.getDouble("latitude"), 0.000001);
        assertEquals(-76.5044, json.getDouble("longitude"), 0.000001);
    }

    @Test
    public void rejectsCategoryFromWrongModeAndPartialCoordinates() {
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult
                        .UNSUPPORTED_CATEGORY,
                validPublicBuilder()
                        .setCategory("illegal_dumping")
                        .build()
                        .validate()
        );
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult
                        .PARTIAL_COORDINATES,
                validPublicBuilder()
                        .setCoordinates(40.0, null)
                        .build()
                        .validate()
        );
    }

    @Test
    public void enforcesServerCommentLengthContract() {
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult.COMMENT_TOO_SHORT,
                validPublicBuilder().setComment("ab").build().validate()
        );
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult.FIELD_TOO_LONG,
                validPublicBuilder()
                        .setComment("x".repeat(2_001))
                        .build()
                        .validate()
        );
        assertEquals(
                TrashCanSubmissionDraft.ValidationResult.VALID,
                validPublicBuilder().setComment("abc").build().validate()
        );
    }

    private static TrashCanSubmissionDraft.Builder validPublicBuilder() {
        return new TrashCanSubmissionDraft.Builder()
                .setKind(TrashCanSubmissionDraft.KIND_PUBLIC_COMMENT)
                .setCategory("clean_well_maintained")
                .setComment("This can is clean and easy to use.")
                .setAddress("Locust Street Park")
                .setAssetScope(TrashCanSubmissionDraft.SCOPE_PUBLIC);
    }
}
