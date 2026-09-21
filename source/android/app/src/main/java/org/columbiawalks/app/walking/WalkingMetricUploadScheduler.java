package org.columbiawalks.app.walking;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public final class WalkingMetricUploadScheduler {
    private static final String UNIQUE_WORK_PREFIX = "submit-walking-metric-";

    private WalkingMetricUploadScheduler() {
    }

    public static void enqueue(Context context, String metricId) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        Data input = new Data.Builder()
                .putString(WalkingMetricSubmissionWorker.INPUT_METRIC_ID, metricId)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(
                WalkingMetricSubmissionWorker.class
        )
                .setConstraints(constraints)
                .setInputData(input)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build();
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                UNIQUE_WORK_PREFIX + metricId,
                ExistingWorkPolicy.KEEP,
                request
        );
    }

    public static void enqueuePending(Context context) {
        for (String metricId : WalkingMetricQueueStore.pendingIds(context)) {
            enqueue(context, metricId);
        }
    }
}

