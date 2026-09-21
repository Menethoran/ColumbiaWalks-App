package org.columbiawalks.app.ui;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ListView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.work.WorkManager;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.columbiawalks.app.MainActivity;
import org.columbiawalks.app.R;
import org.columbiawalks.app.data.ReportDatabaseHelper;
import org.columbiawalks.app.data.SafetyReport;
import org.columbiawalks.app.submission.ReportUploadScheduler;

import java.io.File;
import java.util.List;

public class SavedReportsFragment extends Fragment {
    private ReportDatabaseHelper databaseHelper;
    private ReportAdapter adapter;
    private ListView reportsList;
    private View emptyState;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.fragment_saved_reports, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        databaseHelper = new ReportDatabaseHelper(requireContext());
        adapter = new ReportAdapter(requireContext());
        reportsList = view.findViewById(R.id.reports_list);
        emptyState = view.findViewById(R.id.empty_state);
        reportsList.setAdapter(adapter);
        reportsList.setOnItemClickListener((parent, item, position, id) ->
                showReport(adapter.getItem(position)));
        WorkManager.getInstance(requireContext())
                .getWorkInfosByTagLiveData(
                        ReportUploadScheduler.TAG_REPORT_UPLOAD)
                .observe(getViewLifecycleOwner(), workInfos -> loadReports());

        view.findViewById(R.id.new_report_button)
                .setOnClickListener(button ->
                        ((MainActivity) requireActivity()).navigateToMap());
        loadReports();
    }

    @Override
    public void onResume() {
        super.onResume();
        ReportUploadScheduler.enqueuePending(requireContext());
        loadReports();
    }

    private void loadReports() {
        if (databaseHelper == null || adapter == null) {
            return;
        }
        List<SafetyReport> reports = databaseHelper.getAllReports();
        adapter.replaceReports(reports);
        boolean hasReports = !reports.isEmpty();
        reportsList.setVisibility(hasReports ? View.VISIBLE : View.GONE);
        emptyState.setVisibility(hasReports ? View.GONE : View.VISIBLE);
    }

    private void showReport(SafetyReport report) {
        MaterialAlertDialogBuilder dialogBuilder =
                new MaterialAlertDialogBuilder(requireContext())
                .setTitle(R.string.details_dialog_title)
                .setMessage(reportDetailText(report))
                .setPositiveButton(R.string.share_report, (dialog, which) ->
                        shareReport(report))
                .setNegativeButton(R.string.delete_report, (dialog, which) ->
                        confirmDelete(report));
        if (report.isSubmitted()) {
            dialogBuilder.setNeutralButton(R.string.close, null);
        } else {
            dialogBuilder.setNeutralButton(
                    R.string.retry_submission,
                    (window, which) -> retrySubmission(report)
            );
        }
        dialogBuilder.show();
    }

    private String reportDetailText(SafetyReport report) {
        String text = report.toShareText();
        if (report.getLastSubmissionError() != null
                && !report.getLastSubmissionError().trim().isEmpty()) {
            text += "\n\n" + getString(
                    R.string.submission_error_format,
                    report.getLastSubmissionError()
            );
        }
        return text;
    }

    private void retrySubmission(SafetyReport report) {
        databaseHelper.markPending(report.getId());
        ReportUploadScheduler.enqueue(requireContext(), report.getId());
        Toast.makeText(
                requireContext(),
                R.string.submission_requeued,
                Toast.LENGTH_LONG
        ).show();
        loadReports();
    }

    private void shareReport(SafetyReport report) {
        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType(report.hasPhoto() ? "image/jpeg" : "text/plain");
        shareIntent.putExtra(
                Intent.EXTRA_SUBJECT,
                "ColumbiaWalks safety report"
        );
        shareIntent.putExtra(Intent.EXTRA_TEXT, report.toShareText());
        if (report.hasPhoto()) {
            File photo = new File(report.getPhotoPath());
            if (photo.isFile()) {
                Uri photoUri = FileProvider.getUriForFile(
                        requireContext(),
                        requireContext().getPackageName() + ".files",
                        photo
                );
                shareIntent.putExtra(Intent.EXTRA_STREAM, photoUri);
                shareIntent.setClipData(
                        ClipData.newUri(
                                requireContext().getContentResolver(),
                                getString(R.string.report_photo),
                                photoUri
                        )
                );
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        }
        startActivity(Intent.createChooser(
                shareIntent,
                getString(R.string.share_chooser)
        ));
    }

    private void confirmDelete(SafetyReport report) {
        new MaterialAlertDialogBuilder(requireContext())
                .setTitle(R.string.delete_title)
                .setMessage(R.string.delete_message)
                .setPositiveButton(R.string.delete_report, (dialog, which) -> {
                    ReportUploadScheduler.cancel(
                            requireContext(),
                            report.getId()
                    );
                    if (databaseHelper.deleteReport(report.getId())) {
                        Toast.makeText(
                                requireContext(),
                                R.string.report_deleted,
                                Toast.LENGTH_SHORT
                        ).show();
                        loadReports();
                    }
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    @Override
    public void onDestroy() {
        if (databaseHelper != null) {
            databaseHelper.close();
            databaseHelper = null;
        }
        super.onDestroy();
    }
}

