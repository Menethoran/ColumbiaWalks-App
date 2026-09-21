package org.columbiawalks.app.domain;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ColumbiaAreaTest {
    @Test
    public void columbiaCenterIsNearby() {
        assertTrue(ColumbiaArea.isNearColumbia(40.0337, -76.5044));
    }

    @Test
    public void philadelphiaIsNotNearby() {
        assertFalse(ColumbiaArea.isNearColumbia(39.9526, -75.1652));
    }
}

