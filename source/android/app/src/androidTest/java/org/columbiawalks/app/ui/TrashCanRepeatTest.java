package org.columbiawalks.app.ui;

import static org.junit.Assert.*;
import android.view.View;
import android.widget.Spinner;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.junit.Test;
import org.junit.Before;
import org.junit.runner.RunWith;

/** UI/lifecycle check only. Does not queue or submit a report. */
@RunWith(AndroidJUnit4.class)
public class TrashCanRepeatTest {
    @Before public void allowLocationInTheTestEmulator() {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        String packageName = instrumentation.getTargetContext().getPackageName();
        instrumentation.getUiAutomation().grantRuntimePermission(packageName, android.Manifest.permission.ACCESS_COARSE_LOCATION);
        instrumentation.getUiAutomation().grantRuntimePermission(packageName, android.Manifest.permission.ACCESS_FINE_LOCATION);
    }
    @Test public void repeatTrashSelectionsSurviveNextReportResetAndRotation() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.navigateToContinuousReport();
                activity.getSupportFragmentManager().executePendingTransactions();
                ((Spinner) activity.findViewById(R.id.continuous_hierarchy_spinner)).setSelection(9);
            });
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> {
                assertEquals(View.VISIBLE, activity.findViewById(R.id.continuous_trash_can_section).getVisibility());
                Spinner propertyType = activity.findViewById(R.id.continuous_trash_property_type_spinner);
                assertEquals(0, propertyType.getSelectedItemPosition());
                assertEquals("Residential", propertyType.getSelectedItem());
                propertyType.setSelection(1);
                Spinner hauler = activity.findViewById(R.id.continuous_trash_hauler_spinner);
                assertEquals(8, hauler.getCount());
                assertEquals("B&L Carson", hauler.getItemAtPosition(1));
                assertEquals("Good's", hauler.getItemAtPosition(3));
                assertEquals("Shell's", hauler.getItemAtPosition(6));
                assertEquals("WM.COM", hauler.getItemAtPosition(7));
                hauler.setSelection(3);
                ((Spinner) activity.findViewById(R.id.continuous_trash_category_spinner)).setSelection(2);
                ((Spinner) activity.findViewById(R.id.continuous_trash_scope_spinner)).setSelection(1);
                ContinuousReportFragment fragment = (ContinuousReportFragment) activity.getSupportFragmentManager()
                        .getFragments().stream().filter(value -> value instanceof ContinuousReportFragment).findFirst().orElseThrow();
                try {
                    java.lang.reflect.Method reset = ContinuousReportFragment.class.getDeclaredMethod("resetForNextReport");
                    reset.setAccessible(true);
                    reset.invoke(fragment);
                } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
                assertEquals(3, hauler.getSelectedItemPosition());
                assertEquals("Commercial", propertyType.getSelectedItem());
            });
            scenario.recreate();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> {
                assertEquals(9, ((Spinner) activity.findViewById(R.id.continuous_hierarchy_spinner)).getSelectedItemPosition());
                assertEquals(3, ((Spinner) activity.findViewById(R.id.continuous_trash_hauler_spinner)).getSelectedItemPosition());
                assertEquals(2, ((Spinner) activity.findViewById(R.id.continuous_trash_category_spinner)).getSelectedItemPosition());
                assertEquals(1, ((Spinner) activity.findViewById(R.id.continuous_trash_scope_spinner)).getSelectedItemPosition());
                assertEquals("Commercial", ((Spinner) activity.findViewById(R.id.continuous_trash_property_type_spinner)).getSelectedItem());
            });
        }
    }
}
