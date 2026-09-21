import PhotosUI
import SwiftUI
import UIKit

struct RepeatReportView: View {
    @EnvironmentObject private var reports: ReportStore
    @EnvironmentObject private var location: LocationService

    @State private var kind: RapidReportKind = .sidewalk
    @State private var sidewalkIssueType: SidewalkIssueType?
    @State private var sidewalkLipHeight: SidewalkLipHeight?
    @State private var vehicleIssueType: VehicleIssueType?
    @State private var vehicleDetails = VehicleDetails()
    @State private var comments = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var locationDraft = ReportLocationDraft()
    @State private var sessionID = UUID()
    @State private var sequence = 1
    @State private var errorMessage: String?
    @State private var savedMessage: String?
    @State private var lastSavedReportID: UUID?
    @State private var requestedInitialLocation = false
    @State private var showTestEmailDetails = false
    @State private var testEmailOptIn = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    AppHeader(
                        "Repeat reporting",
                        subtitle: "Photograph, report, and keep walking with the same issue hierarchy ready."
                    )
                    EmergencyNotice()
                }

                Section("Issue hierarchy") {
                    Picker("Issue type", selection: $kind) {
                        ForEach(RapidReportKind.allCases) { value in
                            Text(value.label).tag(value)
                        }
                    }

                    if kind == .sidewalk {
                        Picker("Sidewalk issue (optional)", selection: $sidewalkIssueType) {
                            Text("Not selected").tag(SidewalkIssueType?.none)
                            ForEach(SidewalkIssueType.allCases) { value in
                                Text(value.label).tag(Optional(value))
                            }
                        }
                        Picker("Sidewalk lip height (optional)", selection: $sidewalkLipHeight) {
                            Text("Not selected").tag(SidewalkLipHeight?.none)
                            ForEach(SidewalkLipHeight.allCases) { value in
                                Text(value.label).tag(Optional(value))
                            }
                        }
                    }

                    if kind == .vehicle {
                        Picker("Vehicle issue (optional)", selection: $vehicleIssueType) {
                            Text("Not selected").tag(VehicleIssueType?.none)
                            ForEach(VehicleIssueType.allCases) { value in
                                Text(value.label).tag(Optional(value))
                            }
                        }
                        TextField("License plate (optional)", text: $vehicleDetails.licensePlate)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        TextField("Plate state or jurisdiction (optional)", text: $vehicleDetails.plateState)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }

                    Text("The sidewalk subtype, lip height, vehicle behavior, license plate, and plate state are optional. A picture and confirmed location are required for a repeat report.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }

                if !officialEmailDestinations.isEmpty {
                    OfficialEmailDisclosure(
                        destinations: officialEmailDestinations,
                        isOptedIn: $testEmailOptIn,
                        isExpanded: $showTestEmailDetails,
                        requirementsMet: testEmailRequirementsMet
                    )
                }

                ReportPhotoSection(
                    title: "Picture",
                    guidance: "Take a picture or choose one from the library. GPS embedded in the picture is used first and retained as provenance; the stored JPEG has that metadata removed.",
                    photoItem: $photoItem,
                    photoData: $photoData,
                    locationDraft: $locationDraft
                )

                LocationDraftSection(locationDraft: $locationDraft)

                Section("Comments (optional)") {
                    Text("Add only useful details the picture does not show.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                    TextField(
                        "Optional comments",
                        text: $comments,
                        axis: .vertical
                    )
                    .lineLimit(3...7)
                    Text("\(comments.count)/1,500")
                        .font(.caption)
                        .foregroundStyle(comments.count > 1_500 ? Color.cwError : Color.cwTextSecondary)
                }

                if let savedMessage {
                    Section {
                        Label(savedMessage, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Color.cwGreen)
                    }
                }

                if let emailState = latestOfficialEmailServerState {
                    Section("Server response") {
                        Text(emailState.acceptanceSummary)
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(Color.cwText)
                        Text("This is the response when the server accepted the report, not a live delivery receipt.")
                            .font(.footnote)
                            .foregroundStyle(Color.cwTextSecondary)
                    }
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.cwError)
                    }
                }

                Section {
                    Button(action: saveAndPrepareNext) {
                        Label(submitButtonLabel, systemImage: "repeat.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                } footer: {
                    Text("Session \(sessionID.uuidString.lowercased()) · next report #\(sequence). Each report is saved on this iPhone before upload is attempted.")
                }
            }
            .columbiaWalksScrollSurface()
            .navigationTitle("Repeat")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: kind) { _, newKind in
                if newKind != .sidewalk {
                    sidewalkIssueType = nil
                    sidewalkLipHeight = nil
                }
                if newKind != .vehicle {
                    vehicleIssueType = nil
                    vehicleDetails = VehicleDetails()
                }
                errorMessage = nil
                savedMessage = nil
                lastSavedReportID = nil
                testEmailOptIn = false
                showTestEmailDetails = false
            }
            .onChange(of: locationDraft) { _, _ in
                if testEmailOptIn && !testEmailRequirementsMet {
                    testEmailOptIn = false
                }
            }
            .task {
                guard !requestedInitialLocation else { return }
                requestedInitialLocation = true
                requestDeviceLocation()
            }
        }
    }

    private var rapidQuickTypes: [QuickReportType] {
        kind == .sidewalk && sidewalkIssueType == .missingSidewalk
            ? [.missingSidewalk]
            : []
    }

    private var officialEmailDestinations: [OfficialEmailDestination] {
        OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: rapidQuickTypes,
            rapidReportKind: kind,
            vehicleIssueType: vehicleIssueType
        )
    }

    private var submitButtonLabel: String {
        "Save report & prepare next"
    }

    private var testEmailRequirementsMet: Bool {
        guard photoData != nil, let coordinate = locationDraft.coordinate else { return false }
        return OfficialEmailPolicy.isWithinServiceArea(coordinate)
    }

    private var latestOfficialEmailServerState: OfficialEmailServerState? {
        guard let lastSavedReportID else { return nil }
        return reports.reports.first(where: { $0.id == lastSavedReportID })?
            .officialEmailServerState
    }

    private func saveAndPrepareNext() {
        errorMessage = nil
        savedMessage = nil
        lastSavedReportID = nil
        if let validationError = RapidReportValidator.validate(
            hasPhoto: photoData != nil,
            location: locationDraft,
            comments: comments
        ) {
            errorMessage = validationError
            return
        }
        guard let photoData, let coordinate = locationDraft.coordinate else {
            errorMessage = "The picture or report location is no longer available."
            return
        }
        if kind == .vehicle, let validationError = vehicleDetails.validationError {
            errorMessage = validationError
            return
        }

        let officialEmailAuthorized = testEmailOptIn && testEmailRequirementsMet
        let quickTypes = rapidQuickTypes

        let reportID = UUID()
        let photoFilename: String
        do {
            photoFilename = try PhotoStore.saveNormalized(photoData, reportID: reportID)
        } catch {
            errorMessage = error.localizedDescription
            return
        }

        let report = SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(),
            observedAt: Date(),
            categories: [kind.category],
            severity: .medium,
            policeResponse: .notInvolved,
            details: comments.trimmingCharacters(in: .whitespacesAndNewlines),
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: kind == .vehicle,
            vehicleDetails: kind == .vehicle ? vehicleDetails : VehicleDetails(),
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .quick,
            quickReportTypes: quickTypes,
            nearestIntersection: nil,
            rapidReportKind: kind,
            sidewalkLipHeight: kind == .sidewalk ? sidewalkLipHeight : nil,
            vehicleIssueType: kind == .vehicle ? vehicleIssueType : nil,
            continuousSessionID: sessionID,
            continuousSequence: sequence,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            locationSource: locationDraft.source,
            photoLatitude: locationDraft.photoLatitude,
            photoLongitude: locationDraft.photoLongitude,
            locationOverridden: locationDraft.locationOverridden,
            photoFilename: photoFilename,
            officialEmailAuthorized: officialEmailAuthorized,
            officialEmailDestinationAuthorized: !officialEmailAuthorized
                ? nil
                : "test",
            submissionStatus: .pending,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )

        do {
            try reports.add(report)
        } catch {
            try? FileManager.default.removeItem(at: PhotoStore.url(for: photoFilename))
            errorMessage = "The report could not be saved securely on this iPhone. Your form is still here; try again."
            return
        }

        let savedSequence = sequence
        lastSavedReportID = reportID
        sequence += 1
        sidewalkLipHeight = nil
        vehicleDetails = VehicleDetails()
        comments = ""
        photoItem = nil
        self.photoData = nil
        locationDraft.reset()
        testEmailOptIn = false
        showTestEmailDetails = false
        savedMessage = !officialEmailAuthorized
            ? "Report #\(savedSequence) saved. Ready for the next \(kind.label.lowercased())."
            : "Report #\(savedSequence) saved with your optional [TEST]-email authorization to the ColumbiaWalks-controlled test mailbox after successful upload—not Police, the Mayor, or Codes. Delivery is not confirmed. Ready for the next \(kind.label.lowercased())."
        requestDeviceLocation()
    }

    private func requestDeviceLocation() {
        location.requestLocation { coordinate in
            locationDraft.useDeviceFallback(coordinate)
        }
    }
}

