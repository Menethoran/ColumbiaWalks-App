package org.columbiawalks.app.submission;

import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.data.SafetyReport;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

final class DirectusReportClient {
    private static final int CONNECT_TIMEOUT_MILLIS = 15_000;
    private static final int READ_TIMEOUT_MILLIS = 20_000;
    private static final int MAX_RESPONSE_BYTES = 16_384;

    SubmissionResponse submit(SafetyReport report)
            throws IOException, JSONException {
        URL endpoint = new URL(BuildConfig.REPORT_ENDPOINT);
        HttpURLConnection connection =
                (HttpURLConnection) endpoint.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        connection.setReadTimeout(READ_TIMEOUT_MILLIS);
        connection.setInstanceFollowRedirects(false);
        connection.setDoOutput(true);
        String boundary = "ColumbiaWalks-" + UUID.randomUUID();
        connection.setRequestProperty(
                "Content-Type",
                "multipart/form-data; boundary=" + boundary
        );
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty(
                "User-Agent",
                "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME
        );

        connection.setChunkedStreamingMode(8192);

        try {
            try (OutputStream output = connection.getOutputStream()) {
                writeTextPart(
                        output,
                        boundary,
                        "report",
                        "application/json; charset=UTF-8",
                        DirectusPayloadMapper.toJson(report).toString()
                );
                if (report.hasPhoto()) {
                    writePhotoPart(output, boundary, report);
                }
                writeUtf8(output, "--" + boundary + "--\r\n");
            }

            int statusCode = connection.getResponseCode();
            String body = readResponseBody(connection, statusCode);
            return new SubmissionResponse(statusCode, body);
        } finally {
            connection.disconnect();
        }
    }

    private void writeTextPart(
            OutputStream output,
            String boundary,
            String name,
            String contentType,
            String value
    ) throws IOException {
        writeUtf8(output, "--" + boundary + "\r\n");
        writeUtf8(
                output,
                "Content-Disposition: form-data; name=\"" + name + "\"\r\n"
        );
        writeUtf8(output, "Content-Type: " + contentType + "\r\n\r\n");
        writeUtf8(output, value);
        writeUtf8(output, "\r\n");
    }

    private void writePhotoPart(
            OutputStream output,
            String boundary,
            SafetyReport report
    ) throws IOException {
        File photo = new File(report.getPhotoPath());
        if (!photo.isFile()) {
            throw new PhotoUnavailableException();
        }

        writeUtf8(output, "--" + boundary + "\r\n");
        writeUtf8(
                output,
                "Content-Disposition: form-data; name=\"photo\"; filename=\""
                        + "columbiawalks-" + report.getClientReportId()
                        + ".jpg\"\r\n"
        );
        writeUtf8(output, "Content-Type: image/jpeg\r\n\r\n");
        try (InputStream input = new FileInputStream(photo)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
        }
        writeUtf8(output, "\r\n");
    }

    private void writeUtf8(OutputStream output, String value)
            throws IOException {
        output.write(value.getBytes(StandardCharsets.UTF_8));
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

        int getStatusCode() {
            return statusCode;
        }

        boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }

        boolean isDuplicate() {
            return body.contains("RECORD_NOT_UNIQUE");
        }

        boolean isRetryable() {
            return statusCode == 404
                    || statusCode == 408
                    || statusCode == 425
                    || statusCode == 429
                    || statusCode >= 500;
        }

        String getRemoteId(String fallbackId) {
            try {
                JSONObject root = new JSONObject(body);
                JSONObject data = root.optJSONObject("data");
                if (data != null) {
                    String id = data.optString("id", "");
                    if (!id.isEmpty()) {
                        return id;
                    }
                }
            } catch (JSONException ignored) {
                // The app-generated UUID remains the authoritative idempotency key.
            }
            return fallbackId;
        }

        String getOfficialEmailResult() {
            try {
                JSONObject root = new JSONObject(body);
                JSONObject officialEmail = root.optJSONObject("official_email");
                if (officialEmail == null) {
                    return SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE;
                }
                String overall = officialEmail.optString("status", "");
                if (SafetyReport.OFFICIAL_EMAIL_RESULT_DEFERRED.equals(overall)) {
                    return SafetyReport.OFFICIAL_EMAIL_RESULT_DEFERRED;
                }
                if (SafetyReport.OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE.equals(overall)) {
                    return SafetyReport.OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE;
                }
                if (!"recorded".equals(overall)) {
                    return SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE;
                }

                JSONArray deliveries = officialEmail.optJSONArray("deliveries");
                if (deliveries == null || deliveries.length() == 0) {
                    return SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE;
                }
                String result = null;
                for (int index = 0; index < deliveries.length(); index++) {
                    JSONObject delivery = deliveries.optJSONObject(index);
                    String status = delivery == null
                            ? null
                            : normalizedOfficialEmailStatus(
                            delivery.optString("status", "")
                    );
                    if (status == null) {
                        return SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE;
                    }
                    if (result == null) {
                        result = status;
                    } else if (!result.equals(status)) {
                        return SafetyReport.OFFICIAL_EMAIL_RESULT_MIXED;
                    }
                }
                return result == null
                        ? SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE
                        : result;
            } catch (JSONException ignored) {
                return SafetyReport.OFFICIAL_EMAIL_RESULT_UNAVAILABLE;
            }
        }

        String getOfficialEmailDestinationMode() {
            try {
                JSONObject root = new JSONObject(body);
                JSONObject officialEmail = root.optJSONObject("official_email");
                if (officialEmail == null) {
                    return null;
                }
                String value = officialEmail.optString("destination_mode", "");
                if (value.isEmpty()) {
                    value = officialEmail.optString("recipient_mode", "");
                }
                if (SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST.equals(value)) {
                    return SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST;
                }
                if (SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL.equals(value)) {
                    return SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL;
                }
                return null;
            } catch (JSONException ignored) {
                return null;
            }
        }

        private String normalizedOfficialEmailStatus(String value) {
            switch (value) {
                case SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_REVIEW:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_DISABLED:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_BLOCKED:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_HELD_CAP:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_RETRY:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_PREPARING:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_SENDING:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_SENT:
                case SafetyReport.OFFICIAL_EMAIL_RESULT_UNCERTAIN:
                    return value;
                default:
                    return null;
            }
        }
    }

    static final class PhotoUnavailableException extends IOException {
        PhotoUnavailableException() {
            super("The selected photo is no longer available.");
        }
    }
}
