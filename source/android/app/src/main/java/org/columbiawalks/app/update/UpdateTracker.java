package org.columbiawalks.app.update;

import android.content.Context;
import android.util.Log;

import org.columbiawalks.app.BuildConfig;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

final class UpdateTracker {
    private static final String LOG_TAG = "ColumbiaWalksUpdate";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    private UpdateTracker() {}

    static void record(
            Context context,
            String eventType,
            ReleaseMetadata release,
            String errorCode) {
        Context appContext = context.getApplicationContext();
        EXECUTOR.execute(() -> send(
                appContext,
                eventType,
                release,
                release == null ? null : release.versionCode,
                release == null ? null : release.versionName,
                errorCode));
    }

    static void recordInstalled(
            Context context,
            int targetVersionCode,
            String targetVersionName) {
        Context appContext = context.getApplicationContext();
        EXECUTOR.execute(() -> send(
                appContext,
                "installed",
                null,
                targetVersionCode,
                targetVersionName,
                null));
    }

    private static void send(
            Context context,
            String eventType,
            ReleaseMetadata release,
            Integer targetVersionCode,
            String targetVersionName,
            String errorCode) {
        HttpsURLConnection connection = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("event_id", UUID.randomUUID().toString());
            payload.put("event_type", eventType);
            payload.put("from_version_code", BuildConfig.VERSION_CODE);
            payload.put("from_version_name", BuildConfig.VERSION_NAME);
            payload.put("occurred_at", Instant.now().toString());
            payload.put("platform", "android");
            if (targetVersionCode != null && targetVersionCode > 0) {
                payload.put("target_version_code", targetVersionCode);
            }
            if (targetVersionName != null && !targetVersionName.isBlank()) {
                payload.put("target_version_name", targetVersionName);
            }
            if (errorCode != null && !errorCode.isBlank()) {
                payload.put("error_code", errorCode);
            }

            URL endpoint = new URL(BuildConfig.UPDATE_EVENT_ENDPOINT);
            if (!"https".equalsIgnoreCase(endpoint.getProtocol())) return;
            connection = (HttpsURLConnection) endpoint.openConnection();
            connection.setConnectTimeout(6_000);
            connection.setReadTimeout(6_000);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty(
                    "User-Agent", "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME);
            connection.setDoOutput(true);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                Log.w(LOG_TAG, "Update event was rejected with status " + status);
            }
        } catch (Exception exception) {
            Log.d(LOG_TAG, "Update event could not be sent", exception);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}

