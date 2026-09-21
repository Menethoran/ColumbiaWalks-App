package org.columbiawalks.app.domain;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class OfficialEmailPolicyTest {
    @Test
    public void authorizesOnlyExactCrosswalkSignalsForPoliceAndMayor() {
        assertEquals(
                OfficialEmailPolicy.Routing.POLICE_AND_MAYOR,
                OfficialEmailPolicy.classify(
                        "[\"crosswalk_encroachment\"]",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.POLICE_AND_MAYOR,
                OfficialEmailPolicy.classify("[]", "crosswalk_incursion")
        );
        assertFalse(OfficialEmailPolicy.isAutomaticEmailEligible(
                "[\"speeding\",\"illegal_u_turn\"]",
                "aggressive_driving"
        ));
        assertFalse(OfficialEmailPolicy.isAutomaticEmailEligible(
                "[\"crosswalk_issue\"]",
                null
        ));
    }

    @Test
    public void authorizesOnlyExactMissingSidewalkForCodes() {
        assertEquals(
                OfficialEmailPolicy.Routing.CODES,
                OfficialEmailPolicy.classify(
                        "[\"missing_sidewalk\"]",
                        null
                )
        );
        assertFalse(OfficialEmailPolicy.isAutomaticEmailEligible(
                "[\"sidewalk_issue\",\"trip_hazard\"]",
                null
        ));
    }

    @Test
    public void mixedDuplicateAndNonNormalizedQuickSelectionsFailClosed() {
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"missing_sidewalk\",\"crosswalk_encroachment\"]",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"crosswalk_encroachment\",\"speeding\"]",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"crosswalk_encroachment\",\"crosswalk_encroachment\"]",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\" crosswalk_encroachment\"]",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"CROSSWALK_ENCROACHMENT\"]",
                        null
                )
        );
    }

    @Test
    public void repeatRoutesCannotCrossReportingHierarchies() {
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"missing_sidewalk\"]",
                        "vehicle",
                        "aggressive_driving"
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"crosswalk_encroachment\"]",
                        "sidewalk",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.CODES,
                OfficialEmailPolicy.classify(
                        "[\"missing_sidewalk\"]",
                        "sidewalk",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"missing_sidewalk\",\"missing_sidewalk\"]",
                        "sidewalk",
                        null
                )
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(
                        "[\"crosswalk_encroachment\"]",
                        "vehicle",
                        "crosswalk_incursion"
                )
        );
    }

    @Test
    public void malformedOrUnknownValuesFailClosed() {
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify("not-json", null)
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify(null, "crosswalk_incursion")
        );
        assertEquals(
                OfficialEmailPolicy.Routing.NONE,
                OfficialEmailPolicy.classify("[1]", null)
        );
        assertTrue(OfficialEmailPolicy.isAutomaticEmailEligible(
                "[]",
                "crosswalk_incursion"
        ));
    }

    @Test
    public void officialEmailLocationUsesFiveKilometerColumbiaGate() {
        assertTrue(OfficialEmailPolicy.isOfficialEmailLocationEligible(
                40.0337,
                -76.5044
        ));
        assertTrue(OfficialEmailPolicy.isOfficialEmailLocationEligible(
                40.0770,
                -76.5044
        ));
        assertFalse(OfficialEmailPolicy.isOfficialEmailLocationEligible(
                40.0800,
                -76.5044
        ));
        assertFalse(OfficialEmailPolicy.isOfficialEmailLocationEligible(
                Double.NaN,
                -76.5044
        ));
    }
}
