import SwiftUI

struct TrashCanView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var trashCanService: TrashCanService

    @State private var kind: TrashCanSubmissionKind = .publicComment
    @State private var categoryKey: String?
    @State private var comment = ""
    @State private var address = ""
    @State private var assetScope: TrashCanAssetScope = .publicProperty
    @State private var includeCurrentReportPin = false
    @State private var errorMessage: String?
    @State private var confirmation: String?

    var body: some View {
        Form {
            Section {
                AppHeader(
                    "Trash Cans",
                    subtitle: "Public-can comments and a separate private complaint intake"
                )
            }

            Section("Submission type") {
                Picker("Submission type", selection: $kind) {
                    ForEach(TrashCanSubmissionKind.allCases) { value in
                        Text(value.label).tag(value)
                    }
                }
                .pickerStyle(.segmented)

                if kind == .publicComment {
                    Label {
                        Text("Public comments are submitted for moderation and may be published. Publication is not guaranteed. Do not include private personal information.")
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "globe.americas.fill")
                    }
                    .font(.footnote)
                    .foregroundStyle(Color.cwBlueDark)
                } else {
                    Label {
                        Text("Complaints remain private in ColumbiaWalks and are not automatically forwarded to Columbia Borough, Public Works, a trash hauler, or emergency services.")
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "lock.fill")
                    }
                    .font(.footnote)
                    .foregroundStyle(Color.cwWarning)
                }
            }

            Section(kind == .publicComment ? "Public can comment" : "Can complaint") {
                Picker("Category", selection: $categoryKey) {
                    Text("Select a category…").tag(String?.none)
                    ForEach(kind.categoryOptions) { option in
                        Text(option.label).tag(Optional(option.id))
                    }
                }

                TextField(
                    kind == .publicComment
                        ? "Comment about this public trash can"
                        : "Describe the trash-can complaint",
                    text: $comment,
                    axis: .vertical
                )
                .lineLimit(4...10)
                Text("3–2,000 characters")
                    .font(.caption)
                    .foregroundStyle(Color.cwTextSecondary)

                TextField(
                    "Address, intersection, or clear location (required)",
                    text: $address,
                    axis: .vertical
                )
                .lineLimit(2...5)
            }

            Section("Trash-can property scope") {
                if kind == .publicComment {
                    LabeledContent("Scope", value: TrashCanAssetScope.publicProperty.label)
                    Text("A public comment is always recorded as concerning a can on public property.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                } else {
                    Picker("Scope", selection: $assetScope) {
                        ForEach(TrashCanAssetScope.allCases) { scope in
                            Text(scope.label).tag(scope)
                        }
                    }
                    Text("Choose Unknown if you are unsure whether the can is on public or private property.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }
            }

            Section("Optional confirmed report pin") {
                Toggle(
                    "Include the current confirmed report pin",
                    isOn: $includeCurrentReportPin
                )
                .disabled(!appState.locationConfirmed)

                if appState.locationConfirmed {
                    let coordinate = appState.reportCoordinate
                    LabeledContent(
                        "Current pin",
                        value: String(
                            format: "%.5f, %.5f",
                            coordinate.latitude,
                            coordinate.longitude
                        )
                    )
                    if let intersection = appState.nearestIntersection?.label {
                        LabeledContent("Nearest intersection", value: intersection)
                    }
                    Text("The pin is optional. The written address or location above is still required.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                } else {
                    Text("No confirmed report pin is currently available. You can still submit using the required written location.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }
            }

            Section {
                Text("Photo and video upload is not available for trash-can submissions in this client version.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.cwError)
                }
            }
            if let confirmation {
                Section {
                    Label(confirmation, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Color.cwGreen)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Section {
                Button {
                    submit()
                } label: {
                    Label(
                        kind == .publicComment ? "Submit Public Comment" : "Submit Private Complaint",
                        systemImage: "paperplane.fill"
                    )
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .columbiaWalksScrollSurface()
        .navigationTitle("Trash Cans")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: kind) { _, newKind in
            categoryKey = nil
            errorMessage = nil
            confirmation = nil
            if newKind == .publicComment {
                assetScope = .publicProperty
            }
        }
        .onChange(of: appState.locationConfirmed) { _, confirmed in
            if !confirmed {
                includeCurrentReportPin = false
            }
        }
    }

    private func submit() {
        errorMessage = nil
        confirmation = nil

        let coordinate = includeCurrentReportPin && appState.locationConfirmed
            ? appState.reportCoordinate
            : nil
        let effectiveScope: TrashCanAssetScope = kind == .publicComment
            ? .publicProperty
            : assetScope

        if let validationError = TrashCanValidator.validate(
            kind: kind,
            categoryKey: categoryKey,
            comment: comment,
            address: address,
            assetScope: effectiveScope,
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude
        ) {
            errorMessage = validationError
            return
        }
        guard let categoryKey else { return }

        let submission = TrashCanSubmission(
            id: UUID(),
            kind: kind,
            categories: [categoryKey],
            comment: comment.trimmingCharacters(in: .whitespacesAndNewlines),
            address: address.trimmingCharacters(in: .whitespacesAndNewlines),
            latitude: coordinate?.latitude,
            longitude: coordinate?.longitude,
            assetScope: effectiveScope,
            appVersion: "ios-\(APIClient.version)",
            submissionSource: "ios"
        )

        do {
            try trashCanService.enqueue(submission)
            confirmation = kind == .publicComment
                ? "Comment saved and queued for moderation. Public publication is not guaranteed."
                : "Complaint saved privately in ColumbiaWalks and queued. It was not automatically forwarded to the Borough."
            resetForm()
        } catch {
            errorMessage = "The submission could not be saved locally. Please try again."
        }
    }

    private func resetForm() {
        categoryKey = nil
        comment = ""
        address = ""
        if kind == .publicComment {
            assetScope = .publicProperty
        }
        includeCurrentReportPin = false
    }
}
