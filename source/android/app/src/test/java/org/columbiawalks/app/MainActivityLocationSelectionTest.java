package org.columbiawalks.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.columbiawalks.app.data.ReportLocationSource;
import org.junit.Test;

public class MainActivityLocationSelectionTest {
    @Test
    public void deviceGpsClearsStaleManualOverrideWithoutPhotoGps() {
        MainActivity.LocationSelection selection =
                new MainActivity.LocationSelection();

        selection.set(
                40.0290,
                -76.4990,
                ReportLocationSource.DEVICE_GPS
        );
        selection.set(
                40.0300,
                -76.5000,
                ReportLocationSource.MANUAL_COORDINATES
        );
        assertTrue(selection.overridden);
        selection.set(
                40.0310,
                -76.5010,
                ReportLocationSource.DEVICE_GPS
        );

        assertEquals(ReportLocationSource.DEVICE_GPS, selection.source);
        assertFalse(selection.overridden);
        assertFalse(selection.hasPhotoLocation());
    }

    @Test
    public void deviceGpsPreservesPhotoCoordinatesAsOverrideProvenance() {
        MainActivity.LocationSelection selection =
                new MainActivity.LocationSelection();

        selection.set(
                40.0300,
                -76.5000,
                ReportLocationSource.PHOTO_EXIF
        );
        selection.set(
                40.0310,
                -76.5010,
                ReportLocationSource.DEVICE_GPS
        );

        assertEquals(ReportLocationSource.DEVICE_GPS, selection.source);
        assertTrue(selection.overridden);
        assertEquals(Double.valueOf(40.0300), selection.photoLatitude);
        assertEquals(Double.valueOf(-76.5000), selection.photoLongitude);
    }

    @Test
    public void manualCoordinatesOverridePhotoAndRetainOriginalCoordinates() {
        MainActivity.LocationSelection selection =
                new MainActivity.LocationSelection();

        selection.set(
                40.0300,
                -76.5000,
                ReportLocationSource.PHOTO_EXIF
        );
        selection.set(
                40.0320,
                -76.5020,
                ReportLocationSource.MANUAL_COORDINATES
        );

        assertEquals(
                ReportLocationSource.MANUAL_COORDINATES,
                selection.source
        );
        assertTrue(selection.overridden);
        assertEquals(Double.valueOf(40.0300), selection.photoLatitude);
        assertEquals(Double.valueOf(-76.5000), selection.photoLongitude);
    }

    @Test
    public void ordinaryAndContinuousSelectionsRemainIndependent() {
        MainActivity.LocationSelection ordinary =
                new MainActivity.LocationSelection();
        MainActivity.LocationSelection continuous =
                new MainActivity.LocationSelection();

        ordinary.set(
                40.0300,
                -76.5000,
                ReportLocationSource.PHOTO_EXIF
        );
        continuous.set(
                40.0400,
                -76.5100,
                ReportLocationSource.MANUAL_COORDINATES
        );
        continuous.clear();

        assertTrue(ordinary.confirmed);
        assertEquals(ReportLocationSource.PHOTO_EXIF, ordinary.source);
        assertTrue(ordinary.hasPhotoLocation());
        assertFalse(continuous.confirmed);
        assertEquals(ReportLocationSource.NONE, continuous.source);
        assertFalse(continuous.hasPhotoLocation());
    }
}
