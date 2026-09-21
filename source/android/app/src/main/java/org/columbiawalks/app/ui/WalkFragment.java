package org.columbiawalks.app.ui;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;

import org.columbiawalks.app.R;
import org.columbiawalks.app.walking.HealthConnectImporter;
import org.columbiawalks.app.walking.WalkTrackingService;
import org.columbiawalks.app.walking.WalkingMetricPayload;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class WalkFragment extends Fragment {
    private static final String HEALTH_READ_DISTANCE =
            "android.permission.health.READ_DISTANCE";
    private static final String HEALTH_READ_EXERCISE =
            "android.permission.health.READ_EXERCISE";
    private static final String IMPORT_PREFERENCES = "health_connect_import";
    private static final String KEY_LAST_IMPORT = "last_import";

    private TextView status;
    private TextView distance;
    private MaterialButton startButton;
    private MaterialButton stopButton;
    private MaterialButton healthButton;
    private CheckBox consent;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean receiverRegistered;

    private final Runnable refresh = new Runnable() {
        @Override
        public void run() {
            updateTrackingUi();
            if (isAdded() && WalkTrackingService.isRunning(requireContext())) {
                handler.postDelayed(this, 1000);
            }
        }
    };

    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            updateTrackingUi();
        }
    };

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    this::handleLocationPermissionResult
            );

    private final ActivityResultLauncher<String[]> healthPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    result -> {
                        if (Build.VERSION.SDK_INT >=
                                Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                                && Boolean.TRUE.equals(
                                result.get(HEALTH_READ_DISTANCE))
                                && Boolean.TRUE.equals(
                                result.get(HEALTH_READ_EXERCISE))) {
                            importHealthConnect();
                        } else if (isAdded()) {
                            Toast.makeText(
                                    requireContext(),
                                    R.string.walk_health_permission_denied,
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    }
            );

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_walk, container, false);
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        status = view.findViewById(R.id.walk_status);
        distance = view.findViewById(R.id.walk_distance);
        startButton = view.findViewById(R.id.walk_start_button);
        stopButton = view.findViewById(R.id.walk_stop_button);
        healthButton = view.findViewById(R.id.walk_health_button);
        consent = view.findViewById(R.id.walk_consent);
        startButton.setOnClickListener(button -> requestStartTracking());
        stopButton.setOnClickListener(button -> stopTracking());
        healthButton.setOnClickListener(button -> requestHealthImport());
        updateTrackingUi();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (!receiverRegistered) {
            ContextCompat.registerReceiver(
                    requireContext(),
                    statusReceiver,
                    new IntentFilter(WalkTrackingService.ACTION_STATUS),
                    ContextCompat.RECEIVER_NOT_EXPORTED
            );
            receiverRegistered = true;
        }
        handler.removeCallbacks(refresh);
        handler.post(refresh);
    }

    @Override
    public void onStop() {
        handler.removeCallbacks(refresh);
        if (receiverRegistered) {
            requireContext().unregisterReceiver(statusReceiver);
            receiverRegistered = false;
        }
        super.onStop();
    }

    private void requestStartTracking() {
        if (!consent.isChecked()) {
            showToast(R.string.walk_consent_required);
            return;
        }
        if (hasLocationPermission()) {
            startTracking();
            return;
        }
        List<String> permissions = new ArrayList<>();
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        locationPermissionLauncher.launch(permissions.toArray(new String[0]));
    }

    private void handleLocationPermissionResult(Map<String, Boolean> result) {
        if (Boolean.TRUE.equals(result.get(Manifest.permission.ACCESS_FINE_LOCATION))
                || Boolean.TRUE.equals(
                result.get(Manifest.permission.ACCESS_COARSE_LOCATION))) {
            startTracking();
        } else {
            showToast(R.string.walk_location_denied);
        }
    }

    private void startTracking() {
        Intent intent = new Intent(requireContext(), WalkTrackingService.class)
                .setAction(WalkTrackingService.ACTION_START);
        ContextCompat.startForegroundService(requireContext(), intent);
        showToast(R.string.walk_started);
        updateTrackingUi();
    }

    private void stopTracking() {
        Intent intent = new Intent(requireContext(), WalkTrackingService.class)
                .setAction(WalkTrackingService.ACTION_STOP);
        requireContext().startService(intent);
        showToast(R.string.walk_stopped);
        handler.postDelayed(this::updateTrackingUi, 400);
    }

    private void requestHealthImport() {
        if (!consent.isChecked()) {
            showToast(R.string.walk_consent_required);
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            showToast(R.string.walk_health_requires_android_14);
            return;
        }
        if (ContextCompat.checkSelfPermission(requireContext(), HEALTH_READ_DISTANCE)
                == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(
                requireContext(),
                HEALTH_READ_EXERCISE
        ) == PackageManager.PERMISSION_GRANTED) {
            importHealthConnect();
        } else {
            healthPermissionLauncher.launch(new String[]{
                    HEALTH_READ_DISTANCE,
                    HEALTH_READ_EXERCISE
            });
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void importHealthConnect() {
        healthButton.setEnabled(false);
        healthButton.setText(R.string.walk_health_importing);
        Instant end = Instant.now();
        SharedPreferences preferences = requireContext().getSharedPreferences(
                IMPORT_PREFERENCES,
                Context.MODE_PRIVATE
        );
        long savedStart = preferences.getLong(
                KEY_LAST_IMPORT,
                end.minus(7, ChronoUnit.DAYS).toEpochMilli()
        );
        Instant start = Instant.ofEpochMilli(savedStart);
        Instant earliest = end.minus(30, ChronoUnit.DAYS);
        if (start.isBefore(earliest) || !start.isBefore(end)) start = earliest;
        HealthConnectImporter.importWalkingSessions(
                requireContext(),
                start,
                end,
                new HealthConnectImporter.Callback() {
                    @Override
                    public void onSuccess(HealthConnectImporter.Result result) {
                        if (!isAdded()) return;
                        resetHealthButton();
                        if (result.activityCount == 0 || result.distanceMeters <= 0) {
                            preferences.edit()
                                    .putLong(KEY_LAST_IMPORT, result.periodEnd.toEpochMilli())
                                    .apply();
                            showToast(R.string.walk_health_empty);
                            return;
                        }
                        try {
                            WalkingMetricPayload.queue(
                                    requireContext(),
                                    result.periodStart,
                                    result.periodEnd,
                                    result.distanceMeters,
                                    result.durationSeconds,
                                    result.activityCount,
                                    "health_connect"
                            );
                            preferences.edit()
                                    .putLong(KEY_LAST_IMPORT, result.periodEnd.toEpochMilli())
                                    .apply();
                            showToast(R.string.walk_health_queued);
                        } catch (IOException exception) {
                            showToast(R.string.walk_queue_error);
                        }
                    }

                    @Override
                    public void onError() {
                        if (!isAdded()) return;
                        resetHealthButton();
                        showToast(R.string.walk_health_error);
                    }
                }
        );
    }

    private void resetHealthButton() {
        healthButton.setEnabled(true);
        healthButton.setText(R.string.walk_health_import);
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void updateTrackingUi() {
        if (!isAdded() || status == null) return;
        boolean running = WalkTrackingService.isRunning(requireContext());
        status.setText(running ? R.string.walk_status_active : R.string.walk_status_ready);
        distance.setText(getString(
                R.string.walk_distance_format,
                WalkTrackingService.distanceMeters(requireContext()) / 1609.344
        ));
        startButton.setVisibility(running ? View.GONE : View.VISIBLE);
        stopButton.setVisibility(running ? View.VISIBLE : View.GONE);
        consent.setEnabled(!running);
    }

    private void showToast(int message) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show();
    }
}
