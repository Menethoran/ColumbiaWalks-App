import SwiftUI
import UIKit

struct SavedReportsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var reports: ReportStore

    var body: some View {
        NavigationStack {
            Group {
                if reports.reports.isEmpty {
                    ContentUnavailableView {
                        Label("No saved reports yet", systemImage: "tray")
                    } description: {
                        Text("Choose a location on the map and complete a safety report.")
                    } actions: {
                        Button("New report") { appState.selectedTab = .report }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List(reports.reports) { report in
                        NavigationLink {
                            ReportDetailView(reportID: report.id)
                        } label: {
                            ReportRow(report: report)
                        }
                    }
                    .columbiaWalksScrollSurface()
                    .refreshable { await reports.submitPending() }
                }
            }
            .navigationTitle("Saved reports")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { appState.selectedTab = .report } label: {
                        Label("New report", systemImage: "plus")
                    }
                }
            }
        }
    }
}

private struct ReportRow: View {
    let report: SafetyReport

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline) {
                Text(report.categorySummary)
                    .font(.headline)
                    .lineLimit(2)
                Spacer()
                StatusBadge(status: report.submissionStatus)
            }
            Text(report.observedAt.formatted(date: .abbreviated, time: .shortened))
                .font(.subheadline)
                .foregroundStyle(Color.cwTextSecondary)
            HStack {
                Label(report.severity.rawValue.capitalized, systemImage: "exclamationmark.triangle")
                if report.coordinate != nil {
                    Label("Pinned", systemImage: "mappin")
                }
                if report.photoFilename != nil {
                    Label("Photo", systemImage: "photo")
                }
                if report.officialEmailAuthorized == true ||
                    report.officialEmailServerState != nil {
                    Label("Field-test email", systemImage: "envelope.fill")
                }
            }
            .font(.caption)
            .foregroundStyle(Color.cwTextSecondary)
            if let emailState = report.officialEmailServerState {
                Label(emailState.shortLabel, systemImage: "envelope.badge")
                    .font(.caption)
                    .foregroundStyle(Color.cwTextSecondary)
            }
        }
        .padding(.vertical, 5)
    }
}

private struct StatusBadge: View {
    let status: SubmissionStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.bold())
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .foregroundStyle(foreground)
            .background(background, in: Capsule())
    }

    private var foreground: Color {
        switch status {
        case .submitted: .cwGreen
        case .failed: .cwError
        case .submitting, .pending: .cwBlue
        case .local: .cwTextSecondary
        }
    }

    private var background: Color { foreground.opacity(0.12) }
}

