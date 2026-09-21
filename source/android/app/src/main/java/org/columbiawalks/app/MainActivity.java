package org.columbiawalks.app;

import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import androidx.lifecycle.Lifecycle;

import com.google.android.material.bottomnavigation.BottomNavigationView;

import org.columbiawalks.app.data.ReportLocationSource;
import org.columbiawalks.app.submission.FeedbackUploadScheduler;
import org.columbiawalks.app.submission.TrashCanUploadScheduler;
import org.columbiawalks.app.update.UpdateManager;
import org.columbiawalks.app.ui.CommunityFragment;
import org.columbiawalks.app.ui.ContinuousReportFragment;
import org.columbiawalks.app.ui.EdgeToEdgeSupport;
import org.columbiawalks.app.ui.FeedbackFragment;
import org.columbiawalks.app.ui.MapFragment;
import org.columbiawalks.app.ui.PoliceTipFragment;
import org.columbiawalks.app.ui.PosFragment;
import org.columbiawalks.app.ui.ReportFragment;
import org.columbiawalks.app.ui.SavedReportsFragment;
import org.columbiawalks.app.ui.TrashCanFragment;
import org.columbiawalks.app.ui.WalkFragment;
import org.columbiawalks.app.walking.WalkingMetricUploadScheduler;
import org.maplibre.android.MapLibre;

public class MainActivity extends AppCompatActivity {
    private static final String STATE_LATITUDE = "selected_latitude";
    private static final String STATE_LONGITUDE = "selected_longitude";
    private static final String STATE_LOCATION_CONFIRMED =
            "selected_location_confirmed";
    private static final String STATE_LOCATION_SOURCE =
            "selected_location_source";
    private static final String STATE_LOCATION_OVERRIDDEN =
            "selected_location_overridden";
    private static final String STATE_HAS_PHOTO_LOCATION =
            "selected_has_photo_location";
    private static final String STATE_PHOTO_LATITUDE =
            "selected_photo_latitude";
    private static final String STATE_PHOTO_LONGITUDE =
            "selected_photo_longitude";
    private static final String STATE_CONTINUOUS_LATITUDE =
            "continuous_selected_latitude";
    private static final String STATE_CONTINUOUS_LONGITUDE =
            "continuous_selected_longitude";
    private static final String STATE_CONTINUOUS_LOCATION_CONFIRMED =
            "continuous_selected_location_confirmed";
    private static final String STATE_CONTINUOUS_LOCATION_SOURCE =
            "continuous_selected_location_source";
    private static final String STATE_CONTINUOUS_LOCATION_OVERRIDDEN =
            "continuous_selected_location_overridden";
    private static final String STATE_CONTINUOUS_HAS_PHOTO_LOCATION =
            "continuous_selected_has_photo_location";
    private static final String STATE_CONTINUOUS_PHOTO_LATITUDE =
            "continuous_selected_photo_latitude";
    private static final String STATE_CONTINUOUS_PHOTO_LONGITUDE =
            "continuous_selected_photo_longitude";
    private static final String STATE_NAV_ITEM = "selected_navigation_item";
    private static final String STATE_VISIBLE_FRAGMENT = "visible_fragment";
    private static final String TAG_MAP = "map";
    private static final String TAG_REPORT = "report";
    private static final String TAG_POS = "pos";
    private static final String TAG_SAVED = "saved";
    private static final String TAG_COMMUNITY = "community";
    private static final String TAG_FEEDBACK = "feedback";
    private static final String TAG_POLICE_TIP = "police_tip";
    private static final String TAG_TRASH_CANS = "trash_cans";
    private static final String TAG_WALK = "walk";
    private static final String TAG_REPEAT = "repeat";

    public static final double COLUMBIA_LATITUDE = 40.0337;
    public static final double COLUMBIA_LONGITUDE = -76.5044;

