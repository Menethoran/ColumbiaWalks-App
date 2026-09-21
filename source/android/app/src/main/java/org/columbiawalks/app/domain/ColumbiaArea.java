package org.columbiawalks.app.domain;

public final class ColumbiaArea {
    private static final double CENTER_LATITUDE = 40.0337;
    private static final double CENTER_LONGITUDE = -76.5044;
    private static final double NEARBY_RADIUS_KM = 16.0;
    private static final double EARTH_RADIUS_KM = 6371.0;

    private ColumbiaArea() {
    }

    public static boolean isNearColumbia(double latitude, double longitude) {
        return distanceKm(
                CENTER_LATITUDE,
                CENTER_LONGITUDE,
                latitude,
                longitude
        ) <= NEARBY_RADIUS_KM;
    }

    static double distanceKm(
            double startLatitude,
            double startLongitude,
            double endLatitude,
            double endLongitude
    ) {
        double latitudeDelta = Math.toRadians(endLatitude - startLatitude);
        double longitudeDelta = Math.toRadians(endLongitude - startLongitude);
        double startLatitudeRadians = Math.toRadians(startLatitude);
        double endLatitudeRadians = Math.toRadians(endLatitude);

        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
                + Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians)
                * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }
}

