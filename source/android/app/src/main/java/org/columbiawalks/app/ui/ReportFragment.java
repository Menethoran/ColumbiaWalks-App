package org.columbiawalks.app.ui;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Typeface;
import android.os.Looper;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.data.PhotoStorage;
import org.columbiawalks.app.data.ReportDatabaseHelper;
import org.columbiawalks.app.data.ReportLocationSource;
import org.columbiawalks.app.data.SafetyReport;
import org.columbiawalks.app.domain.ChecklistCatalog;
import org.columbiawalks.app.domain.OfficialEmailPolicy;
import org.columbiawalks.app.domain.ReportValidator;
import org.columbiawalks.app.submission.IntersectionLookupClient;
import org.columbiawalks.app.submission.ReportUploadScheduler;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

public class ReportFragment extends Fragment implements LocationListener {
    private static final String STATE_PHOTO_PATH = "photo_path";
    private static final String STATE_CAMERA_PATH = "camera_path";
    private static final String STATE_CHECKLIST_RESPONSES =
            "checklist_responses";
    private static final String STATE_VEHICLE_DETAILS = "vehicle_details";
    private static final String STATE_POLICE_OBSERVATIONS =
            "police_observations";
    private static final String STATE_SUBMISSION_MODE = "submission_mode";
    private static final String STATE_QUICK_REPORT_TYPES =
            "quick_report_types";
    private static final String STATE_NEAREST_INTERSECTION =
            "nearest_intersection";
    private static final String[] REPORTED_PARTY_VALUES = {
            "unknown",
            "civilian_driver",
            "police_officer",
            "other_government_driver",
            "commercial_driver"
    };
    private static final String[] STATUS_VALUES = {
            "unknown",
            "on",
            "off"
    };
    private static final String[] POLICE_OBSERVATION_VALUES = {
            "entered_against_red_signal",
            "failed_to_stop_at_stop_sign",
            "unsafe_speed",
            "failed_to_yield",
            "blocked_crosswalk_or_sidewalk",
            "aggressive_or_threatening_conduct",
            "complaint_or_report_not_taken",
            "identification_not_provided",
            "no_follow_up_observed",
            "professional_or_helpful_response"
    };
    private static final int[] POLICE_OBSERVATION_LABELS = {
            R.string.police_observation_red_signal,
            R.string.police_observation_stop_sign,
            R.string.police_observation_speed,
            R.string.police_observation_yield,
            R.string.police_observation_blocked,
            R.string.police_observation_aggressive,
            R.string.police_observation_not_taken,
            R.string.police_observation_identification,
            R.string.police_observation_follow_up,
            R.string.police_observation_helpful
    };
    private static final String[] CHECKLIST_VALUES = {
            "",
            "ok",
            "needs_attention",
            "not_applicable"
    };

    private final List<CheckBox> issueCheckboxes = new ArrayList<>();
    private final Map<String, CheckBox> issueCheckboxesBySlug =
            new LinkedHashMap<>();
    private final Map<String, LinearLayout> issueExpansionContainersBySlug =
            new LinkedHashMap<>();
    private final Map<String, Spinner> checklistSpinners =
            new LinkedHashMap<>();
    private final Map<String, ChecklistCatalog.Category> checklistCategories =
            new LinkedHashMap<>();
    private final Map<String, View> checklistCategoryViews =
            new LinkedHashMap<>();
    private final Map<String, TextInputEditText> vehicleFields =
            new LinkedHashMap<>();
    private final Map<String, CheckBox> policeObservationCheckboxes =
            new LinkedHashMap<>();
    private final Map<String, CheckBox> quickReportCheckboxes =
            new LinkedHashMap<>();
    private final Set<String> quickReportTypes = new LinkedHashSet<>();
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

    private Spinner severitySpinner;
    private RadioGroup policeResponseGroup;
    private TextInputEditText observedTime;
    private TextInputEditText details;
    private TextInputLayout detailsLayout;
    private CheckBox additionalInformationToggle;
    private TextInputEditText otherDetails;
    private TextInputLayout otherDetailsLayout;
    private TextView issueError;
    private TextView locationLabel;
    private TextView locationSourceLabel;
    private TextView nearestIntersectionLabel;
    private ImageView photoPreview;
    private View photoPreviewContainer;
    private CheckBox otherCheckbox;
    private TextView checklistEmpty;
    private View subjectVehicleSection;
    private View vehicleDetailsContainer;
    private View policeInteractionSection;
    private Spinner reportedPartySpinner;
    private CheckBox vehicleInvolvedCheckbox;
    private Spinner emergencyLightsSpinner;
    private Spinner sirenSpinner;
    private TextInputEditText policeComplaintDetails;
    private View quickReportOptions;
    private View fullReportSections;
    private LinearLayout quickExpandedContainer;
    private TextView reportPathError;
    private View officialEmailNoticeContainer;
    private TextView officialEmailNotice;
    private TextView officialEmailError;
    private TextView photoHeading;
    private MaterialButton quickReportButton;
    private MaterialButton fullReportButton;
    private MaterialButton takePhotoButton;
    private MaterialButton choosePhotoButton;
    private MaterialButton saveReportButton;
    private ReportDatabaseHelper databaseHelper;
    private LocationManager locationManager;
    private ExecutorService intersectionExecutor;
    private ExecutorService photoExecutor;
    private String selectedPhotoPath;
    private String submissionMode = "quick";
    private String nearestIntersectionJson;
    private double lastIntersectionLatitude = Double.NaN;
    private double lastIntersectionLongitude = Double.NaN;
    private File cameraCaptureFile;
    private boolean restoringViewState;
    private boolean changingQuickSelection;
    private boolean preparingPhoto;
    private int photoPreparationGeneration;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_report, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        restoringViewState = savedInstanceState != null;
        databaseHelper = new ReportDatabaseHelper(requireContext());
        issueCheckboxes.clear();
        issueCheckboxesBySlug.clear();
        issueExpansionContainersBySlug.clear();
        checklistSpinners.clear();
        checklistCategories.clear();
        checklistCategoryViews.clear();
        vehicleFields.clear();
        policeObservationCheckboxes.clear();
        quickReportCheckboxes.clear();
        addIssue(view, R.id.issue_sidewalk, "sidewalk_safety");
        addIssue(view, R.id.issue_vehicle, "vehicle_safety");
        addIssue(view, R.id.issue_crosswalk, "crosswalk_safety");
        addIssue(view, R.id.issue_trip, "trip_hazards");
        addIssue(view, R.id.issue_aggressive, "aggressive_drivers");
        addIssue(view, R.id.issue_police, "police_response");
        addIssue(view, R.id.issue_lighting, "lighting_or_visibility");
        addIssue(view, R.id.issue_accessibility, "accessibility_ada");
        addIssue(view, R.id.issue_school_route, "school_route_safety");
        otherCheckbox = addIssue(
                view,
                R.id.issue_other,
                "not_included_elsewhere"
        );

