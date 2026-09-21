package org.columbiawalks.app.walking;

import org.columbiawalks.app.BuildConfig;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class WalkingMetricSubmissionClient {
    Response submit(String payload) throws IOException {
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        HttpURLConnection connection = (HttpURLConnection) new URL(
                BuildConfig.WALKING_METRIC_ENDPOINT
        ).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(20_000);
        connection.setInstanceFollowRedirects(false);
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(bytes.length);
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty(
                "User-Agent",
                "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME
        );
        try {
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }
            return new Response(connection.getResponseCode());
        } finally {
            connection.disconnect();
        }
    }

    static final class Response {
        private final int statusCode;

        Response(int statusCode) {
            this.statusCode = statusCode;
        }

        boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }

        boolean isRetryable() {
            return statusCode == 404 || statusCode == 408 || statusCode == 425
                    || statusCode == 429 || statusCode >= 500;
        }
    }
}

