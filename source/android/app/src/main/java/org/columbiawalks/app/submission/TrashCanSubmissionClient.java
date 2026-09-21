package org.columbiawalks.app.submission;

import org.columbiawalks.app.BuildConfig;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class TrashCanSubmissionClient {
    private static final int CONNECT_TIMEOUT_MILLIS = 15_000;
    private static final int READ_TIMEOUT_MILLIS = 20_000;
    private static final int MAX_RESPONSE_BYTES = 16_384;

    SubmissionResponse submit(String payload) throws IOException {
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        URL endpoint = new URL(BuildConfig.TRASH_CAN_ENDPOINT);
        HttpURLConnection connection =
                (HttpURLConnection) endpoint.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        connection.setReadTimeout(READ_TIMEOUT_MILLIS);
        connection.setInstanceFollowRedirects(false);
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(bytes.length);
        connection.setRequestProperty(
                "Content-Type",
                "application/json; charset=UTF-8"
        );
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty(
                "User-Agent",
                "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME
        );

        try {
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }
            int statusCode = connection.getResponseCode();
            return new SubmissionResponse(
                    statusCode,
                    readResponseBody(connection, statusCode)
            );
        } finally {
            connection.disconnect();
        }
    }

    private String readResponseBody(
            HttpURLConnection connection,
            int statusCode
    ) throws IOException {
        InputStream stream = statusCode >= 200 && statusCode < 400
                ? connection.getInputStream()
                : connection.getErrorStream();
        if (stream == null) {
            return "";
        }
        try (InputStream input = stream;
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[2048];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1
                    && total < MAX_RESPONSE_BYTES) {
                int allowed = Math.min(count, MAX_RESPONSE_BYTES - total);
                output.write(buffer, 0, allowed);
                total += allowed;
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static final class SubmissionResponse {
        private final int statusCode;
        private final String body;

        SubmissionResponse(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }

        boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }

        boolean isRetryable() {
            return statusCode == 404
                    || statusCode == 408
                    || statusCode == 425
                    || statusCode == 429
                    || statusCode >= 500;
        }

        @SuppressWarnings("unused")
        String getBody() {
            return body;
        }
    }
}