struct PageOfShameView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var reports: ReportStore
    @EnvironmentObject private var location: LocationService

    @State private var description = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var locationDraft = ReportLocationDraft()
    @State private var errorMessage: String?
    @State private var requestedInitialLocation = false

    var body: some View {
        Form {
            Section {
                AppHeader(
                    "Page of Shame",
                    subtitle: "Photo-first documentation with location review and administrator approval."
                )
            }

            Section {
                Text("Submitting sends this picture, its confirmed location, and any description to ColumbiaWalks for administrator review. It is not public unless an administrator approves it. Avoid faces, children, private-property details, or other sensitive information.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            ReportPhotoSection(
                title: "Picture (required)",
                guidance: "Take a new picture or select one from the photo library. Both choices can be cancelled without leaving or restarting ColumbiaWalks.",
                photoItem: $photoItem,
                photoData: $photoData,
                locationDraft: $locationDraft
            )

            LocationDraftSection(locationDraft: $locationDraft)

            Section("Description (optional)") {
                Text("Add only useful details the picture does not show.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                TextField("Optional description", text: $description, axis: .vertical)
                    .lineLimit(3...7)
                Text("\(description.count)/1,500")
                    .font(.caption)
                    .foregroundStyle(description.count > 1_500 ? Color.cwError : Color.cwTextSecondary)
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.cwError)
                }
            }

            Section {
                Button(action: submit) {
                    Label("Submit for administrator review", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
        }
        .columbiaWalksScrollSurface()
        .navigationTitle("Page of Shame")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard !requestedInitialLocation else { return }
            requestedInitialLocation = true
            requestDeviceLocation()
        }
    }

    private func submit() {
        errorMessage = nil
        if let validationError = RapidReportValidator.validate(
            hasPhoto: photoData != nil,
            location: locationDraft,
            comments: description
        ) {
            errorMessage = validationError
            return
        }
        guard let photoData, let coordinate = locationDraft.coordinate else {
            errorMessage = "The picture or report location is no longer available."
            return
        }

        let reportID = UUID()
        let photoFilename: String
        do {
            photoFilename = try PhotoStore.saveNormalized(photoData, reportID: reportID)
        } catch {
            errorMessage = error.localizedDescription
            return
        }

        let report = SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(),
            observedAt: Date(),
            categories: [],
            severity: .medium,
            policeResponse: .notInvolved,
            details: description.trimmingCharacters(in: .whitespacesAndNewlines),
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: false,
            vehicleDetails: VehicleDetails(),
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .pos,
            quickReportTypes: [],
            nearestIntersection: nil,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            locationSource: locationDraft.source,
            photoLatitude: locationDraft.photoLatitude,
            photoLongitude: locationDraft.photoLongitude,
            locationOverridden: locationDraft.locationOverridden,
            photoFilename: photoFilename,
            submissionStatus: .pending,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )

        do {
            try reports.add(report)
        } catch {
            try? FileManager.default.removeItem(at: PhotoStore.url(for: photoFilename))
            errorMessage = "The picture could not be saved securely on this iPhone. Try again."
            return
        }
        resetForm()
        dismiss()
        appState.selectedTab = .saved
    }

    private func requestDeviceLocation() {
        location.requestLocation { coordinate in
            locationDraft.useDeviceFallback(coordinate)
        }
    }

    private func resetForm() {
        description = ""
        photoItem = nil
        photoData = nil
        locationDraft.reset()
        errorMessage = nil
        requestedInitialLocation = false
    }
}

