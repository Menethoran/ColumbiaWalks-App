package org.columbiawalks.app.domain;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Collections;
import java.util.List;

public class ChecklistCatalogTest {
    @Test
    public void tripHazardShowsWalkingSurfaceQuestionsOnly() {
        ChecklistCatalog.Category walkingSurfaces =
                new ChecklistCatalog.Category(
                        "walking_surfaces",
                        "Sidewalks, paths & trip hazards",
                        "Walking surfaces",
                        "sidewalk_safety",
                        List.of("sidewalk_safety", "trip_hazards"),
                        Collections.emptyList()
                );
        ChecklistCatalog.Category crossings =
                new ChecklistCatalog.Category(
                        "crossings",
                        "Crosswalks & intersections",
                        "Crossing markings",
                        "crosswalk_safety",
                        List.of("crosswalk_safety"),
                        Collections.emptyList()
                );

        assertTrue(walkingSurfaces.appliesTo(List.of("trip_hazards")));
        assertFalse(crossings.appliesTo(List.of("trip_hazards")));
    }

    @Test
    public void policeVehicleReportShowsDriverAndPoliceQuestions() {
        ChecklistCatalog.Category driverBehavior =
                new ChecklistCatalog.Category(
                        "driver_behavior",
                        "Drivers & traffic behavior",
                        "Driver conduct",
                        "vehicle_safety",
                        List.of("vehicle_safety", "aggressive_drivers"),
                        Collections.emptyList()
                );
        ChecklistCatalog.Category policeResponse =
                new ChecklistCatalog.Category(
                        "police_response",
                        "Police & emergency response",
                        "Police interaction",
                        "police_response",
                        List.of("police_response"),
                        Collections.emptyList()
                );

        List<String> selected =
                List.of("aggressive_drivers", "police_response");
        assertTrue(driverBehavior.appliesTo(selected));
        assertTrue(policeResponse.appliesTo(selected));
    }
}