        issueError = view.findViewById(R.id.issue_error);
        severitySpinner = view.findViewById(R.id.severity_spinner);
        policeResponseGroup = view.findViewById(R.id.police_response_group);
        observedTime = view.findViewById(R.id.observed_time);
        details = view.findViewById(R.id.details);
        detailsLayout = view.findViewById(R.id.details_layout);
        locationLabel = view.findViewById(R.id.report_location_label);
        locationSourceLabel = view.findViewById(
                R.id.report_location_source_label);
        nearestIntersectionLabel = view.findViewById(
                R.id.nearest_intersection_label);
        photoPreview = view.findViewById(R.id.photo_preview);
        photoPreviewContainer = view.findViewById(R.id.photo_preview_container);
        checklistEmpty = view.findViewById(R.id.detailed_checklist_empty);
        subjectVehicleSection = view.findViewById(
                R.id.subject_vehicle_section);
        vehicleDetailsContainer = view.findViewById(
                R.id.vehicle_details_container);
        policeInteractionSection = view.findViewById(
                R.id.police_interaction_section);
        reportedPartySpinner = view.findViewById(
                R.id.reported_party_spinner);
        vehicleInvolvedCheckbox = view.findViewById(R.id.vehicle_involved);
        emergencyLightsSpinner = view.findViewById(
                R.id.emergency_lights_spinner);
        sirenSpinner = view.findViewById(R.id.siren_spinner);
        policeComplaintDetails = view.findViewById(
                R.id.police_complaint_details);
        quickReportOptions = view.findViewById(R.id.quick_report_options);
        fullReportSections = view.findViewById(R.id.full_report_sections);
        quickExpandedContainer = createInlineExpansionContainer();
        ((LinearLayout) quickReportOptions).addView(
                quickExpandedContainer,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );
        reportPathError = view.findViewById(R.id.report_path_error);
        officialEmailNoticeContainer = view.findViewById(
                R.id.official_email_notice_container);
        officialEmailNotice = view.findViewById(
                R.id.official_email_notice);
        officialEmailError = view.findViewById(
                R.id.official_email_error);
        photoHeading = view.findViewById(R.id.report_photo_heading);
        quickReportButton = view.findViewById(R.id.quick_report_button);
        fullReportButton = view.findViewById(R.id.full_report_button);
        takePhotoButton = view.findViewById(R.id.take_photo_button);
        choosePhotoButton = view.findViewById(R.id.choose_photo_button);
        saveReportButton = view.findViewById(R.id.save_report_button);
        additionalInformationToggle = view.findViewById(
                R.id.additional_information_toggle);
        createOtherDetailsField();
        additionalInformationToggle.setOnCheckedChangeListener(
                (button, checked) -> {
                    detailsLayout.setVisibility(
                            checked ? View.VISIBLE : View.GONE
                    );
                    if (!checked && details != null) {
                        details.setText("");
                        detailsLayout.setError(null);
                    }
                }
        );
        locationManager = (LocationManager) requireContext()
                .getSystemService(android.content.Context.LOCATION_SERVICE);
        intersectionExecutor = Executors.newSingleThreadExecutor();
        photoExecutor = Executors.newSingleThreadExecutor();

        addVehicleField(view, "license_plate", R.id.vehicle_license_plate);
        addVehicleField(view, "plate_state", R.id.vehicle_plate_state);
        addVehicleField(view, "year", R.id.vehicle_year);
        addVehicleField(view, "make", R.id.vehicle_make);
        addVehicleField(view, "model", R.id.vehicle_model);
        addVehicleField(view, "color", R.id.vehicle_color);
        addVehicleField(view, "body_style", R.id.vehicle_body_style);
        addVehicleField(view, "unit_number", R.id.vehicle_unit_number);
        addVehicleField(view, "vin", R.id.vehicle_vin);
        addVehicleField(view, "visible_damage", R.id.vehicle_visible_damage);
        addVehicleField(view, "description", R.id.vehicle_description);

        initializeReportMode(view, savedInstanceState);
        initializeStructuredReportControls(view, savedInstanceState);
        buildDetailedChecklist(
                view.findViewById(R.id.detailed_checklist_container),
                savedInstanceState == null
                        ? null
                        : savedInstanceState.getString(
                                STATE_CHECKLIST_RESPONSES)
        );
        updateDynamicSections();

        PhotoStorage.cleanupOldPending(requireContext());
        if (savedInstanceState != null) {
            selectedPhotoPath = savedInstanceState.getString(STATE_PHOTO_PATH);
            String cameraPath = savedInstanceState.getString(STATE_CAMERA_PATH);
            if (cameraPath != null) {
                cameraCaptureFile = new File(cameraPath);
            }
        }
        refreshPhotoPreview();

