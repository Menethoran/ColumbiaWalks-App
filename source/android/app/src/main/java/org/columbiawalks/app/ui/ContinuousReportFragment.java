package org.columbiawalks.app.ui;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Rect;
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
import android.view.accessibility.AccessibilityEvent;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
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
import org.columbiawalks.app.domain.OfficialEmailPolicy;
import org.columbiawalks.app.submission.ReportUploadScheduler;
import org.json.JSONException;
import org.json.JSONObject;
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

/**
 * A camera-first reporting flow intended for repeated observations made while
 * walking. Each saved report is independent, while the selected hierarchy and
 * continuous session remain in place for the next observation.
 */
public final class ContinuousReportFragment extends Fragment
        implements LocationListener {
    private static final String STATE_PHOTO_PATH = "continuous_photo_path";
    private static final String STATE_CAMERA_PATH = "continuous_camera_path";
    private static final String STATE_SESSION_ID = "continuous_session_id";
    private static final String STATE_SEQUENCE = "continuous_sequence";
    private static final String STATE_HIERARCHY = "continuous_hierarchy";
    private static final String STATE_LIP_HEIGHT = "continuous_lip_height";
    private static final String STATE_VEHICLE_ISSUE =
            "continuous_vehicle_issue";
    private static final String STATE_COMMENTS = "continuous_comments";
    private static final String STATE_MISSING_SIDEWALK =
            "continuous_missing_sidewalk";
    private static final String STATE_LICENSE_PLATE =
            "continuous_license_plate";
    private static final String STATE_PLATE_STATE =
            "continuous_plate_state";
    private static final String STATE_HAS_PREPARED_PHOTO_LOCATION =
            "continuous_has_prepared_photo_location";
    private static final String STATE_PREPARED_PHOTO_LATITUDE =
            "continuous_prepared_photo_latitude";
    private static final String STATE_PREPARED_PHOTO_LONGITUDE =
            "continuous_prepared_photo_longitude";
    private static final String STATE_PREPARED_PHOTO_NEEDS_APPLICATION =
            "continuous_prepared_photo_needs_application";
    private static final String STATE_SAVE_COMPLETION_PENDING =
            "continuous_save_completion_pending";
    private static final String STATE_TEST_EMAIL_OPT_IN =
            "continuous_test_email_opt_in";

    private static final String[] HIERARCHY_VALUES = {
            "sidewalk",
            "vehicle",
            "crosswalk",
            "trip_hazard",
            "lighting_or_visibility",
            "accessibility_ada",
            "school_route",
            "police_response",
            "other"
    };
    private static final String[] CATEGORY_VALUES = {
            "sidewalk_safety",
            "vehicle_safety",
            "crosswalk_safety",
            "trip_hazards",
            "lighting_or_visibility",
            "accessibility_ada",
            "school_route_safety",
            "police_response",
            "not_included_elsewhere"
    };
    private static final String[] SIDEWALK_LIP_VALUES = {
            "",
            "quarter_inch_or_less",
            "over_quarter_inch",
            "over_half_inch",
            "over_one_inch",
            "over_two_inches"
    };
    private static final String[] VEHICLE_ISSUE_VALUES = {
            "",
            "aggressive_driving",
            "crosswalk_incursion",
            "illegal_u_turn",
            "speeding",
            "failure_to_yield",
            "red_light_violation",
            "stop_sign_violation",
            "blocked_crosswalk_or_sidewalk",
            "illegal_parking",
            "distracted_driving",
            "other"
    };

    private final ActivityResultLauncher<String> choosePhotoLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.GetContent(),
                    this::handleChosenPhoto
            );
    private final ActivityResultLauncher<Uri> takePhotoLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.TakePicture(),
                    this::handleCameraResult
            );
    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    this::handleLocationPermissionResult
            );
    private final ActivityResultLauncher<String> mediaLocationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> choosePhotoLauncher.launch("image/*")
            );

    private Spinner hierarchySpinner;
    private ScrollView reportScroll;
    private Spinner sidewalkLipSpinner;
    private Spinner vehicleIssueSpinner;
    private String[] hierarchyLabels;
    private String[] sidewalkLipLabels;
    private String[] vehicleIssueLabels;
    private View sidewalkLipSection;
    private View vehicleIssueSection;
    private CheckBox missingSidewalkCheckbox;
    private TextInputEditText licensePlate;
    private TextInputEditText plateState;
    private View officialEmailNoticeContainer;
    private View officialEmailDetails;
    private TextView officialEmailNotice;
    private TextView officialEmailRequirements;
    private CheckBox officialEmailOptIn;
    private MaterialButton officialEmailToggleButton;
    private TextInputEditText comments;
    private MaterialButton takePhotoButton;
    private MaterialButton choosePhotoButton;
    private MaterialButton removePhotoButton;
    private MaterialButton useDeviceLocationButton;
    private MaterialButton overrideCoordinatesButton;
    private MaterialButton submitButton;
    private ImageView photoPreview;
    private View photoPreviewContainer;
    private TextView photoError;
    private TextView locationLabel;
    private TextView locationSourceLabel;
    private TextView locationError;
    private TextView sessionLabel;
    private View workingRow;
    private TextView workingLabel;
    private TextView readyHint;

    private ContinuousReportOperations operations;
    private final Runnable operationStateListener =
            this::renderOperationState;
    private LocationManager locationManager;
    private CancellationSignal currentLocationCancellation;
    private File cameraCaptureFile;
    private boolean busy;
    private boolean findingLocation;
    private boolean forceDeviceLocation;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(
                R.layout.fragment_continuous_report,
                container,
                false
        );
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        bindViews(view);
        operations = new ViewModelProvider(this).get(
                ContinuousReportOperations.class);
        locationManager = (LocationManager) requireContext()
                .getSystemService(Context.LOCATION_SERVICE);

        configureSpinners();
        restoreState(savedInstanceState);
        initializeOperations(savedInstanceState);
        configureActions();
        updateHierarchySections();
        refreshPhotoPreview();
        updateSessionLabel();
        operations.attach(operationStateListener);
        renderOperationState();

        PhotoStorage.cleanupOldPending(requireContext());
        MainActivity activity = (MainActivity) requireActivity();
        if (savedInstanceState == null) {
            activity.clearContinuousReportLocation();
        }
        if (!activity.isContinuousReportLocationConfirmed()) {
            requestCurrentLocation(false);
        }
        refreshLocation();
    }

    private void bindViews(View root) {
        reportScroll = root.findViewById(R.id.continuous_scroll);
        hierarchySpinner = root.findViewById(
                R.id.continuous_hierarchy_spinner);
        sidewalkLipSpinner = root.findViewById(
                R.id.continuous_sidewalk_lip_spinner);
        vehicleIssueSpinner = root.findViewById(
                R.id.continuous_vehicle_issue_spinner);
        sidewalkLipSection = root.findViewById(
                R.id.continuous_sidewalk_lip_section);
        vehicleIssueSection = root.findViewById(
                R.id.continuous_vehicle_issue_section);
        missingSidewalkCheckbox = root.findViewById(
                R.id.continuous_missing_sidewalk);
        licensePlate = root.findViewById(
                R.id.continuous_license_plate);
        plateState = root.findViewById(
                R.id.continuous_plate_state);
        officialEmailNoticeContainer = root.findViewById(
                R.id.continuous_official_email_notice_container);
        officialEmailDetails = root.findViewById(
                R.id.continuous_official_email_details);
        officialEmailNotice = root.findViewById(
                R.id.continuous_official_email_notice);
        officialEmailRequirements = root.findViewById(
                R.id.continuous_official_email_requirements);
        officialEmailOptIn = root.findViewById(
                R.id.continuous_official_email_opt_in);
        officialEmailToggleButton = root.findViewById(
                R.id.toggle_continuous_official_email_details);
        comments = root.findViewById(R.id.continuous_comments);
        takePhotoButton = root.findViewById(
                R.id.take_continuous_photo_button);
        choosePhotoButton = root.findViewById(
                R.id.choose_continuous_photo_button);
        removePhotoButton = root.findViewById(
                R.id.remove_continuous_photo_button);
        useDeviceLocationButton = root.findViewById(
                R.id.use_device_location_button);
        overrideCoordinatesButton = root.findViewById(
                R.id.override_coordinates_button);
        submitButton = root.findViewById(R.id.continuous_submit_button);
        photoPreview = root.findViewById(R.id.continuous_photo_preview);
        photoPreviewContainer = root.findViewById(
                R.id.continuous_photo_preview_container);
        photoError = root.findViewById(R.id.continuous_photo_error);
        locationLabel = root.findViewById(R.id.continuous_location_label);
        locationSourceLabel = root.findViewById(
                R.id.continuous_location_source_label);
        locationError = root.findViewById(R.id.continuous_location_error);
        sessionLabel = root.findViewById(R.id.continuous_session_label);
        workingRow = root.findViewById(R.id.continuous_working_row);
        workingLabel = root.findViewById(R.id.continuous_working_label);
        readyHint = root.findViewById(R.id.continuous_ready_hint);
    }

    private void configureSpinners() {
        hierarchyLabels = getResources().getStringArray(
                R.array.continuous_hierarchy_labels);
        sidewalkLipLabels = getResources().getStringArray(
                R.array.continuous_sidewalk_lip_labels);
        vehicleIssueLabels = getResources().getStringArray(
                R.array.continuous_vehicle_issue_labels);
        hierarchySpinner.setAdapter(spinnerAdapter(hierarchyLabels));
        sidewalkLipSpinner.setAdapter(spinnerAdapter(sidewalkLipLabels));
        vehicleIssueSpinner.setAdapter(spinnerAdapter(vehicleIssueLabels));
        hierarchySpinner.setOnItemSelectedListener(
                new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(
                            AdapterView<?> parent,
                            View selectedView,
                            int position,
                            long id
                    ) {
                        updateHierarchySections();
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> parent) {
                        updateHierarchySections();
                    }
                }
        );
        vehicleIssueSpinner.setOnItemSelectedListener(
                new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(
                            AdapterView<?> parent,
                            View selectedView,
                            int position,
                            long id
                    ) {
                        updateOfficialEmailUi();
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> parent) {
                        updateOfficialEmailUi();
                    }
                }
        );
    }

    private ArrayAdapter<String> spinnerAdapter(String[] labels) {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                labels
        );
        adapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item);
        return adapter;
    }

    private void restoreState(@Nullable Bundle savedInstanceState) {
        if (savedInstanceState == null) {
            return;
        }
        String cameraPath = savedInstanceState.getString(STATE_CAMERA_PATH);
        if (cameraPath != null && !cameraPath.trim().isEmpty()) {
            cameraCaptureFile = new File(cameraPath);
        }
        hierarchySpinner.setSelection(validPosition(
                savedInstanceState.getInt(STATE_HIERARCHY, 0),
                HIERARCHY_VALUES.length
        ));
        sidewalkLipSpinner.setSelection(validPosition(
                savedInstanceState.getInt(STATE_LIP_HEIGHT, 0),
                SIDEWALK_LIP_VALUES.length
        ));
        vehicleIssueSpinner.setSelection(validPosition(
                savedInstanceState.getInt(STATE_VEHICLE_ISSUE, 0),
                VEHICLE_ISSUE_VALUES.length
        ));
        missingSidewalkCheckbox.setChecked(savedInstanceState.getBoolean(
                STATE_MISSING_SIDEWALK,
                false
        ));
        licensePlate.setText(savedInstanceState.getString(
                STATE_LICENSE_PLATE,
                ""
        ));
        plateState.setText(savedInstanceState.getString(
                STATE_PLATE_STATE,
                ""
        ));
        comments.setText(savedInstanceState.getString(STATE_COMMENTS, ""));
        officialEmailOptIn.setChecked(savedInstanceState.getBoolean(
                STATE_TEST_EMAIL_OPT_IN,
                false
        ));
    }

    private void initializeOperations(@Nullable Bundle savedInstanceState) {
        String restoredSession = savedInstanceState == null
                ? null
                : savedInstanceState.getString(STATE_SESSION_ID);
        int restoredSequence = savedInstanceState == null
                ? 1
                : Math.max(1, savedInstanceState.getInt(STATE_SEQUENCE, 1));
        String restoredPhotoPath = savedInstanceState == null
                ? null
                : savedInstanceState.getString(STATE_PHOTO_PATH);
        Double restoredPhotoLatitude = null;
        Double restoredPhotoLongitude = null;
        boolean restoredPhotoNeedsApplication = savedInstanceState != null
                && savedInstanceState.getBoolean(
                STATE_PREPARED_PHOTO_NEEDS_APPLICATION,
                false
        );
        boolean restoredSaveCompletionPending = savedInstanceState != null
                && savedInstanceState.getBoolean(
                STATE_SAVE_COMPLETION_PENDING,
                false
        );
        if (savedInstanceState != null
                && savedInstanceState.getBoolean(
                STATE_HAS_PREPARED_PHOTO_LOCATION,
                false
        )) {
            restoredPhotoLatitude = savedInstanceState.getDouble(
                    STATE_PREPARED_PHOTO_LATITUDE);
            restoredPhotoLongitude = savedInstanceState.getDouble(
                    STATE_PREPARED_PHOTO_LONGITUDE);
        }
        operations.initialize(
                requireContext().getApplicationContext(),
                restoredSession == null || restoredSession.trim().isEmpty()
                        ? UUID.randomUUID().toString()
                        : restoredSession,
                restoredSequence,
                restoredPhotoPath,
                restoredPhotoLatitude,
                restoredPhotoLongitude,
                restoredPhotoNeedsApplication,
                restoredSaveCompletionPending
        );
    }

    private int validPosition(int position, int itemCount) {
        return position >= 0 && position < itemCount ? position : 0;
    }

    private void configureActions() {
        takePhotoButton.setOnClickListener(button -> takePhoto());
        choosePhotoButton.setOnClickListener(button -> choosePhoto());
        removePhotoButton.setOnClickListener(button -> removeSelectedPhoto());
        useDeviceLocationButton.setOnClickListener(button ->
                requestCurrentLocation(true));
        overrideCoordinatesButton.setOnClickListener(button ->
                showCoordinateDialog());
        submitButton.setOnClickListener(button -> saveAndReportNext());
        officialEmailToggleButton.setOnClickListener(button ->
                setOfficialEmailDetailsExpanded(
                        officialEmailDetails.getVisibility() != View.VISIBLE));
        officialEmailOptIn.setOnCheckedChangeListener(
                (button, checked) -> updateOfficialEmailToggleLabel());
        missingSidewalkCheckbox.setOnCheckedChangeListener(
                (button, checked) -> updateOfficialEmailUi());
    }

    private void updateHierarchySections() {
        if (hierarchySpinner == null) {
            return;
        }
        String kind = selectedHierarchy();
        boolean sidewalk = "sidewalk".equals(kind);
        boolean vehicle = "vehicle".equals(kind);
        sidewalkLipSection.setVisibility(
                sidewalk ? View.VISIBLE : View.GONE);
        vehicleIssueSection.setVisibility(
                vehicle ? View.VISIBLE : View.GONE);
        if (!sidewalk) {
            sidewalkLipSpinner.setSelection(0);
            missingSidewalkCheckbox.setChecked(false);
        }
        if (!vehicle) {
            vehicleIssueSpinner.setSelection(0);
            licensePlate.setText("");
            plateState.setText("");
        }
        updateOfficialEmailUi();
    }

    private String selectedHierarchy() {
        int position = validPosition(
                hierarchySpinner.getSelectedItemPosition(),
                HIERARCHY_VALUES.length
        );
        return HIERARCHY_VALUES[position];
    }

    private String selectedCategory() {
        int position = validPosition(
                hierarchySpinner.getSelectedItemPosition(),
                CATEGORY_VALUES.length
        );
        return CATEGORY_VALUES[position];
    }

    @Nullable
    private String selectedLipHeight() {
        if (!"sidewalk".equals(selectedHierarchy())) {
            return null;
        }
        return optionalValue(
                SIDEWALK_LIP_VALUES,
                sidewalkLipSpinner.getSelectedItemPosition()
        );
    }

    @Nullable
    private String selectedVehicleIssue() {
        if (!"vehicle".equals(selectedHierarchy())) {
            return null;
        }
        return optionalValue(
                VEHICLE_ISSUE_VALUES,
                vehicleIssueSpinner.getSelectedItemPosition()
        );
    }

    private String quickReportTypesJson() {
        return "sidewalk".equals(selectedHierarchy())
                && missingSidewalkCheckbox.isChecked()
                ? "[\"missing_sidewalk\"]"
                : "[]";
    }

    private String vehicleDetailsJson() {
        if (!"vehicle".equals(selectedHierarchy())) {
            return "{}";
        }
        JSONObject details = new JSONObject();
        try {
            String plate = textValue(licensePlate);
            String jurisdiction = textValue(plateState);
            if (!plate.isEmpty()) {
                details.put("license_plate", plate);
            }
            if (!jurisdiction.isEmpty()) {
                details.put("plate_state", jurisdiction);
            }
        } catch (JSONException ignored) {
            return "{}";
        }
        return details.toString();
    }

    private void updateOfficialEmailUi() {
        if (officialEmailNoticeContainer == null
                || officialEmailNotice == null
                || officialEmailOptIn == null) {
            return;
        }
        OfficialEmailPolicy.Routing routing = OfficialEmailPolicy.classify(
                quickReportTypesJson(),
                selectedHierarchy(),
                selectedVehicleIssue()
        );
        boolean eligible = routing != OfficialEmailPolicy.Routing.NONE;
        officialEmailNoticeContainer.setVisibility(
                eligible ? View.VISIBLE : View.GONE);
        if (eligible) {
            officialEmailNotice.setText(routing
                    == OfficialEmailPolicy.Routing.CODES
                    ? R.string.continuous_official_email_disclosure_codes
                    : R.string
                    .continuous_official_email_disclosure_police_mayor);
        } else {
            officialEmailOptIn.setChecked(false);
            setOfficialEmailDetailsExpanded(false);
        }
        boolean requirementsMet = eligible
                && officialEmailRequirementsMet();
        officialEmailOptIn.setEnabled(requirementsMet);
        if (!requirementsMet) {
            officialEmailOptIn.setChecked(false);
        }
        if (officialEmailRequirements != null) {
            officialEmailRequirements.setText(requirementsMet
                    ? R.string.official_email_ready
                    : R.string.continuous_official_email_requirements);
        }
        submitButton.setText(R.string.continuous_submit_next);
        submitButton.setContentDescription(getString(
                R.string.continuous_submit_next_description));
        updateOfficialEmailToggleLabel();
    }

    private boolean officialEmailRequirementsMet() {
        if (operations == null || !isAdded()) {
            return false;
        }
        String selectedPhotoPath = operations.getSelectedPhotoPath();
        boolean hasPhoto = selectedPhotoPath != null
                && new File(selectedPhotoPath).isFile();
        MainActivity activity = (MainActivity) requireActivity();
        return hasPhoto
                && activity.isContinuousReportLocationConfirmed()
                && OfficialEmailPolicy.isOfficialEmailLocationEligible(
                activity.getContinuousReportLatitude(),
                activity.getContinuousReportLongitude()
        );
    }

    private void updateOfficialEmailToggleLabel() {
        if (officialEmailToggleButton == null || officialEmailOptIn == null) {
            return;
        }
        officialEmailToggleButton.setText(officialEmailOptIn.isChecked()
                ? R.string.official_email_optional_title_on
                : R.string.official_email_optional_title);
    }

    private void setOfficialEmailDetailsExpanded(boolean expanded) {
        if (officialEmailDetails == null
                || officialEmailToggleButton == null) {
            return;
        }
        officialEmailDetails.setVisibility(
                expanded ? View.VISIBLE : View.GONE);
        officialEmailToggleButton.setIconResource(expanded
                ? android.R.drawable.arrow_up_float
                : android.R.drawable.arrow_down_float);
        officialEmailToggleButton.setContentDescription(getString(expanded
                ? R.string.official_email_collapse
                : R.string.official_email_expand));
    }

    @Nullable
    private String optionalValue(String[] values, int position) {
        int safePosition = validPosition(position, values.length);
        String value = values[safePosition];
        return value.isEmpty() ? null : value;
    }

    private void takePhoto() {
        if (busy) {
            return;
        }
        try {
            cameraCaptureFile =
                    PhotoStorage.createCameraCaptureFile(requireContext());
            Uri destination = FileProvider.getUriForFile(
                    requireContext(),
                    requireContext().getPackageName() + ".files",
                    cameraCaptureFile
            );
            takePhotoLauncher.launch(destination);
        } catch (IOException | RuntimeException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.continuous_camera_unavailable,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void choosePhoto() {
        if (busy) {
            return;
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

    private void handleCameraResult(Boolean captured) {
        File capturedFile = cameraCaptureFile;
        cameraCaptureFile = null;
        if (capturedFile == null) {
            return;
        }
        if (!Boolean.TRUE.equals(captured)) {
            capturedFile.delete();
            return;
        }
        Context appContext = requireContext().getApplicationContext();
        preparePhotoAsync(() -> PhotoStorage.createPendingPhoto(
                appContext,
                capturedFile
        ));
    }

    private void handleChosenPhoto(@Nullable Uri source) {
        if (source == null || !isAdded()) {
            return;
        }
        Context appContext = requireContext().getApplicationContext();
        preparePhotoAsync(() -> PhotoStorage.createPendingPhoto(
                appContext,
                source
        ));
    }

    private void preparePhotoAsync(PhotoPreparation preparation) {
        if (busy || !operations.beginPreparingPhoto()) {
            return;
        }
        photoError.setVisibility(View.GONE);
        renderOperationState();
        try {
            operations.execute(() -> {
                try {
                    PhotoStorage.PreparedPhoto preparedPhoto =
                            preparation.prepare();
                    operations.completePreparedPhoto(preparedPhoto);
                } catch (IOException | RuntimeException exception) {
                    operations.failPreparedPhoto();
                }
            });
        } catch (RejectedExecutionException exception) {
            operations.failPreparedPhoto();
        }
    }

    private void applyPreparedPhoto(
            @NonNull PhotoStorage.PreparedPhoto preparedPhoto
    ) {
        applyPreparedPhotoLocation(
                preparedPhoto.hasCoordinates(),
                preparedPhoto.getLatitude(),
                preparedPhoto.getLongitude()
        );
    }

    private void applyPreparedPhotoLocation(
            boolean hasCoordinates,
            @Nullable Double preparedLatitude,
            @Nullable Double preparedLongitude
    ) {
        MainActivity activity = (MainActivity) requireActivity();
        boolean hadLocation = activity.isContinuousReportLocationConfirmed();
        double previousLatitude = activity.getContinuousReportLatitude();
        double previousLongitude = activity.getContinuousReportLongitude();
        String previousSource = activity.getContinuousReportLocationSource();

        if (hasCoordinates
                && preparedLatitude != null
                && preparedLongitude != null) {
            cancelCurrentLocationRequest();
            activity.setContinuousReportLocation(
                    preparedLatitude,
                    preparedLongitude,
                    ReportLocationSource.PHOTO_EXIF
            );
        } else {
            activity.clearContinuousReportLocation();
            if (hadLocation
                    && ReportLocationSource.isManual(previousSource)) {
                activity.setContinuousReportLocation(
                        previousLatitude,
                        previousLongitude,
                        previousSource
                );
            } else {
                requestCurrentLocation(false);
            }
        }
        refreshPhotoPreview();
        refreshLocation();
    }

    private void removeSelectedPhoto() {
        if (busy) {
            return;
        }
        operations.removeSelectedPhoto();
        photoError.setVisibility(View.GONE);

        MainActivity activity = (MainActivity) requireActivity();
        boolean hadLocation = activity.isContinuousReportLocationConfirmed();
        double previousLatitude = activity.getContinuousReportLatitude();
        double previousLongitude = activity.getContinuousReportLongitude();
        String previousSource = activity.getContinuousReportLocationSource();
        activity.clearContinuousReportLocation();
        if (hadLocation
                && ReportLocationSource.isManual(previousSource)) {
            activity.setContinuousReportLocation(
                    previousLatitude,
                    previousLongitude,
                    previousSource
            );
        } else {
            requestCurrentLocation(false);
        }
        refreshPhotoPreview();
        refreshLocation();
    }

    private void refreshPhotoPreview() {
        if (photoPreview == null || photoPreviewContainer == null) {
            return;
        }
        String selectedPhotoPath = operations.getSelectedPhotoPath();
        boolean hasPhoto = selectedPhotoPath != null
                && new File(selectedPhotoPath).isFile();
        photoPreviewContainer.setVisibility(
                hasPhoto ? View.VISIBLE : View.GONE);
        if (hasPhoto) {
            photoPreview.setImageURI(null);
            photoPreview.setImageURI(Uri.fromFile(
                    new File(selectedPhotoPath)));
        } else {
            photoPreview.setImageDrawable(null);
        }
        updateOfficialEmailUi();
    }

    private void refreshLocation() {
        if (locationLabel == null || !isAdded()) {
            return;
        }
        MainActivity activity = (MainActivity) requireActivity();
        if (!activity.isContinuousReportLocationConfirmed()) {
            locationLabel.setText(
                    findingLocation
                            ? R.string.continuous_finding_current_location
                            : R.string.continuous_no_location
            );
            locationSourceLabel.setText(
                    findingLocation
                            ? R.string.continuous_checking_device_gps
                            : R.string.continuous_location_waiting
            );
            updateOfficialEmailUi();
            return;
        }
        locationLabel.setText(String.format(
                Locale.US,
                getString(R.string.continuous_coordinate_pair_format),
                activity.getContinuousReportLatitude(),
                activity.getContinuousReportLongitude()
        ));
        locationSourceLabel.setText(locationSourceDescription(
                activity.getContinuousReportLocationSource(),
                activity.isContinuousReportLocationOverridden()
        ));
        locationError.setVisibility(View.GONE);
        updateOfficialEmailUi();
    }

    private String locationSourceDescription(
            @Nullable String source,
            boolean overridden
    ) {
        if (ReportLocationSource.PHOTO_EXIF.equals(source)) {
            return getString(R.string.continuous_location_photo);
        }
        if (ReportLocationSource.DEVICE_GPS.equals(source)) {
            return overridden
                    ? getString(
                    R.string.continuous_location_device_override)
                    : getString(R.string.continuous_location_device);
        }
        if (ReportLocationSource.MANUAL_COORDINATES.equals(source)) {
            return overridden
                    ? getString(
                    R.string.continuous_location_manual_override)
                    : getString(
                    R.string.continuous_location_manual_coordinates);
        }
        if (ReportLocationSource.MANUAL_MAP.equals(source)) {
            return overridden
                    ? getString(R.string.continuous_location_map_override)
                    : getString(R.string.continuous_location_map);
        }
        return getString(R.string.continuous_location_source_unavailable);
    }

    private void requestCurrentLocation(boolean requestedByUser) {
        if (!isAdded()) {
            return;
        }
        forceDeviceLocation = requestedByUser;
        if (hasLocationPermission()) {
            locateDevice();
            return;
        }
        locationPermissionLauncher.launch(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        });
    }

    private void handleLocationPermissionResult(Map<String, Boolean> result) {
        boolean granted = Boolean.TRUE.equals(
                result.get(Manifest.permission.ACCESS_FINE_LOCATION))
                || Boolean.TRUE.equals(
                result.get(Manifest.permission.ACCESS_COARSE_LOCATION));
        if (granted) {
            locateDevice();
        } else if (isAdded()) {
            forceDeviceLocation = false;
            finishFindingLocation();
            Toast.makeText(
                    requireContext(),
                    R.string.continuous_location_permission_denied,
                    Toast.LENGTH_LONG
            ).show();
            refreshLocation();
        }
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
        if (locationManager == null) {
            finishFindingLocation();
            return;
        }
        String provider = chooseLocationProvider();
        if (provider == null) {
            finishFindingLocation();
            if (isAdded()) {
                Toast.makeText(
                        requireContext(),
                        R.string.continuous_device_location_unavailable,
                        Toast.LENGTH_LONG
                ).show();
            }
            return;
        }
        cancelCurrentLocationRequest(false);
        findingLocation = true;
        useDeviceLocationButton.setEnabled(false);
        useDeviceLocationButton.setText(R.string.continuous_finding_gps);
        refreshLocation();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            currentLocationCancellation = new CancellationSignal();
            locationManager.getCurrentLocation(
                    provider,
                    currentLocationCancellation,
                    ContextCompat.getMainExecutor(requireContext()),
                    location -> {
                        currentLocationCancellation = null;
                        if (location == null) {
                            finishFindingLocation();
                            if (isAdded()) {
                                Toast.makeText(
                                        requireContext(),
                                        R.string.continuous_current_gps_unavailable,
                                        Toast.LENGTH_LONG
                                ).show();
                            }
                            return;
                        }
                        onLocationResolved(location);
                    }
            );
        } else {
            locationManager.requestSingleUpdate(
                    provider,
                    this,
                    Looper.getMainLooper()
            );
        }
    }

    @Nullable
    private String chooseLocationProvider() {
        boolean fine = ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
        if (fine && locationManager.isProviderEnabled(
                LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (locationManager.isProviderEnabled(
                LocationManager.NETWORK_PROVIDER)) {
            return LocationManager.NETWORK_PROVIDER;
        }
        return null;
    }

    private void onLocationResolved(@NonNull Location location) {
        if (!isAdded()) {
            return;
        }
        MainActivity activity = (MainActivity) requireActivity();
        String currentSource = activity.getContinuousReportLocationSource();
        boolean protectHigherPriorityLocation =
                activity.isContinuousReportLocationConfirmed()
                        && (ReportLocationSource.PHOTO_EXIF.equals(
                        currentSource)
                        || ReportLocationSource.isManual(currentSource));
        if (forceDeviceLocation || !protectHigherPriorityLocation) {
            activity.setContinuousReportLocation(
                    location.getLatitude(),
                    location.getLongitude(),
                    ReportLocationSource.DEVICE_GPS
            );
        }
        forceDeviceLocation = false;
        finishFindingLocation();
        refreshLocation();
    }

    private void finishFindingLocation() {
        findingLocation = false;
        if (useDeviceLocationButton != null) {
            useDeviceLocationButton.setEnabled(!busy);
            useDeviceLocationButton.setText(
                    R.string.continuous_use_device_gps);
        }
        if (isAdded()) {
            refreshLocation();
        }
    }

    private void cancelCurrentLocationRequest() {
        cancelCurrentLocationRequest(true);
    }

    private void cancelCurrentLocationRequest(boolean clearForcedRequest) {
        if (currentLocationCancellation != null) {
            currentLocationCancellation.cancel();
            currentLocationCancellation = null;
        }
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        findingLocation = false;
        if (clearForcedRequest) {
            forceDeviceLocation = false;
        }
        if (useDeviceLocationButton != null) {
            useDeviceLocationButton.setText(
                    R.string.continuous_use_device_gps);
            useDeviceLocationButton.setEnabled(!busy);
        }
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        onLocationResolved(location);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(
            String provider,
            int status,
            Bundle extras
    ) {
        // Required by LocationListener on Android 8 and 9.
    }

    @Override
    public void onProviderEnabled(@NonNull String provider) {
        // A continuous report requests only one fix at a time.
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {
        // The user can request another fix or enter coordinates manually.
    }

    private void showCoordinateDialog() {
        if (busy) {
            return;
        }
        Context context = requireContext();
        LinearLayout fields = new LinearLayout(context);
        fields.setOrientation(LinearLayout.VERTICAL);
        int horizontalPadding = dp(22);
        fields.setPadding(horizontalPadding, dp(8), horizontalPadding, 0);

        TextInputLayout latitudeLayout = coordinateInputLayout(
                context,
                getString(R.string.continuous_latitude_hint)
        );
        TextInputEditText latitudeInput = coordinateInput(latitudeLayout);
        fields.addView(latitudeLayout);

        TextInputLayout longitudeLayout = coordinateInputLayout(
                context,
                getString(R.string.continuous_longitude_hint)
        );
        LinearLayout.LayoutParams longitudeParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );
        longitudeParams.topMargin = dp(10);
        fields.addView(longitudeLayout, longitudeParams);
        TextInputEditText longitudeInput = coordinateInput(longitudeLayout);

        MainActivity activity = (MainActivity) requireActivity();
        if (activity.isContinuousReportLocationConfirmed()) {
            latitudeInput.setText(String.format(
                    Locale.US,
                    getString(R.string.continuous_single_coordinate_format),
                    activity.getContinuousReportLatitude()
            ));
            longitudeInput.setText(String.format(
                    Locale.US,
                    getString(R.string.continuous_single_coordinate_format),
                    activity.getContinuousReportLongitude()
            ));
        }

        AlertDialog dialog = new MaterialAlertDialogBuilder(context)
                .setTitle(R.string.continuous_coordinate_dialog_title)
                .setMessage(R.string.continuous_coordinate_dialog_message)
                .setView(fields)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(
                        R.string.continuous_use_coordinates,
                        null
                )
                .create();
        dialog.setOnShowListener(unused -> dialog.getButton(
                AlertDialog.BUTTON_POSITIVE).setOnClickListener(button -> {
                    Double latitude = parseCoordinate(
                            latitudeInput,
                            latitudeLayout,
                            -90.0,
                            90.0
                    );
                    Double longitude = parseCoordinate(
                            longitudeInput,
                            longitudeLayout,
                            -180.0,
                            180.0
                    );
                    if (latitude == null || longitude == null) {
                        return;
                    }
                    cancelCurrentLocationRequest();
                    activity.setContinuousReportLocation(
                            latitude,
                            longitude,
                            ReportLocationSource.MANUAL_COORDINATES
                    );
                    refreshLocation();
                    dialog.dismiss();
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
            layout.setError(getString(
                    R.string.continuous_coordinate_required));
            return null;
        }
        try {
            double coordinate = Double.parseDouble(text);
            if (!Double.isFinite(coordinate)
                    || coordinate < minimum
                    || coordinate > maximum) {
                layout.setError(String.format(
                        Locale.US,
                        getString(R.string.continuous_coordinate_range_error),
                        minimum,
                        maximum
                ));
                return null;
            }
            layout.setError(null);
            return coordinate;
        } catch (NumberFormatException exception) {
            layout.setError(getString(
                    R.string.continuous_coordinate_invalid));
            return null;
        }
    }

    private void saveAndReportNext() {
        if (busy) {
            return;
        }
        String selectedPhotoPath = operations.getSelectedPhotoPath();
        boolean hasPhoto = selectedPhotoPath != null
                && new File(selectedPhotoPath).isFile();
        if (!hasPhoto) {
            photoError.setVisibility(View.VISIBLE);
            photoError.announceForAccessibility(photoError.getText());
            takePhotoButton.requestFocus();
            return;
        }
        MainActivity activity = (MainActivity) requireActivity();
        locationError.setText(R.string.continuous_location_required);
        if (!activity.isContinuousReportLocationConfirmed()) {
            locationError.setVisibility(View.VISIBLE);
            locationError.announceForAccessibility(locationError.getText());
            useDeviceLocationButton.requestFocus();
            return;
        }
        photoError.setVisibility(View.GONE);
        locationError.setVisibility(View.GONE);

        String hierarchy = selectedHierarchy();
        String category = selectedCategory();
        String lipHeight = selectedLipHeight();
        String vehicleIssue = selectedVehicleIssue();
        String quickReportTypes = quickReportTypesJson();
        String vehicleDetails = vehicleDetailsJson();
        boolean missingSidewalk = quickReportTypes.contains(
                "missing_sidewalk");
        boolean officialEmailEligible =
                OfficialEmailPolicy.isAutomaticEmailEligible(
                        quickReportTypes,
                        hierarchy,
                        vehicleIssue
                );
        boolean officialEmailAuthorized = officialEmailEligible
                && officialEmailOptIn != null
                && officialEmailOptIn.isChecked()
                && officialEmailRequirementsMet();
        String details = backwardCompatibleDetails(
                hierarchy,
                lipHeight,
                vehicleIssue,
                missingSidewalk,
                textValue(comments)
        );
        String pendingPhotoPath = selectedPhotoPath;
        String sessionId = operations.getSessionId();
        int sequence = operations.getNextSequence();
        String clientReportId = UUID.randomUUID().toString();
        long createdAt = System.currentTimeMillis();
        String observedAt = new SimpleDateFormat(
                getString(R.string.continuous_observed_time_pattern),
                Locale.US
        ).format(new Date(createdAt));
        String severity = getString(R.string.severity_medium);
        double latitude = activity.getContinuousReportLatitude();
        double longitude = activity.getContinuousReportLongitude();
        String locationSource = activity.getContinuousReportLocationSource();
        Double photoLatitude = activity.getContinuousPhotoLatitude();
        Double photoLongitude = activity.getContinuousPhotoLongitude();
        boolean locationOverridden =
                activity.isContinuousReportLocationOverridden();
        Context appContext = requireContext().getApplicationContext();

        if (!operations.beginSaving(sequence, officialEmailAuthorized)) {
            return;
        }
        renderOperationState();
        try {
            operations.execute(() -> persistReport(
                    appContext,
                    clientReportId,
                    pendingPhotoPath,
                    sessionId,
                    sequence,
                    createdAt,
                    observedAt,
                    category,
                    hierarchy,
                    lipHeight,
                    vehicleIssue,
                    details,
                    quickReportTypes,
                    vehicleDetails,
                    severity,
                    latitude,
                    longitude,
                    locationSource,
                    photoLatitude,
                    photoLongitude,
                    locationOverridden,
                    officialEmailAuthorized
            ));
        } catch (RejectedExecutionException exception) {
            operations.failSave(true);
        }
    }

    private void persistReport(
            Context context,
            String clientReportId,
            String pendingPhotoPath,
            String sessionId,
            int sequence,
            long createdAt,
            String observedAt,
            String category,
            String hierarchy,
            @Nullable String lipHeight,
            @Nullable String vehicleIssue,
            String details,
            String quickReportTypes,
            String vehicleDetails,
            String severity,
            double latitude,
            double longitude,
            String locationSource,
            @Nullable Double photoLatitude,
            @Nullable Double photoLongitude,
            boolean locationOverridden,
            boolean officialEmailAuthorized
    ) {
        String committedPhotoPath = null;
        ReportDatabaseHelper database = null;
        try {
            committedPhotoPath = PhotoStorage.copyPendingPhotoForCommit(
                    context,
                    pendingPhotoPath,
                    clientReportId
            );
            SafetyReport report = new SafetyReport(
                    0,
                    clientReportId,
                    createdAt,
                    observedAt,
                    category,
                    severity,
                    context.getString(R.string.continuous_not_specified),
                    details,
                    "quick_report",
                    "{}",
                    "unknown",
                    "vehicle".equals(hierarchy),
                    vehicleDetails,
                    "[]",
                    "",
                    "quick",
                    quickReportTypes,
                    null,
                    hierarchy,
                    lipHeight,
                    vehicleIssue,
                    sessionId,
                    sequence,
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
                    0,
                    officialEmailAuthorized
            );
            database = new ReportDatabaseHelper(context);
            long reportId = database.insertReport(report);
            // The database now owns the committed copy. Keeping the pending
            // source until this point makes a process kill before insertion
            // recoverable on the next launch.
            PhotoStorage.delete(pendingPhotoPath);
            boolean uploadQueued = true;
            try {
                ReportUploadScheduler.enqueue(context, reportId);
            } catch (RuntimeException exception) {
                // The local pending report remains available for retry.
                uploadQueued = false;
            }
            boolean finalUploadQueued = uploadQueued;
            operations.completeSave(sequence, finalUploadQueued);
        } catch (IOException | RuntimeException exception) {
            boolean photoRestored = restorePendingPhoto(
                    committedPhotoPath,
                    pendingPhotoPath
            );
            operations.failSave(photoRestored);
        } finally {
            if (database != null) {
                database.close();
            }
        }
    }

    private boolean restorePendingPhoto(
            @Nullable String committedPath,
            @Nullable String pendingPath
    ) {
        if (committedPath == null || pendingPath == null) {
            return pendingPath != null && new File(pendingPath).isFile();
        }
        File committed = new File(committedPath);
        File pending = new File(pendingPath);
        if (!committed.isFile()) {
            return pending.isFile();
        }
        if (pending.isFile()) {
            PhotoStorage.delete(committedPath);
            return true;
        }
        if (committed.renameTo(pending)) {
            return true;
        }
        PhotoStorage.delete(committedPath);
        return false;
    }

    private void reportSaved(
            int savedSequence,
            boolean uploadQueued,
            boolean officialEmailAuthorized
    ) {
        resetForNextReport();
        String confirmation = officialEmailAuthorized && uploadQueued
                ? getString(
                R.string.continuous_report_saved_email_format,
                savedSequence
        )
                : uploadQueued
                ? getString(
                R.string.continuous_report_saved_format,
                savedSequence
        )
                : getString(
                R.string.continuous_report_saved_locally_format,
                savedSequence
        );
        Toast.makeText(
                requireContext(),
                confirmation,
                Toast.LENGTH_LONG
        ).show();
        if (readyHint != null) {
            readyHint.setText(confirmation);
            readyHint.announceForAccessibility(confirmation);
        }
        if (reportScroll != null) {
            reportScroll.post(() -> {
                Rect cameraBounds = new Rect();
                takePhotoButton.getDrawingRect(cameraBounds);
                reportScroll.offsetDescendantRectToMyCoords(
                        takePhotoButton,
                        cameraBounds
                );
                reportScroll.smoothScrollTo(
                        0,
                        Math.max(0, cameraBounds.top - dp(12))
                );
                takePhotoButton.sendAccessibilityEvent(
                        AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED
                );
            });
        } else {
            takePhotoButton.requestFocus();
        }
        requestCurrentLocation(false);
    }

    private void reportSaveFailed(boolean photoRestored) {
        if (!photoRestored) {
            refreshPhotoPreview();
        }
        Toast.makeText(
            requireContext(),
            photoRestored
                        ? R.string.continuous_report_save_retry_with_picture
                        : R.string.continuous_report_save_retry_picture_lost,
                Toast.LENGTH_LONG
        ).show();
    }

    private void resetForNextReport() {
        sidewalkLipSpinner.setSelection(0);
        officialEmailOptIn.setChecked(false);
        setOfficialEmailDetailsExpanded(false);
        comments.setText("");
        licensePlate.setText("");
        plateState.setText("");
        photoError.setVisibility(View.GONE);
        locationError.setVisibility(View.GONE);
        refreshPhotoPreview();
        ((MainActivity) requireActivity()).clearContinuousReportLocation();
        refreshLocation();
        updateHierarchySections();
        updateSessionLabel();
    }

    private String backwardCompatibleDetails(
            String hierarchy,
            @Nullable String lipHeight,
            @Nullable String vehicleIssue,
            boolean missingSidewalk,
            String commentText
    ) {
        StringBuilder details = new StringBuilder();
        details.append(getString(
                R.string.continuous_details_rapid_format,
                labelForValue(
                        HIERARCHY_VALUES,
                        hierarchyLabels,
                        hierarchy
                ),
                hierarchy
        ));
        if (lipHeight != null) {
            details.append(getString(
                    R.string.continuous_details_lip_format,
                    labelForValue(
                            SIDEWALK_LIP_VALUES,
                            sidewalkLipLabels,
                            lipHeight
                    ),
                    lipHeight
            ));
        }
        if (missingSidewalk) {
            details.append(getString(
                    R.string.continuous_details_missing_sidewalk));
        }
        if (vehicleIssue != null) {
            details.append(getString(
                    R.string.continuous_details_vehicle_format,
                    labelForValue(
                            VEHICLE_ISSUE_VALUES,
                            vehicleIssueLabels,
                            vehicleIssue
                    ),
                    vehicleIssue
            ));
        }
        if (!commentText.isEmpty()) {
            details.append(getString(
                    R.string.continuous_details_comments_format,
                    commentText
            ));
        }
        return details.toString();
    }

    private String labelForValue(
            String[] values,
            String[] labels,
            String value
    ) {
        for (int index = 0; index < values.length; index++) {
            if (values[index].equals(value)) {
                return labels[index];
            }
        }
        return value.replace('_', ' ');
    }

    private String textValue(@Nullable TextInputEditText field) {
        return field == null || field.getText() == null
                ? ""
                : field.getText().toString().trim();
    }

    private void updateSessionLabel() {
        if (sessionLabel == null) {
            return;
        }
        sessionLabel.setText(getString(
                R.string.continuous_session_format,
                operations == null ? 1 : operations.getNextSequence()
        ));
    }

    private void renderOperationState() {
        if (operations == null || getView() == null || !isAdded()) {
            return;
        }
        ContinuousReportOperations.Phase phase = operations.getPhase();
        String message = null;
        if (phase == ContinuousReportOperations.Phase.INITIALIZING) {
            message = getString(R.string.continuous_restoring_session);
        } else if (phase
                == ContinuousReportOperations.Phase.PREPARING_PHOTO) {
            message = getString(R.string.continuous_preparing_picture);
        } else if (phase
                == ContinuousReportOperations.Phase.SAVING_REPORT) {
            message = getString(
                    R.string.continuous_saving_report_format,
                    operations.getInFlightSequence()
            );
        }
        setBusy(phase != ContinuousReportOperations.Phase.IDLE, message);
        refreshPhotoPreview();
        updateSessionLabel();

        PhotoStorage.PreparedPhoto preparedPhoto =
                operations.consumePreparedPhoto();
        if (operations.consumeDurablePhotoReplacement()) {
            applyPreparedPhotoLocation(
                    operations.hasPreparedPhotoCoordinates(),
                    operations.getPreparedPhotoLatitude(),
                    operations.getPreparedPhotoLongitude()
            );
            operations.markPreparedPhotoLocationApplied();
        } else if (preparedPhoto != null) {
            applyPreparedPhoto(preparedPhoto);
            operations.markPreparedPhotoLocationApplied();
        } else {
            MainActivity activity = (MainActivity) requireActivity();
            if (!activity.isContinuousReportLocationConfirmed()
                    && operations.hasPreparedPhotoCoordinates()) {
                cancelCurrentLocationRequest();
                activity.setContinuousReportLocation(
                        operations.getPreparedPhotoLatitude(),
                        operations.getPreparedPhotoLongitude(),
                        ReportLocationSource.PHOTO_EXIF
                );
                refreshLocation();
            }
        }
        if (operations.consumePhotoPreparationFailure()) {
            Toast.makeText(
                    requireContext(),
                    R.string.continuous_picture_prepare_failed,
                    Toast.LENGTH_LONG
            ).show();
        }
        ContinuousReportOperations.SaveCompletion completion =
                operations.consumeSaveCompletion();
        if (completion != null) {
            reportSaved(
                    completion.savedSequence,
                    completion.uploadQueued,
                    completion.officialEmailAuthorized
            );
        }
        Boolean photoRestored = operations.consumeSaveFailure();
        if (photoRestored != null) {
            reportSaveFailed(photoRestored);
        }
        if (operations.consumeRecoveredCompletion()) {
            resetForNextReport();
            requestCurrentLocation(false);
        }
    }

    private void setBusy(boolean isBusy, @Nullable String message) {
        busy = isBusy;
        if (workingRow != null) {
            workingRow.setVisibility(isBusy ? View.VISIBLE : View.GONE);
        }
        if (isBusy && message != null && workingLabel != null) {
            workingLabel.setText(message);
        }
        if (takePhotoButton != null) {
            takePhotoButton.setEnabled(!isBusy);
        }
        if (choosePhotoButton != null) {
            choosePhotoButton.setEnabled(!isBusy);
        }
        if (removePhotoButton != null) {
            removePhotoButton.setEnabled(!isBusy);
        }
        if (submitButton != null) {
            submitButton.setEnabled(!isBusy);
        }
        if (hierarchySpinner != null) {
            hierarchySpinner.setEnabled(!isBusy);
        }
        if (sidewalkLipSpinner != null) {
            sidewalkLipSpinner.setEnabled(!isBusy);
        }
        if (vehicleIssueSpinner != null) {
            vehicleIssueSpinner.setEnabled(!isBusy);
        }
        if (missingSidewalkCheckbox != null) {
            missingSidewalkCheckbox.setEnabled(!isBusy);
        }
        if (licensePlate != null) {
            licensePlate.setEnabled(!isBusy);
        }
        if (plateState != null) {
            plateState.setEnabled(!isBusy);
        }
        if (comments != null) {
            comments.setEnabled(!isBusy);
        }
        if (overrideCoordinatesButton != null) {
            overrideCoordinatesButton.setEnabled(!isBusy);
        }
        if (useDeviceLocationButton != null) {
            useDeviceLocationButton.setEnabled(!isBusy && !findingLocation);
        }
    }

    private int dp(int value) {
        return Math.round(value
                * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshLocation();
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (operations != null) {
            outState.putString(
                    STATE_PHOTO_PATH,
                    operations.getSelectedPhotoPath()
            );
            outState.putString(
                    STATE_SESSION_ID,
                    operations.getSessionId()
            );
            outState.putInt(
                    STATE_SEQUENCE,
                    operations.getNextSequence()
            );
            outState.putBoolean(
                    STATE_HAS_PREPARED_PHOTO_LOCATION,
                    operations.hasPreparedPhotoCoordinates()
            );
            outState.putBoolean(
                    STATE_PREPARED_PHOTO_NEEDS_APPLICATION,
                    operations.isPreparedPhotoLocationPending()
            );
            outState.putBoolean(
                    STATE_SAVE_COMPLETION_PENDING,
                    operations.hasSaveCompletionPending()
            );
            if (operations.hasPreparedPhotoCoordinates()) {
                outState.putDouble(
                        STATE_PREPARED_PHOTO_LATITUDE,
                        operations.getPreparedPhotoLatitude()
                );
                outState.putDouble(
                        STATE_PREPARED_PHOTO_LONGITUDE,
                        operations.getPreparedPhotoLongitude()
                );
            }
        }
        outState.putInt(
                STATE_HIERARCHY,
                hierarchySpinner.getSelectedItemPosition()
        );
        outState.putInt(
                STATE_LIP_HEIGHT,
                sidewalkLipSpinner.getSelectedItemPosition()
        );
        outState.putInt(
                STATE_VEHICLE_ISSUE,
                vehicleIssueSpinner.getSelectedItemPosition()
        );
        outState.putBoolean(
                STATE_MISSING_SIDEWALK,
                missingSidewalkCheckbox.isChecked()
        );
        outState.putString(STATE_LICENSE_PLATE, textValue(licensePlate));
        outState.putString(STATE_PLATE_STATE, textValue(plateState));
        outState.putString(STATE_COMMENTS, textValue(comments));
        outState.putBoolean(
                STATE_TEST_EMAIL_OPT_IN,
                officialEmailOptIn != null && officialEmailOptIn.isChecked()
        );
        if (cameraCaptureFile != null) {
            outState.putString(
                    STATE_CAMERA_PATH,
                    cameraCaptureFile.getAbsolutePath()
            );
        }
    }

    @Override
    public void onDestroyView() {
        if (operations != null) {
            operations.detach(operationStateListener);
        }
        super.onDestroyView();
    }

    @Override
    public void onDestroy() {
        cancelCurrentLocationRequest();
        super.onDestroy();
    }

    private interface PhotoPreparation {
        PhotoStorage.PreparedPhoto prepare() throws IOException;
    }

    /**
     * Retains file work and its authoritative sequence across configuration
     * changes. The Fragment owns only views and platform location requests;
     * neither an insert nor a prepared picture is dropped when that view is
     * briefly destroyed during rotation.
     */
    public static final class ContinuousReportOperations extends ViewModel {
        private static final String DRAFT_PREFERENCES =
                "continuous_report_drafts";
        enum Phase {
            INITIALIZING,
            IDLE,
            PREPARING_PHOTO,
            SAVING_REPORT
        }

        private final ExecutorService executor =
                Executors.newSingleThreadExecutor();
        private final Handler mainHandler = new Handler(Looper.getMainLooper());

        @Nullable
        private Runnable listener;
        private boolean initialized;
        @Nullable
        private Context applicationContext;
        private String sessionId = "";
        private int nextSequence = 1;
        @Nullable
        private String selectedPhotoPath;
        private Phase phase = Phase.INITIALIZING;
        private int inFlightSequence;
        private boolean inFlightOfficialEmailAuthorized;
        @Nullable
        private PhotoStorage.PreparedPhoto preparedPhoto;
        private boolean preparedPhotoNeedsApplication;
        @Nullable
        private Double preparedPhotoLatitude;
        @Nullable
        private Double preparedPhotoLongitude;
        private boolean durablePhotoReplacement;
        private boolean photoPreparationFailure;
        private boolean recoveredCompletionPending;
        @Nullable
        private SaveCompletion saveCompletion;
        @Nullable
        private Boolean saveFailurePhotoRestored;

        synchronized void initialize(
                Context applicationContext,
                String restoredSessionId,
                int restoredSequence,
                @Nullable String restoredPhotoPath,
                @Nullable Double restoredPhotoLatitude,
                @Nullable Double restoredPhotoLongitude,
                boolean restoredPhotoNeedsApplication,
                boolean restoredSaveCompletionPending
        ) {
            if (initialized) {
                return;
            }
            initialized = true;
            this.applicationContext = applicationContext;
            sessionId = restoredSessionId;
            nextSequence = Math.max(1, restoredSequence);
            recoveredCompletionPending = restoredSaveCompletionPending;
            SharedPreferences preferences = draftPreferences();
            String durablePath = preferences == null
                    ? null
                    : preferences.getString(draftKey("path"), null);
            String candidatePath = durablePath != null
                    && new File(durablePath).isFile()
                    ? durablePath
                    : restoredPhotoPath;
            selectedPhotoPath = candidatePath != null
                    && new File(candidatePath).isFile()
                    ? candidatePath
                    : null;
            boolean restoredFromDurableDraft = selectedPhotoPath != null
                    && selectedPhotoPath.equals(durablePath);
            boolean durableNeedsApplication = restoredFromDurableDraft
                    && preferences.getBoolean(
                    draftKey("needs_application"),
                    false
            );
            preparedPhotoNeedsApplication = durableNeedsApplication
                    || (selectedPhotoPath != null
                    && selectedPhotoPath.equals(restoredPhotoPath)
                    && restoredPhotoNeedsApplication);
            durablePhotoReplacement = preparedPhotoNeedsApplication
                    || (restoredFromDurableDraft
                    && (restoredPhotoPath == null
                    || !selectedPhotoPath.equals(restoredPhotoPath)));
            if (selectedPhotoPath != null
                    && selectedPhotoPath.equals(durablePath)
                    && preferences.getBoolean(draftKey("has_location"), false)) {
                preparedPhotoLatitude = Double.longBitsToDouble(
                        preferences.getLong(
                                draftKey("latitude_bits"),
                                Double.doubleToLongBits(Double.NaN)
                        ));
                preparedPhotoLongitude = Double.longBitsToDouble(
                        preferences.getLong(
                                draftKey("longitude_bits"),
                                Double.doubleToLongBits(Double.NaN)
                        ));
                if (!validPreparedCoordinates()) {
                    preparedPhotoLatitude = null;
                    preparedPhotoLongitude = null;
                }
            } else if (selectedPhotoPath != null
                    && restoredPhotoLatitude != null
                    && restoredPhotoLongitude != null
                    && validLatitude(restoredPhotoLatitude)
                    && validLongitude(restoredPhotoLongitude)) {
                preparedPhotoLatitude = restoredPhotoLatitude;
                preparedPhotoLongitude = restoredPhotoLongitude;
            }
            if (selectedPhotoPath == null) {
                clearPersistedDraft();
            }
            phase = Phase.INITIALIZING;
            try {
                executor.execute(() -> {
                    int storedSequence = 1;
                    boolean reconciled = true;
                    try (ReportDatabaseHelper database =
                                 new ReportDatabaseHelper(
                                         applicationContext)) {
                        storedSequence = database
                                .getNextContinuousSequence(restoredSessionId);
                    } catch (RuntimeException ignored) {
                        reconciled = false;
                    }
                    finishInitialization(storedSequence, reconciled);
                });
            } catch (RejectedExecutionException exception) {
                phase = Phase.IDLE;
                notifyChanged();
            }
        }

        private void finishInitialization(
                int storedSequence,
                boolean reconciled
        ) {
            String completedDraftPath = null;
            String abandonedSession = null;
            synchronized (this) {
                if (!reconciled) {
                    // Never reuse a possibly committed sequence if the local
                    // reconciliation query itself failed. The photo remains
                    // available, but subsequent reports use a fresh session.
                    abandonedSession = sessionId;
                    sessionId = UUID.randomUUID().toString();
                    nextSequence = 1;
                } else {
                    if (storedSequence > nextSequence) {
                        recoveredCompletionPending = true;
                        completedDraftPath = selectedPhotoPath;
                        selectedPhotoPath = null;
                        preparedPhoto = null;
                        preparedPhotoNeedsApplication = false;
                        preparedPhotoLatitude = null;
                        preparedPhotoLongitude = null;
                        durablePhotoReplacement = false;
                    }
                    nextSequence = Math.max(nextSequence, storedSequence);
                }
                if (phase == Phase.INITIALIZING) {
                    phase = Phase.IDLE;
                }
            }
            if (abandonedSession != null) {
                clearPersistedDraft(abandonedSession);
                persistDraft();
            }
            if (completedDraftPath != null) {
                PhotoStorage.delete(completedDraftPath);
                clearPersistedDraft();
            }
            notifyChanged();
        }

        synchronized void attach(Runnable stateListener) {
            listener = stateListener;
            notifyChanged();
        }

        synchronized void detach(Runnable stateListener) {
            if (listener == stateListener) {
                listener = null;
            }
        }

        synchronized boolean beginPreparingPhoto() {
            if (phase != Phase.IDLE) {
                return false;
            }
            phase = Phase.PREPARING_PHOTO;
            photoPreparationFailure = false;
            return true;
        }

        void completePreparedPhoto(
                @NonNull PhotoStorage.PreparedPhoto value
        ) {
            String replacedPath;
            synchronized (this) {
                replacedPath = selectedPhotoPath;
                selectedPhotoPath = value.getPath();
                preparedPhoto = value;
                preparedPhotoNeedsApplication = true;
                preparedPhotoLatitude = value.getLatitude();
                preparedPhotoLongitude = value.getLongitude();
                durablePhotoReplacement = false;
                phase = Phase.IDLE;
            }
            boolean draftPersisted = persistDraft();
            if (draftPersisted
                    && replacedPath != null
                    && !replacedPath.equals(value.getPath())) {
                PhotoStorage.delete(replacedPath);
            }
            notifyChanged();
        }

        void failPreparedPhoto() {
            synchronized (this) {
                photoPreparationFailure = true;
                phase = Phase.IDLE;
            }
            notifyChanged();
        }

        synchronized void removeSelectedPhoto() {
            String removedPath = selectedPhotoPath;
            selectedPhotoPath = null;
            preparedPhoto = null;
            preparedPhotoNeedsApplication = false;
            preparedPhotoLatitude = null;
            preparedPhotoLongitude = null;
            durablePhotoReplacement = false;
            if (removedPath != null) {
                PhotoStorage.delete(removedPath);
            }
            clearPersistedDraft();
        }

        synchronized boolean beginSaving(
                int sequence,
                boolean officialEmailAuthorized
        ) {
            if (phase != Phase.IDLE || sequence != nextSequence) {
                return false;
            }
            phase = Phase.SAVING_REPORT;
            inFlightSequence = sequence;
            inFlightOfficialEmailAuthorized = officialEmailAuthorized;
            saveCompletion = null;
            saveFailurePhotoRestored = null;
            return true;
        }

        void completeSave(int savedSequence, boolean uploadQueued) {
            synchronized (this) {
                nextSequence = Math.max(nextSequence, savedSequence + 1);
                selectedPhotoPath = null;
                preparedPhoto = null;
                preparedPhotoNeedsApplication = false;
                preparedPhotoLatitude = null;
                preparedPhotoLongitude = null;
                durablePhotoReplacement = false;
                inFlightSequence = 0;
                phase = Phase.IDLE;
                saveCompletion = new SaveCompletion(
                        savedSequence,
                        uploadQueued,
                        inFlightOfficialEmailAuthorized
                );
                inFlightOfficialEmailAuthorized = false;
            }
            clearPersistedDraft();
            notifyChanged();
        }

        void failSave(boolean photoRestored) {
            synchronized (this) {
                if (!photoRestored) {
                    selectedPhotoPath = null;
                    preparedPhoto = null;
                    preparedPhotoNeedsApplication = false;
                    preparedPhotoLatitude = null;
                    preparedPhotoLongitude = null;
                    durablePhotoReplacement = false;
                }
                inFlightSequence = 0;
                inFlightOfficialEmailAuthorized = false;
                phase = Phase.IDLE;
                saveFailurePhotoRestored = photoRestored;
            }
            if (photoRestored) {
                persistDraft();
            } else {
                clearPersistedDraft();
            }
            notifyChanged();
        }

        void execute(Runnable action) {
            executor.execute(action);
        }

        synchronized Phase getPhase() {
            return phase;
        }

        synchronized int getInFlightSequence() {
            return inFlightSequence;
        }

        synchronized String getSessionId() {
            return sessionId;
        }

        synchronized int getNextSequence() {
            return nextSequence;
        }

        @Nullable
        synchronized String getSelectedPhotoPath() {
            return selectedPhotoPath;
        }

        @Nullable
        synchronized PhotoStorage.PreparedPhoto consumePreparedPhoto() {
            if (!preparedPhotoNeedsApplication) {
                return null;
            }
            preparedPhotoNeedsApplication = false;
            return preparedPhoto;
        }

        synchronized boolean hasPreparedPhotoCoordinates() {
            return validPreparedCoordinates();
        }

        synchronized boolean consumeDurablePhotoReplacement() {
            boolean value = durablePhotoReplacement;
            durablePhotoReplacement = false;
            return value;
        }

        synchronized boolean isPreparedPhotoLocationPending() {
            return preparedPhotoNeedsApplication
                    || durablePhotoReplacement;
        }

        void markPreparedPhotoLocationApplied() {
            synchronized (this) {
                preparedPhotoNeedsApplication = false;
                durablePhotoReplacement = false;
            }
            persistDraft();
        }

        synchronized double getPreparedPhotoLatitude() {
            return preparedPhotoLatitude == null
                    ? Double.NaN
                    : preparedPhotoLatitude;
        }

        synchronized double getPreparedPhotoLongitude() {
            return preparedPhotoLongitude == null
                    ? Double.NaN
                    : preparedPhotoLongitude;
        }

        synchronized boolean consumePhotoPreparationFailure() {
            boolean value = photoPreparationFailure;
            photoPreparationFailure = false;
            return value;
        }

        @Nullable
        synchronized SaveCompletion consumeSaveCompletion() {
            SaveCompletion value = saveCompletion;
            saveCompletion = null;
            return value;
        }

        @Nullable
        synchronized Boolean consumeSaveFailure() {
            Boolean value = saveFailurePhotoRestored;
            saveFailurePhotoRestored = null;
            return value;
        }

        synchronized boolean consumeRecoveredCompletion() {
            boolean value = recoveredCompletionPending;
            recoveredCompletionPending = false;
            return value;
        }

        synchronized boolean hasSaveCompletionPending() {
            return saveCompletion != null || recoveredCompletionPending;
        }

        private void notifyChanged() {
            mainHandler.post(() -> {
                Runnable currentListener;
                synchronized (ContinuousReportOperations.this) {
                    currentListener = listener;
                }
                if (currentListener != null) {
                    currentListener.run();
                }
            });
        }

        @Nullable
        private synchronized SharedPreferences draftPreferences() {
            return applicationContext == null
                    ? null
                    : applicationContext.getSharedPreferences(
                            DRAFT_PREFERENCES,
                            Context.MODE_PRIVATE
                    );
        }

        private synchronized String draftKey(String suffix) {
            return sessionId + "." + suffix;
        }

        @SuppressLint("ApplySharedPref")
        private boolean persistDraft() {
            SharedPreferences preferences;
            String path;
            boolean hasCoordinates;
            boolean needsApplication;
            double latitude = Double.NaN;
            double longitude = Double.NaN;
            synchronized (this) {
                preferences = draftPreferences();
                path = selectedPhotoPath;
                hasCoordinates = validPreparedCoordinates();
                needsApplication = preparedPhotoNeedsApplication
                        || durablePhotoReplacement;
                if (hasCoordinates) {
                    latitude = preparedPhotoLatitude;
                    longitude = preparedPhotoLongitude;
                }
            }
            if (preferences == null || path == null) {
                clearPersistedDraft();
                return true;
            }
            return preferences.edit()
                    .putString(draftKey("path"), path)
                    .putBoolean(draftKey("has_location"), hasCoordinates)
                    .putBoolean(
                            draftKey("needs_application"),
                            needsApplication
                    )
                    .putLong(
                            draftKey("latitude_bits"),
                            Double.doubleToRawLongBits(latitude)
                    )
                    .putLong(
                            draftKey("longitude_bits"),
                            Double.doubleToRawLongBits(longitude)
                    )
                    .commit();
        }

        private void clearPersistedDraft() {
            clearPersistedDraft(sessionId);
        }

        private void clearPersistedDraft(String targetSessionId) {
            SharedPreferences preferences = draftPreferences();
            if (preferences == null
                    || targetSessionId == null
                    || targetSessionId.isEmpty()) {
                return;
            }
            preferences.edit()
                    .remove(targetSessionId + ".path")
                    .remove(targetSessionId + ".has_location")
                    .remove(targetSessionId + ".needs_application")
                    .remove(targetSessionId + ".latitude_bits")
                    .remove(targetSessionId + ".longitude_bits")
                    .apply();
        }

        private synchronized boolean validPreparedCoordinates() {
            return preparedPhotoLatitude != null
                    && preparedPhotoLongitude != null
                    && validLatitude(preparedPhotoLatitude)
                    && validLongitude(preparedPhotoLongitude);
        }

        private static boolean validLatitude(double value) {
            return Double.isFinite(value) && value >= -90.0 && value <= 90.0;
        }

        private static boolean validLongitude(double value) {
            return Double.isFinite(value)
                    && value >= -180.0
                    && value <= 180.0;
        }

        @Override
        protected void onCleared() {
            synchronized (this) {
                listener = null;
            }
            // Let an accepted local save finish; do not interrupt the commit.
            executor.shutdown();
        }

        static final class SaveCompletion {
            private final int savedSequence;
            private final boolean uploadQueued;
            private final boolean officialEmailAuthorized;

            private SaveCompletion(
                    int savedSequence,
                    boolean uploadQueued,
                    boolean officialEmailAuthorized
            ) {
                this.savedSequence = savedSequence;
                this.uploadQueued = uploadQueued;
                this.officialEmailAuthorized = officialEmailAuthorized;
            }
        }
    }
}
