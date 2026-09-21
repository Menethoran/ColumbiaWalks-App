package org.columbiawalks.app.walking;

import android.content.Context;

import org.columbiawalks.app.BuildConfig;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

public final class WalkingMetricPayload {
    private WalkingMetricPayload() {
    }

    public static void queue(
            Context context,
            Instant periodStart,
            Instant periodEnd,
            double distanceMeters,
            long durationSeconds,
            int activityCount,
            String source
    ) throws IOException {
        String metricId = UUID.randomUUID().toString();
        try {
            JSONObject payload = new JSONObject();
            payload.put("metric_id", metricId);
            payload.put("period_start", periodStart.toString());
            payload.put("period_end", periodEnd.toString());
            payload.put("distance_meters", Math.max(0, distanceMeters));
            payload.put("duration_seconds", Math.max(0, durationSeconds));
            payload.put("activity_count", Math.max(1, activityCount));
            payload.put("source", source);
            payload.put("app_version", BuildConfig.VERSION_NAME);
            payload.put("user_consent", true);
            WalkingMetricQueueStore.save(context, metricId, payload.toString());
            WalkingMetricUploadScheduler.enqueue(context, metricId);
        } catch (JSONException exception) {
            throw new IOException("The walking summary could not be encoded.", exception);
        }
    }
}

