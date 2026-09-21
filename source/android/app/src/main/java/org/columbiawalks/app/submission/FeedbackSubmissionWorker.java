package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

public final class FeedbackSubmissionWorker extends Worker {
    static final String INPUT_FEEDBACK_ID = "feedback_id";
    private static final int MAX_AUTOMATIC_ATTEMPTS = 8;

    public FeedbackSubmissionWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParameters
    ) {
        super(context, workerParameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        String feedbackId = getInputData().getString(INPUT_FEEDBACK_ID);
        if (feedbackId == null || feedbackId.isEmpty()) {
            return Result.failure();
        }

        final String payload;
        try {
            payload = FeedbackQueueStore.load(
                    getApplicationContext(),
                    feedbackId
            );
        } catch (IOException | IllegalArgumentException exception) {
            return Result.failure();
        }
        if (payload == null) {
            return Result.success();
        }

        try {
            JSONObject parsed = new JSONObject(payload);
            if (!feedbackId.equals(parsed.optString("feedback_id"))) {
                FeedbackQueueStore.delete(getApplicationContext(), feedbackId);
                return Result.failure();
            }
        } catch (JSONException exception) {
            FeedbackQueueStore.delete(getApplicationContext(), feedbackId);
            return Result.failure();
        }

        try {
            FeedbackSubmissionClient.SubmissionResponse response =
                    new FeedbackSubmissionClient().submit(payload);
            if (response.isSuccessful()) {
                FeedbackQueueStore.delete(getApplicationContext(), feedbackId);
                return Result.success();
            }
            if (response.isRetryable()) {
                return retryOrStop();
            }
            FeedbackQueueStore.delete(getApplicationContext(), feedbackId);
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

