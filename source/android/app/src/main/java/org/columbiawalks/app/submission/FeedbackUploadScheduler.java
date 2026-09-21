package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public final class FeedbackUploadScheduler {
    public static final String TAG_FEEDBACK_UPLOAD =
            "columbiawalks-feedback-upload";
    private static final String UNIQUE_WORK_PREFIX = "submit-feedback-";

    private FeedbackUploadScheduler() {
    }

    public static void enqueue(Context context, String feedbackId) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        Data input = new Data.Builder()
                .putString(
                        FeedbackSubmissionWorker.INPUT_FEEDBACK_ID,
                        feedbackId
                )
                .build();
        OneTimeWorkRequest request =
                new OneTimeWorkRequest.Builder(FeedbackSubmissionWorker.class)
                        .setConstraints(constraints)
                        .setInputData(input)
                        .setBackoffCriteria(
                                BackoffPolicy.EXPONENTIAL,
                                30,
                                TimeUnit.SECONDS
                        )
                        .addTag(TAG_FEEDBACK_UPLOAD)
                        .build();

        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork(
                        UNIQUE_WORK_PREFIX + feedbackId,
                        ExistingWorkPolicy.KEEP,
                        request
                );
    }

    public static void enqueuePending(Context context) {
        for (String feedbackId : FeedbackQueueStore.pendingIds(context)) {
            enqueue(context, feedbackId);
        }
    }
}

