package org.columbiawalks.app;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.containsString;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Explicitly opt in: this stores one clearly synthetic test in private hosted intake. */
@RunWith(AndroidJUnit4.class)
public final class AnonymousTipHostedSmokeTest {
    @Test public void syntheticTipReceivesVerifiedHostedReceipt() throws Exception {
        assumeTrue("Hosted writes require an explicit instrumentation argument",
                "true".equals(InstrumentationRegistry.getArguments().getString("hostedAnonymousTip")));
        assertTrue(BuildConfig.INTERNAL_TEST_BUILD);
        assertEquals("https://directus.rndtech.org/columbiawalks-api/anonymous-tip-tests", BuildConfig.ANONYMOUS_TIP_ENDPOINT);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(MainActivity::navigateToPoliceTip);
            enter(R.id.tip_subject, "SYNTHETIC ANDROID HTTPS TEST ONLY");
            enter(R.id.tip_observed_time, "Synthetic deployment check 2026-09-27");
            enter(R.id.tip_location, "Synthetic location only");
            enter(R.id.tip_observation, "Synthetic Android integration check. No real incident or person.");
            onView(withId(R.id.tip_inactive)).perform(scrollTo(), click());
            onView(withId(R.id.tip_test_only)).perform(scrollTo(), click());
            onView(withId(R.id.tip_prepare)).perform(scrollTo(), click());
            onView(withId(R.id.tip_submit)).perform(scrollTo(), click());
            long deadline = System.currentTimeMillis() + 45000;
            boolean saved = false;
            while (System.currentTimeMillis() < deadline) {
                final boolean[] done = {false};
                scenario.onActivity(activity -> {
                    android.widget.TextView status = activity.findViewById(R.id.tip_status);
                    done[0] = status != null && status.getText().toString().contains("Saved to private ColumbiaWalks test intake.");
                });
                if (done[0]) { saved = true; break; }
                Thread.sleep(200);
            }
            assertTrue("Hosted receipt must be shown by the app", saved);
            onView(withId(R.id.tip_status)).perform(scrollTo()).check(matches(withText(containsString("Police were not contacted."))));
            onView(withId(R.id.tip_status)).check(matches(withText(containsString("[TEST] CW-TIP-"))));
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 3000);
            android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            java.io.File file = new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "tip-hosted-receipt.png");
            try (java.io.FileOutputStream output = new java.io.FileOutputStream(file)) {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output);
            }
            bitmap.recycle();
        }
    }
    private void enter(int id, String value) {
        onView(withId(id)).perform(scrollTo(), replaceText(value), closeSoftKeyboard());
    }
}