    private final LocationSelection reportLocation = new LocationSelection();
    private final LocationSelection continuousReportLocation =
            new LocationSelection();
    private int selectedNavigationItem = R.id.navigation_map;
    private String visibleFragmentTag = TAG_MAP;
    private BottomNavigationView bottomNavigation;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdgeSupport.enable(this);
        MapLibre.getInstance(this);
        setContentView(R.layout.activity_main);
        EdgeToEdgeSupport.applySystemBarPadding(
                findViewById(R.id.main_root)
        );
        FeedbackUploadScheduler.enqueuePending(this);
        TrashCanUploadScheduler.enqueuePending(this);
        WalkingMetricUploadScheduler.enqueuePending(this);
        if (BuildConfig.SELF_UPDATE_ENABLED) {
            UpdateManager.checkOnLaunch(this);
        }

        if (savedInstanceState != null) {
            reportLocation.latitude = savedInstanceState.getDouble(
                    STATE_LATITUDE, COLUMBIA_LATITUDE);
            reportLocation.longitude = savedInstanceState.getDouble(
                    STATE_LONGITUDE, COLUMBIA_LONGITUDE);
            reportLocation.confirmed = savedInstanceState.getBoolean(
                    STATE_LOCATION_CONFIRMED, false);
            reportLocation.source = savedInstanceState.getString(
                    STATE_LOCATION_SOURCE,
                    reportLocation.confirmed
                            ? ReportLocationSource.LEGACY
                            : ReportLocationSource.NONE
            );
            reportLocation.overridden = savedInstanceState.getBoolean(
                    STATE_LOCATION_OVERRIDDEN,
                    false
            );
            if (savedInstanceState.getBoolean(
                    STATE_HAS_PHOTO_LOCATION,
                    false
            )) {
                reportLocation.photoLatitude = savedInstanceState.getDouble(
                        STATE_PHOTO_LATITUDE);
                reportLocation.photoLongitude = savedInstanceState.getDouble(
                        STATE_PHOTO_LONGITUDE);
            }
            continuousReportLocation.latitude = savedInstanceState.getDouble(
                    STATE_CONTINUOUS_LATITUDE, COLUMBIA_LATITUDE);
            continuousReportLocation.longitude = savedInstanceState.getDouble(
                    STATE_CONTINUOUS_LONGITUDE, COLUMBIA_LONGITUDE);
            continuousReportLocation.confirmed = savedInstanceState.getBoolean(
                    STATE_CONTINUOUS_LOCATION_CONFIRMED, false);
            continuousReportLocation.source = savedInstanceState.getString(
                    STATE_CONTINUOUS_LOCATION_SOURCE,
                    continuousReportLocation.confirmed
                            ? ReportLocationSource.LEGACY
                            : ReportLocationSource.NONE
            );
            continuousReportLocation.overridden =
                    savedInstanceState.getBoolean(
                            STATE_CONTINUOUS_LOCATION_OVERRIDDEN,
                            false
                    );
            if (savedInstanceState.getBoolean(
                    STATE_CONTINUOUS_HAS_PHOTO_LOCATION,
                    false
            )) {
                continuousReportLocation.photoLatitude =
                        savedInstanceState.getDouble(
                                STATE_CONTINUOUS_PHOTO_LATITUDE);
                continuousReportLocation.photoLongitude =
                        savedInstanceState.getDouble(
                                STATE_CONTINUOUS_PHOTO_LONGITUDE);
            }
            selectedNavigationItem = savedInstanceState.getInt(
                    STATE_NAV_ITEM, R.id.navigation_map);
            visibleFragmentTag = savedInstanceState.getString(
                    STATE_VISIBLE_FRAGMENT,
                    tagForNavigationItem(selectedNavigationItem)
            );
            if (!isKnownFragmentTag(visibleFragmentTag)) {
                visibleFragmentTag = tagForNavigationItem(
                        selectedNavigationItem
                );
            }
        }