        ArrayAdapter<String> severityAdapter = new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                new String[]{
                        getString(R.string.severity_low),
                        getString(R.string.severity_medium),
                        getString(R.string.severity_high)
                }
        );
        severityAdapter.setDropDownViewResource(R.layout.spinner_dropdown_item);
        severitySpinner.setAdapter(severityAdapter);
        severitySpinner.setSelection(1);

        if (savedInstanceState == null
                && (observedTime.getText() == null
                || observedTime.getText().length() == 0)) {
            observedTime.setText(new SimpleDateFormat(
                    "MMM d, yyyy h:mm a",
                    Locale.US
            ).format(new Date()));
        }

        view.findViewById(R.id.change_map_button)
                .setOnClickListener(button ->
                        ((MainActivity) requireActivity()).navigateToMap());
        view.findViewById(R.id.open_continuous_report_button)
                .setOnClickListener(button ->
                        ((MainActivity) requireActivity())
                                .navigateToContinuousReport());
        saveReportButton.setOnClickListener(button -> saveReport());
        takePhotoButton.setOnClickListener(button -> takePhoto());
        choosePhotoButton.setOnClickListener(button -> choosePhoto());
        view.findViewById(R.id.remove_photo_button)
                .setOnClickListener(button -> removeSelectedPhoto());

        refreshLocation();
        if (savedInstanceState == null
                && "quick".equals(submissionMode)) {
            requestCurrentLocation();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshLocation();
    }

    private CheckBox addIssue(View root, int viewId, String slug) {
        CheckBox checkBox = root.findViewById(viewId);
        issueCheckboxes.add(checkBox);
        issueCheckboxesBySlug.put(slug, checkBox);
        LinearLayout expansionContainer =
                createInlineExpansionContainer();
        issueExpansionContainersBySlug.put(slug, expansionContainer);
        ViewGroup parent = (ViewGroup) checkBox.getParent();
        parent.addView(
                expansionContainer,
                parent.indexOfChild(checkBox) + 1,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );
        checkBox.setOnCheckedChangeListener((button, checked) -> {
            if (checked && issueError != null) {
                issueError.setVisibility(View.GONE);
            }
            if (checked
                    && ("vehicle_safety".equals(slug)
                    || "aggressive_drivers".equals(slug))
                    && vehicleInvolvedCheckbox != null) {
                vehicleInvolvedCheckbox.setChecked(true);
            }
            if (!checked
                    && "not_included_elsewhere".equals(slug)
                    && otherDetails != null) {
                otherDetails.setText("");
                otherDetailsLayout.setError(null);
            }
            updateDynamicSections();
        });
        return checkBox;
    }

    private LinearLayout createInlineExpansionContainer() {
        LinearLayout container = new LinearLayout(requireContext());
        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(dp(12), 0, 0, dp(6));
        container.setVisibility(View.GONE);
        return container;
    }

    private void createOtherDetailsField() {
        LinearLayout container = issueExpansionContainersBySlug.get(
                "not_included_elsewhere");
        if (container == null) {
            return;
        }
        otherDetailsLayout = new TextInputLayout(requireContext());
        otherDetailsLayout.setId(R.id.other_issue_details_layout);
        otherDetailsLayout.setBoxBackgroundMode(
                TextInputLayout.BOX_BACKGROUND_OUTLINE);
        otherDetailsLayout.setHint(R.string.other_issue_details_label);
        otherDetailsLayout.setHelperText(
                getString(R.string.other_issue_details_helper));
        otherDetailsLayout.setCounterEnabled(true);
        otherDetailsLayout.setCounterMaxLength(700);

        otherDetails = new TextInputEditText(
                otherDetailsLayout.getContext());
        otherDetails.setId(R.id.other_issue_details);
        otherDetails.setGravity(Gravity.TOP | Gravity.START);
        otherDetails.setInputType(
                InputType.TYPE_CLASS_TEXT
                        | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                        | InputType.TYPE_TEXT_FLAG_MULTI_LINE
        );
        otherDetails.setMinLines(4);
        otherDetails.setFilters(new InputFilter[]{
                new InputFilter.LengthFilter(700)
        });
        otherDetailsLayout.addView(
                otherDetails,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );
        container.addView(
                otherDetailsLayout,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );
    }

    private void addVehicleField(View root, String key, int viewId) {
        vehicleFields.put(key, root.findViewById(viewId));
    }

    private void initializeReportMode(
            View root,
            @Nullable Bundle savedInstanceState
    ) {
        addQuickReportOption(
                root,
                R.id.quick_crosswalk_encroachment,
                "crosswalk_encroachment",
                "crosswalk_safety"
        );
        addQuickReportOption(
                root,
                R.id.quick_missing_sidewalk,
                "missing_sidewalk",
                "sidewalk_safety"
        );
        addQuickReportOption(
                root,
                R.id.quick_speeding,
                "speeding",
                "aggressive_drivers"
        );
        addQuickReportOption(
                root,
                R.id.quick_illegal_u_turn,
                "illegal_u_turn",
                "vehicle_safety"
        );
        addQuickReportOption(
                root,
                R.id.quick_trip_hazard,
                "trip_hazard",
                "trip_hazards"
        );

        quickReportButton.setOnClickListener(button ->
                chooseSubmissionMode("quick"));
        fullReportButton.setOnClickListener(button ->
                chooseSubmissionMode("full"));
        root.findViewById(R.id.quick_other_button)
                .setOnClickListener(button -> chooseSubmissionMode("full"));

        if (savedInstanceState != null) {
            submissionMode = savedInstanceState.getString(
                    STATE_SUBMISSION_MODE,
                    "quick"
            );
            restoreQuickReportTypes(savedInstanceState.getString(
                    STATE_QUICK_REPORT_TYPES
            ));
            nearestIntersectionJson = savedInstanceState.getString(
                    STATE_NEAREST_INTERSECTION
            );
        }
        applySubmissionMode(false);
        for (String quickReportType : quickReportTypes) {
            CheckBox selected = quickReportCheckboxes.get(quickReportType);
            if (selected != null) {
                changingQuickSelection = true;
                selected.setChecked(true);
                changingQuickSelection = false;
            }
        }
    }

    private void addQuickReportOption(
            View root,
            int viewId,
            String quickType,
            String reportCategory
    ) {
        CheckBox option = root.findViewById(viewId);
        quickReportCheckboxes.put(quickType, option);
        option.setTag(reportCategory);
        option.setOnCheckedChangeListener((button, checked) -> {
            if (changingQuickSelection) {
                return;
            }
            changingQuickSelection = true;
            if (checked) {
                quickReportTypes.add(quickType);
                if ("crosswalk_encroachment".equals(quickType)
                        && vehicleInvolvedCheckbox != null) {
                    // A crosswalk encroachment necessarily involves a
                    // vehicle. Reveal the optional plate/state fields at the
                    // same time as the official-email disclosure.
                    vehicleInvolvedCheckbox.setChecked(true);
                }
            } else {
                quickReportTypes.remove(quickType);
            }
            for (CheckBox issue : issueCheckboxes) {
                issue.setChecked(false);
            }
            for (String selectedType : quickReportTypes) {
                CheckBox selectedOption =
                        quickReportCheckboxes.get(selectedType);
                if (selectedOption == null) {
                    continue;
                }
                CheckBox category = issueCheckboxesBySlug.get(
                        String.valueOf(selectedOption.getTag()));
                if (category != null) {
                    category.setChecked(true);
                }
            }
            changingQuickSelection = false;
            updateDynamicSections();
        });
    }

    private void chooseSubmissionMode(String mode) {
        if (mode.equals(submissionMode)) {
            return;
        }
        submissionMode = mode;
        quickReportTypes.clear();
        changingQuickSelection = true;
        for (CheckBox quickOption : quickReportCheckboxes.values()) {
            quickOption.setChecked(false);
        }
        for (CheckBox issue : issueCheckboxes) {
            issue.setChecked(false);
        }
        changingQuickSelection = false;
        applySubmissionMode(true);
        updateDynamicSections();
        if ("quick".equals(mode)) {
            requestCurrentLocation();
        } else {
            refreshLocation();
        }
    }

    private void applySubmissionMode(boolean clearError) {
        boolean quick = "quick".equals(submissionMode);
        boolean full = "full".equals(submissionMode);
        quickReportOptions.setVisibility(quick ? View.VISIBLE : View.GONE);
        fullReportSections.setVisibility(full ? View.VISIBLE : View.GONE);
        if (quickExpandedContainer != null) {
            quickExpandedContainer.setVisibility(
                    quick ? View.VISIBLE : View.GONE);
        }
        quickReportButton.setChecked(quick);
        fullReportButton.setChecked(full);
        if (clearError) {
            reportPathError.setVisibility(View.GONE);
        }
    }

    private void initializeStructuredReportControls(
            View root,
            @Nullable Bundle savedInstanceState
    ) {
        ArrayAdapter<String> reportedPartyAdapter = new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                new String[]{
                        getString(R.string.reported_party_unknown),
                        getString(R.string.reported_party_civilian),
                        getString(R.string.reported_party_police),
                        getString(R.string.reported_party_government),
                        getString(R.string.reported_party_commercial)
                }
        );
        reportedPartyAdapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item
        );
        reportedPartySpinner.setAdapter(reportedPartyAdapter);
        reportedPartySpinner.setSelection(0);
        reportedPartySpinner.setOnItemSelectedListener(
                new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(
                            AdapterView<?> parent,
                            View selectedView,
                            int position,
                            long id
                    ) {
                        if (position == 2) {
                            CheckBox policeCategory =
                                    issueCheckboxesBySlug.get(
                                            "police_response");
                            if (policeCategory != null) {
                                policeCategory.setChecked(true);
                            }
                        }
                        updateDynamicSections();
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> parent) {
                    }
                }
        );

        ArrayAdapter<String> statusAdapter = new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                new String[]{
                        getString(R.string.status_unknown),
                        getString(R.string.status_on),
                        getString(R.string.status_off)
                }
        );
        statusAdapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item
        );
        emergencyLightsSpinner.setAdapter(statusAdapter);
        sirenSpinner.setAdapter(new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                new String[]{
                        getString(R.string.status_unknown),
                        getString(R.string.status_on),
                        getString(R.string.status_off)
                }
        ));
        ((ArrayAdapter<?>) sirenSpinner.getAdapter())
                .setDropDownViewResource(
                        R.layout.spinner_dropdown_item
                );

        vehicleInvolvedCheckbox.setOnCheckedChangeListener(
                (button, checked) -> {
                    vehicleDetailsContainer.setVisibility(
                            checked ? View.VISIBLE : View.GONE
                    );
                    if (!checked) {
                        clearVehicleDetails();
                    }
                }
        );

        LinearLayout observationsContainer = root.findViewById(
                R.id.police_observations_container);
        for (int index = 0;
             index < POLICE_OBSERVATION_VALUES.length;
             index++) {
            CheckBox observation = new CheckBox(requireContext());
            observation.setText(POLICE_OBSERVATION_LABELS[index]);
            observation.setMinHeight(dp(48));
            observationsContainer.addView(
                    observation,
                    new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                    )
            );
            policeObservationCheckboxes.put(
                    POLICE_OBSERVATION_VALUES[index],
                    observation
            );
        }

        if (savedInstanceState != null) {
            restoreVehicleDetails(savedInstanceState.getString(
                    STATE_VEHICLE_DETAILS));
            restorePoliceObservations(savedInstanceState.getString(
                    STATE_POLICE_OBSERVATIONS));
        }
    }

    private void buildDetailedChecklist(
            LinearLayout container,
            @Nullable String savedResponses
    ) {
        container.removeAllViews();
        try {
            for (ChecklistCatalog.Category category
                    : ChecklistCatalog.load(requireContext())) {
                View categoryView = createChecklistCategory(category);
                categoryView.setVisibility(View.GONE);
                checklistCategories.put(category.getId(), category);
                checklistCategoryViews.put(category.getId(), categoryView);
                container.addView(categoryView);
            }
            restoreChecklistResponses(savedResponses);
        } catch (IOException | JSONException exception) {
            TextView error = new TextView(requireContext());
            error.setText(R.string.checklist_unavailable);
            error.setTextColor(ContextCompat.getColor(
                    requireContext(),
                    R.color.cw_error
            ));
            error.setTextSize(13);
            error.setPadding(0, dp(8), 0, dp(8));
            container.addView(error);
        }
    }

    private void updateDynamicSections() {
        if (issueCheckboxesBySlug.isEmpty()) {
            return;
        }
        List<String> selectedCategories = selectedIssueSlugs();
        List<String> effectiveCategories =
                new ArrayList<>(selectedCategories);
        boolean policeIsReported =
                "police_officer".equals(reportedPartyValue());
        if (policeIsReported
                && !effectiveCategories.contains("police_response")) {
            effectiveCategories.add("police_response");
        }

        boolean full = "full".equals(submissionMode);
        for (Map.Entry<String, LinearLayout> entry
                : issueExpansionContainersBySlug.entrySet()) {
            CheckBox category = issueCheckboxesBySlug.get(entry.getKey());
            entry.getValue().setVisibility(
                    full && category != null && category.isChecked()
                            ? View.VISIBLE
                            : View.GONE
            );
        }

        for (Map.Entry<String, ChecklistCatalog.Category> entry
                : checklistCategories.entrySet()) {
            View categoryView = checklistCategoryViews.get(entry.getKey());
            boolean visible = entry.getValue().appliesTo(
                    effectiveCategories);
            if (categoryView != null) {
                if (visible) {
                    LinearLayout target = inlineContainerFor(
                            entry.getValue(),
                            effectiveCategories
                    );
                    if (target != null) {
                        moveView(categoryView, target);
                    }
                }
                categoryView.setVisibility(
                        visible ? View.VISIBLE : View.GONE
                );
            }
            if (!visible && !restoringViewState) {
                clearChecklistCategory(entry.getValue());
            }
        }
        if (checklistEmpty != null) {
            checklistEmpty.setVisibility(View.GONE);
        }

        boolean vehicleCategorySelected =
                selectedCategories.contains("vehicle_safety")
                || selectedCategories.contains("aggressive_drivers");
        boolean policeCategorySelected =
                selectedCategories.contains("police_response");
        boolean showIdentification = "quick".equals(submissionMode)
                || vehicleCategorySelected
                || policeCategorySelected
                || !"unknown".equals(reportedPartyValue());
        if (subjectVehicleSection != null) {
            LinearLayout target = structuredSectionTarget(
                    selectedCategories,
                    policeCategorySelected
            );
            if (showIdentification && target != null) {
                moveView(subjectVehicleSection, target);
            }
            subjectVehicleSection.setVisibility(
                    showIdentification ? View.VISIBLE : View.GONE
            );
        }
        if (!showIdentification && !restoringViewState) {
            resetIdentificationFields();
        }

        boolean showPolice = policeCategorySelected || policeIsReported;
        if (policeInteractionSection != null) {
            LinearLayout target = "quick".equals(submissionMode)
                    ? quickExpandedContainer
                    : issueExpansionContainersBySlug.get(
                            "police_response");
            if (showPolice && target != null) {
                moveView(policeInteractionSection, target);
            }
            policeInteractionSection.setVisibility(
                    showPolice ? View.VISIBLE : View.GONE
            );
        }
        if (!showPolice && !restoringViewState) {
            clearPoliceFields();
        }
        updateOfficialEmailUi();
    }

    private void updateOfficialEmailUi() {
        if (officialEmailNoticeContainer == null
                || officialEmailNotice == null
                || saveReportButton == null) {
            return;
        }
        OfficialEmailPolicy.Routing routing = OfficialEmailPolicy.classify(
                "quick".equals(submissionMode)
                        ? quickReportTypesJson()
                        : "[]",
                null,
                null
        );
        boolean automatic = routing != OfficialEmailPolicy.Routing.NONE;
        officialEmailNoticeContainer.setVisibility(
                automatic ? View.VISIBLE : View.GONE);
        if (automatic) {
            int disclosure = routing
                    == OfficialEmailPolicy.Routing.POLICE_AND_MAYOR
                    ? R.string.official_email_disclosure_police_mayor
                    : routing == OfficialEmailPolicy.Routing.CODES
                    ? R.string.official_email_disclosure_codes
                    : R.string.official_email_disclosure_police_mayor_codes;
            officialEmailNotice.setText(disclosure);
        }
        if (officialEmailError != null && !automatic) {
            officialEmailError.setVisibility(View.GONE);
        }
        if (photoHeading != null) {
            photoHeading.setText(automatic
                    ? R.string.photo_required_for_official_email
                    : R.string.photo_optional);
        }
        saveReportButton.setText(automatic
                ? R.string.save_submit_and_email
                : R.string.save_report);
    }

    @Nullable
    private LinearLayout inlineContainerFor(
            ChecklistCatalog.Category category,
            List<String> effectiveCategories
    ) {
        for (String reportCategory : category.getReportCategories()) {
            if (effectiveCategories.contains(reportCategory)) {
                LinearLayout target =
                        issueExpansionContainersBySlug.get(reportCategory);
                if (target != null) {
                    return target;
                }
            }
        }
        return null;
    }

    @Nullable
    private LinearLayout structuredSectionTarget(
            List<String> selectedCategories,
            boolean policeCategorySelected
    ) {
        if ("quick".equals(submissionMode)) {
            return quickExpandedContainer;
        }
        if (selectedCategories.contains("vehicle_safety")) {
            return issueExpansionContainersBySlug.get("vehicle_safety");
        }
        if (selectedCategories.contains("aggressive_drivers")) {
            return issueExpansionContainersBySlug.get(
                    "aggressive_drivers");
        }
        if (policeCategorySelected) {
            return issueExpansionContainersBySlug.get("police_response");
        }
        return null;
    }

    private void moveView(View child, ViewGroup target) {
        if (child.getParent() == target) {
            return;
        }
        if (child.getParent() instanceof ViewGroup) {
            ((ViewGroup) child.getParent()).removeView(child);
        }
        target.addView(
                child,
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                )
        );
    }

    @Override
    public void onViewStateRestored(@Nullable Bundle savedInstanceState) {
        super.onViewStateRestored(savedInstanceState);
        restoringViewState = false;
        detailsLayout.setVisibility(
                additionalInformationToggle.isChecked()
                        ? View.VISIBLE
                        : View.GONE
        );
        updateDynamicSections();
    }

    private List<String> selectedIssueSlugs() {
        List<String> selected = new ArrayList<>();
        for (Map.Entry<String, CheckBox> entry
                : issueCheckboxesBySlug.entrySet()) {
            if (entry.getValue().isChecked()) {
                selected.add(entry.getKey());
            }
        }
        return selected;
    }

    private String reportedPartyValue() {
        if (reportedPartySpinner == null) {
            return "unknown";
        }
        int position = reportedPartySpinner.getSelectedItemPosition();
        return position >= 0 && position < REPORTED_PARTY_VALUES.length
                ? REPORTED_PARTY_VALUES[position]
                : "unknown";
    }

    private void clearChecklistCategory(
            ChecklistCatalog.Category category
    ) {
        for (ChecklistCatalog.Question question
                : category.getQuestions()) {
            Spinner spinner = checklistSpinners.get(question.getId());
            if (spinner != null && spinner.getSelectedItemPosition() != 0) {
                spinner.setSelection(0);
            }
        }
    }

    private void resetIdentificationFields() {
        if (reportedPartySpinner != null
                && reportedPartySpinner.getSelectedItemPosition() != 0) {
            reportedPartySpinner.setSelection(0);
        }
        if (vehicleInvolvedCheckbox != null
                && vehicleInvolvedCheckbox.isChecked()) {
            vehicleInvolvedCheckbox.setChecked(false);
        } else {
            clearVehicleDetails();
        }
    }

    private void clearVehicleDetails() {
        for (TextInputEditText field : vehicleFields.values()) {
            field.setText("");
        }
        if (emergencyLightsSpinner != null) {
            emergencyLightsSpinner.setSelection(0);
        }
        if (sirenSpinner != null) {
            sirenSpinner.setSelection(0);
        }
    }

    private void clearPoliceFields() {
        if (policeResponseGroup != null) {
            policeResponseGroup.check(R.id.police_not_involved);
        }
        for (CheckBox observation
                : policeObservationCheckboxes.values()) {
            observation.setChecked(false);
        }
        if (policeComplaintDetails != null) {
            policeComplaintDetails.setText("");
        }
    }

    private View createChecklistCategory(
            ChecklistCatalog.Category category
    ) {
        MaterialCardView card = new MaterialCardView(requireContext());
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardParams.bottomMargin = dp(8);
        card.setLayoutParams(cardParams);
        card.setRadius(dp(12));
        card.setStrokeWidth(dp(1));
        card.setStrokeColor(ContextCompat.getColor(
                requireContext(),
                R.color.cw_blue
        ));
        card.setCardBackgroundColor(ContextCompat.getColor(
                requireContext(),
                R.color.white
        ));

        LinearLayout cardContent = new LinearLayout(requireContext());
        cardContent.setOrientation(LinearLayout.VERTICAL);
        card.addView(cardContent, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        MaterialButton header = new MaterialButton(requireContext());
        int questionCount = category.getQuestions().size();
        header.setAllCaps(false);
        header.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        header.setText(getString(
                R.string.checklist_header_format,
                category.getTitle(),
                questionCount
        ));
        header.setTextColor(ContextCompat.getColor(
                requireContext(),
                R.color.cw_blue_dark
        ));
        header.setTypeface(header.getTypeface(), Typeface.BOLD);
        header.setBackgroundColor(ContextCompat.getColor(
                requireContext(),
                R.color.white
        ));
        header.setContentDescription(getResources().getQuantityString(
                R.plurals.checklist_expand,
                questionCount,
                category.getTitle(),
                questionCount
        ));
        cardContent.addView(header, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(54)
        ));

        LinearLayout questions = new LinearLayout(requireContext());
        questions.setOrientation(LinearLayout.VERTICAL);
        questions.setPadding(dp(14), 0, dp(14), dp(12));
        questions.setVisibility(View.GONE);
        cardContent.addView(questions, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView description = new TextView(requireContext());
        description.setText(category.getDescription());
        description.setTextColor(ContextCompat.getColor(
                requireContext(),
                R.color.cw_text_secondary
        ));
        description.setTextSize(13);
        description.setPadding(0, 0, 0, dp(8));
        questions.addView(description);

        for (ChecklistCatalog.Question question
                : category.getQuestions()) {
            questions.addView(createChecklistQuestion(
                    category,
                    question
            ));
        }

        header.setOnClickListener(button -> {
            boolean expanding = questions.getVisibility() != View.VISIBLE;
            questions.setVisibility(expanding ? View.VISIBLE : View.GONE);
            header.setContentDescription(getResources().getQuantityString(
                    expanding
                            ? R.plurals.checklist_collapse
                            : R.plurals.checklist_expand,
                    questionCount,
                    category.getTitle(),
                    questionCount
            ));
        });
        return card;
    }

    private View createChecklistQuestion(
            ChecklistCatalog.Category category,
            ChecklistCatalog.Question question
    ) {
        LinearLayout row = new LinearLayout(requireContext());
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(0, dp(10), 0, dp(10));

        TextView questionText = new TextView(requireContext());
        questionText.setText(question.getText());
        questionText.setTextColor(ContextCompat.getColor(
                requireContext(),
                R.color.cw_text
        ));
        questionText.setTextSize(14);
        row.addView(questionText, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        Spinner spinner = new Spinner(requireContext());
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                requireContext(),
                R.layout.spinner_item,
                new String[]{
                        getString(R.string.checklist_not_answered),
                        getString(R.string.checklist_ok),
                        getString(R.string.checklist_needs_attention),
                        getString(R.string.checklist_not_applicable)
                }
        );
        adapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item
        );
        spinner.setAdapter(adapter);
        spinner.setContentDescription(getString(
                R.string.checklist_question_content_description,
                question.getText()
        ));
        LinearLayout.LayoutParams spinnerParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(48)
                );
        spinnerParams.topMargin = dp(4);
        row.addView(spinner, spinnerParams);
        checklistSpinners.put(question.getId(), spinner);

        View divider = new View(requireContext());
        divider.setBackgroundColor(0xFFD7E1E6);
        LinearLayout.LayoutParams dividerParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(1)
                );
        dividerParams.topMargin = dp(2);
        row.addView(divider, dividerParams);
        return row;
    }

    private String checklistResponsesJson() {
        JSONObject responses = new JSONObject();
        for (Map.Entry<String, Spinner> entry
                : checklistSpinners.entrySet()) {
            int selection = entry.getValue().getSelectedItemPosition();
            if (selection > 0 && selection < CHECKLIST_VALUES.length) {
                try {
                    responses.put(
                            entry.getKey(),
                            CHECKLIST_VALUES[selection]
                    );
                } catch (JSONException ignored) {
                    // The catalog uses fixed safe keys and string values.
                }
            }
        }
        return responses.toString();
    }

    private String vehicleDetailsJson() {
        JSONObject detailsValue = new JSONObject();
        if (vehicleInvolvedCheckbox == null
                || !vehicleInvolvedCheckbox.isChecked()) {
            return detailsValue.toString();
        }
        for (Map.Entry<String, TextInputEditText> entry
                : vehicleFields.entrySet()) {
            try {
                detailsValue.put(
                        entry.getKey(),
                        textValue(entry.getValue())
                );
            } catch (JSONException ignored) {
                // The structured field names are fixed application constants.
            }
        }
        try {
            detailsValue.put(
                    "emergency_lights",
                    statusValue(emergencyLightsSpinner)
            );
            detailsValue.put("siren", statusValue(sirenSpinner));
        } catch (JSONException ignored) {
            // The structured field names are fixed application constants.
        }
        return detailsValue.toString();
    }

    private String policeObservationsJson() {
        JSONArray observations = new JSONArray();
        for (Map.Entry<String, CheckBox> entry
                : policeObservationCheckboxes.entrySet()) {
            if (entry.getValue().isChecked()) {
                observations.put(entry.getKey());
            }
        }
        return observations.toString();
    }

    private String quickReportTypesJson() {
        JSONArray values = new JSONArray();
        for (String quickReportType : quickReportTypes) {
            values.put(quickReportType);
        }
        return values.toString();
    }

    private void restoreQuickReportTypes(@Nullable String storedValue) {
        quickReportTypes.clear();
        if (storedValue == null || storedValue.trim().isEmpty()) {
            return;
        }
        try {
            JSONArray values = new JSONArray(storedValue);
            for (int index = 0; index < values.length(); index++) {
                String value = values.optString(index);
                if (quickReportCheckboxes.containsKey(value)) {
                    quickReportTypes.add(value);
                }
            }
        } catch (JSONException ignored) {
            if (quickReportCheckboxes.containsKey(storedValue)) {
                quickReportTypes.add(storedValue);
            }
        }
    }

    private String statusValue(Spinner spinner) {
        int position = spinner == null
                ? 0
                : spinner.getSelectedItemPosition();
        return position >= 0 && position < STATUS_VALUES.length
                ? STATUS_VALUES[position]
                : "unknown";
    }

    private String textValue(TextInputEditText field) {
        return field == null || field.getText() == null
                ? ""
                : field.getText().toString().trim();
    }

    private void restoreVehicleDetails(@Nullable String detailsJson) {
        if (detailsJson == null || detailsJson.trim().isEmpty()) {
            return;
        }
        try {
            JSONObject values = new JSONObject(detailsJson);
            for (Map.Entry<String, TextInputEditText> entry
                    : vehicleFields.entrySet()) {
                entry.getValue().setText(
                        values.optString(entry.getKey(), "")
                );
            }
            setStatusSelection(
                    emergencyLightsSpinner,
                    values.optString("emergency_lights", "unknown")
            );
            setStatusSelection(
                    sirenSpinner,
                    values.optString("siren", "unknown")
            );
        } catch (JSONException ignored) {
            // Invalid transient state should not block a report.
        }
    }

    private void restorePoliceObservations(
            @Nullable String observationsJson
    ) {
        if (observationsJson == null
                || observationsJson.trim().isEmpty()) {
            return;
        }
        try {
            JSONArray values = new JSONArray(observationsJson);
            for (int index = 0; index < values.length(); index++) {
                CheckBox observation = policeObservationCheckboxes.get(
                        values.optString(index)
                );
                if (observation != null) {
                    observation.setChecked(true);
                }
            }
        } catch (JSONException ignored) {
            // Invalid transient state should not block a report.
        }
    }

    private void setStatusSelection(Spinner spinner, String value) {
        for (int index = 0; index < STATUS_VALUES.length; index++) {
            if (STATUS_VALUES[index].equals(value)) {
                spinner.setSelection(index);
                return;
            }
        }
        spinner.setSelection(0);
    }

    private void restoreChecklistResponses(@Nullable String responseJson) {
        if (responseJson == null || responseJson.trim().isEmpty()) {
            return;
        }
        try {
            JSONObject responses = new JSONObject(responseJson);
            for (Map.Entry<String, Spinner> entry
                    : checklistSpinners.entrySet()) {
                String value = responses.optString(entry.getKey(), "");
                for (int index = 1;
                     index < CHECKLIST_VALUES.length;
                     index++) {
                    if (CHECKLIST_VALUES[index].equals(value)) {
                        entry.getValue().setSelection(index);
                        break;
                    }
                }
            }
        } catch (JSONException ignored) {
            // Invalid transient state should not block the quick report.
        }
    }

    private int checklistResponseCount(String responseJson) {
        try {
            return new JSONObject(responseJson).length();
        } catch (JSONException ignored) {
            return 0;
        }
    }

    private int dp(int value) {
        return Math.round(value
                * getResources().getDisplayMetrics().density);
    }

    private void refreshLocation() {
        if (locationLabel == null || !isAdded()) {
            return;
        }
        MainActivity activity = (MainActivity) requireActivity();
        if (!activity.isSelectedLocationConfirmed()) {
            locationLabel.setText(R.string.no_report_pin);
            locationSourceLabel.setText(
                    R.string.location_source_waiting);
            nearestIntersectionLabel.setText(
                    R.string.nearest_intersection_waiting);
            nearestIntersectionJson = null;
            return;
        }
        locationLabel.setText(getString(
                R.string.map_location_format,
                activity.getSelectedLatitude(),
                activity.getSelectedLongitude()
        ));
        locationSourceLabel.setText(locationSourceText(
                activity.getSelectedLocationSource(),
                activity.isLocationOverridden()
        ));
        if (
                Double.compare(
                        lastIntersectionLatitude,
                        activity.getSelectedLatitude()
                ) != 0
                        || Double.compare(
                        lastIntersectionLongitude,
                        activity.getSelectedLongitude()
                ) != 0
        ) {
            resolveNearestIntersection(
                    activity.getSelectedLatitude(),
                    activity.getSelectedLongitude()
            );
        } else {
            showNearestIntersection();
        }
    }

    private void requestCurrentLocation() {
        if (hasLocationPermission()) {
            locateDevice();
            return;
        }
        locationPermissionLauncher.launch(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        });
    }

    private void handleLocationPermissionResult(
            Map<String, Boolean> result
    ) {
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
            return;
        }
        String provider = chooseLocationProvider();
        if (provider == null) {
            Toast.makeText(
                    requireContext(),
                    R.string.location_unavailable,
                    Toast.LENGTH_LONG
            ).show();
            return;
        }
        Toast.makeText(
                requireContext(),
                R.string.finding_location,
                Toast.LENGTH_SHORT
        ).show();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            locationManager.getCurrentLocation(
                    provider,
                    null,
                    ContextCompat.getMainExecutor(requireContext()),
                    location -> {
                        if (location == null) {
                            if (isAdded()) {
                                Toast.makeText(
                                        requireContext(),
                                        R.string.location_unavailable,
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
        return locationManager.isProviderEnabled(
                LocationManager.NETWORK_PROVIDER)
                ? LocationManager.NETWORK_PROVIDER
                : null;
    }

    private void onLocationResolved(Location location) {
        if (!isAdded()) {
            return;
        }
        MainActivity activity = (MainActivity) requireActivity();
        if (activity.canAutomaticDeviceLocationReplace()) {
            activity.setSelectedLocation(
                    location.getLatitude(),
                    location.getLongitude(),
                    ReportLocationSource.DEVICE_GPS
            );
        }
        refreshLocation();
    }

    private String locationSourceText(String source, boolean overridden) {
        if (ReportLocationSource.PHOTO_EXIF.equals(source)) {
            return getString(R.string.location_source_photo);
        }
        if (ReportLocationSource.DEVICE_GPS.equals(source)) {
            return getString(overridden
                    ? R.string.location_source_device_override
                    : R.string.location_source_device);
        }
        if (ReportLocationSource.MANUAL_COORDINATES.equals(source)) {
            return getString(overridden
                    ? R.string.location_source_manual_override
                    : R.string.location_source_manual_coordinates);
        }
        if (ReportLocationSource.MANUAL_MAP.equals(source)) {
            return getString(overridden
                    ? R.string.location_source_manual_override
                    : R.string.location_source_manual_map);
        }
        return getString(R.string.location_source_unknown);
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
        // A report requests only one location fix at a time.
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {
        // The next request explains that a current fix is unavailable.
    }

    private void resolveNearestIntersection(
            double latitude,
            double longitude
    ) {
        if (intersectionExecutor == null
                || intersectionExecutor.isShutdown()) {
            return;
        }
        lastIntersectionLatitude = latitude;
        lastIntersectionLongitude = longitude;
        nearestIntersectionJson = null;
        nearestIntersectionLabel.setText(
                R.string.nearest_intersection_checking);
        intersectionExecutor.execute(() -> {
            String result = null;
            try {
                JSONObject intersection =
                        new IntersectionLookupClient().lookup(
                                latitude,
                                longitude
                        );
                if (intersection != null) {
                    result = intersection.toString();
                }
            } catch (IOException | JSONException ignored) {
                // The report remains usable if road lookup is unavailable.
            }
            String finalResult = result;
            if (isAdded()) {
                requireActivity().runOnUiThread(() -> {
                    nearestIntersectionJson = finalResult;
                    showNearestIntersection();
                });
            }
        });
    }

    private void showNearestIntersection() {
        if (nearestIntersectionLabel == null) {
            return;
        }
        if (nearestIntersectionJson == null) {
            nearestIntersectionLabel.setText(
                    R.string.nearest_intersection_unknown);
            return;
        }
        try {
            nearestIntersectionLabel.setText(
                    new JSONObject(nearestIntersectionJson)
                            .optString(
                                    "label",
                                    getString(
                                            R.string
                                                    .nearest_intersection_unknown
                                    )
                            )
            );
        } catch (JSONException ignored) {
            nearestIntersectionLabel.setText(
                    R.string.nearest_intersection_unknown);
        }
    }

    private void saveReport() {
        if (preparingPhoto) {
            return;
        }
        if ("choose".equals(submissionMode)) {
            reportPathError.setVisibility(View.VISIBLE);
            quickReportButton.requestFocus();
            return;
        }
        List<String> categories = selectedIssueSlugs();
        String otherDetailsText = textValue(otherDetails);
        String detailsText = combinedDetails(
                otherDetailsText,
                additionalInformationToggle.isChecked()
                        ? textValue(details)
                        : ""
        );
        String checklistResponses = checklistResponsesJson();
        String vehicleDetails = vehicleDetailsJson();
        String policeObservations = policeObservationsJson();
        String policeComplaintText = textValue(policeComplaintDetails);
        String selectedQuickReportTypes = "quick".equals(submissionMode)
                ? quickReportTypesJson()
                : "[]";
        boolean officialEmailAuthorized =
                OfficialEmailPolicy.isAutomaticEmailEligible(
                        selectedQuickReportTypes,
                        null,
                        null
                );

        ReportValidator.ValidationResult result =
                ReportValidator.validate(
                        categories,
                        otherDetailsText,
                        "full".equals(submissionMode)
                );
        if (result == ReportValidator.ValidationResult.NO_CATEGORY) {
            issueError.setVisibility(View.VISIBLE);
            issueCheckboxes.get(0).requestFocus();
            return;
        }
        if (result == ReportValidator.ValidationResult.OTHER_NEEDS_DETAILS) {
            otherDetailsLayout.setError(
                    getString(R.string.details_required_error));
            otherDetails.requestFocus();
            return;
        }
        otherDetailsLayout.setError(null);
        detailsLayout.setError(null);

        MainActivity activity = (MainActivity) requireActivity();
        if (officialEmailAuthorized) {
            boolean hasPhoto = selectedPhotoPath != null
                    && new File(selectedPhotoPath).isFile();
            boolean hasConfirmedLocation =
                    activity.isSelectedLocationConfirmed();
            boolean locationEligible = hasConfirmedLocation
                    && OfficialEmailPolicy.isOfficialEmailLocationEligible(
                    activity.getSelectedLatitude(),
                    activity.getSelectedLongitude()
            );
            if (!hasPhoto || !hasConfirmedLocation || !locationEligible) {
                if (officialEmailError != null) {
                    officialEmailError.setText(!hasPhoto
                            ? R.string.official_email_photo_required
                            : !hasConfirmedLocation
                            ? R.string.official_email_location_required
                            : R.string.official_email_location_outside_area);
                    officialEmailError.setVisibility(View.VISIBLE);
                    officialEmailError.announceForAccessibility(
                            officialEmailError.getText());
                }
                if (!hasPhoto) {
                    takePhotoButton.requestFocus();
                } else {
                    locationLabel.requestFocus();
                }
                return;
            }
        }
        if (officialEmailError != null) {
            officialEmailError.setVisibility(View.GONE);
        }
        String observedText = observedTime.getText() == null
                ? ""
                : observedTime.getText().toString().trim();
        if (observedText.isEmpty()) {
            observedText = new SimpleDateFormat(
                    "MMM d, yyyy h:mm a",
                    Locale.US
            ).format(new Date());
        }

        RadioButton responseButton = viewForCheckedRadioButton();
        String policeResponse = responseButton == null
                ? getString(R.string.police_not_involved)
                : responseButton.getText().toString();

        String clientReportId = UUID.randomUUID().toString();
        String pendingPhotoPath = selectedPhotoPath;
        String committedPhotoPath;
        try {
            committedPhotoPath = PhotoStorage.copyPendingPhotoForCommit(
                    requireContext(),
                    pendingPhotoPath,
                    clientReportId
            );
        } catch (IOException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.photo_prepare_failed,
                    Toast.LENGTH_LONG
            ).show();
            return;
        }

        SafetyReport report = new SafetyReport(
                0,
                clientReportId,
                System.currentTimeMillis(),
                observedText,
                String.join("|", categories),
                severitySpinner.getSelectedItem().toString(),
                policeResponse,
                detailsText,
                checklistResponseCount(checklistResponses) > 0
                        ? "walkability_assessment"
                        : "quick_report",
                checklistResponses,
                reportedPartyValue(),
                vehicleInvolvedCheckbox.isChecked(),
                vehicleDetails,
                policeObservations,
                policeComplaintText,
                submissionMode,
                selectedQuickReportTypes,
                activity.isSelectedLocationConfirmed()
                        ? nearestIntersectionJson
                        : null,
                null,
                null,
                null,
                null,
                0,
                activity.isSelectedLocationConfirmed(),
                activity.getSelectedLatitude(),
                activity.getSelectedLongitude(),
                activity.getSelectedLocationSource(),
                activity.getPhotoLatitude(),
                activity.getPhotoLongitude(),
                activity.isLocationOverridden(),
                committedPhotoPath,
                SafetyReport.STATUS_PENDING,
                null,
                null,
                0,
                officialEmailAuthorized
        );

        long reportId;
        try {
            reportId = databaseHelper.insertReport(report);
        } catch (RuntimeException exception) {
            PhotoStorage.delete(committedPhotoPath);
            Toast.makeText(
                    requireContext(),
                    R.string.report_save_failed,
                    Toast.LENGTH_LONG
            ).show();
            return;
        }
        PhotoStorage.delete(pendingPhotoPath);
        selectedPhotoPath = null;
        try {
            ReportUploadScheduler.enqueue(requireContext(), reportId);
        } catch (RuntimeException exception) {
            // The locally pending row is retried by the app-launch scheduler.
        }
        Toast.makeText(
                requireContext(),
                officialEmailAuthorized
                        ? R.string.saved_and_official_email_confirmation
                        : R.string.saved_confirmation,
                Toast.LENGTH_LONG
        ).show();
        clearForm();
        activity.clearSelectedLocation();
        activity.navigateToSavedReports();
    }

    private String combinedDetails(
            String otherDetailsText,
            String additionalDetailsText
    ) {
        StringBuilder combined = new StringBuilder();
        if (otherCheckbox != null
                && otherCheckbox.isChecked()
                && !otherDetailsText.isEmpty()) {
            combined.append("Not included elsewhere: ")
                    .append(otherDetailsText);
        }
        if (!additionalDetailsText.isEmpty()) {
            if (combined.length() > 0) {
                combined.append("\n\n");
            }
            combined.append(additionalDetailsText);
        }
        return combined.toString();
    }

    @Nullable
    private RadioButton viewForCheckedRadioButton() {
        int checkedId = policeResponseGroup.getCheckedRadioButtonId();
        if (checkedId == View.NO_ID) {
            return null;
        }
        return policeResponseGroup.findViewById(checkedId);
    }

    private void clearForm() {
        submissionMode = "quick";
        quickReportTypes.clear();
        changingQuickSelection = true;
        for (CheckBox quickOption : quickReportCheckboxes.values()) {
            quickOption.setChecked(false);
        }
        changingQuickSelection = false;
        applySubmissionMode(true);
        for (CheckBox checkbox : issueCheckboxes) {
            checkbox.setChecked(false);
        }
        severitySpinner.setSelection(1);
        policeResponseGroup.check(R.id.police_not_involved);
        observedTime.setText(new SimpleDateFormat(
                "MMM d, yyyy h:mm a",
                Locale.US
        ).format(new Date()));
        additionalInformationToggle.setChecked(false);
        details.setText("");
        otherDetails.setText("");
        for (Spinner spinner : checklistSpinners.values()) {
            spinner.setSelection(0);
        }
        reportedPartySpinner.setSelection(0);
        vehicleInvolvedCheckbox.setChecked(false);
        clearVehicleDetails();
        clearPoliceFields();
        selectedPhotoPath = null;
        refreshPhotoPreview();
        issueError.setVisibility(View.GONE);
        otherDetailsLayout.setError(null);
        detailsLayout.setError(null);
        if (officialEmailError != null) {
            officialEmailError.setVisibility(View.GONE);
        }
        updateDynamicSections();
    }

    private void takePhoto() {
        if (preparingPhoto) {
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
                    R.string.photo_camera_unavailable,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void choosePhoto() {
        if (preparingPhoto) {
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
        android.content.Context appContext = requireContext()
                .getApplicationContext();
        preparePhotoAsync(() -> PhotoStorage.createPendingPhoto(
                appContext,
                capturedFile
        ));
    }

    private void handleChosenPhoto(@Nullable Uri source) {
        if (source == null || !isAdded()) {
            return;
        }
        android.content.Context appContext = requireContext()
                .getApplicationContext();
        preparePhotoAsync(() -> PhotoStorage.createPendingPhoto(
                appContext,
                source
        ));
    }

    private void preparePhotoAsync(PhotoPreparation preparation) {
        if (preparingPhoto || photoExecutor == null
                || photoExecutor.isShutdown()) {
            return;
        }
        int generation = ++photoPreparationGeneration;
        setPhotoPreparing(true);
        try {
            photoExecutor.execute(() -> {
                try {
                    PhotoStorage.PreparedPhoto prepared =
                            preparation.prepare();
                    if (isAdded()) {
                        requireActivity().runOnUiThread(() -> {
                            if (generation != photoPreparationGeneration
                                    || !isAdded()) {
                                PhotoStorage.delete(prepared.getPath());
                                return;
                            }
                            replaceSelectedPhoto(prepared);
                            setPhotoPreparing(false);
                        });
                    } else {
                        PhotoStorage.delete(prepared.getPath());
                    }
                } catch (IOException | RuntimeException exception) {
                    if (isAdded()) {
                        requireActivity().runOnUiThread(() -> {
                            if (generation == photoPreparationGeneration) {
                                setPhotoPreparing(false);
                                Toast.makeText(
                                        requireContext(),
                                        R.string.photo_prepare_failed,
                                        Toast.LENGTH_LONG
                                ).show();
                            }
                        });
                    }
                }
            });
        } catch (RejectedExecutionException exception) {
            setPhotoPreparing(false);
        }
    }

    private void replaceSelectedPhoto(
            PhotoStorage.PreparedPhoto preparedPhoto
    ) {
        PhotoStorage.delete(selectedPhotoPath);
        selectedPhotoPath = preparedPhoto.getPath();
        MainActivity activity = (MainActivity) requireActivity();
        if (preparedPhoto.hasCoordinates()) {
            activity.setSelectedLocation(
                    preparedPhoto.getLatitude(),
                    preparedPhoto.getLongitude(),
                    ReportLocationSource.PHOTO_EXIF
            );
        } else {
            activity.clearPhotoLocation();
            if (!activity.isSelectedLocationConfirmed()) {
                requestCurrentLocation();
            }
        }
        refreshPhotoPreview();
        refreshLocation();
    }

    private void removeSelectedPhoto() {
        photoPreparationGeneration++;
        PhotoStorage.delete(selectedPhotoPath);
        selectedPhotoPath = null;
        MainActivity activity = (MainActivity) requireActivity();
        activity.clearPhotoLocation();
        if (!activity.isSelectedLocationConfirmed()) {
            requestCurrentLocation();
        }
        refreshPhotoPreview();
        refreshLocation();
    }

    private void setPhotoPreparing(boolean value) {
        preparingPhoto = value;
        if (takePhotoButton != null) {
            takePhotoButton.setEnabled(!value);
        }
        if (choosePhotoButton != null) {
            choosePhotoButton.setEnabled(!value);
        }
        if (saveReportButton != null) {
            saveReportButton.setEnabled(!value);
        }
    }

    private void refreshPhotoPreview() {
        if (photoPreview == null || photoPreviewContainer == null) {
            return;
        }
        boolean hasPhoto = selectedPhotoPath != null
                && new File(selectedPhotoPath).isFile();
        photoPreviewContainer.setVisibility(
                hasPhoto ? View.VISIBLE : View.GONE
        );
        if (hasPhoto) {
            photoPreview.setImageURI(Uri.fromFile(new File(selectedPhotoPath)));
        } else {
            photoPreview.setImageDrawable(null);
        }
    }

    @Override
    public void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(STATE_PHOTO_PATH, selectedPhotoPath);
        outState.putString(
                STATE_CHECKLIST_RESPONSES,
                checklistResponsesJson()
        );
        outState.putString(STATE_VEHICLE_DETAILS, vehicleDetailsJson());
        outState.putString(
                STATE_POLICE_OBSERVATIONS,
                policeObservationsJson()
        );
        outState.putString(STATE_SUBMISSION_MODE, submissionMode);
        outState.putString(
                STATE_QUICK_REPORT_TYPES,
                quickReportTypesJson()
        );
        outState.putString(
                STATE_NEAREST_INTERSECTION,
                nearestIntersectionJson
        );
        if (cameraCaptureFile != null) {
            outState.putString(
                    STATE_CAMERA_PATH,
                    cameraCaptureFile.getAbsolutePath()
            );
        }
    }

    @Override
    public void onDestroy() {
        photoPreparationGeneration++;
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        if (intersectionExecutor != null) {
            intersectionExecutor.shutdownNow();
            intersectionExecutor = null;
        }
        if (photoExecutor != null) {
            photoExecutor.shutdownNow();
            photoExecutor = null;
        }
        if (databaseHelper != null) {
            databaseHelper.close();
            databaseHelper = null;
        }
        super.onDestroy();
    }

    private interface PhotoPreparation {
        PhotoStorage.PreparedPhoto prepare() throws IOException;
    }
}
