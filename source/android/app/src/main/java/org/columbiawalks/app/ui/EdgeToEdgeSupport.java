package org.columbiawalks.app.ui;

import android.app.Activity;
import android.os.Build;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** Applies one consistent, API 26-36 system-bar policy to every activity. */
public final class EdgeToEdgeSupport {
    private EdgeToEdgeSupport() {
    }

    /**
     * Keeps system icons readable over ColumbiaWalks' intentionally pale
     * window background. Android 15+ enforces edge-to-edge for this app's
     * target SDK, so no deprecated window-color compatibility call is needed.
     */
    public static void enable(Activity activity) {
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(
                        activity.getWindow(),
                        activity.getWindow().getDecorView()
                );
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }

    /**
     * Keeps interactive content clear of status bars, navigation bars, and
     * display cutouts while allowing the root background to fill every edge.
     */
    public static void applySystemBarPadding(View root) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            return;
        }
        final int initialLeft = root.getPaddingLeft();
        final int initialTop = root.getPaddingTop();
        final int initialRight = root.getPaddingRight();
        final int initialBottom = root.getPaddingBottom();

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets safeInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(
                    initialLeft + safeInsets.left,
                    initialTop + safeInsets.top,
                    initialRight + safeInsets.right,
                    initialBottom + safeInsets.bottom
            );
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
