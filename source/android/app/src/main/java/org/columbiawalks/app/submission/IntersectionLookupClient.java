package org.columbiawalks.app.submission;

import org.columbiawalks.app.BuildConfig;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class IntersectionLookupClient {
    private static final int MAX_RESPONSE_BYTES = 16_384;

    public JSONObject lookup(double latitude, double longitude)
            throws IOException, JSONException {
        String endpoint = BuildConfig.REPORT_ENDPOINT.replace(
                "/reports",
                "/intersection"
        );
        String query = String.format(
                Locale.US,
                "%s?latitude=%.7f&longitude=%.7f",
                endpoint,
                latitude,
                longitude
        );
        HttpURLConnection connection =
                (HttpURLConnection) new URL(query).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(18_000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty(
                "User-Agent",
                "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME
        );

        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                return null;
            }
            String response = read(connection.getInputStream());
            JSONObject data = new JSONObject(response).optJSONObject("data");
            return data == null ? null : data;
        } finally {
            connection.disconnect();
        }
    }

    private String read(InputStream stream) throws IOException {
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
}

