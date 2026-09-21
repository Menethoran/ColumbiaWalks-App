package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.columbiawalks.app.domain.TrashCanSubmissionDraft;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

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

        try {
            JSONObject parsed = new JSONObject(payload);
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
                    new TrashCanSubmissionClient().submit(payload);
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
            TrashCanQueueStore.delete(getApplicationContext(), submissionId);
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
