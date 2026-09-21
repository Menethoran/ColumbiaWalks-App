package org.columbiawalks.app.ui;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.ViewModel;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.data.PhotoStorage;
import org.columbiawalks.app.data.ReportDatabaseHelper;
import org.columbiawalks.app.data.ReportLocationSource;
import org.columbiawalks.app.data.SafetyReport;
import org.columbiawalks.app.submission.ReportUploadScheduler;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

public final class PosFragment extends Fragment {
    private static final String STATE_CAMERA_PATH = "pos_camera_path";
    private static final String STATE_PHOTO_PATH = "pos_photo_path";
    private static final String STATE_LATITUDE = "pos_latitude";
    private static final String STATE_LONGITUDE = "pos_longitude";
    private static final String STATE_LOCATION_READY = "pos_location_ready";
    private static final String STATE_LOCATION_SOURCE = "pos_location_source";
    private static final String STATE_HAS_PHOTO_LOCATION =
        "pos_has_photo_location";
    private static final String STATE_PHOTO_LATITUDE = "pos_photo_latitude";
    private static final String STATE_PHOTO_LONGITUDE = "pos_photo_longitude";
    private static final String STATE_LOCATION_OVERRIDDEN =
        "pos_location_overridden";
    private static final String STATE_AUTO_SUBMIT = "pos_auto_submit";
    private static final String STATE_MANUAL_SUBMIT = "pos_manual_submit";
    private static final String STATE_DETAILS_VISIBLE = "pos_details_visible";