        bottomNavigation = findViewById(R.id.bottom_navigation);
        findViewById(R.id.open_walk).setOnClickListener(view -> {
            selectedNavigationItem = R.id.open_walk;
            showFragment(TAG_WALK);
        });
        findViewById(R.id.open_repeat).setOnClickListener(view -> {
            selectedNavigationItem = R.id.open_repeat;
            markRepeatAsReportSection();
            showFragment(TAG_REPEAT);
        });
        bottomNavigation.setOnItemSelectedListener(item -> {
            selectedNavigationItem = item.getItemId();
            if (item.getItemId() == R.id.navigation_map) {
                showFragment(TAG_MAP);
                return true;
            }
            if (item.getItemId() == R.id.navigation_report) {
                showFragment(TAG_REPORT);
                return true;
            }
            if (item.getItemId() == R.id.navigation_saved) {
                showFragment(TAG_SAVED);
                return true;
            }
            if (item.getItemId() == R.id.navigation_feedback) {
                showFragment(TAG_COMMUNITY);
                return true;
            }
            if (item.getItemId() == R.id.navigation_pos) {
                showFragment(TAG_POS);
                return true;
            }
            return false;
        });
        bottomNavigation.setOnItemReselectedListener(item -> {
            if (selectedNavigationItem == R.id.open_repeat
                    && item.getItemId() == R.id.navigation_report) {
                selectedNavigationItem = R.id.navigation_report;
                showFragment(TAG_REPORT);
                return;
            }
            if (item.getItemId() == R.id.navigation_feedback) {
                selectedNavigationItem = R.id.navigation_feedback;
                showFragment(TAG_COMMUNITY);
            }
        });