private struct ReportPhotoSection: View {
    @EnvironmentObject private var location: LocationService
    let title: String
    let guidance: String
    @Binding var photoItem: PhotosPickerItem?
    @Binding var photoData: Data?
    @Binding var locationDraft: ReportLocationDraft
    @State private var showCamera = false
    @State private var photoError: String?
    @State private var photoLoadTask: Task<Void, Never>?
    @State private var photoGeneration = PhotoSelectionGeneration()

    var body: some View {
        Section {
            Text(guidance)
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            HStack {
                PhotosPicker(
                    selection: $photoItem,
                    matching: .images,
                    preferredItemEncoding: .current
                ) {
                    Label("Choose picture", systemImage: "photo")
                }
                Spacer()
                Button { prepareForCamera() } label: {
                    Label("Camera", systemImage: "camera")
                }
            }

            if let photoData, let image = UIImage(data: photoData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 240)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                Button("Remove picture", role: .destructive) {
                    invalidatePhotoLoad()
                    self.photoData = nil
                    photoItem = nil
                    locationDraft.removePhotoProvenance()
                }
            }

            if let photoError {
                Label(photoError, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Color.cwError)
            }
        } header: {
            Text(title)
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            load(item)
        }
        .sheet(isPresented: $showCamera) {
            CameraCaptureSheet(onImage: applyCamera)
        }
        .onDisappear { invalidatePhotoLoad() }
    }

    private func load(_ item: PhotosPickerItem) {
        invalidatePhotoLoad()
        photoError = nil
        let generation = photoGeneration.begin()
        photoLoadTask = Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw PhotoStore.PhotoError.invalidImage
                }
                try Task.checkCancellation()
                guard photoGeneration.accepts(generation) else { return }
                apply(PhotoSelection(data: data))
                photoLoadTask = nil
            } catch is CancellationError {
                return
            } catch {
                guard photoGeneration.accepts(generation) else { return }
                photoError = "That picture could not be opened. Choose another image."
                photoLoadTask = nil
            }
        }
    }

    private func prepareForCamera() {
        invalidatePhotoLoad()
        photoItem = nil
        showCamera = true
    }

    private func applyCamera(_ selection: PhotoSelection) {
        invalidatePhotoLoad()
        photoItem = nil
        apply(selection)
    }

    private func invalidatePhotoLoad() {
        photoLoadTask?.cancel()
        photoLoadTask = nil
        photoGeneration.invalidate()
    }

    private func apply(_ selection: PhotoSelection) {
        photoError = nil
        photoData = selection.data
        if let coordinate = selection.coordinate {
            locationDraft.usePhoto(coordinate)
        } else {
            locationDraft.notePhotoWithoutLocation()
            if !locationDraft.isConfirmed {
                location.requestLocation { coordinate in
                    locationDraft.useDeviceFallback(coordinate)
                }
            }
        }
    }
}

