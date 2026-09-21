package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.columbiawalks.app.data.ReportDatabaseHelper;
import org.columbiawalks.app.data.SafetyReport;
import org.json.JSONException;

import java.io.IOException;

public final class ReportSubmissionWorker extends Worker {
    static final String INPUT_REPORT_ID = "report_id";
    private static final int MAX_AUTOMATIC_ATTEMPTS = 8;

    public ReportSubmissionWorker(
            @NonNull Context context,
            @NonNull WorkerParameters workerParameters
    ) {
        super(context, workerParameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        long reportId = getInputData().getLong(INPUT_REPORT_ID, -1);
        if (reportId < 1) {
            return Result.failure();
        }

        try (ReportDatabaseHelper database =
                     new ReportDatabaseHelper(getApplicationContext())) {
            SafetyReport report = database.getReport(reportId);
            if (report == null || report.isSubmitted()) {
                return Result.success();
            }
            boolean officialEmailAuthorized =
                    DirectusPayloadMapper.shouldAuthorizeOfficialEmail(report);

            long attemptTime = System.currentTimeMillis();
            database.updateSubmission(
                    reportId,
                    SafetyReport.STATUS_SUBMITTING,
                    null,
                    null,
                    attemptTime
            );

            try {
                DirectusReportClient.SubmissionResponse response =
                        new DirectusReportClient().submit(report);
                if (response.isSuccessful() || response.isDuplicate()) {
                    String officialEmailResult = null;
                    String officialEmailDestinationMode = null;
                    if (report.isOfficialEmailAuthorized()) {
                        officialEmailResult = officialEmailAuthorized
                                ? response.getOfficialEmailResult()
                                : SafetyReport.OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE;
                        if (officialEmailAuthorized) {
                            officialEmailDestinationMode =
                                    response.getOfficialEmailDestinationMode();
                        }
                    }
                    database.updateSubmission(
                            reportId,
                            SafetyReport.STATUS_SUBMITTED,
                            response.getRemoteId(report.getClientReportId()),
                            null,
                            attemptTime,
                            officialEmailResult,
                            officialEmailDestinationMode
                    );
                    return Result.success();
                }

                String error = response.getStatusCode() == 404
                        ? "Directus report endpoint is not available (HTTP 404)."
                        : "Server rejected the report (HTTP "
                        + response.getStatusCode() + ").";
                if (response.isRetryable()) {
                    return retryOrStop(database, reportId, error, attemptTime);
                }

                database.updateSubmission(
                        reportId,
                        SafetyReport.STATUS_FAILED,
                        null,
                        error,
                        attemptTime
                );
                return Result.failure();
            } catch (DirectusReportClient.PhotoUnavailableException exception) {
                database.updateSubmission(
                        reportId,
                        SafetyReport.STATUS_FAILED,
                        null,
                        "The attached photo is no longer available on this device.",
                        attemptTime
                );
                return Result.failure();
            } catch (IOException exception) {
                return retryOrStop(
                        database,
                        reportId,
                        "Could not reach the report server.",
                        attemptTime
                );
            } catch (JSONException exception) {
                database.updateSubmission(
                        reportId,
                        SafetyReport.STATUS_FAILED,
                        null,
                        "The report could not be converted for submission.",
                        attemptTime
                );
                return Result.failure();
            }
        }
    }

    private Result retryOrStop(
            ReportDatabaseHelper database,
            long reportId,
            String error,
            long attemptTime
    ) {
        boolean attemptsRemain = getRunAttemptCount() + 1
                < MAX_AUTOMATIC_ATTEMPTS;
        database.updateSubmission(
                reportId,
                attemptsRemain
                        ? SafetyReport.STATUS_PENDING
                        : SafetyReport.STATUS_FAILED,
                null,
                error,
                attemptTime
        );
        return attemptsRemain ? Result.retry() : Result.failure();
    }
}
