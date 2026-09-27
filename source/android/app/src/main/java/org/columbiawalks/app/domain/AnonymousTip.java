package org.columbiawalks.app.domain;

import org.json.JSONException;
import org.json.JSONObject;
import java.util.Map;
import java.util.UUID;

/** All user-entered content leaves the device only after mandatory test marking. */
public final class AnonymousTip {
    public static final String[] KEYS = {"subject", "observed_time", "location", "direction",
            "license_plate", "plate_state", "vehicle_description", "observation", "evidence_notes"};
    public static final int[] LIMITS = {128, 500, 500, 500, 500, 500, 500, 5000, 2000};
    private AnonymousTip() { }

    public static String plain(String value) {
        return (value == null ? "" : value).replaceAll("(?i)\\[TEST\\]", " ")
                .replaceAll("[\\x00-\\x1f\\x7f-\\x9f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\ufeff]", " ")
                .replaceAll("[\\s\\p{Z}]+", " ").trim();
    }

    public static String mark(String value) {
        String clean = plain(value);
        if (clean.isEmpty()) clean = "Not provided";
        return "[TEST] " + clean.replace(" ", " [TEST] ") + " [TEST]";
    }

    public static String validationError(Map<String, String> fields, boolean inactive, boolean testOnly) {
        if (!inactive || !testOnly) return "[TEST] Confirm both statements before submitting.";
        for (int i = 0; i < KEYS.length; i++) {
            String value = plain(fields.get(KEYS[i]));
            if ((i == 0 || i == 1 || i == 2 || i == 7) && value.isEmpty()) {
                return "[TEST] Complete all required fields.";
            }
            if (value.length() > LIMITS[i]) return "[TEST] Shorten " + KEYS[i].replace('_', ' ') + ".";
        }
        return null;
    }

    public static JSONObject payload(Map<String, String> fields, String version) throws JSONException {
        if (!version.matches("(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.0")) {
            throw new IllegalArgumentException("Only internal .0 builds can use test intake.");
        }
        String error = validationError(fields, true, true);
        if (error != null) throw new IllegalArgumentException(error);
        JSONObject marked = new JSONObject();
        for (String key : KEYS) marked.put(key, mark(fields.get(key)));
        return new JSONObject().put("submission_id", UUID.randomUUID().toString())
                .put("app_version", version).put("past_or_inactive_confirmed", true)
                .put("test_only_acknowledged", true).put("fields", marked);
    }

    public static String preview(JSONObject payload) throws JSONException {
        StringBuilder text = new StringBuilder("[TEST] PRIVATE COLUMBIAWALKS INTAKE ONLY\nPolice will not be contacted.\n\n");
        JSONObject fields = payload.getJSONObject("fields");
        for (String key : KEYS) {
            text.append("[TEST] ").append(key.replace('_', ' ')).append("\n")
                    .append(fields.getString(key)).append("\n\n");
        }
        return text.toString();
    }
}
