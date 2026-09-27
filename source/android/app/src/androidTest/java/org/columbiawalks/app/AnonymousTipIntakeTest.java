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
import static org.junit.Assert.assertTrue;

/** Synthetic data only. Run against tools/anonymous-tip-qa.mjs on the host. */
@RunWith(AndroidJUnit4.class)
public final class AnonymousTipIntakeTest {
    @Test public void previewAndSubmitToIsolatedPrivateTestIntake() throws Exception {
        assertTrue("This test must never target hosted intake", BuildConfig.ANONYMOUS_TIP_ENDPOINT.startsWith("http://10.0.2.2:31717/"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(MainActivity::navigateToPoliceTip);
            onView(withId(R.id.tip_subject)).check(matches(isDisplayed()));
            capture("tip-form");
            enter(R.id.tip_subject, "Synthetic test only");
            enter(R.id.tip_observed_time, "2026-09-27 10:00 EDT");
            enter(R.id.tip_location, "Synthetic location");
            enter(R.id.tip_observation, "Synthetic observation only");
            onView(withId(R.id.tip_inactive)).perform(scrollTo(), click());
            onView(withId(R.id.tip_test_only)).perform(scrollTo(), click());
            onView(withId(R.id.tip_prepare)).perform(scrollTo(), click());
            onView(withId(R.id.tip_preview)).check(matches(withText(containsString("[TEST] Synthetic [TEST] observation [TEST] only [TEST]"))));
            onView(withId(R.id.tip_submit)).perform(scrollTo(), click());
            long deadline = System.currentTimeMillis() + 12000;
            while (System.currentTimeMillis() < deadline) {
                final boolean[] done = {false};
                scenario.onActivity(activity -> {
                    android.widget.TextView view = activity.findViewById(R.id.tip_status);
                    done[0] = view != null && view.getText().toString().contains("Saved to private ColumbiaWalks test intake.");
                });
                if (done[0]) break;
                Thread.sleep(200);
            }
            onView(withId(R.id.tip_status)).perform(scrollTo()).check(matches(withText(containsString("Police were not contacted."))));
            onView(withId(R.id.tip_status)).check(matches(withText(containsString("[TEST] CW-TIP-"))));
            capture("tip-receipt");
            scenario.recreate();
            onView(withId(R.id.tip_status)).check(matches(withText(containsString("[TEST] CW-TIP-"))));
        }
    }
    @Test public void recoversSavedTestAfterLostReceiptWithoutSendingAnotherTip() throws Exception {
        assertTrue(BuildConfig.ANONYMOUS_TIP_ENDPOINT.startsWith("http://10.0.2.2:31717/"));
        java.net.HttpURLConnection control = (java.net.HttpURLConnection) new java.net.URL("http://10.0.2.2:31717/__qa/fail-next").openConnection();
        control.setRequestMethod("POST");
        control.setRequestProperty("Content-Type", "application/json");
        control.setDoOutput(true);
        try (java.io.OutputStream output = control.getOutputStream()) {
            output.write("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        org.junit.Assert.assertEquals(204, control.getResponseCode());
        control.disconnect();
        String id;
        try (ActivityScenario<MainActivity> first = ActivityScenario.launch(MainActivity.class)) {
            first.onActivity(MainActivity::navigateToPoliceTip);
            enter(R.id.tip_subject, "Synthetic retry test");
            enter(R.id.tip_observed_time, "2026-09-27 10:00 EDT");
            enter(R.id.tip_location, "Synthetic retry location");
            enter(R.id.tip_observation, "Synthetic retry observation");
            onView(withId(R.id.tip_inactive)).perform(scrollTo(), click());
            onView(withId(R.id.tip_test_only)).perform(scrollTo(), click());
            onView(withId(R.id.tip_prepare)).perform(scrollTo(), click());
            onView(withId(R.id.tip_submit)).perform(scrollTo(), click());
            awaitStatus(first, "Storage is not confirmed.");
            onView(withId(R.id.tip_status)).perform(scrollTo()).check(matches(withText(containsString("Storage is not confirmed."))));
            capture("tip-retry");
            java.io.File file = new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(), "anonymous-tip-test-pending.json");
            String saved = new String(java.nio.file.Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8);
            id = new org.json.JSONObject(saved).getString("submission_id");
            assertTrue(saved.contains("[TEST] Synthetic [TEST] retry [TEST]"));
        }
        // Closing and relaunching creates a new ViewModel that must read the durable file.
        try (ActivityScenario<MainActivity> second = ActivityScenario.launch(MainActivity.class)) {
            second.onActivity(MainActivity::navigateToPoliceTip);
            onView(withId(R.id.tip_submit)).perform(scrollTo(), click());
            awaitStatus(second, "Saved to private ColumbiaWalks test intake.");
            onView(withId(R.id.tip_status)).check(matches(withText(containsString("[TEST] CW-TIP-" + id))));
        }
    }
    private void awaitStatus(ActivityScenario<MainActivity> scenario, String expected) throws Exception {
        long deadline = System.currentTimeMillis() + 12000;
        while (System.currentTimeMillis() < deadline) {
            final boolean[] done = {false};
            scenario.onActivity(activity -> {
                android.widget.TextView view = activity.findViewById(R.id.tip_status);
                done[0] = view != null && view.getText().toString().contains(expected);
            });
            if (done[0]) return;
            Thread.sleep(200);
        }
        org.junit.Assert.fail("Expected test intake status was not shown");
    }
    private void capture(String name) throws Exception {
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        // Wait for the next rendered frame after Espresso scrolls the form.
        InstrumentationRegistry.getInstrumentation().getUiAutomation().waitForIdle(200, 3000);
        android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        java.io.File file = new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), name + ".png");
        try (java.io.FileOutputStream output = new java.io.FileOutputStream(file)) { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output); }
        bitmap.recycle();
    }
    private void enter(int id, String value) {
        onView(withId(id)).perform(scrollTo(), replaceText(value), closeSoftKeyboard());
    }
}