private struct LocationDraftSection: View {
    @EnvironmentObject private var location: LocationService
    @Binding var locationDraft: ReportLocationDraft
    @State private var showManualCoordinates = false
    @State private var latitudeText = ""
    @State private var longitudeText = ""
    @State private var coordinateError: String?

    var body: some View {
        Section("Location") {
            if let coordinate = locationDraft.coordinate {
                LabeledContent("Report coordinates") {
                    Text(String(
                        format: "%.6f, %.6f",
                        coordinate.latitude,
                        coordinate.longitude
                    ))
                    .monospacedDigit()
                }
                LabeledContent("Source", value: locationDraft.source.label)
                if locationDraft.locationOverridden {
                    Label("The automatic location was overridden.", systemImage: "arrow.triangle.2.circlepath")
                        .font(.footnote)
                        .foregroundStyle(Color.cwWarning)
                }
            } else {
                Text(location.isLocating ? "Finding device GPS…" : "No confirmed report location yet.")
                    .foregroundStyle(Color.cwTextSecondary)
            }

            if let photoCoordinate = locationDraft.photoCoordinate {
                LabeledContent("Original picture GPS") {
                    Text(String(
                        format: "%.6f, %.6f",
                        photoCoordinate.latitude,
                        photoCoordinate.longitude
                    ))
                    .monospacedDigit()
                }
            }

            if let error = location.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.cwError)
            }

            Button {
                location.requestLocation { coordinate in
                    locationDraft.useDevice(coordinate)
                }
            } label: {
                Label(location.isLocating ? "Finding GPS…" : "Use device GPS", systemImage: "location.fill")
            }
            .disabled(location.isLocating)

            DisclosureGroup("Review or override coordinates", isExpanded: $showManualCoordinates) {
                TextField("Latitude (−90 to 90)", text: $latitudeText)
                    .keyboardType(.numbersAndPunctuation)
                TextField("Longitude (−180 to 180)", text: $longitudeText)
                    .keyboardType(.numbersAndPunctuation)
                Button("Use these coordinates") { applyManualCoordinates() }
                if let coordinateError {
                    Text(coordinateError)
                        .font(.footnote)
                        .foregroundStyle(Color.cwError)
                }
            }
            .onChange(of: showManualCoordinates) { _, expanded in
                guard expanded, let coordinate = locationDraft.coordinate else { return }
                latitudeText = String(format: "%.6f", coordinate.latitude)
                longitudeText = String(format: "%.6f", coordinate.longitude)
            }
        }
    }

    private func applyManualCoordinates() {
        guard let coordinate = CoordinateValidator.coordinate(
            latitude: latitudeText,
            longitude: longitudeText
        ) else {
            coordinateError = "Enter a latitude from −90 to 90 and longitude from −180 to 180."
            return
        }
        locationDraft.useManual(coordinate, source: .manualCoordinates)
        latitudeText = String(format: "%.6f", coordinate.latitude)
        longitudeText = String(format: "%.6f", coordinate.longitude)
        coordinateError = nil
        showManualCoordinates = false
    }
}
