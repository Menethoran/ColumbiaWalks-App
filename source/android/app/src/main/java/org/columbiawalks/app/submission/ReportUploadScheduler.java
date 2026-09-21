package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.columbiawalks.app.data.ReportDatabaseHelper;

import java.util.concurrent.TimeUnit;

public final class ReportUploadScheduler {
    public static final String TAG_REPORT_UPLOAD = "columbiawalks-report-upload";
    private static final String UNIQUE_WORK_PREFIX = "submit-safety-report-";

    private ReportUploadScheduler() {
    }

    public static void enqueue(Context context, long reportId) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        Data input = new Data.Builder()
                .putLong(ReportSubmissionWorker.INPUT_REPORT_ID, reportId)
                .build();
        OneTimeWorkRequest request =
                new OneTimeWorkRequest.Builder(ReportSubmissionWorker.class)
                        .setConstraints(constraints)
                        .setInputData(input)
                        .setBackoffCriteria(
                                BackoffPolicy.EXPONENTIAL,
                                30,
                                TimeUnit.SECONDS
                        )
                        .addTag(TAG_REPORT_UPLOAD)
                        .build();

        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork(
                        UNIQUE_WORK_PREFIX + reportId,
                        ExistingWorkPolicy.KEEP,
                        request
                );
    }

    public static void enqueuePending(Context context) {
        try (ReportDatabaseHelper database =
                     new ReportDatabaseHelper(context.getApplicationContext())) {
            for (long reportId : database.getPendingReportIds()) {
                enqueue(context, reportId);
            }
        }
    }

    public static void cancel(Context context, long reportId) {
        WorkManager.getInstance(context.getApplicationContext())
                .cancelUniqueWork(UNIQUE_WORK_PREFIX + reportId);
    }
}

