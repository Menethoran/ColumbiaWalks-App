package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.columbiawalks.app.domain.TrashCanSubmissionDraft;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.File;

public final class TrashCanSubmissionWorker extends Worker {
    static final String INPUT_SUBMISSION_ID = "submission_id";
    private static final int MAX_AUTOMATIC_ATTEMPTS = 8;

    public TrashCanSubmissionWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParameters
    ) {
        super(context, workerParameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        String submissionId = getInputData().getString(INPUT_SUBMISSION_ID);
        if (submissionId == null || submissionId.isEmpty()) {
            return Result.failure();
        }

        final String payload;
        try {
            payload = TrashCanQueueStore.load(
                    getApplicationContext(),
                    submissionId
            );
        } catch (IOException | IllegalArgumentException exception) {
            return Result.failure();
        }
        if (payload == null) {
            return Result.success();
        }

        final String submissionPayload;
        final File photo;
        try {
            JSONObject entry = new JSONObject(payload);
            JSONObject parsed = entry.optJSONObject("submission");
            if (parsed == null) parsed = entry; // Existing text-only queue entries.
            submissionPayload = parsed.toString();
            photo = entry.optBoolean("has_photo", false)
                    ? TrashCanQueueStore.photoFile(getApplicationContext(), submissionId) : null;
            if (photo != null && !photo.isFile()) return retryOrStop();
            String kind = parsed.optString("kind");
            boolean knownKind = TrashCanSubmissionDraft.KIND_PUBLIC_COMMENT
                    .equals(kind)
                    || TrashCanSubmissionDraft.KIND_PRIVATE_COMPLAINT
                    .equals(kind);
            if (!submissionId.equals(parsed.optString("submission_id"))
                    || !knownKind) {
                TrashCanQueueStore.delete(
                        getApplicationContext(),
                        submissionId
                );
                return Result.failure();
            }
        } catch (JSONException exception) {
            TrashCanQueueStore.delete(getApplicationContext(), submissionId);
            return Result.failure();
        }

        try {
            TrashCanSubmissionClient.SubmissionResponse response =
                    new TrashCanSubmissionClient().submit(submissionPayload, photo);
            if (response.isSuccessful()) {
                TrashCanQueueStore.delete(
                        getApplicationContext(),
                        submissionId
                );
                return Result.success();
            }
            if (response.isRetryable()) {
                return retryOrStop();
            }
            // Keep an unaccepted submission locally, including its photo.
            return Result.failure();
        } catch (IOException exception) {
            return retryOrStop();
        }
    }

    private Result retryOrStop() {
        return getRunAttemptCount() + 1 < MAX_AUTOMATIC_ATTEMPTS
                ? Result.retry()
                : Result.failure();
    }
}
