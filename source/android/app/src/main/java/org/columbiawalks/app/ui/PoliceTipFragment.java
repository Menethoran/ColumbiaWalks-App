package org.columbiawalks.app.ui;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.domain.PoliceTipDraft;

public final class PoliceTipFragment extends Fragment {
    private static final String OFFICIAL_TIP_URL =
            "https://crimewatch.net/us/pa/lancaster/"
                    + "columbia-boro-pd/10552/submit-tip";
    private static final String FORMAL_REPORT_URL =
            "https://crimewatch.net/us/pa/lancaster/"
                    + "columbia-boro-pd/10552/report";
    private static final String OFFICER_CONDUCT_URL =
            "https://crimewatch.net/us/pa/lancaster/"
                    + "columbia-boro-pd/10552/content/citizen-complaint-form";

    private CheckBox inactiveConfirmation;
    private TextInputLayout subjectLayout;
    private TextInputLayout observedTimeLayout;
    private TextInputLayout locationLayout;
    private TextInputLayout observationLayout;
    private TextInputEditText subject;
    private TextInputEditText observedTime;
    private TextInputEditText location;
    private TextInputEditText direction;
    private TextInputEditText licensePlate;
    private TextInputEditText plateState;
    private TextInputEditText vehicleDescription;
    private TextInputEditText observation;
    private TextInputEditText evidenceNotes;
    private View preparedContainer;
    private TextView preparedSubject;
    private TextView preparedNarrative;
    @Nullable
    private PoliceTipDraft.PreparedTip preparedTip;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_police_tip, container, false);
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        inactiveConfirmation = view.findViewById(
                R.id.police_tip_inactive_confirmation
        );
        subjectLayout = view.findViewById(R.id.police_tip_subject_layout);
        observedTimeLayout = view.findViewById(
                R.id.police_tip_observed_time_layout
        );
        locationLayout = view.findViewById(
                R.id.police_tip_location_layout
        );
        observationLayout = view.findViewById(
                R.id.police_tip_observation_layout
        );
        subject = view.findViewById(R.id.police_tip_subject);
        observedTime = view.findViewById(R.id.police_tip_observed_time);
        location = view.findViewById(R.id.police_tip_location);
        direction = view.findViewById(R.id.police_tip_direction);
        licensePlate = view.findViewById(R.id.police_tip_license_plate);
        plateState = view.findViewById(R.id.police_tip_plate_state);
        vehicleDescription = view.findViewById(
                R.id.police_tip_vehicle_description
        );
        observation = view.findViewById(R.id.police_tip_observation);
        evidenceNotes = view.findViewById(R.id.police_tip_evidence_notes);
        preparedContainer = view.findViewById(
                R.id.police_tip_prepared_container
        );
        preparedSubject = view.findViewById(
                R.id.police_tip_prepared_subject
        );
        preparedNarrative = view.findViewById(
                R.id.police_tip_prepared_narrative
        );

        MainActivity activity = (MainActivity) requireActivity();
        view.findViewById(R.id.police_tip_back)
                .setOnClickListener(button -> activity.navigateToCommunity());
        view.findViewById(R.id.police_tip_call_911)
                .setOnClickListener(button -> dial("911"));
        view.findViewById(R.id.police_tip_call_dispatch)
                .setOnClickListener(button -> dial("717-664-1180"));
        view.findViewById(R.id.police_tip_call_dispatch_toll_free)
                .setOnClickListener(button -> dial("1-800-957-2677"));
        view.findViewById(R.id.police_tip_call_station)
                .setOnClickListener(button -> dial("717-684-7735"));
        view.findViewById(R.id.police_tip_prepare)
                .setOnClickListener(button -> prepareTip());
        view.findViewById(R.id.police_tip_copy)
                .setOnClickListener(button -> copyPreparedTip());
        view.findViewById(R.id.police_tip_open_official)
                .setOnClickListener(button -> {
                    if (preparedTip == null && !prepareTip()) {
                        return;
                    }
                    Toast.makeText(
                            requireContext(),
                            R.string.police_tip_opening_not_submitted,
                            Toast.LENGTH_LONG
                    ).show();
                    openExternal(OFFICIAL_TIP_URL);
                });
        view.findViewById(R.id.police_tip_formal_report)
                .setOnClickListener(button -> openExternal(FORMAL_REPORT_URL));
        view.findViewById(R.id.police_tip_officer_conduct)
                .setOnClickListener(
                        button -> openExternal(OFFICER_CONDUCT_URL)
                );

        TextWatcher invalidationWatcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(
                    CharSequence value,
                    int start,
                    int count,
                    int after
            ) {
            }

            @Override
            public void onTextChanged(
                    CharSequence value,
                    int start,
                    int before,
                    int count
            ) {
            }

            @Override
            public void afterTextChanged(Editable editable) {
                invalidatePreparedTip();
            }
        };
        for (TextInputEditText field : new TextInputEditText[]{
                subject,
                observedTime,
                location,
                direction,
                licensePlate,
                plateState,
                vehicleDescription,
                observation,
                evidenceNotes
        }) {
            field.addTextChangedListener(invalidationWatcher);
        }
        inactiveConfirmation.setOnCheckedChangeListener(
                (button, checked) -> invalidatePreparedTip()
        );
    }

    private boolean prepareTip() {
        clearErrors();
        PoliceTipDraft draft = new PoliceTipDraft.Builder()
                .setPastOrInactiveConfirmed(inactiveConfirmation.isChecked())
                .setSubject(value(subject))
                .setObservedTime(value(observedTime))
                .setLocation(value(location))
                .setDirection(value(direction))
                .setLicensePlate(value(licensePlate))
                .setPlateState(value(plateState))
                .setVehicleDescription(value(vehicleDescription))
                .setFirsthandObservation(value(observation))
                .setEvidenceNotes(value(evidenceNotes))
                .build();
        PoliceTipDraft.ValidationResult validation = draft.validate();
        if (validation != PoliceTipDraft.ValidationResult.VALID) {
            showValidationError(validation);
            return false;
        }

        preparedTip = draft.prepare();
        preparedSubject.setText(preparedTip.getSubject());
        preparedNarrative.setText(preparedTip.getNarrative());
        preparedContainer.setVisibility(View.VISIBLE);
        preparedContainer.requestFocus();
        Toast.makeText(
                requireContext(),
                R.string.police_tip_prepared_not_submitted,
                Toast.LENGTH_LONG
        ).show();
        return true;
    }

    private void copyPreparedTip() {
        if (preparedTip == null && !prepareTip()) {
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) requireContext()
                .getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null || preparedTip == null) {
            Toast.makeText(
                    requireContext(),
                    R.string.police_tip_copy_failed,
                    Toast.LENGTH_LONG
            ).show();
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText(
                getString(R.string.police_tip_clipboard_label),
                preparedTip.getClipboardText()
        ));
        Toast.makeText(
                requireContext(),
                R.string.police_tip_copied,
                Toast.LENGTH_LONG
        ).show();
    }

    private void showValidationError(
            PoliceTipDraft.ValidationResult validation
    ) {
        if (validation == PoliceTipDraft.ValidationResult
                .NOT_CONFIRMED_PAST_OR_INACTIVE) {
            Toast.makeText(
                    requireContext(),
                    R.string.police_tip_confirm_inactive_error,
                    Toast.LENGTH_LONG
            ).show();
            inactiveConfirmation.requestFocus();
            return;
        }
        if (validation == PoliceTipDraft.ValidationResult.NO_SUBJECT) {
            subjectLayout.setError(getString(R.string.required_field));
            subject.requestFocus();
            return;
        }
        if (validation == PoliceTipDraft.ValidationResult.NO_OBSERVED_TIME) {
            observedTimeLayout.setError(getString(R.string.required_field));
            observedTime.requestFocus();
            return;
        }
        if (validation == PoliceTipDraft.ValidationResult.NO_LOCATION) {
            locationLayout.setError(getString(R.string.required_field));
            location.requestFocus();
            return;
        }
        if (validation == PoliceTipDraft.ValidationResult
                .NO_FIRSTHAND_OBSERVATION) {
            observationLayout.setError(getString(R.string.required_field));
            observation.requestFocus();
            return;
        }
        Toast.makeText(
                requireContext(),
                R.string.police_tip_field_too_long,
                Toast.LENGTH_LONG
        ).show();
    }

    private void clearErrors() {
        subjectLayout.setError(null);
        observedTimeLayout.setError(null);
        locationLayout.setError(null);
        observationLayout.setError(null);
    }

    private void invalidatePreparedTip() {
        preparedTip = null;
        if (preparedContainer != null) {
            preparedContainer.setVisibility(View.GONE);
        }
    }

    private void dial(String number) {
        try {
            startActivity(new Intent(
                    Intent.ACTION_DIAL,
                    Uri.parse("tel:" + number)
            ));
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.phone_app_unavailable,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void openExternal(String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.browser_unavailable,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private static String value(TextInputEditText field) {
        return field.getText() == null
                ? ""
                : field.getText().toString().trim();
    }
}
