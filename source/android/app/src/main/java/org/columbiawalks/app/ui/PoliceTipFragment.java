package org.columbiawalks.app.ui;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputEditText;
import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.domain.AnonymousTip;
import org.columbiawalks.app.submission.AnonymousTipSubmissionModel;
import org.json.JSONObject;
import java.util.LinkedHashMap;
import java.util.Map;

/** Internal test intake only: this screen has no external police handoff. */
public final class PoliceTipFragment extends Fragment {
    public static final String REPORT_HANDOFF_REQUEST = "police_tip_report_handoff";
    private final Map<String, TextInputEditText> fields = new LinkedHashMap<>();
    private CheckBox inactive;
    private CheckBox testOnly;
    private AnonymousTipSubmissionModel model;
    private TextView preview;
    private TextView status;
    private View prepare;
    private TextView submit;
    private View newTest;
    private String prepared;
    static Bundle newReportHandoff(
            String subject,
            String observedTime,
            String location,
            String licensePlate,
            String plateState,
            String vehicleDescription,
            String observation,
            String evidenceNotes
    ) {
        Bundle handoff = new Bundle();
        handoff.putBoolean("source_was_cw", true);
        handoff.putString("subject", subject);
        handoff.putString("observed_time", observedTime);
        handoff.putString("location", location);
        handoff.putString("license_plate", licensePlate);
        handoff.putString("plate_state", plateState);
        handoff.putString("vehicle_description", vehicleDescription);
        handoff.putString("observation", observation);
        handoff.putString("evidence_notes", evidenceNotes);
        return handoff;
    }

    public static Bundle newStandaloneRequest() {
        Bundle request = new Bundle();
        request.putBoolean("source_was_cw", false);
        return request;
    }


    @Nullable @Override public View onCreateView(@NonNull LayoutInflater inflater,
            @Nullable ViewGroup container, @Nullable Bundle state) {
        return inflater.inflate(R.layout.fragment_police_tip, container, false);
    }
    @Override public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
        model = new ViewModelProvider(this).get(AnonymousTipSubmissionModel.class);
        int[] ids = {R.id.tip_subject, R.id.tip_observed_time, R.id.tip_location, R.id.tip_direction,
                R.id.tip_license_plate, R.id.tip_plate_state, R.id.tip_vehicle_description,
                R.id.tip_observation, R.id.tip_evidence_notes};
        for (int i = 0; i < ids.length; i++) fields.put(AnonymousTip.KEYS[i], view.findViewById(ids[i]));
        inactive = view.findViewById(R.id.tip_inactive);
        testOnly = view.findViewById(R.id.tip_test_only);
        preview = view.findViewById(R.id.tip_preview);
        status = view.findViewById(R.id.tip_status);
        prepare = view.findViewById(R.id.tip_prepare);
        submit = view.findViewById(R.id.tip_submit);
        newTest = view.findViewById(R.id.tip_new);
        view.findViewById(R.id.police_tip_back).setOnClickListener(v -> ((MainActivity) requireActivity()).navigateToCommunity());
        TextWatcher watcher = new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            public void onTextChanged(CharSequence s, int start, int before, int count) { }
            public void afterTextChanged(Editable s) { invalidatePreview(); }
        };
        for (TextInputEditText field : fields.values()) field.addTextChangedListener(watcher);
        inactive.setOnCheckedChangeListener((button, checked) -> invalidatePreview());
        testOnly.setOnCheckedChangeListener((button, checked) -> invalidatePreview());
        prepare.setOnClickListener(v -> prepare());
        submit.setOnClickListener(v -> {
            String payload = model.pending != null ? model.pending : prepared;
            if (payload != null) model.submit(payload);
        });
        newTest.setOnClickListener(v -> new MaterialAlertDialogBuilder(requireContext())
                .setTitle(R.string.tip_new_title).setMessage(R.string.tip_new_notice)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.tip_new_action, (dialog, which) -> {
                    model.discard();
                    prepared = null;
                    for (TextInputEditText field : fields.values()) field.setText("");
                    inactive.setChecked(false); testOnly.setChecked(false); update();
                }).show());
        model.busy.observe(getViewLifecycleOwner(), ignored -> update());
        model.message.observe(getViewLifecycleOwner(), message -> { status.setText(message); update(); });
        getParentFragmentManager().setFragmentResultListener(REPORT_HANDOFF_REQUEST, getViewLifecycleOwner(),
                (key, handoff) -> {
                    if (model.pending != null || model.completed) return;
                    for (Map.Entry<String, TextInputEditText> entry : fields.entrySet()) {
                        entry.getValue().setText(handoff.getString(entry.getKey(), ""));
                    }
                    // A source report's real-world confirmations never carry over to a test.
                    inactive.setChecked(false); testOnly.setChecked(false);
                });
        update();
    }
    private void invalidatePreview() { prepared = null; update(); }
    private void prepare() {
        Map<String, String> raw = new LinkedHashMap<>();
        for (Map.Entry<String, TextInputEditText> field : fields.entrySet()) {
            raw.put(field.getKey(), String.valueOf(field.getValue().getText()));
        }
        String error = AnonymousTip.validationError(raw, inactive.isChecked(), testOnly.isChecked());
        if (error != null) { status.setText(error); return; }
        try {
            prepared = AnonymousTip.payload(raw, BuildConfig.VERSION_NAME).toString();
            status.setText(R.string.tip_preview_notice);
        } catch (Exception errorValue) { status.setText(R.string.tip_invalid); }
        update();
    }
    private void update() {
        if (preview == null || model == null) return;
        boolean busy = Boolean.TRUE.equals(model.busy.getValue());
        boolean locked = busy || model.pending != null || model.completed;
        for (TextInputEditText field : fields.values()) field.setEnabled(!locked);
        inactive.setEnabled(!locked); testOnly.setEnabled(!locked); prepare.setEnabled(!locked);
        String payload = model.pending != null ? model.pending : prepared;
        preview.setVisibility(payload == null ? View.GONE : View.VISIBLE);
        if (payload != null) {
            try { preview.setText(AnonymousTip.preview(new JSONObject(payload))); }
            catch (Exception error) { preview.setText(R.string.tip_invalid); }
        }
        submit.setVisibility(payload == null || model.completed ? View.GONE : View.VISIBLE);
        submit.setEnabled(!busy);
        submit.setText(model.pending != null ? R.string.tip_retry_action : R.string.tip_submit_action);
        newTest.setVisibility(model.pending != null || model.completed ? View.VISIBLE : View.GONE);
        newTest.setEnabled(!busy);
    }
}
