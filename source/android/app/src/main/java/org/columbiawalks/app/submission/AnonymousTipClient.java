package org.columbiawalks.app.submission;

import org.columbiawalks.app.BuildConfig;
import org.json.JSONObject;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class AnonymousTipClient {
    private AnonymousTipClient() { }

    public static String submit(String payload) throws Exception {
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.ANONYMOUS_TIP_ENDPOINT).openConnection();
        connection.setRequestMethod("POST");
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(25_000);
        connection.setUseCaches(false);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        connection.setFixedLengthStreamingMode(bytes.length);
        try {
            try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            int code = connection.getResponseCode();
            if (code != 200 && code != 201) throw new IOException("test_intake_unconfirmed");
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[2048];
                int count;
                while ((count = input.read(chunk)) != -1) {
                    if (buffer.size() + count > 16_384) throw new IOException("test_receipt_too_large");
                    buffer.write(chunk, 0, count);
                }
                byte[] response = buffer.toByteArray();
                return verifiedReference(payload, new String(response, StandardCharsets.UTF_8));
            }
        } finally { connection.disconnect(); }
    }

    public static String verifiedReference(String payload, String response) throws Exception {
        JSONObject expected = new JSONObject(payload);
        JSONObject data = new JSONObject(response).getJSONObject("data");
        String id = expected.getString("submission_id");
        String reference = "[TEST] CW-TIP-" + id;
        if (!id.equals(data.getString("submission_id"))
                || !Boolean.TRUE.equals(data.get("test_mode"))
                || !Boolean.FALSE.equals(data.get("police_contacted"))
                || !"test_received".equals(data.getString("status"))
                || !"private_columbiawalks_test_intake".equals(data.getString("destination"))
                || !reference.equals(data.getString("reference"))) {
            throw new IOException("invalid_test_receipt");
        }
        return reference;
    }
}
