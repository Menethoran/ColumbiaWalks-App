package org.columbiawalks.app.walking;

import android.content.Context;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.DistanceRecord;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.ExerciseSessionType;
import android.health.connect.datatypes.units.Length;
import android.os.Build;
import android.os.OutcomeReceiver;

import androidx.annotation.RequiresApi;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class HealthConnectImporter {
    public interface Callback {
        void onSuccess(Result result);
        void onError();
    }

    public static final class Result {
        public final Instant periodStart;
        public final Instant periodEnd;
        public final double distanceMeters;
        public final long durationSeconds;
        public final int activityCount;

        Result(
                Instant periodStart,
                Instant periodEnd,
                double distanceMeters,
                long durationSeconds,
                int activityCount
        ) {
            this.periodStart = periodStart;
            this.periodEnd = periodEnd;
            this.distanceMeters = distanceMeters;
            this.durationSeconds = durationSeconds;
            this.activityCount = activityCount;
        }
    }

    private HealthConnectImporter() {
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    public static void importWalkingSessions(
            Context context,
            Instant start,
            Instant end,
            Callback callback
    ) {
        HealthConnectManager manager = context.getSystemService(
                HealthConnectManager.class
        );
        if (manager == null) {
            callback.onError();
            return;
        }
        TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder()
                .setStartTime(start)
                .setEndTime(end)
                .build();
        ReadRecordsRequestUsingFilters<ExerciseSessionRecord> request =
                new ReadRecordsRequestUsingFilters.Builder<>(
                        ExerciseSessionRecord.class
                )
                        .setTimeRangeFilter(range)
                        .setAscending(true)
                        .setPageSize(500)
                        .build();
        manager.readRecords(
                request,
                context.getMainExecutor(),
                new OutcomeReceiver<ReadRecordsResponse<ExerciseSessionRecord>,
                        HealthConnectException>() {
                    @Override
                    public void onResult(
                            ReadRecordsResponse<ExerciseSessionRecord> response
                    ) {
                        List<ExerciseSessionRecord> walking = new ArrayList<>();
                        for (ExerciseSessionRecord session : response.getRecords()) {
                            if (session.getExerciseType()
                                    == ExerciseSessionType.EXERCISE_SESSION_TYPE_WALKING) {
                                walking.add(session);
                            }
                        }
                        aggregateSessions(
                                context,
                                manager,
                                walking,
                                0,
                                0,
                                0,
                                start,
                                end,
                                callback
                        );
                    }

                    @Override
                    public void onError(HealthConnectException error) {
                        callback.onError();
                    }
                }
        );
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private static void aggregateSessions(
            Context context,
            HealthConnectManager manager,
            List<ExerciseSessionRecord> sessions,
            int index,
            double distanceMeters,
            long durationSeconds,
            Instant periodStart,
            Instant periodEnd,
            Callback callback
    ) {
        if (index >= sessions.size()) {
            callback.onSuccess(new Result(
                    periodStart,
                    periodEnd,
                    distanceMeters,
                    durationSeconds,
                    sessions.size()
            ));
            return;
        }
        ExerciseSessionRecord session = sessions.get(index);
        TimeInstantRangeFilter sessionRange = new TimeInstantRangeFilter.Builder()
                .setStartTime(session.getStartTime())
                .setEndTime(session.getEndTime())
                .build();
        AggregateRecordsRequest<Length> request =
                new AggregateRecordsRequest.Builder<Length>(sessionRange)
                        .addAggregationType(DistanceRecord.DISTANCE_TOTAL)
                        .build();
        long sessionSeconds = Math.max(
                0,
                Duration.between(session.getStartTime(), session.getEndTime()).getSeconds()
        );
        manager.aggregate(
                request,
                context.getMainExecutor(),
                new OutcomeReceiver<AggregateRecordsResponse<Length>,
                        HealthConnectException>() {
                    @Override
                    public void onResult(AggregateRecordsResponse<Length> response) {
                        Length distance = response.get(DistanceRecord.DISTANCE_TOTAL);
                        aggregateSessions(
                                context,
                                manager,
                                sessions,
                                index + 1,
                                distanceMeters + (distance == null ? 0 : distance.getInMeters()),
                                durationSeconds + sessionSeconds,
                                periodStart,
                                periodEnd,
                                callback
                        );
                    }

                    @Override
                    public void onError(HealthConnectException error) {
                        callback.onError();
                    }
                }
        );
    }
}
