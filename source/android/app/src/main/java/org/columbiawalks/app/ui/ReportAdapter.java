package org.columbiawalks.app.ui;

import android.content.Context;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.columbiawalks.app.R;
import org.columbiawalks.app.data.SafetyReport;

import java.util.ArrayList;
import java.util.List;

public final class ReportAdapter extends BaseAdapter {
    private final LayoutInflater inflater;
    private final List<SafetyReport> reports = new ArrayList<>();

    public ReportAdapter(Context context) {
        inflater = LayoutInflater.from(context);
    }

    public void replaceReports(List<SafetyReport> updatedReports) {
        reports.clear();
        reports.addAll(updatedReports);
        notifyDataSetChanged();
    }

    @Override
    public int getCount() {
        return reports.size();
    }

    @Override
    public SafetyReport getItem(int position) {
        return reports.get(position);
    }

    @Override
    public long getItemId(int position) {
        return getItem(position).getId();
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        ViewHolder holder;
        if (convertView == null) {
            convertView = inflater.inflate(R.layout.item_report, parent, false);
            holder = new ViewHolder(convertView);
            convertView.setTag(holder);
        } else {
            holder = (ViewHolder) convertView.getTag();
        }

        SafetyReport report = getItem(position);
        holder.categories.setText(report.getCategoriesForDisplay());
        holder.severity.setText(shortSeverity(report.getSeverity()));
        holder.observed.setText(report.getObservedAt());
        holder.location.setText(report.getCoordinateText());
        holder.submission.setText(report.getSubmissionStatusForDisplay());
        if (report.isOfficialEmailAuthorizedForTestDestination()) {
            holder.officialEmail.setText(
                    report.getOfficialEmailResultForDisplay()
            );
            holder.officialEmail.setTextColor(ContextCompat.getColor(
                    parent.getContext(),
                    SafetyReport.OFFICIAL_EMAIL_DESTINATION_OFFICIAL.equals(
                            report.getOfficialEmailDestinationMode())
                            ? R.color.cw_error
                            : R.color.cw_green
            ));
            holder.officialEmail.setVisibility(View.VISIBLE);
        } else {
            holder.officialEmail.setVisibility(View.GONE);
        }
        holder.details.setText(report.getDetails().trim().isEmpty()
                ? parent.getContext().getString(R.string.no_details)
                : report.getDetails());
        if (report.hasPhoto()) {
            holder.photo.setImageURI(Uri.fromFile(
                    new java.io.File(report.getPhotoPath())
            ));
            holder.photo.setVisibility(View.VISIBLE);
        } else {
            holder.photo.setImageDrawable(null);
            holder.photo.setVisibility(View.GONE);
        }
        return convertView;
    }

    private String shortSeverity(String severity) {
        int separator = severity.indexOf('—');
        return separator > 0 ? severity.substring(0, separator).trim() : severity;
    }

    private static final class ViewHolder {
        private final TextView categories;
        private final TextView severity;
        private final TextView observed;
        private final TextView location;
        private final TextView submission;
        private final TextView officialEmail;
        private final TextView details;
        private final ImageView photo;

        private ViewHolder(View view) {
            categories = view.findViewById(R.id.item_categories);
            severity = view.findViewById(R.id.item_severity);
            observed = view.findViewById(R.id.item_observed);
            location = view.findViewById(R.id.item_location);
            submission = view.findViewById(R.id.item_submission);
            officialEmail = view.findViewById(R.id.item_official_email);
            details = view.findViewById(R.id.item_details);
            photo = view.findViewById(R.id.item_photo);
        }
    }
}
