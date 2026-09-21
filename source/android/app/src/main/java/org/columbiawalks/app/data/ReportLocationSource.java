package org.columbiawalks.app.data;

public final class ReportLocationSource {
    public static final String NONE = "none";
    public static final String PHOTO_EXIF = "photo_exif";
    public static final String DEVICE_GPS = "device_gps";
    public static final String MANUAL_MAP = "manual_map";
    public static final String MANUAL_COORDINATES = "manual_coordinates";
    public static final String LEGACY = "legacy";

    private ReportLocationSource() {
    }

    public static boolean isManual(String value) {
        return MANUAL_MAP.equals(value) || MANUAL_COORDINATES.equals(value);
    }

    public static boolean isSupported(String value) {
        return NONE.equals(value)
                || PHOTO_EXIF.equals(value)
                || DEVICE_GPS.equals(value)
                || MANUAL_MAP.equals(value)
                || MANUAL_COORDINATES.equals(value)
                || LEGACY.equals(value);
    }
}
