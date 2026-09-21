package org.columbiawalks.app.walking;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

public final class WalkingMetricSubmissionWorker extends Worker {
    static final String INPUT_METRIC_ID = "metric_id";
    private static final int MAX_AUTOMATIC_ATTEMPTS = 8;

    public WalkingMetricSubmissionWorker(
            @NonNull Context context,
            @NonNull WorkerParameters parameters
    ) {
        super(context, parameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        String metricId = getInputData().getString(INPUT_METRIC_ID);
        if (metricId == null || metricId.isEmpty()) return Result.failure();
        final String payload;
        try {
            payload = WalkingMetricQueueStore.load(getApplicationContext(), metricId);
        } catch (IOException | IllegalArgumentException exception) {
            return Result.failure();
        }
        if (payload == null) return Result.success();
        try {
            if (!metricId.equals(new JSONObject(payload).optString("metric_id"))) {
                WalkingMetricQueueStore.delete(getApplicationContext(), metricId);
                return Result.failure();
            }
        } catch (JSONException exception) {
            WalkingMetricQueueStore.delete(getApplicationContext(), metricId);
            return Result.failure();
        }
        try {
            WalkingMetricSubmissionClient.Response response =
                    new WalkingMetricSubmissionClient().submit(payload);
            if (response.isSuccessful()) {
                WalkingMetricQueueStore.delete(getApplicationContext(), metricId);
                return Result.success();
            }
            if (response.isRetryable()) return retryOrStop();
            WalkingMetricQueueStore.delete(getApplicationContext(), metricId);
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