        if (selectedNavigationItem == R.id.open_repeat) {
            markRepeatAsReportSection();
        } else if (bottomNavigation.getMenu()
                .findItem(selectedNavigationItem) != null) {
            bottomNavigation.getMenu()
                    .findItem(selectedNavigationItem)
                    .setChecked(true);
        }
        getOnBackPressedDispatcher().addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (isCommunityChild(visibleFragmentTag)) {
                            navigateToCommunity();
                            return;
                        }
                        if (selectedNavigationItem == R.id.open_repeat) {
                            navigateToReport();
                            return;
                        }
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                    }
                }
        );
        String restoredVisibleTag = savedInstanceState == null
                ? null
                : savedInstanceState.getString(STATE_VISIBLE_FRAGMENT);
        if (selectedNavigationItem == R.id.navigation_feedback
                && isCommunityTag(restoredVisibleTag)) {
            visibleFragmentTag = restoredVisibleTag;
        } else if (selectedNavigationItem != R.id.navigation_feedback
                && isCommunityTag(visibleFragmentTag)) {
            visibleFragmentTag = tagForNavigationItem(
                    selectedNavigationItem
            );
        }
        showFragment(visibleFragmentTag);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (BuildConfig.SELF_UPDATE_ENABLED) {
            UpdateManager.onResume(this);
        }
    }

    private void showFragment(String tag) {
        visibleFragmentTag = tag;
        FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
        Fragment selected = getSupportFragmentManager().findFragmentByTag(tag);

        for (Fragment fragment : getSupportFragmentManager().getFragments()) {
            if (fragment.isAdded()) {
                transaction.hide(fragment);
                transaction.setMaxLifecycle(fragment, Lifecycle.State.STARTED);
            }
        }

        if (selected == null) {
            selected = createFragment(tag);
            transaction.add(R.id.fragment_container, selected, tag);
        } else {
            transaction.show(selected);
        }
        transaction.setMaxLifecycle(selected, Lifecycle.State.RESUMED);
        transaction.commit();
    }

    private Fragment createFragment(String tag) {
        if (TAG_REPORT.equals(tag)) {
            return new ReportFragment();
        }
        if (TAG_SAVED.equals(tag)) {
            return new SavedReportsFragment();
        }
        if (TAG_COMMUNITY.equals(tag)) {
            return new CommunityFragment();
        }
        if (TAG_FEEDBACK.equals(tag)) {
            return new FeedbackFragment();
        }
        if (TAG_POLICE_TIP.equals(tag)) {
            return new PoliceTipFragment();
        }
        if (TAG_TRASH_CANS.equals(tag)) {
            return new TrashCanFragment();
        }
        if (TAG_POS.equals(tag)) {
            return new PosFragment();
        }
        if (TAG_WALK.equals(tag)) {
            return new WalkFragment();
        }
        if (TAG_REPEAT.equals(tag)) {
            return new ContinuousReportFragment();
        }
        return new MapFragment();
    }

    private String tagForNavigationItem(int itemId) {
        if (itemId == R.id.navigation_report) {
            return TAG_REPORT;
        }
        if (itemId == R.id.navigation_saved) {
            return TAG_SAVED;
        }
        if (itemId == R.id.navigation_feedback) {
            return TAG_COMMUNITY;
        }
        if (itemId == R.id.open_walk) {
            return TAG_WALK;
        }
        if (itemId == R.id.open_repeat) {
            return TAG_REPEAT;
        }
        if (itemId == R.id.navigation_pos) {
            return TAG_POS;
        }
        return TAG_MAP;
    }

    public void setSelectedLocation(double latitude, double longitude) {
        setSelectedLocation(
                latitude,
                longitude,
                ReportLocationSource.MANUAL_MAP
        );
    }

    public void setSelectedLocation(
            double latitude,
            double longitude,
            String source
    ) {
        reportLocation.set(latitude, longitude, source);
    }

    public boolean canAutomaticDeviceLocationReplace() {
        return reportLocation.canAutomaticDeviceLocationReplace();
    }

    public void clearSelectedLocation() {
        reportLocation.clear();
    }

    public void clearPhotoLocation() {
        reportLocation.clearPhotoLocation();
    }

    public boolean isSelectedLocationConfirmed() {
        return reportLocation.confirmed;
    }

    public double getSelectedLatitude() {
        return reportLocation.latitude;
    }

    public double getSelectedLongitude() {
        return reportLocation.longitude;
    }

    public String getSelectedLocationSource() {
        return reportLocation.source;
    }

    public boolean isLocationOverridden() {
        return reportLocation.overridden;
    }

    public boolean hasPhotoLocation() {
        return reportLocation.hasPhotoLocation();
    }

    public Double getPhotoLatitude() {
        return reportLocation.photoLatitude;
    }

    public Double getPhotoLongitude() {
        return reportLocation.photoLongitude;
    }

    public void setContinuousReportLocation(
            double latitude,
            double longitude,
            String source
    ) {
        continuousReportLocation.set(latitude, longitude, source);
    }

    public boolean canAutomaticContinuousDeviceLocationReplace() {
        return continuousReportLocation.canAutomaticDeviceLocationReplace();
    }

    public void clearContinuousReportLocation() {
        continuousReportLocation.clear();
    }

    public void clearContinuousPhotoLocation() {
        continuousReportLocation.clearPhotoLocation();
    }

    public boolean isContinuousReportLocationConfirmed() {
        return continuousReportLocation.confirmed;
    }

    public double getContinuousReportLatitude() {
        return continuousReportLocation.latitude;
    }

    public double getContinuousReportLongitude() {
        return continuousReportLocation.longitude;
    }

    public String getContinuousReportLocationSource() {
        return continuousReportLocation.source;
    }

    public boolean isContinuousReportLocationOverridden() {
        return continuousReportLocation.overridden;
    }

    public boolean hasContinuousPhotoLocation() {
        return continuousReportLocation.hasPhotoLocation();
    }

    public Double getContinuousPhotoLatitude() {
        return continuousReportLocation.photoLatitude;
    }

    public Double getContinuousPhotoLongitude() {
        return continuousReportLocation.photoLongitude;
    }

    public void navigateToMap() {
        bottomNavigation.setSelectedItemId(R.id.navigation_map);
    }

    public void navigateToReport() {
        bottomNavigation.setSelectedItemId(R.id.navigation_report);
    }

    public void navigateToSavedReports() {
        bottomNavigation.setSelectedItemId(R.id.navigation_saved);
    }

    public void navigateToPos() {
        bottomNavigation.setSelectedItemId(R.id.navigation_pos);
    }

    public void navigateToFeedback() {
        navigateToCommunity();
    }

    public void navigateToCommunity() {
        selectedNavigationItem = R.id.navigation_feedback;
        bottomNavigation.getMenu()
                .findItem(R.id.navigation_feedback)
                .setChecked(true);
        showFragment(TAG_COMMUNITY);
    }

    public void navigateToAppFeedback() {
        showCommunityChild(TAG_FEEDBACK);
    }

    public void navigateToPoliceTip() {
        getSupportFragmentManager().setFragmentResult(
                PoliceTipFragment.REPORT_HANDOFF_REQUEST,
                PoliceTipFragment.newStandaloneRequest()
        );
        showCommunityChild(TAG_POLICE_TIP);
    }

    public void navigateToPoliceTip(Bundle reportHandoff) {
        getSupportFragmentManager().setFragmentResult(
                PoliceTipFragment.REPORT_HANDOFF_REQUEST,
                reportHandoff
        );
        showCommunityChild(TAG_POLICE_TIP);
    }

    public void navigateToTrashCans() {
        showCommunityChild(TAG_TRASH_CANS);
    }

    private void showCommunityChild(String tag) {
        selectedNavigationItem = R.id.navigation_feedback;
        bottomNavigation.getMenu()
                .findItem(R.id.navigation_feedback)
                .setChecked(true);
        showFragment(tag);
    }

    private static boolean isCommunityChild(String tag) {
        return TAG_FEEDBACK.equals(tag)
                || TAG_POLICE_TIP.equals(tag)
                || TAG_TRASH_CANS.equals(tag);
    }

    private static boolean isCommunityTag(String tag) {
        return TAG_COMMUNITY.equals(tag) || isCommunityChild(tag);
    }

    private static boolean isKnownFragmentTag(String tag) {
        return TAG_MAP.equals(tag)
                || TAG_REPORT.equals(tag)
                || TAG_POS.equals(tag)
                || TAG_SAVED.equals(tag)
                || TAG_WALK.equals(tag)
                || TAG_REPEAT.equals(tag)
                || isCommunityTag(tag);
    }

    public void navigateToContinuousReport() {
        selectedNavigationItem = R.id.open_repeat;
        markRepeatAsReportSection();
        showFragment(TAG_REPEAT);
    }

    private void markRepeatAsReportSection() {
        if (bottomNavigation != null) {
            bottomNavigation.getMenu()
                    .findItem(R.id.navigation_report)
                    .setChecked(true);
        }
    }

    private static boolean validLatitude(double latitude) {
        return Double.isFinite(latitude)
                && latitude >= -90.0
                && latitude <= 90.0;
    }

    private static boolean validLongitude(double longitude) {
        return Double.isFinite(longitude)
                && longitude >= -180.0
                && longitude <= 180.0;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putDouble(STATE_LATITUDE, reportLocation.latitude);
        outState.putDouble(STATE_LONGITUDE, reportLocation.longitude);
        outState.putBoolean(
                STATE_LOCATION_CONFIRMED,
                reportLocation.confirmed
        );
        outState.putString(STATE_LOCATION_SOURCE, reportLocation.source);
        outState.putBoolean(
                STATE_LOCATION_OVERRIDDEN,
                reportLocation.overridden
        );
        outState.putBoolean(STATE_HAS_PHOTO_LOCATION, hasPhotoLocation());
        if (hasPhotoLocation()) {
            outState.putDouble(
                    STATE_PHOTO_LATITUDE,
                    reportLocation.photoLatitude
            );
            outState.putDouble(
                    STATE_PHOTO_LONGITUDE,
                    reportLocation.photoLongitude
            );
        }
        outState.putDouble(
                STATE_CONTINUOUS_LATITUDE,
                continuousReportLocation.latitude
        );
        outState.putDouble(
                STATE_CONTINUOUS_LONGITUDE,
                continuousReportLocation.longitude
        );
        outState.putBoolean(
                STATE_CONTINUOUS_LOCATION_CONFIRMED,
                continuousReportLocation.confirmed
        );
        outState.putString(
                STATE_CONTINUOUS_LOCATION_SOURCE,
                continuousReportLocation.source
        );
        outState.putBoolean(
                STATE_CONTINUOUS_LOCATION_OVERRIDDEN,
                continuousReportLocation.overridden
        );
        outState.putBoolean(
                STATE_CONTINUOUS_HAS_PHOTO_LOCATION,
                hasContinuousPhotoLocation()
        );
        if (hasContinuousPhotoLocation()) {
            outState.putDouble(
                    STATE_CONTINUOUS_PHOTO_LATITUDE,
                    continuousReportLocation.photoLatitude
            );
            outState.putDouble(
                    STATE_CONTINUOUS_PHOTO_LONGITUDE,
                    continuousReportLocation.photoLongitude
            );
        }
        outState.putInt(STATE_NAV_ITEM, selectedNavigationItem);
        outState.putString(STATE_VISIBLE_FRAGMENT, visibleFragmentTag);
        super.onSaveInstanceState(outState);
    }

    /**
     * Location provenance belongs to a single report draft. Keeping ordinary
     * and repeat-report selections in separate instances prevents a hidden
     * fragment from attaching one photo to another draft's coordinates.
     */
    static final class LocationSelection {
        double latitude = COLUMBIA_LATITUDE;
        double longitude = COLUMBIA_LONGITUDE;
        boolean confirmed;
        String source = ReportLocationSource.NONE;
        boolean overridden;
        @Nullable
        Double photoLatitude;
        @Nullable
        Double photoLongitude;

        void set(double newLatitude, double newLongitude, String value) {
            if (!validLatitude(newLatitude) || !validLongitude(newLongitude)) {
                return;
            }
            String normalizedSource = ReportLocationSource.isSupported(value)
                    ? value
                    : ReportLocationSource.NONE;
            boolean replacingAutomatic = confirmed
                    && (ReportLocationSource.PHOTO_EXIF.equals(source)
                    || ReportLocationSource.DEVICE_GPS.equals(source));
            if (ReportLocationSource.PHOTO_EXIF.equals(normalizedSource)) {
                photoLatitude = newLatitude;
                photoLongitude = newLongitude;
                overridden = false;
            } else if (ReportLocationSource.isManual(normalizedSource)) {
                overridden = replacingAutomatic || hasPhotoLocation();
            } else if (ReportLocationSource.DEVICE_GPS.equals(
                    normalizedSource)) {
                // A device fix overrides photo EXIF only when EXIF exists.
                // Always assign the value so an earlier manual override cannot
                // leak into a later device-only report.
                overridden = hasPhotoLocation();
            } else {
                overridden = false;
            }
            latitude = newLatitude;
            longitude = newLongitude;
            confirmed = true;
            source = normalizedSource;
        }

        boolean canAutomaticDeviceLocationReplace() {
            return !confirmed
                    || ReportLocationSource.NONE.equals(source)
                    || ReportLocationSource.DEVICE_GPS.equals(source)
                    || ReportLocationSource.LEGACY.equals(source);
        }

        void clear() {
            latitude = COLUMBIA_LATITUDE;
            longitude = COLUMBIA_LONGITUDE;
            confirmed = false;
            source = ReportLocationSource.NONE;
            overridden = false;
            photoLatitude = null;
            photoLongitude = null;
        }

        void clearPhotoLocation() {
            photoLatitude = null;
            photoLongitude = null;
            overridden = false;
            if (ReportLocationSource.PHOTO_EXIF.equals(source)) {
                latitude = COLUMBIA_LATITUDE;
                longitude = COLUMBIA_LONGITUDE;
                confirmed = false;
                source = ReportLocationSource.NONE;
            }
        }

        boolean hasPhotoLocation() {
            return photoLatitude != null && photoLongitude != null;
        }
    }
}
