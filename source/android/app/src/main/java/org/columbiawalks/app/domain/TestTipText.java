package org.columbiawalks.app.domain;

/** Mandatory, idempotent marking for every text field in the police-assisted test. */
public final class TestTipText {
    private TestTipText() { }

    public static String plain(String value) {
        return (value == null ? "" : value).replaceAll("(?i)\\[TEST\\]", " ")
                .replaceAll("[\\x00-\\x1f\\x7f-\\x9f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\ufeff]", " ")
                .replaceAll("[\\s\\p{Z}]+", " ").trim();
    }

    public static String mark(String value) {
        String text = plain(value);
        if (text.isEmpty()) text = "Not provided";
        return "[TEST] " + text.replace(" ", " [TEST] ") + " [TEST]";
    }
}
