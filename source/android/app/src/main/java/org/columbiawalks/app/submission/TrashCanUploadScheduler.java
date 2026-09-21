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

public final class TrashCanUploadScheduler {
    public static final String TAG_TRASH_CAN_UPLOAD =
            "columbiawalks-trash-can-upload";
    private static final String UNIQUE_WORK_PREFIX = "submit-trash-can-";

    private TrashCanUploadScheduler() {
    }

    public static void enqueue(Context context, String submissionId) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        Data input = new Data.Builder()
                .putString(
                        TrashCanSubmissionWorker.INPUT_SUBMISSION_ID,
                        submissionId
                )
                .build();
        OneTimeWorkRequest request =
                new OneTimeWorkRequest.Builder(
                        TrashCanSubmissionWorker.class
                )
                        .setConstraints(constraints)
                        .setInputData(input)
                        .setBackoffCriteria(
                                BackoffPolicy.EXPONENTIAL,
                                30,
                                TimeUnit.SECONDS
                        )
                        .addTag(TAG_TRASH_CAN_UPLOAD)
                        .build();

        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork(
                        UNIQUE_WORK_PREFIX + submissionId,
                        // A terminal failed WorkRequest intentionally leaves
                        // its no-backup JSON queued. REPLACE lets launch-time
                        // enqueuePending create a fresh retry chain.
                        ExistingWorkPolicy.REPLACE,
                        request
                );
    }

    public static void enqueuePending(Context context) {
        for (String submissionId
                : TrashCanQueueStore.pendingIds(context)) {
            enqueue(context, submissionId);
        }
    }
}
