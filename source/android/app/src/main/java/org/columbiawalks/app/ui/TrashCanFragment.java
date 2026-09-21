package org.columbiawalks.app.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.domain.TrashCanSubmissionDraft;
import org.columbiawalks.app.submission.TrashCanQueueStore;
import org.columbiawalks.app.submission.TrashCanUploadScheduler;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.UUID;

public final class TrashCanFragment extends Fragment {
    private static final String[] PUBLIC_CATEGORY_VALUES = {
            "",
            "clean_well_maintained",
            "needs_cleaning",
            "full_or_overflowing",
            "damaged",
            "hard_to_access",
            "poor_location",
            "request_new_can",
            "other"
    };
    private static final String[] COMPLAINT_CATEGORY_VALUES = {
            "",
            "full_or_overflowing",
            "damaged",
            "missing",
            "odor_or_pests",
            "illegal_dumping",
            "unsafe_or_obstructing",
            "missed_service",
            "other"
    };
    private static final String[] SCOPE_VALUES = {
            TrashCanSubmissionDraft.SCOPE_PUBLIC,
            TrashCanSubmissionDraft.SCOPE_PRIVATE_PROPERTY,
            TrashCanSubmissionDraft.SCOPE_UNKNOWN
    };

    private RadioGroup modeGroup;
    private Spinner categorySpinner;
    private Spinner scopeSpinner;
    private TextView disclosure;
    private TextInputLayout commentLayout;
    private TextInputLayout addressLayout;
    private TextInputEditText comment;
    private TextInputEditText address;
    private TextView pinStatus;
    private CheckBox useMapPin;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_trash_cans, container, false);
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        modeGroup = view.findViewById(R.id.trash_can_mode_group);
        categorySpinner = view.findViewById(R.id.trash_can_category_spinner);
        scopeSpinner = view.findViewById(R.id.trash_can_scope_spinner);
        disclosure = view.findViewById(R.id.trash_can_disclosure);
        commentLayout = view.findViewById(R.id.trash_can_comment_layout);
        addressLayout = view.findViewById(R.id.trash_can_address_layout);
        comment = view.findViewById(R.id.trash_can_comment);
        address = view.findViewById(R.id.trash_can_address);
        pinStatus = view.findViewById(R.id.trash_can_pin_status);
        useMapPin = view.findViewById(R.id.trash_can_use_pin);

        ArrayAdapter<CharSequence> scopeAdapter =
                ArrayAdapter.createFromResource(
                        requireContext(),
                        R.array.trash_can_scope_labels,
                        R.layout.spinner_item
                );
        scopeAdapter.setDropDownViewResource(R.layout.spinner_dropdown_item);
        scopeSpinner.setAdapter(scopeAdapter);
        scopeSpinner.setSelection(0);

        MainActivity activity = (MainActivity) requireActivity();
        view.findViewById(R.id.trash_can_back)
                .setOnClickListener(button -> activity.navigateToCommunity());
        view.findViewById(R.id.trash_can_choose_map_pin)
                .setOnClickListener(button -> activity.navigateToMap());
        view.findViewById(R.id.trash_can_submit)
                .setOnClickListener(button -> submit());
        modeGroup.setOnCheckedChangeListener(
                (group, checkedId) -> updateMode()
        );
        updateMode();
        updateMapPinState();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pinStatus != null) {
            updateMapPinState();
        }
    }

    private void updateMode() {
        boolean publicComment = isPublicComment();
        int labels = publicComment
                ? R.array.trash_can_public_category_labels
                : R.array.trash_can_complaint_category_labels;
        ArrayAdapter<CharSequence> categoryAdapter =
                ArrayAdapter.createFromResource(
                        requireContext(),
                        labels,
                        R.layout.spinner_item
                );
        categoryAdapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item
        );
        categorySpinner.setAdapter(categoryAdapter);
        categorySpinner.setSelection(0);
        disclosure.setText(publicComment
                ? R.string.trash_can_public_disclosure
                : R.string.trash_can_complaint_disclosure);
        if (publicComment) {
            scopeSpinner.setSelection(0);
            scopeSpinner.setEnabled(false);
        } else {
            scopeSpinner.setEnabled(true);
        }
    }

    private void updateMapPinState() {
        MainActivity activity = (MainActivity) requireActivity();
        boolean confirmed = activity.isSelectedLocationConfirmed();
        useMapPin.setEnabled(confirmed);
        if (!confirmed) {
            useMapPin.setChecked(false);
            pinStatus.setText(R.string.trash_can_no_pin);
            return;
        }
        pinStatus.setText(getString(
                R.string.trash_can_pin_format,
                activity.getSelectedLatitude(),
                activity.getSelectedLongitude()
        ));
    }

    private void submit() {
        commentLayout.setError(null);
        addressLayout.setError(null);

        boolean publicComment = isPublicComment();
        TrashCanSubmissionDraft.Builder builder =
                new TrashCanSubmissionDraft.Builder()
                        .setKind(publicComment
                                ? TrashCanSubmissionDraft.KIND_PUBLIC_COMMENT
                                : TrashCanSubmissionDraft
                                .KIND_PRIVATE_COMPLAINT)
                        .setCategory(categoryValue(publicComment))
                        .setComment(value(comment))
                        .setAddress(value(address))
                        .setAssetScope(scopeValue());

        MainActivity activity = (MainActivity) requireActivity();
        if (useMapPin.isChecked()
                && activity.isSelectedLocationConfirmed()) {
            builder.setCoordinates(
                    activity.getSelectedLatitude(),
                    activity.getSelectedLongitude()
            );
        }
        TrashCanSubmissionDraft draft = builder.build();
        TrashCanSubmissionDraft.ValidationResult validation =
                draft.validate();
        if (validation != TrashCanSubmissionDraft.ValidationResult.VALID) {
            showValidationError(validation);
            return;
        }

        String submissionId = UUID.randomUUID().toString();
        try {
            JSONObject payload = draft.toJson(
                    submissionId,
                    BuildConfig.VERSION_NAME
            );
            TrashCanQueueStore.save(
                    requireContext(),
                    submissionId,
                    payload.toString()
            );
            TrashCanUploadScheduler.enqueue(requireContext(), submissionId);
            clearForm();
            Toast.makeText(
                    requireContext(),
                    publicComment
                            ? R.string.trash_can_public_queued
                            : R.string.trash_can_complaint_queued,
                    Toast.LENGTH_LONG
            ).show();
        } catch (JSONException | IOException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.trash_can_queue_error,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void showValidationError(
            TrashCanSubmissionDraft.ValidationResult validation
    ) {
        if (validation == TrashCanSubmissionDraft.ValidationResult.NO_CATEGORY
                || validation == TrashCanSubmissionDraft.ValidationResult
                .UNSUPPORTED_CATEGORY) {
            Toast.makeText(
                    requireContext(),
                    R.string.trash_can_category_error,
                    Toast.LENGTH_LONG
            ).show();
            categorySpinner.requestFocus();
            return;
        }
        if (validation == TrashCanSubmissionDraft.ValidationResult.NO_COMMENT
                || validation == TrashCanSubmissionDraft.ValidationResult
                .COMMENT_TOO_SHORT) {
            commentLayout.setError(getString(
                    R.string.trash_can_comment_error
            ));
            comment.requestFocus();
            return;
        }
        if (validation == TrashCanSubmissionDraft.ValidationResult.NO_ADDRESS) {
            addressLayout.setError(getString(R.string.trash_can_address_error));
            address.requestFocus();
            return;
        }
        Toast.makeText(
                requireContext(),
                R.string.trash_can_validation_error,
                Toast.LENGTH_LONG
        ).show();
    }

    private void clearForm() {
        comment.setText("");
        address.setText("");
        useMapPin.setChecked(false);
        categorySpinner.setSelection(0);
    }

    private boolean isPublicComment() {
        return modeGroup.getCheckedRadioButtonId()
                != R.id.trash_can_private_complaint;
    }

    private String categoryValue(boolean publicComment) {
        String[] values = publicComment
                ? PUBLIC_CATEGORY_VALUES
                : COMPLAINT_CATEGORY_VALUES;
        int position = categorySpinner.getSelectedItemPosition();
        return position >= 0 && position < values.length
                ? values[position]
                : "";
    }

    private String scopeValue() {
        if (isPublicComment()) {
            return TrashCanSubmissionDraft.SCOPE_PUBLIC;
        }
        int position = scopeSpinner.getSelectedItemPosition();
        return position >= 0 && position < SCOPE_VALUES.length
                ? SCOPE_VALUES[position]
                : TrashCanSubmissionDraft.SCOPE_PUBLIC;
    }

    private static String value(TextInputEditText field) {
        return field.getText() == null
                ? ""
                : field.getText().toString().trim();
    }
}
