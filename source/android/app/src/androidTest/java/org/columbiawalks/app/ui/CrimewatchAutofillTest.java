package org.columbiawalks.app.ui;

import static org.junit.Assert.*;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Read/fill-only live smoke test. Never presses Submit or Agree; never attaches a file. */
@RunWith(AndroidJUnit4.class)
public class CrimewatchAutofillTest {
    @Test public void onlyAllowsExactOfficialAgencyForm() {
        assertTrue(CrimewatchTipActivity.isTipPage(CrimewatchTipActivity.TIP_URL));
        assertFalse(CrimewatchTipActivity.isTipPage(CrimewatchTipActivity.TIP_URL.replace("https:","http:")));
        assertFalse(CrimewatchTipActivity.isTipPage(CrimewatchTipActivity.TIP_URL.replace("10552","99999")));
        assertFalse(CrimewatchTipActivity.isTipPage(CrimewatchTipActivity.TIP_URL.replace("crimewatch.net","crimewatch.net.evil.example")));
        assertFalse(CrimewatchTipActivity.isTipPage(CrimewatchTipActivity.TIP_URL.replace("crimewatch.net","user@crimewatch.net")));
    }
    @Test public void carriesAnOlderSavedReportWithoutReportOrContactIdentifiers() {
        org.columbiawalks.app.data.SafetyReport report = new org.columbiawalks.app.data.SafetyReport(
                7L, "private-report-identifier", 0L, "September 28, 2026 09:00", "Crosswalk safety",
                "Low", "Not requested", "Synthetic firsthand observation", "quick", "{}", "vehicle", true,
                "{\"license_plate\":\"TEST-123\",\"plate_state\":\"PA\",\"color\":\"Blue\",\"make\":\"TestMake\"}",
                "[]", "Synthetic extra detail", "quick", "[]", "{\"label\":\"Third and Locust\"}",
                null, null, null, null, 0, true, 40.034, -76.504, "map", null, null, false,
                null, "submitted", "remote-id", null, 0L);
        android.os.Bundle handoff = PoliceTipFragment.newSavedReportHandoff(report);
        assertEquals("TEST-123", handoff.getString("license_plate"));
        assertEquals("PA", handoff.getString("plate_state"));
        assertTrue(handoff.getString("location").contains("Third and Locust"));
        assertTrue(handoff.getString("vehicle").contains("Blue TestMake"));
        assertTrue(handoff.getString("observation").contains("Synthetic firsthand observation"));
        assertTrue(handoff.getString("observation").contains("Synthetic extra detail"));
        assertFalse(handoff.toString().contains("private-report-identifier"));
        assertFalse(handoff.toString().contains("remote-id"));
    }
    @Test public void fillsLiveOfficialFormWithoutSubmitting() throws Exception {
        try (ActivityScenario<CrimewatchTipActivity> scenario = ActivityScenario.launch(
                CrimewatchTipActivity.intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),
                        "Autofill verification", "Synthetic police-assisted test. No incident. Do not submit."))) {
            String result = null;
            for (int attempt = 0; attempt < 90; attempt++) {
                AtomicReference<String> answer = new AtomicReference<>();
                CountDownLatch done = new CountDownLatch(1);
                scenario.onActivity(activity -> {
                    WebView view = web(activity.findViewById(android.R.id.content));
                    if (view == null) { done.countDown(); return; }
                    view.evaluateJavascript("(function(){let f=document.getElementById('webform-client-form-142312');if(!f||f.dataset.cwTestAutofill!=='true')return null;return JSON.stringify({anonymous:document.getElementById('edit-submitted-person-anonymous-2').checked,crime:document.getElementById('edit-submitted-narrative-crime').value,subject:document.getElementById('edit-submitted-narrative-subject').value,message:document.getElementById('edit-submitted-narrative-notes').value,agree:document.getElementById('edit-agree').checked,first:document.getElementById('edit-submitted-person-first-name').value});})()",
                        value -> { answer.set(value); done.countDown(); });
                });
                assertTrue(done.await(5, TimeUnit.SECONDS));
                if (answer.get() != null && !answer.get().equals("null")) { result = answer.get(); break; }
                Thread.sleep(1000);
            }
            assertNotNull("Official form did not load and autofill within 90 seconds", result);
            String decoded = new org.json.JSONTokener(result).nextValue().toString();
            JSONObject fields = new JSONObject(decoded);
            assertTrue(fields.getBoolean("anonymous"));
            assertEquals("Other", fields.getString("crime"));
            assertEquals("[TEST] Autofill [TEST] verification [TEST]", fields.getString("subject"));
            assertTrue(fields.getString("message").contains("[TEST] Synthetic [TEST] police-assisted [TEST] test."));
            assertFalse(fields.getBoolean("agree"));
            assertEquals("", fields.getString("first"));
            scenario.onActivity(activity -> web(activity.findViewById(android.R.id.content)).evaluateJavascript(
                    "document.querySelector('button[data-bs-dismiss=\"modal\"][title=\"Continue browsing Columbia Borough Police Department\"]')?.click();document.getElementById('edit-submitted-person-anonymous-2').scrollIntoView({block:'start'});", null));
            Thread.sleep(700);
            // Screenshot is of synthetic text only, after filling and before any submission.
            InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot()
                    .compress(android.graphics.Bitmap.CompressFormat.PNG, 100,
                        InstrumentationRegistry.getInstrumentation().getTargetContext().openFileOutput(
                                "crimewatch-autofill-31710.png", android.content.Context.MODE_PRIVATE));
        }
    }
    private static WebView web(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i=0;i<((ViewGroup)view).getChildCount();i++) {
            WebView result = web(((ViewGroup)view).getChildAt(i)); if(result!=null) return result;
        }
        return null;
    }
}