    private final ActivityResultLauncher<Uri> takePhotoLauncher =
        registerForActivityResult(
            new ActivityResultContracts.TakePicture(),
            this::handleCameraResult
        );
    private final ActivityResultLauncher<String> choosePhotoLauncher =
        registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            this::handleChosenPhoto
        );
    private final ActivityResultLauncher<String> mediaLocationPermissionLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (isAdded() && !isPhotoBusy()) {
                    choosePhotoLauncher.launch("image/*");
                }
            }
        );
    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            this::handleLocationPermissionResult
        );

    private ReportDatabaseHelper databaseHelper;
    private LocationManager locationManager;
    private PosPhotoOperations photoOperations;
    private final Runnable photoOperationListener =
        this::renderPhotoOperationState;
    private CancellationSignal currentLocationCancellation;
    private LocationListener currentLocationListener;
    private int locationRequestGeneration;
    private int pendingLocationPermissionGeneration = -1;
    private boolean pendingLocationPermissionExplicit;
    private File cameraCaptureFile;
    private String selectedPhotoPath;
    private double latitude;
    private double longitude;
    private boolean locationReady;
    private String locationSource = ReportLocationSource.NONE;
    private Double photoLatitude;
    private Double photoLongitude;
    private boolean locationOverridden;
    private boolean autoSubmitPending;
    private boolean manualSubmitMode;
    private boolean detailsVisible;
    private boolean submitting;

    private View cameraPrompt;
    private ImageView photoPreview;
    private MaterialButton takePhotoButton;
    private MaterialButton retakeButton;
    private MaterialButton choosePhotoButton;
    private MaterialButton retryGpsButton;
    private TextView gpsStatus;
    private MaterialButton manualCoordinatesButton;
    private TextInputLayout descriptionLayout;
    private TextInputEditText description;
    private MaterialButton submitButton;
    private View photoPreparingRow;

    @Override
    public View onCreateView(
        @NonNull LayoutInflater inflater,
        ViewGroup container,
        Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_pos, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        databaseHelper = new ReportDatabaseHelper(requireContext());
        photoOperations = new ViewModelProvider(this).get(
            PosPhotoOperations.class);
        locationManager = (LocationManager) requireContext().getSystemService(
            Context.LOCATION_SERVICE
        );
        PhotoStorage.cleanupOldPending(requireContext());

        cameraPrompt = view.findViewById(R.id.pos_camera_prompt);
        photoPreview = view.findViewById(R.id.pos_photo_preview);
        takePhotoButton = view.findViewById(R.id.pos_take_picture_button);
        retakeButton = view.findViewById(R.id.pos_retake_button);
        choosePhotoButton = view.findViewById(
            R.id.pos_choose_picture_button);
        gpsStatus = view.findViewById(R.id.pos_gps_status);
        retryGpsButton = view.findViewById(R.id.pos_retry_gps_button);
        manualCoordinatesButton = view.findViewById(
            R.id.pos_manual_coordinates_button);
        descriptionLayout = view.findViewById(R.id.pos_description_layout);
        description = view.findViewById(R.id.pos_description);
        submitButton = view.findViewById(R.id.pos_submit_button);
        photoPreparingRow = view.findViewById(R.id.pos_photo_preparing_row);

        if (savedInstanceState != null) {
            selectedPhotoPath = savedInstanceState.getString(STATE_PHOTO_PATH);
            String cameraPath = savedInstanceState.getString(STATE_CAMERA_PATH);
            if (cameraPath != null) cameraCaptureFile = new File(cameraPath);
            latitude = savedInstanceState.getDouble(STATE_LATITUDE);
            longitude = savedInstanceState.getDouble(STATE_LONGITUDE);
            locationReady = savedInstanceState.getBoolean(STATE_LOCATION_READY, false);
            locationSource = savedInstanceState.getString(
                STATE_LOCATION_SOURCE,
                locationReady
                    ? ReportLocationSource.LEGACY
                    : ReportLocationSource.NONE
            );
            if (savedInstanceState.getBoolean(
                STATE_HAS_PHOTO_LOCATION,
                false
            )) {
                photoLatitude = savedInstanceState.getDouble(
                    STATE_PHOTO_LATITUDE);
                photoLongitude = savedInstanceState.getDouble(
                    STATE_PHOTO_LONGITUDE);
            }
            locationOverridden = savedInstanceState.getBoolean(
                STATE_LOCATION_OVERRIDDEN,
                false
            );
            autoSubmitPending = savedInstanceState.getBoolean(STATE_AUTO_SUBMIT, false);
            manualSubmitMode = savedInstanceState.getBoolean(
                STATE_MANUAL_SUBMIT,
                false
            );
            detailsVisible = savedInstanceState.getBoolean(
                STATE_DETAILS_VISIBLE,
                false
            );
        }

        photoOperations.initialize(
            requireContext().getApplicationContext(),
            selectedPhotoPath
        );
        selectedPhotoPath = photoOperations.getSelectedPhotoPath();

        takePhotoButton.setOnClickListener(v -> takePhoto());
        choosePhotoButton.setOnClickListener(v -> choosePhoto());
        retakeButton.setOnClickListener(v -> retakePhoto());
        retryGpsButton.setOnClickListener(v -> requestCurrentLocation(true));
        manualCoordinatesButton.setOnClickListener(
            v -> beginCoordinateReview(autoSubmitPending));
        submitButton.setOnClickListener(v -> submitWhenReady());

        refreshPhotoPreview();
        refreshGpsStatus();
        refreshFormActions();
        photoOperations.attach(photoOperationListener);
        renderPhotoOperationState();
        if (autoSubmitPending
            && selectedPhotoPath != null
            && !locationReady) {
            view.post(this::requestCurrentLocation);
        }
    }

    private void takePhoto() {
        if (isPhotoBusy()) return;
        if (cameraCaptureFile != null) {
            cameraCaptureFile.delete();
            cameraCaptureFile = null;
        }
        try {
            cameraCaptureFile = PhotoStorage.createCameraCaptureFile(requireContext());
            Uri destination = FileProvider.getUriForFile(
                requireContext(),
                requireContext().getPackageName() + ".files",
                cameraCaptureFile
            );
            takePhotoLauncher.launch(destination);
        } catch (IOException | RuntimeException error) {
            cameraCaptureFile = null;
            Toast.makeText(requireContext(), R.string.photo_camera_unavailable, Toast.LENGTH_LONG).show();
        }
    }

    private void choosePhoto() {
        if (isPhotoBusy()) return;
        if (cameraCaptureFile != null) {
            cameraCaptureFile.delete();
            cameraCaptureFile = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_MEDIA_LOCATION
            ) != PackageManager.PERMISSION_GRANTED) {
            mediaLocationPermissionLauncher.launch(
                Manifest.permission.ACCESS_MEDIA_LOCATION);
            return;
        }
        choosePhotoLauncher.launch("image/*");
    }

    private void retakePhoto() {
        if (isPhotoBusy() || selectedPhotoPath == null) return;
        CharSequence[] choices = {
            getString(R.string.pos_replace_take_picture),
            getString(R.string.pos_replace_choose_picture)
        };
        new MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.pos_replace_dialog_title)
            .setMessage(R.string.pos_replace_dialog_message)
            .setItems(choices, (dialog, which) -> {
                pauseForPhotoReplacement();
                if (which == 0) {
                    takePhoto();
                } else {
                    choosePhoto();
                }
            })
            .setNegativeButton(R.string.cancel, null)
            .show();
    }

    private void pauseForPhotoReplacement() {
        autoSubmitPending = false;
        manualSubmitMode = true;
        cancelCurrentLocationRequest();
        refreshFormActions();
    }

    private void handleCameraResult(Boolean captured) {
        File capturedFile = cameraCaptureFile;
        cameraCaptureFile = null;
        if (capturedFile == null) return;
        if (!Boolean.TRUE.equals(captured)) {
            capturedFile.delete();
            return;
        }
        Context appContext = requireContext().getApplicationContext();
        preparePhoto(() -> PhotoStorage.createPendingPhoto(
            appContext,
            capturedFile
        ));
    }

    private void handleChosenPhoto(@Nullable Uri source) {
        if (source == null || !isAdded()) return;
        Context appContext = requireContext().getApplicationContext();
        preparePhoto(() -> PhotoStorage.createPendingPhoto(
            appContext,
            source
        ));
    }

    private void preparePhoto(PhotoPreparation preparation) {
        if (photoOperations == null
            || !photoOperations.prepare(preparation)) return;
        renderPhotoOperationState();
    }

    private void renderPhotoOperationState() {
        if (photoOperations == null || photoPreparingRow == null) return;
        boolean preparing = photoOperations.isPreparing();
        photoPreparingRow.setVisibility(preparing ? View.VISIBLE : View.GONE);
        refreshEnabledState();

        if (!isAdded()
            || getParentFragmentManager().isStateSaved()
            || !getViewLifecycleOwner().getLifecycle()
                .getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) return;

        PreparedPhotoResult result = photoOperations.getPreparedPhoto();
        if (result != null) {
            applyPreparedPhoto(result);
            photoOperations.markPreparedPhotoApplied(result.photoPath);
        }
        if (photoOperations.consumeFailure()) {
            Toast.makeText(
                requireContext(),
                R.string.photo_prepare_failed,
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private void applyPreparedPhoto(@NonNull PreparedPhotoResult result) {
        cancelCurrentLocationRequest();
        boolean preserveManualLocation = locationReady
            && ReportLocationSource.isManual(locationSource);
        double manualLatitude = latitude;
        double manualLongitude = longitude;
        String manualSource = locationSource;
        boolean manualWasOverride = locationOverridden;

        if (result.replacedPath != null
            && !result.replacedPath.equals(result.photoPath)) {
            PhotoStorage.delete(result.replacedPath);
        }
        selectedPhotoPath = result.photoPath;
        if (result.hasCoordinates()) {
            photoLatitude = result.latitude;
            photoLongitude = result.longitude;
            if (preserveManualLocation) {
                latitude = manualLatitude;
                longitude = manualLongitude;
                locationReady = true;
                locationSource = manualSource;
                locationOverridden = true;
            } else {
                latitude = result.latitude;
                longitude = result.longitude;
                locationReady = true;
                locationSource = ReportLocationSource.PHOTO_EXIF;
                locationOverridden = false;
            }
        } else {
            photoLatitude = null;
            photoLongitude = null;
            if (preserveManualLocation) {
                latitude = manualLatitude;
                longitude = manualLongitude;
                locationReady = true;
                locationSource = manualSource;
                locationOverridden = manualWasOverride;
            } else {
                locationReady = false;
                locationSource = ReportLocationSource.NONE;
                locationOverridden = false;
            }
        }
        autoSubmitPending = false;
        manualSubmitMode = false;
        detailsVisible = false;
        refreshFormActions();
        refreshPhotoPreview();
        refreshGpsStatus();
        showDetailsDecision();
    }

    private void showDetailsDecision() {
        new MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.pos_dialog_title)
            .setMessage(R.string.pos_dialog_message)
            .setNegativeButton(R.string.pos_dialog_no, (dialog, which) -> {
                description.setText("");
                manualSubmitMode = false;
                detailsVisible = false;
                refreshFormActions();
                submitWhenReady();
            })
            .setPositiveButton(R.string.pos_dialog_yes, (dialog, which) -> {
                autoSubmitPending = false;
                manualSubmitMode = true;
                detailsVisible = true;
                refreshFormActions();
                description.requestFocus();
                if (!locationReady) requestCurrentLocation();
            })
            .setNeutralButton(
                R.string.pos_dialog_review_location,
                (dialog, which) -> beginCoordinateReview(false)
            )
            .setCancelable(false)
            .show();
    }

    private void submitWhenReady() {
        if (selectedPhotoPath == null) {
            Toast.makeText(requireContext(), R.string.pos_picture_required, Toast.LENGTH_LONG).show();
            cameraPrompt.announceForAccessibility(
                getString(R.string.pos_picture_required));
            return;
        }
        if (!locationReady) {
            autoSubmitPending = true;
            Toast.makeText(requireContext(), R.string.pos_submit_waiting, Toast.LENGTH_LONG).show();
            requestCurrentLocation();
            return;
        }
        saveAndQueueReport();
    }

    private void requestCurrentLocation() {
        requestCurrentLocation(false);
    }

    private void requestCurrentLocation(boolean overrideManualLocation) {
        cancelCurrentLocationRequest();
        int requestGeneration = locationRequestGeneration;
        if (hasLocationPermission()) {
            locateDevice(requestGeneration, overrideManualLocation);
        } else {
            pendingLocationPermissionGeneration = requestGeneration;
            pendingLocationPermissionExplicit = overrideManualLocation;
            locationPermissionLauncher.launch(new String[] {
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.ACCESS_COARSE_LOCATION"
            });
        }
    }

    private void handleLocationPermissionResult(Map<String, Boolean> result) {
        int requestGeneration = pendingLocationPermissionGeneration;
        boolean explicitRequest = pendingLocationPermissionExplicit;
        pendingLocationPermissionGeneration = -1;
        pendingLocationPermissionExplicit = false;
        if (requestGeneration < 0
            || requestGeneration != locationRequestGeneration) return;
        boolean granted =
            Boolean.TRUE.equals(result.get("android.permission.ACCESS_FINE_LOCATION")) ||
            Boolean.TRUE.equals(result.get("android.permission.ACCESS_COARSE_LOCATION"));
        if (granted) {
            locateDevice(requestGeneration, explicitRequest);
        } else if (isAdded()) {
            cancelCurrentLocationRequest();
            autoSubmitPending = false;
            if (locationReady) {
                refreshGpsStatus();
            } else {
                gpsStatus.setText(R.string.pos_gps_denied);
                gpsStatus.setTextColor(ContextCompat.getColor(
                    requireContext(),
                    R.color.cw_error
                ));
            }
        }
    }

    private boolean hasLocationPermission() {
        return
            ContextCompat.checkSelfPermission(
                requireContext(),
                "android.permission.ACCESS_FINE_LOCATION"
            ) == 0 ||
            ContextCompat.checkSelfPermission(
                requireContext(),
                "android.permission.ACCESS_COARSE_LOCATION"
            ) == 0;
    }

    private void locateDevice(
        int requestGeneration,
        boolean explicitRequest
    ) {
        if (requestGeneration != locationRequestGeneration) return;
        if (locationManager == null) {
            cancelCurrentLocationRequest();
            showLocationUnavailable();
            return;
        }
        String provider = chooseLocationProvider();
        if (provider == null) {
            cancelCurrentLocationRequest();
            showLocationUnavailable();
            return;
        }
        gpsStatus.setText(R.string.pos_gps_finding);
        gpsStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.cw_text_secondary));
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                CancellationSignal signal = new CancellationSignal();
                currentLocationCancellation = signal;
                locationManager.getCurrentLocation(
                    provider,
                    signal,
                    ContextCompat.getMainExecutor(requireContext()),
                    location -> onLocationResolved(
                        location,
                        requestGeneration,
                        explicitRequest
                    )
                );
            } else {
                LocationListener listener = location -> onLocationResolved(
                    location,
                    requestGeneration,
                    explicitRequest
                );
                currentLocationListener = listener;
                locationManager.requestSingleUpdate(
                    provider,
                    listener,
                    Looper.getMainLooper()
                );
            }
        } catch (SecurityException error) {
            cancelCurrentLocationRequest();
            showLocationUnavailable();
        }
    }

    @Nullable
    private String chooseLocationProvider() {
        try {
            boolean fine = ContextCompat.checkSelfPermission(
                requireContext(),
                "android.permission.ACCESS_FINE_LOCATION"
            ) == 0;
            if (fine && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                return LocationManager.GPS_PROVIDER;
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                return LocationManager.NETWORK_PROVIDER;
            }
        } catch (RuntimeException ignored) {
        }
        return null;
    }

    private void onLocationResolved(
        @Nullable Location location,
        int requestGeneration,
        boolean explicitRequest
    ) {
        if (requestGeneration != locationRequestGeneration) return;
        cancelCurrentLocationRequest();
        if (!isAdded()
            || getParentFragmentManager().isStateSaved()) return;
        if (location == null) {
            showLocationUnavailable();
            return;
        }
        boolean higherPriorityLocation =
            ReportLocationSource.isManual(locationSource)
                || ReportLocationSource.PHOTO_EXIF.equals(locationSource);
        if (higherPriorityLocation && !explicitRequest) {
            refreshGpsStatus();
            return;
        }
        latitude = location.getLatitude();
        longitude = location.getLongitude();
        locationOverridden = photoLatitude != null && photoLongitude != null;
        locationSource = ReportLocationSource.DEVICE_GPS;
        locationReady = true;
        refreshGpsStatus();
        if (autoSubmitPending && selectedPhotoPath != null) saveAndQueueReport();
    }

    private void cancelCurrentLocationRequest() {
        locationRequestGeneration++;
        pendingLocationPermissionGeneration = -1;
        pendingLocationPermissionExplicit = false;

        CancellationSignal signal = currentLocationCancellation;
        currentLocationCancellation = null;
        if (signal != null) signal.cancel();

        LocationListener listener = currentLocationListener;
        currentLocationListener = null;
        if (listener != null && locationManager != null) {
            try {
                locationManager.removeUpdates(listener);
            } catch (RuntimeException ignored) {
            }
        }
    }

    private void showLocationUnavailable() {
        if (!isAdded()) return;
        autoSubmitPending = false;
        if (!locationReady) {
            locationSource = ReportLocationSource.NONE;
        }
        if (locationReady) {
            refreshGpsStatus();
        } else {
            gpsStatus.setText(R.string.pos_gps_unavailable);
            gpsStatus.setTextColor(ContextCompat.getColor(
                requireContext(),
                R.color.cw_error
            ));
        }
    }

    private void refreshPhotoPreview() {
        if (photoPreview == null) return;
        boolean hasPhoto = selectedPhotoPath != null && new File(selectedPhotoPath).isFile();
        if (!hasPhoto) {
            selectedPhotoPath = null;
            if (photoOperations != null) {
                photoOperations.clearSelectedPhoto();
            }
        }
        cameraPrompt.setVisibility(hasPhoto ? View.GONE : View.VISIBLE);
        photoPreview.setVisibility(hasPhoto ? View.VISIBLE : View.GONE);
        retakeButton.setVisibility(hasPhoto ? View.VISIBLE : View.GONE);
        if (hasPhoto) {
            photoPreview.setImageURI(Uri.fromFile(new File(selectedPhotoPath)));
        } else {
            photoPreview.setImageDrawable(null);
        }
    }

    private void refreshGpsStatus() {
        if (gpsStatus == null) return;
        if (locationReady) {
            String coordinates = getString(
                R.string.pos_gps_format,
                latitude,
                longitude
            );
            if (ReportLocationSource.PHOTO_EXIF.equals(locationSource)) {
                coordinates = getString(
                    R.string.pos_gps_photo_format,
                    coordinates
                );
            } else if (ReportLocationSource.MANUAL_COORDINATES.equals(
                locationSource)) {
                coordinates = getString(
                    locationOverridden
                        ? R.string.pos_gps_manual_override_format
                        : R.string.pos_gps_manual_format,
                    coordinates
                );
            } else if (ReportLocationSource.DEVICE_GPS.equals(locationSource)
                && locationOverridden) {
                coordinates = getString(
                    R.string.pos_gps_overridden_format,
                    coordinates
                );
            } else if (ReportLocationSource.DEVICE_GPS.equals(
                locationSource)) {
                coordinates = getString(
                    R.string.pos_gps_device_format,
                    coordinates
                );
            } else {
                coordinates = getString(
                    R.string.pos_location_confirmed_format,
                    coordinates
                );
            }
            gpsStatus.setText(coordinates);
            gpsStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.cw_green));
        } else {
            gpsStatus.setText(R.string.pos_gps_waiting);
            gpsStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.cw_text_secondary));
        }
    }

    private void beginCoordinateReview(boolean submitAfterSelection) {
        autoSubmitPending = false;
        cancelCurrentLocationRequest();
        if (selectedPhotoPath != null) {
            manualSubmitMode = true;
        }
        refreshFormActions();
        showCoordinateDialog(submitAfterSelection);
    }

    private void showCoordinateDialog(boolean submitAfterSelection) {
        if (!isAdded() || submitting) return;
        Context context = requireContext();
        LinearLayout fields = new LinearLayout(context);
        fields.setOrientation(LinearLayout.VERTICAL);
        int horizontalPadding = dp(22);
        fields.setPadding(horizontalPadding, dp(8), horizontalPadding, 0);

        TextInputLayout latitudeLayout = coordinateInputLayout(
            context,
            getString(R.string.pos_latitude_hint)
        );
        TextInputEditText latitudeInput = coordinateInput(latitudeLayout);
        fields.addView(latitudeLayout);

        TextInputLayout longitudeLayout = coordinateInputLayout(
            context,
            getString(R.string.pos_longitude_hint)
        );
        LinearLayout.LayoutParams longitudeParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
        longitudeParams.topMargin = dp(10);
        fields.addView(longitudeLayout, longitudeParams);
        TextInputEditText longitudeInput = coordinateInput(longitudeLayout);

        if (locationReady) {
            latitudeInput.setText(String.format(
                Locale.US,
                getString(R.string.pos_coordinate_value_format),
                latitude
            ));
            longitudeInput.setText(String.format(
                Locale.US,
                getString(R.string.pos_coordinate_value_format),
                longitude
            ));
        }

        AlertDialog dialog = new MaterialAlertDialogBuilder(context)
            .setTitle(R.string.pos_coordinate_dialog_title)
            .setMessage(R.string.pos_coordinate_dialog_message)
            .setView(fields)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.pos_use_coordinates, null)
            .create();
        dialog.setOnShowListener(unused -> dialog.getButton(
            AlertDialog.BUTTON_POSITIVE).setOnClickListener(button -> {
                Double enteredLatitude = parseCoordinate(
                    latitudeInput,
                    latitudeLayout,
                    -90.0,
                    90.0
                );
                Double enteredLongitude = parseCoordinate(
                    longitudeInput,
                    longitudeLayout,
                    -180.0,
                    180.0
                );
                if (enteredLatitude == null) {
                    latitudeInput.requestFocus();
                    return;
                }
                if (enteredLongitude == null) {
                    longitudeInput.requestFocus();
                    return;
                }

                boolean replacingAutomatic = locationReady
                    && (ReportLocationSource.PHOTO_EXIF.equals(locationSource)
                    || ReportLocationSource.DEVICE_GPS.equals(locationSource)
                    || ReportLocationSource.LEGACY.equals(locationSource));
                latitude = enteredLatitude;
                longitude = enteredLongitude;
                locationReady = true;
                locationSource = ReportLocationSource.MANUAL_COORDINATES;
                locationOverridden = locationOverridden
                    || replacingAutomatic
                    || hasPhotoCoordinates();
                cancelCurrentLocationRequest();
                autoSubmitPending = false;
                refreshGpsStatus();
                dialog.dismiss();
                gpsStatus.announceForAccessibility(getString(
                    R.string.pos_manual_coordinates_confirmed));
                if (submitAfterSelection && selectedPhotoPath != null) {
                    saveAndQueueReport();
                }
            }));
        dialog.show();
    }

    private TextInputLayout coordinateInputLayout(
        Context context,
        String hint
    ) {
        TextInputLayout layout = new TextInputLayout(context);
        layout.setBoxBackgroundMode(TextInputLayout.BOX_BACKGROUND_OUTLINE);
        layout.setHint(hint);
        layout.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return layout;
    }

    private TextInputEditText coordinateInput(TextInputLayout layout) {
        TextInputEditText input = new TextInputEditText(layout.getContext());
        input.setInputType(
            InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL
                | InputType.TYPE_NUMBER_FLAG_SIGNED
        );
        input.setSingleLine(true);
        layout.addView(input, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return input;
    }

    @Nullable
    private Double parseCoordinate(
        TextInputEditText input,
        TextInputLayout layout,
        double minimum,
        double maximum
    ) {
        String text = input.getText() == null
            ? ""
            : input.getText().toString().trim();
        if (text.isEmpty()) {
            layout.setError(getString(R.string.pos_coordinate_required));
            return null;
        }
        try {
            double coordinate = Double.parseDouble(text);
            if (!Double.isFinite(coordinate)
                || coordinate < minimum
                || coordinate > maximum) {
                layout.setError(getString(
                    R.string.pos_coordinate_range_error,
                    minimum,
                    maximum
                ));
                return null;
            }
            layout.setError(null);
            return coordinate;
        } catch (NumberFormatException exception) {
            layout.setError(getString(R.string.pos_coordinate_invalid));
            return null;
        }
    }

    private boolean hasPhotoCoordinates() {
        return photoLatitude != null && photoLongitude != null;
    }

    private void refreshFormActions() {
        if (descriptionLayout != null) {
            descriptionLayout.setVisibility(
                detailsVisible ? View.VISIBLE : View.GONE);
        }
        if (submitButton != null) {
            submitButton.setVisibility(
                manualSubmitMode ? View.VISIBLE : View.GONE);
        }
        refreshEnabledState();
    }

    private boolean isPhotoBusy() {
        return submitting
            || (photoOperations != null && photoOperations.isPreparing());
    }

    private void refreshEnabledState() {
        boolean enabled = !isPhotoBusy();
        if (takePhotoButton != null) takePhotoButton.setEnabled(enabled);
        if (choosePhotoButton != null) choosePhotoButton.setEnabled(enabled);
        if (retakeButton != null) retakeButton.setEnabled(enabled);
        if (retryGpsButton != null) retryGpsButton.setEnabled(enabled);
        if (manualCoordinatesButton != null) {
            manualCoordinatesButton.setEnabled(enabled);
        }
        if (descriptionLayout != null) descriptionLayout.setEnabled(enabled);
        if (submitButton != null) submitButton.setEnabled(enabled);
    }

    private int dp(int value) {
        return Math.round(value
            * getResources().getDisplayMetrics().density);
    }

    private void saveAndQueueReport() {
        if (submitting || selectedPhotoPath == null || !locationReady) return;
        submitting = true;
        autoSubmitPending = false;
        refreshEnabledState();
        String clientReportId = UUID.randomUUID().toString();
        String pendingPhotoPath = selectedPhotoPath;
        String committedPhotoPath = null;
        long reportId;
        try {
            committedPhotoPath = PhotoStorage.copyPendingPhotoForCommit(
                requireContext(),
                pendingPhotoPath,
                clientReportId
            );
            long now = System.currentTimeMillis();
            String observedAt = new SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                Locale.US
            ).format(new Date(now));
            String details = description.getText() == null
                ? ""
                : description.getText().toString().trim();
            SafetyReport report = new SafetyReport(
                0L,
                clientReportId,
                now,
                observedAt,
                "",
                "Medium",
                "Not involved",
                details,
                "quick_report",
                "{}",
                "unknown",
                false,
                "{}",
                "[]",
                "",
                "pos",
                "[]",
                null,
                null,
                null,
                null,
                null,
                0,
                true,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                committedPhotoPath,
                SafetyReport.STATUS_PENDING,
                null,
                null,
                0L
            );
            reportId = databaseHelper.insertReport(report);
        } catch (IOException | RuntimeException error) {
            if (committedPhotoPath != null) {
                PhotoStorage.delete(committedPhotoPath);
            }
            Toast.makeText(
                requireContext(),
                R.string.pos_save_failed,
                Toast.LENGTH_LONG
            ).show();
            submitting = false;
            refreshEnabledState();
            return;
        }

        // Keep the source draft until its committed copy is referenced by a
        // durable database row. A scheduler problem must never delete a photo
        // that the saved report now owns.
        PhotoStorage.delete(pendingPhotoPath);
        selectedPhotoPath = null;
        if (photoOperations != null) photoOperations.clearSelectedPhoto();
        boolean uploadQueued = true;
        try {
            ReportUploadScheduler.enqueue(requireContext(), reportId);
        } catch (RuntimeException error) {
            // The pending database row remains available for app-launch retry.
            uploadQueued = false;
        }
        clearForm();
        Toast.makeText(
            requireContext(),
            uploadQueued ? R.string.pos_saved : R.string.pos_saved_locally,
            Toast.LENGTH_LONG
        ).show();
        submitting = false;
        refreshEnabledState();
        ((MainActivity) requireActivity()).navigateToSavedReports();
    }

    private void clearForm() {
        PhotoStorage.delete(selectedPhotoPath);
        selectedPhotoPath = null;
        if (photoOperations != null) photoOperations.clearSelectedPhoto();
        cameraCaptureFile = null;
        cancelCurrentLocationRequest();
        locationReady = false;
        locationSource = ReportLocationSource.NONE;
        photoLatitude = null;
        photoLongitude = null;
        locationOverridden = false;
        autoSubmitPending = false;
        manualSubmitMode = false;
        detailsVisible = false;
        description.setText("");
        refreshFormActions();
        refreshPhotoPreview();
        refreshGpsStatus();
    }

    @Override
    public void onResume() {
        super.onResume();
        View view = getView();
        if (view != null) view.post(this::renderPhotoOperationState);
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        outState.putString(STATE_PHOTO_PATH, selectedPhotoPath);
        if (cameraCaptureFile != null) {
            outState.putString(STATE_CAMERA_PATH, cameraCaptureFile.getAbsolutePath());
        }
        outState.putDouble(STATE_LATITUDE, latitude);
        outState.putDouble(STATE_LONGITUDE, longitude);
        outState.putBoolean(STATE_LOCATION_READY, locationReady);
        outState.putString(STATE_LOCATION_SOURCE, locationSource);
        outState.putBoolean(
            STATE_HAS_PHOTO_LOCATION,
            photoLatitude != null && photoLongitude != null
        );
        if (photoLatitude != null && photoLongitude != null) {
            outState.putDouble(STATE_PHOTO_LATITUDE, photoLatitude);
            outState.putDouble(STATE_PHOTO_LONGITUDE, photoLongitude);
        }
        outState.putBoolean(STATE_LOCATION_OVERRIDDEN, locationOverridden);
        outState.putBoolean(STATE_AUTO_SUBMIT, autoSubmitPending);
        outState.putBoolean(STATE_MANUAL_SUBMIT, manualSubmitMode);
        outState.putBoolean(STATE_DETAILS_VISIBLE, detailsVisible);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onDestroyView() {
        if (photoOperations != null) {
            photoOperations.detach(photoOperationListener);
        }
        if (databaseHelper != null) databaseHelper.close();
        cameraPrompt = null;
        photoPreview = null;
        takePhotoButton = null;
        retakeButton = null;
        choosePhotoButton = null;
        retryGpsButton = null;
        gpsStatus = null;
        manualCoordinatesButton = null;
        descriptionLayout = null;
        description = null;
        submitButton = null;
        photoPreparingRow = null;
        super.onDestroyView();
    }

    @Override
    public void onDestroy() {
        cancelCurrentLocationRequest();
        super.onDestroy();
    }

    private static final class PreparedPhotoResult {
        private final String photoPath;
        @Nullable
        private final Double latitude;
        @Nullable
        private final Double longitude;
        @Nullable
        private final String replacedPath;

        private PreparedPhotoResult(
            @NonNull String photoPath,
            @Nullable Double latitude,
            @Nullable Double longitude,
            @Nullable String replacedPath
        ) {
            this.photoPath = photoPath;
            this.latitude = latitude;
            this.longitude = longitude;
            this.replacedPath = replacedPath;
        }

        private PreparedPhotoResult(
            @NonNull PhotoStorage.PreparedPhoto preparedPhoto,
            @Nullable String replacedPath
        ) {
            this(
                preparedPhoto.getPath(),
                preparedPhoto.getLatitude(),
                preparedPhoto.getLongitude(),
                replacedPath
            );
        }

        private boolean hasCoordinates() {
            return latitude != null && longitude != null;
        }
    }

    /**
     * Retains slow image copying, EXIF reading, and JPEG normalization across
     * view recreation. The old draft remains authoritative until a complete
     * replacement is available, so a cancellation or failure cannot consume
     * the picture the user was already reviewing.
     */
    public static final class PosPhotoOperations extends ViewModel {
        private static final String DRAFT_PREFERENCES =
            "pos_prepared_photo_draft";
        private static final String KEY_PENDING = "result_pending";
        private static final String KEY_PHOTO_PATH = "photo_path";
        private static final String KEY_REPLACED_PATH = "replaced_path";
        private static final String KEY_HAS_COORDINATES = "has_coordinates";
        private static final String KEY_LATITUDE_BITS = "latitude_bits";
        private static final String KEY_LONGITUDE_BITS = "longitude_bits";

        private final ExecutorService executor =
            Executors.newSingleThreadExecutor();
        private final Handler mainHandler = new Handler(Looper.getMainLooper());

        @Nullable
        private SharedPreferences draftPreferences;
        @Nullable
        private Runnable listener;
        @Nullable
        private String selectedPhotoPath;
        @Nullable
        private PreparedPhotoResult preparedPhotoResult;
        private boolean initialized;
        private boolean preparing;
        private boolean preparationFailure;
        private boolean cleared;
        private long generation;

        synchronized void initialize(
            @NonNull Context applicationContext,
            @Nullable String restoredPhotoPath
        ) {
            if (initialized) return;
            initialized = true;
            draftPreferences = applicationContext.getSharedPreferences(
                DRAFT_PREFERENCES,
                Context.MODE_PRIVATE
            );
            PreparedPhotoResult durableResult = restorePreparedPhoto();
            if (durableResult != null) {
                preparedPhotoResult = durableResult;
                selectedPhotoPath = durableResult.photoPath;
                return;
            }
            selectedPhotoPath = restoredPhotoPath != null
                && new File(restoredPhotoPath).isFile()
                ? restoredPhotoPath
                : null;
        }

        synchronized void attach(@NonNull Runnable stateListener) {
            listener = stateListener;
            notifyChanged();
        }

        synchronized void detach(@NonNull Runnable stateListener) {
            if (listener == stateListener) listener = null;
        }

        boolean prepare(@NonNull PhotoPreparation preparation) {
            final long operationGeneration;
            final String replacedPath;
            synchronized (this) {
                if (cleared || preparing) return false;
                preparing = true;
                preparationFailure = false;
                operationGeneration = ++generation;
                replacedPath = selectedPhotoPath;
            }
            try {
                executor.execute(() -> {
                    try {
                        completePreparation(
                            operationGeneration,
                            preparation.prepare(),
                            replacedPath
                        );
                    } catch (IOException | RuntimeException error) {
                        failPreparation(operationGeneration);
                    }
                });
            } catch (RejectedExecutionException error) {
                failPreparation(operationGeneration);
            }
            notifyChanged();
            return true;
        }

        private void completePreparation(
            long operationGeneration,
            @NonNull PhotoStorage.PreparedPhoto preparedPhoto,
            @Nullable String replacedPath
        ) {
            boolean discard;
            boolean shouldNotify;
            synchronized (this) {
                discard = cleared
                    || operationGeneration != generation
                    || !preparing;
                if (!discard) {
                    PreparedPhotoResult result = new PreparedPhotoResult(
                        preparedPhoto,
                        replacedPath
                    );
                    if (persistPreparedPhoto(result)) {
                        selectedPhotoPath = preparedPhoto.getPath();
                        preparedPhotoResult = result;
                        preparing = false;
                    } else {
                        discard = true;
                        preparing = false;
                        preparationFailure = true;
                    }
                }
                shouldNotify = !cleared;
            }
            if (discard) {
                PhotoStorage.delete(preparedPhoto.getPath());
            }
            if (shouldNotify) notifyChanged();
        }

        private void failPreparation(long operationGeneration) {
            synchronized (this) {
                if (cleared
                    || operationGeneration != generation
                    || !preparing) return;
                preparing = false;
                preparationFailure = true;
            }
            notifyChanged();
        }

        @Nullable
        synchronized String getSelectedPhotoPath() {
            return selectedPhotoPath;
        }

        synchronized boolean isPreparing() {
            return preparing;
        }

        @Nullable
        synchronized PreparedPhotoResult getPreparedPhoto() {
            return preparedPhotoResult;
        }

        void markPreparedPhotoApplied(@NonNull String appliedPath) {
            synchronized (this) {
                if (preparedPhotoResult == null
                    || !appliedPath.equals(preparedPhotoResult.photoPath)) {
                    return;
                }
                preparedPhotoResult = null;
            }
            clearPersistedPreparedPhoto();
        }

        synchronized boolean consumeFailure() {
            boolean failed = preparationFailure;
            preparationFailure = false;
            return failed;
        }

        synchronized void clearSelectedPhoto() {
            selectedPhotoPath = null;
            preparedPhotoResult = null;
            clearPersistedPreparedPhoto();
        }

        @Nullable
        private PreparedPhotoResult restorePreparedPhoto() {
            SharedPreferences preferences = draftPreferences;
            if (preferences == null
                || !preferences.getBoolean(KEY_PENDING, false)) return null;
            String photoPath = preferences.getString(KEY_PHOTO_PATH, null);
            if (photoPath == null || !new File(photoPath).isFile()) {
                clearPersistedPreparedPhoto();
                return null;
            }
            Double latitude = null;
            Double longitude = null;
            if (preferences.getBoolean(KEY_HAS_COORDINATES, false)) {
                latitude = Double.longBitsToDouble(preferences.getLong(
                    KEY_LATITUDE_BITS,
                    Double.doubleToRawLongBits(Double.NaN)
                ));
                longitude = Double.longBitsToDouble(preferences.getLong(
                    KEY_LONGITUDE_BITS,
                    Double.doubleToRawLongBits(Double.NaN)
                ));
                if (!validCoordinates(latitude, longitude)) {
                    latitude = null;
                    longitude = null;
                }
            }
            return new PreparedPhotoResult(
                photoPath,
                latitude,
                longitude,
                preferences.getString(KEY_REPLACED_PATH, null)
            );
        }

        private boolean persistPreparedPhoto(
            @NonNull PreparedPhotoResult result
        ) {
            SharedPreferences preferences = draftPreferences;
            if (preferences == null) return false;
            SharedPreferences.Editor editor = preferences.edit()
                .putString(KEY_PHOTO_PATH, result.photoPath)
                .putBoolean(KEY_PENDING, true)
                .putBoolean(
                    KEY_HAS_COORDINATES,
                    result.hasCoordinates()
                );
            if (result.replacedPath == null) {
                editor.remove(KEY_REPLACED_PATH);
            } else {
                editor.putString(KEY_REPLACED_PATH, result.replacedPath);
            }
            if (result.hasCoordinates()) {
                editor.putLong(
                    KEY_LATITUDE_BITS,
                    Double.doubleToRawLongBits(result.latitude)
                ).putLong(
                    KEY_LONGITUDE_BITS,
                    Double.doubleToRawLongBits(result.longitude)
                );
            } else {
                editor.remove(KEY_LATITUDE_BITS)
                    .remove(KEY_LONGITUDE_BITS);
            }
            try {
                return editor.commit();
            } catch (RuntimeException error) {
                return false;
            }
        }

        private void clearPersistedPreparedPhoto() {
            SharedPreferences preferences = draftPreferences;
            if (preferences == null) return;
            preferences.edit()
                .remove(KEY_PENDING)
                .remove(KEY_PHOTO_PATH)
                .remove(KEY_REPLACED_PATH)
                .remove(KEY_HAS_COORDINATES)
                .remove(KEY_LATITUDE_BITS)
                .remove(KEY_LONGITUDE_BITS)
                .apply();
        }

        private static boolean validCoordinates(
            @Nullable Double latitude,
            @Nullable Double longitude
        ) {
            return latitude != null
                && longitude != null
                && Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && longitude >= -180.0
                && longitude <= 180.0;
        }

        private void notifyChanged() {
            mainHandler.post(() -> {
                Runnable currentListener;
                synchronized (PosPhotoOperations.this) {
                    currentListener = listener;
                }
                if (currentListener != null) currentListener.run();
            });
        }

        @Override
        protected void onCleared() {
            synchronized (this) {
                cleared = true;
                generation++;
                listener = null;
                preparedPhotoResult = null;
                preparing = false;
            }
            executor.shutdownNow();
            mainHandler.removeCallbacksAndMessages(null);
        }
    }

    private interface PhotoPreparation {
        PhotoStorage.PreparedPhoto prepare() throws IOException;
    }
}
