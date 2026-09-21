package org.columbiawalks.app.ui;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.data.ReportLocationSource;
import org.columbiawalks.app.domain.ColumbiaArea;
import org.maplibre.android.annotations.Marker;
import org.maplibre.android.annotations.MarkerOptions;
import org.maplibre.android.camera.CameraPosition;
import org.maplibre.android.camera.CameraUpdateFactory;
import org.maplibre.android.geometry.LatLng;
import org.maplibre.android.maps.MapLibreMap;
import org.maplibre.android.maps.MapView;

import java.util.Map;

public class MapFragment extends Fragment implements LocationListener {
    private static final String MAP_STYLE_URL =
            "https://tiles.openfreemap.org/styles/liberty";
    private static final double INITIAL_ZOOM = 14.5;
    private static final double LOCATION_ZOOM = 17.0;

    private MapView mapView;
    private MapLibreMap map;
    private Marker reportMarker;
    private TextView locationLabel;
    private TextView outsideWarning;
    private LocationManager locationManager;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    this::handlePermissionResult
            );

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_map, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        MainActivity activity = (MainActivity) requireActivity();
        locationLabel = view.findViewById(R.id.location_label);
        outsideWarning = view.findViewById(R.id.outside_warning);
        locationManager = (LocationManager) requireContext()
                .getSystemService(android.content.Context.LOCATION_SERVICE);

        mapView = view.findViewById(R.id.map_view);
        mapView.onCreate(savedInstanceState);
        mapView.getMapAsync(mapLibreMap -> {
            map = mapLibreMap;
            map.setStyle(MAP_STYLE_URL, style -> {
                if (!isAdded()) {
                    return;
                }
                map.setCameraPosition(new CameraPosition.Builder()
                        .target(new LatLng(
                                activity.getSelectedLatitude(),
                                activity.getSelectedLongitude()))
                        .zoom(INITIAL_ZOOM)
                        .build());
                map.addOnMapClickListener(point -> {
                    selectReportLocation(
                            point.getLatitude(),
                            point.getLongitude(),
                            false,
                            true,
                            ReportLocationSource.MANUAL_MAP
                    );
                    return true;
                });
                selectReportLocation(
                        activity.getSelectedLatitude(),
                        activity.getSelectedLongitude(),
                        false,
                        false,
                        activity.getSelectedLocationSource()
                );
            });
        });

        view.findViewById(R.id.my_location_button)
                .setOnClickListener(button -> requestCurrentLocation());
        view.findViewById(R.id.report_spot_button)
                .setOnClickListener(button -> activity.navigateToReport());

        updateLocationText(activity.getSelectedLatitude(), activity.getSelectedLongitude());
    }

    private void handlePermissionResult(Map<String, Boolean> result) {
        boolean granted = Boolean.TRUE.equals(
                result.get(Manifest.permission.ACCESS_FINE_LOCATION))
                || Boolean.TRUE.equals(
                result.get(Manifest.permission.ACCESS_COARSE_LOCATION));
        if (granted) {
            locateDevice();
        } else if (isAdded()) {
            Toast.makeText(
                    requireContext(),
                    R.string.location_permission_denied,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void requestCurrentLocation() {
        if (hasLocationPermission()) {
            locateDevice();
            return;
        }

        if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)
                || shouldShowRequestPermissionRationale(
                Manifest.permission.ACCESS_COARSE_LOCATION)) {
            new MaterialAlertDialogBuilder(requireContext())
                    .setMessage(R.string.location_permission_explanation)
                    .setPositiveButton(R.string.use_my_location, (dialog, which) ->
                            launchLocationPermissionRequest())
                    .setNegativeButton(R.string.cancel, null)
                    .show();
        } else {
            launchLocationPermissionRequest();
        }
    }

    private void launchLocationPermissionRequest() {
        locationPermissionLauncher.launch(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        });
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

    @SuppressLint("MissingPermission")
    private void locateDevice() {
        if (locationManager == null || !hasAnyLocationProvider()) {
            showLocationUnavailable();
            return;
        }

        Toast.makeText(
                requireContext(),
                R.string.finding_location,
                Toast.LENGTH_SHORT
        ).show();

        String provider = chooseProvider();
        if (provider == null) {
            showLocationUnavailable();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            locationManager.getCurrentLocation(
                    provider,
                    null,
                    ContextCompat.getMainExecutor(requireContext()),
                    location -> {
                        if (location == null) {
                            showLocationUnavailable();
                        } else {
                            onLocationResolved(location);
                        }
                    }
            );
        } else {
            locationManager.requestSingleUpdate(provider, this, Looper.getMainLooper());
        }
    }

    private boolean hasAnyLocationProvider() {
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    private String chooseProvider() {
        boolean preciseGranted = ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;

        if (preciseGranted
                && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            return LocationManager.NETWORK_PROVIDER;
        }
        return null;
    }

    private void onLocationResolved(Location location) {
        if (!isAdded()) {
            return;
        }
        selectReportLocation(
                location.getLatitude(),
                location.getLongitude(),
                true,
                true,
                ReportLocationSource.DEVICE_GPS
        );
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        onLocationResolved(location);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // Required by LocationListener on Android 8 and 9.
    }

    @Override
    public void onProviderEnabled(@NonNull String provider) {
        // No continuous tracking is used, so no action is required.
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {
        // The next location request will show the location settings prompt.
    }

    private void selectReportLocation(
            double latitude,
            double longitude,
            boolean animateCamera,
            boolean confirmSelection,
            String locationSource
    ) {
        if (!isAdded()) {
            return;
        }

        MainActivity activity = (MainActivity) requireActivity();
        if (confirmSelection) {
            activity.setSelectedLocation(
                    latitude,
                    longitude,
                    locationSource
            );
        }
        updateLocationText(latitude, longitude);

        if (map == null || map.getStyle() == null) {
            return;
        }

        LatLng position = new LatLng(latitude, longitude);
        if (reportMarker == null) {
            reportMarker = map.addMarker(new MarkerOptions()
                    .position(position)
                    .title(getString(R.string.report_location)));
        } else {
            reportMarker.setPosition(position);
            map.updateMarker(reportMarker);
        }

        if (animateCamera) {
            map.animateCamera(
                    CameraUpdateFactory.newLatLngZoom(position, LOCATION_ZOOM),
                    700
            );
        }
    }

    private void updateLocationText(double latitude, double longitude) {
        if (locationLabel == null) {
            return;
        }
        locationLabel.setText(getString(
                R.string.map_location_format,
                latitude,
                longitude
        ));
        outsideWarning.setVisibility(
                ColumbiaArea.isNearColumbia(latitude, longitude)
                        ? View.GONE
                        : View.VISIBLE
        );
    }

    private void showLocationUnavailable() {
        if (!isAdded()) {
            return;
        }
        Toast.makeText(
                requireContext(),
                R.string.location_unavailable,
                Toast.LENGTH_LONG
        ).show();
        if (!hasAnyLocationProvider()) {
            startActivity(new android.content.Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (mapView != null) {
            mapView.onStart();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (mapView != null) {
            mapView.onResume();
        }
    }

    @Override
    public void onPause() {
        if (mapView != null) {
            mapView.onPause();
        }
        super.onPause();
    }

    @Override
    public void onStop() {
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        if (mapView != null) {
            mapView.onStop();
        }
        super.onStop();
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        if (mapView != null) {
            mapView.onLowMemory();
        }
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (mapView != null) {
            mapView.onSaveInstanceState(outState);
        }
    }

    @Override
    public void onDestroyView() {
        if (mapView != null) {
            mapView.onDestroy();
            mapView = null;
        }
        map = null;
        reportMarker = null;
        locationLabel = null;
        outsideWarning = null;
        super.onDestroyView();
    }
}
