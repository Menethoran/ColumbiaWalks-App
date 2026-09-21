package org.columbiawalks.app.ui;

import android.os.Bundle;
import android.util.Patterns;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.domain.FeedbackValidator;
import org.columbiawalks.app.submission.FeedbackQueueStore;
import org.columbiawalks.app.submission.FeedbackUploadScheduler;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.UUID;

public final class FeedbackFragment extends Fragment {
    private static final String[] CATEGORY_VALUES = {
            "",
            "app_feedback",
            "feature_request",
            "bug_report",
            "other"
    };

    private Spinner reasonSpinner;
    private TextInputLayout feedbackTextLayout;
    private TextInputEditText feedbackText;
    private RadioGroup contactGroup;
    private View contactFields;
    private TextInputEditText contactName;
    private TextInputEditText contactPhone;
    private TextInputEditText contactEmail;
    private TextInputEditText contactAddress;
    private TextInputEditText contactNotes;
    private CheckBox consentToContact;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_feedback, container, false);
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);
        reasonSpinner = view.findViewById(R.id.feedback_reason_spinner);
        feedbackTextLayout = view.findViewById(R.id.feedback_text_layout);
        feedbackText = view.findViewById(R.id.feedback_text);
        contactGroup = view.findViewById(R.id.feedback_contact_group);
        contactFields = view.findViewById(R.id.feedback_contact_fields);
        contactName = view.findViewById(R.id.feedback_name);
        contactPhone = view.findViewById(R.id.feedback_phone);
        contactEmail = view.findViewById(R.id.feedback_email);
        contactAddress = view.findViewById(R.id.feedback_address);
        contactNotes = view.findViewById(R.id.feedback_contact_notes);
        consentToContact = view.findViewById(R.id.feedback_consent);
        view.findViewById(R.id.feedback_back)
                .setOnClickListener(button ->
                        ((MainActivity) requireActivity())
                                .navigateToCommunity());

        ArrayAdapter<CharSequence> reasonAdapter =
                ArrayAdapter.createFromResource(
                        requireContext(),
                        R.array.feedback_reason_labels,
                        R.layout.spinner_item
                );
        reasonAdapter.setDropDownViewResource(
                R.layout.spinner_dropdown_item);
        reasonSpinner.setAdapter(reasonAdapter);

        reasonSpinner.setOnItemSelectedListener(
                new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(
                            AdapterView<?> parent,
                            View selectedView,
                            int position,
                            long id
                    ) {
                        boolean selected = position > 0;
                        feedbackTextLayout.setVisibility(
                                selected ? View.VISIBLE : View.GONE
                        );
                        feedbackTextLayout.setError(null);
                        if (!selected) {
                            feedbackText.setText("");
                        }
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> parent) {
                        feedbackTextLayout.setVisibility(View.GONE);
                    }
                }
        );
        contactGroup.setOnCheckedChangeListener(
                (group, checkedId) -> updateContactFields()
        );
        updateContactFields();
        view.findViewById(R.id.submit_feedback_button)
                .setOnClickListener(button -> submitFeedback());
    }

    private void submitFeedback() {
        String category = categoryValue();
        String text = textValue(feedbackText);
        FeedbackValidator.ValidationResult validation =
                FeedbackValidator.validate(category, text);
        if (validation == FeedbackValidator.ValidationResult.NO_CATEGORY
                || validation ==
                FeedbackValidator.ValidationResult.UNSUPPORTED_CATEGORY) {
            Toast.makeText(
                    requireContext(),
                    R.string.feedback_reason_error,
                    Toast.LENGTH_LONG
            ).show();
            reasonSpinner.requestFocus();
            return;
        }
        if (validation == FeedbackValidator.ValidationResult.NO_TEXT) {
            feedbackTextLayout.setError(
                    getString(R.string.feedback_text_error)
            );
            feedbackText.requestFocus();
            return;
        }
        feedbackTextLayout.setError(null);

        boolean contactOffered = contactInformationOffered();
        String email = contactOffered ? textValue(contactEmail) : "";
        if (!email.isEmpty()
                && !Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            contactEmail.setError("Enter a valid email address or leave it blank.");
            contactEmail.requestFocus();
            return;
        }
        contactEmail.setError(null);

        String feedbackId = UUID.randomUUID().toString();
        try {
            JSONObject payload = new JSONObject();
            payload.put("feedback_id", feedbackId);
            payload.put("feedback_category", category);
            payload.put("feedback_text", text);
            payload.put("app_version", "android-" + BuildConfig.VERSION_NAME);
            payload.put("submission_source", "android");
            payload.put("contact_information_offered", contactOffered);
            payload.put(
                    "contact_name",
                    contactOffered ? textValue(contactName) : ""
            );
            payload.put(
                    "contact_phone",
                    contactOffered ? textValue(contactPhone) : ""
            );
            payload.put("contact_email", email);
            payload.put(
                    "contact_street_address",
                    contactOffered ? textValue(contactAddress) : ""
            );
            payload.put(
                    "contact_notes",
                    contactOffered ? textValue(contactNotes) : ""
            );
            payload.put(
                    "consent_to_contact",
                    contactOffered && consentToContact.isChecked()
            );

            FeedbackQueueStore.save(
                    requireContext(),
                    feedbackId,
                    payload.toString()
            );
            FeedbackUploadScheduler.enqueue(requireContext(), feedbackId);
            clearForm();
            Toast.makeText(
                    requireContext(),
                    R.string.feedback_queued_confirmation,
                    Toast.LENGTH_LONG
            ).show();
        } catch (JSONException | IOException exception) {
            Toast.makeText(
                    requireContext(),
                    R.string.feedback_queue_error,
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private String categoryValue() {
        int position = reasonSpinner.getSelectedItemPosition();
        return position >= 0 && position < CATEGORY_VALUES.length
                ? CATEGORY_VALUES[position]
                : "";
    }

    private boolean contactInformationOffered() {
        return contactGroup.getCheckedRadioButtonId()
                == R.id.feedback_contact_yes;
    }

    private void updateContactFields() {
        boolean offered = contactInformationOffered();
        contactFields.setVisibility(offered ? View.VISIBLE : View.GONE);
        if (!offered) {
            clearContactFields();
        }
    }

    private void clearForm() {
        reasonSpinner.setSelection(0);
        feedbackText.setText("");
        contactGroup.check(R.id.feedback_contact_no);
        clearContactFields();
        updateContactFields();
    }

    private void clearContactFields() {
        contactName.setText("");
        contactPhone.setText("");
        contactEmail.setText("");
        contactAddress.setText("");
        contactNotes.setText("");
        consentToContact.setChecked(false);
    }

    private String textValue(TextInputEditText field) {
        return field.getText() == null
                ? ""
                : field.getText().toString().trim();
    }
}