private struct ReportDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var reports: ReportStore
    let reportID: UUID
    @State private var confirmDelete = false

    var body: some View {
        Group {
            if let report = reports.reports.first(where: { $0.id == reportID }) {
                List {
                    Section("Report") {
                        LabeledContent("Issue", value: report.categorySummary)
                        LabeledContent("Urgency", value: report.severity.label)
                        LabeledContent("Observed", value: report.observedAt.formatted(date: .abbreviated, time: .shortened))
                        LabeledContent("Path", value: report.submissionMode.label)
                        LabeledContent("Checklist answers", value: String(report.checklistResponses.count))
                        if let kind = report.rapidReportKind {
                            LabeledContent("Repeat hierarchy", value: kind.label)
                            if let sequence = report.continuousSequence {
                                LabeledContent("Session report", value: "#\(sequence)")
                            }
                        }
                        if let lipHeight = report.sidewalkLipHeight {
                            LabeledContent("Sidewalk lip", value: lipHeight.label)
                        }
                        if let vehicleIssue = report.vehicleIssueType {
                            LabeledContent("Vehicle issue", value: vehicleIssue.label)
                        }
                        if !report.quickReportTypes.isEmpty {
                            LabeledContent(
                                "Quick type",
                                value: report.quickReportTypes.map(\.label).joined(separator: ", ")
                            )
                        }
                    }

                    Section("Submission") {
                        LabeledContent("Status") { StatusBadge(status: report.submissionStatus) }
                        if let error = report.lastSubmissionError {
                            Text(error).foregroundStyle(Color.cwError)
                        }
                        if report.submissionStatus == .failed || report.submissionStatus == .pending {
                            Button("Retry submission") { reports.retry(report) }
                        }
                    }

                    if report.officialEmailAuthorized == true ||
                        report.officialEmailServerState != nil {
                        Section("3.16.1 field-test email") {
                            if report.hasAuthorizedOfficialEmail {
                                Label("Authorized only for test-mailbox processing after upload", systemImage: "envelope.fill")
                                    .foregroundStyle(Color.cwText)
                            } else if report.officialEmailServerState == nil {
                                Label("No valid 3.16.1 test-mailbox authorization", systemImage: "envelope.badge.shield.half.filled")
                                    .foregroundStyle(Color.cwWarning)
                            }
                            Text("Version 3.16.1 sends these authorized messages only to a ColumbiaWalks-controlled test mailbox with [TEST] in the subject—not to Police, the Mayor, or Codes.")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Color.cwText)
                            if let emailState = report.officialEmailServerState {
                                Text(emailState.acceptanceSummary)
                                    .font(.callout.weight(.semibold))
                                    .foregroundStyle(Color.cwText)
                                LabeledContent(
                                    "Server destination mode",
                                    value: emailState.destinationModeLabel
                                )
                                Text("This is the server's response when it accepted the report, not a live delivery receipt.")
                                    .font(.footnote)
                                    .foregroundStyle(Color.cwTextSecondary)
                                ForEach(
                                    Array(emailState.deliveries.enumerated()),
                                    id: \.offset
                                ) { _, delivery in
                                    LabeledContent(
                                        delivery.destinationLabel,
                                        value: delivery.statusLabel
                                    )
                                }
                            } else {
                                Text(report.hasAuthorizedOfficialEmail
                                     ? "The report is saved locally and authorizes the ColumbiaWalks server to attempt only a [TEST]-subject message to its controlled test mailbox after successful upload, subject to the 5 km service-area and delivery safeguards. No message is authorized for Police, the Mayor, or Codes, and delivery is not confirmed."
                                     : "This locally saved or legacy report does not contain the complete 3.16.1 test-destination consent pin. It does not authorize a field-test or official-recipient email.")
                                    .font(.footnote)
                                    .foregroundStyle(Color.cwTextSecondary)
                            }
                            Text("This app does not send from your personal email account.")
                                .font(.footnote)
                                .foregroundStyle(Color.cwTextSecondary)
                            if report.officialEmailDestinations.contains(.policeChiefAndMayor) {
                                let plate = report.vehicleDetails.licensePlate.trimmingCharacters(in: .whitespacesAndNewlines)
                                let state = report.vehicleDetails.plateState.trimmingCharacters(in: .whitespacesAndNewlines)
                                LabeledContent(
                                    "Plate for crosswalk test email",
                                    value: plate.isEmpty ? "Not entered" : "\(plate)\(state.isEmpty ? "" : " (\(state))")"
                                )
                            }
                        }
                    }

                    if let coordinate = report.coordinate {
                        Section("Location") {
                            Text(String(format: "%.6f, %.6f", coordinate.latitude, coordinate.longitude))
                                .monospacedDigit()
                            if let intersection = report.nearestIntersection {
                                LabeledContent("Closest intersection", value: intersection.label)
                            }
                            LabeledContent(
                                "Location source",
                                value: (report.locationSource ?? .legacy).label
                            )
                            if let photoLatitude = report.photoLatitude,
                               let photoLongitude = report.photoLongitude {
                                LabeledContent("Original picture GPS") {
                                    Text(String(
                                        format: "%.6f, %.6f",
                                        photoLatitude,
                                        photoLongitude
                                    ))
                                    .monospacedDigit()
                                }
                            }
                            if report.locationOverridden == true {
                                Label("The automatic location was overridden.", systemImage: "arrow.triangle.2.circlepath")
                                    .foregroundStyle(Color.cwWarning)
                            }
                            Link("Open in OpenStreetMap", destination: URL(string: String(
                                format: "https://www.openstreetmap.org/?mlat=%.6f&mlon=%.6f#map=18/%.6f/%.6f",
                                coordinate.latitude, coordinate.longitude,
                                coordinate.latitude, coordinate.longitude
                            ))!)
                        }
                    }

                    if !report.details.isEmpty {
                        Section("Additional information") { Text(report.details) }
                    }

                    if let filename = report.photoFilename,
                       let image = UIImage(contentsOfFile: PhotoStore.url(for: filename).path) {
                        Section("Photo") {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFit()
                        }
                    }

                    Section {
                        ShareLink(item: report.shareText) {
                            Label("Share report", systemImage: "square.and.arrow.up")
                        }
                        Button("Delete local copy", role: .destructive) { confirmDelete = true }
                    }
                }
                .columbiaWalksScrollSurface()
                .navigationTitle("Report details")
                .alert("Delete this report?", isPresented: $confirmDelete) {
                    Button("Delete", role: .destructive) {
                        reports.delete(report)
                        dismiss()
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("This removes the local copy. It cannot remove a report already received by the server.")
                }
            } else {
                ContentUnavailableView("Report unavailable", systemImage: "exclamationmark.triangle")
            }
        }
    }

}
