import PhotosUI
import SwiftUI
import UIKit

struct ReportFormView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var reports: ReportStore
    @EnvironmentObject private var location: LocationService

    @State private var mode: ReportMode = .quick
    @State private var quickTypes: Set<QuickReportType> = []
    @State private var categories: Set<IssueCategory> = []
    @State private var otherDetails = ""
    @State private var checklistResponses: [String: ChecklistResponse] = [:]
    @State private var severity: Severity = .medium
    @State private var observedAt = Date()
    @State private var addDetails = false
    @State private var details = ""
    @State private var reportedParty: ReportedParty = .unknown
    @State private var vehicleInvolved = false
    @State private var vehicle = VehicleDetails()
    @State private var policeResponse: PoliceResponse = .notInvolved
    @State private var policeObservations: Set<PoliceObservation> = []
    @State private var policeDetails = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var showCamera = false
    @State private var showCoordinateEditor = false
    @State private var manualLatitude = ""
    @State private var manualLongitude = ""
    @State private var errorMessage: String?
    @State private var requestedInitialLocation = false
    @State private var photoLoadTask: Task<Void, Never>?
    @State private var photoGeneration = PhotoSelectionGeneration()

    private let catalog = ChecklistCatalog.load()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    AppHeader("Safety report", subtitle: "Saved privately on this iPhone first, then submitted securely.")
                    EmergencyNotice()
                }

                Section("Choose a report path") {
                    Picker("Report path", selection: $mode) {
                        ForEach(ReportMode.standardCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Text(mode == .quick
                         ? "Fast complaint, live GPS, optional details and photo. No issue type is required."
                         : "All categories and their related follow-up questions.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }

                if mode == .quick {
                    quickSection
                } else {
                    fullCategorySection
                    checklistSection
                }

                if !officialEmailDestinations.isEmpty {
                    OfficialEmailDisclosure(destinations: officialEmailDestinations)
                }

                locationSection
                identificationSection

                if showPoliceSection {
                    policeSection
                }

                Section("Report details") {
                    Picker("Urgency", selection: $severity) {
                        ForEach(Severity.allCases) { Text($0.label).tag($0) }
                    }
                    DatePicker("When did it happen?", selection: $observedAt)
                    Toggle("Add additional information", isOn: $addDetails.animation())
                    if addDetails {
                        TextField(
                            "Condition, direction of travel, nearby address or landmark",
                            text: $details,
                            axis: .vertical
                        )
                        .lineLimit(4...8)
                    }
                }

                photoSection

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.cwError)
                    }
                }

                Section {
                    Button {
                        saveReport()
                    } label: {
                        Label(submitButtonLabel, systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                } footer: {
                    Text("No Directus credential is stored in this app. The server validates and processes the report through the public intake endpoint.")
                }

                Section("Photo-first report") {
                    NavigationLink {
                        PageOfShameView()
                    } label: {
                        Label("Page of Shame", systemImage: "photo.badge.exclamationmark")
                    }
                    Text("Submit a picture and confirmed location for administrator review before any public use.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }
            }
            .columbiaWalksScrollSurface()
            .navigationTitle("Report")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: mode) { _, newMode in
                errorMessage = nil
                if newMode == .quick {
                    categories.removeAll()
                    checklistResponses.removeAll()
                } else {
                    quickTypes.removeAll()
                }
            }
            .onChange(of: reportedParty) { _, party in
                if party == .policeOfficer { categories.insert(.policeResponse) }
            }
            .onChange(of: vehicleInvolved) { _, involved in
                if !involved { vehicle = VehicleDetails() }
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                loadPhoto(item)
            }
            .sheet(isPresented: $showCamera) {
                CameraCaptureSheet(onImage: applyCameraPhoto)
            }
            .task {
                guard !requestedInitialLocation, mode == .quick, !appState.locationConfirmed else { return }
                requestedInitialLocation = true
                location.requestLocation { appState.useDeviceLocationFallback($0) }
            }
            .onDisappear { invalidatePhotoLoad() }
        }
    }

    private var quickSection: some View {
        Section("Quick complaint types (optional)") {
            Text("Choose every complaint that applies, or submit without selecting one. The 3.16 test email is available only when Crosswalk encroachment or Missing sidewalk is the single selected type.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            ForEach(QuickReportType.allCases) { type in
                SelectionRow(title: type.label, selected: quickTypes.contains(type)) {
                    toggle(type, in: &quickTypes)
                    if type == .crosswalkEncroachment, quickTypes.contains(type) {
                        vehicleInvolved = true
                    }
                }
            }
            if quickTypes.count > 1,
               quickTypes.contains(.crosswalkEncroachment) ||
               quickTypes.contains(.missingSidewalk) {
                Label(
                    "Multiple selections will be saved as an ordinary report without field-test email authorization.",
                    systemImage: "info.circle.fill"
                )
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.cwWarning)
            }
            Button("Other — open the full report list") { mode = .full }
        }
    }

    private var fullCategorySection: some View {
        Section("What happened?") {
            Text("Select every issue that applies. Related questions appear below.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            ForEach(IssueCategory.allCases) { category in
                SelectionRow(title: category.label, selected: categories.contains(category)) {
                    toggle(category, in: &categories)
                    if !categories.contains(category) {
                        pruneChecklistResponses()
                    }
                }
                if category == .notIncludedElsewhere && categories.contains(category) {
                    TextField("Briefly describe the issue", text: $otherDetails, axis: .vertical)
                        .lineLimit(2...5)
                }
            }
        }
    }

    @ViewBuilder
    private var checklistSection: some View {
        let visible = catalog.categories.filter { $0.applies(to: categories) }
        if !visible.isEmpty {
            Section("Questions for selected issues (optional)") {
                Text("Answer only what you can observe. \(checklistResponses.count) answered.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                ForEach(visible) { category in
                    DisclosureGroup("\(category.title) · \(category.questions.count)") {
                        Text(category.description)
                            .font(.footnote)
                            .foregroundStyle(Color.cwTextSecondary)
                        ForEach(category.questions) { question in
                            ChecklistQuestionRow(
                                question: question,
                                response: checklistBinding(for: question.id)
                            )
                        }
                    }
                }
            }
        }
    }

    private var locationSection: some View {
        Section("Location") {
            if appState.locationConfirmed {
                LabeledContent("Report pin") {
                    Text(String(
                        format: "%.6f, %.6f",
                        appState.reportCoordinate.latitude,
                        appState.reportCoordinate.longitude
                    ))
                    .monospacedDigit()
                }
                LabeledContent("Closest intersection") {
                    if appState.intersectionLookupInProgress {
                        ProgressView()
                    } else {
                        Text(appState.nearestIntersection?.label ?? "Not determined")
                    }
                }
                if !ColumbiaArea.contains(appState.reportCoordinate) {
                    Label("This point appears outside the Columbia area.", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(Color.cwWarning)
                }
                LabeledContent("Location source", value: appState.reportLocation.source.label)
                if let photoCoordinate = appState.reportLocation.photoCoordinate {
                    LabeledContent("Original photo GPS") {
                        Text(String(
                            format: "%.6f, %.6f",
                            photoCoordinate.latitude,
                            photoCoordinate.longitude
                        ))
                        .monospacedDigit()
                    }
                }
            } else {
                Text(officialEmailDestinations.isEmpty
                     ? "No report pin set. Quick Report can still be submitted; Repeat and Page of Shame reports require a confirmed location."
                     : "A confirmed report location is required to authorize this 3.16 test-mailbox email after upload.")
                    .foregroundStyle(Color.cwTextSecondary)
            }
            Button("Use current device GPS") {
                location.requestLocation { appState.selectLocation($0, source: .deviceGPS) }
            }
            .disabled(location.isLocating)
            Button("Choose or change on map") { appState.selectedTab = .map }
            DisclosureGroup("Enter coordinates manually", isExpanded: $showCoordinateEditor) {
                TextField("Latitude", text: $manualLatitude)
                    .keyboardType(.numbersAndPunctuation)
                TextField("Longitude", text: $manualLongitude)
                    .keyboardType(.numbersAndPunctuation)
                Button("Use these coordinates") { applyManualCoordinates() }
            }
        }
    }

    private var identificationSection: some View {
        Section("Identify the person or vehicle (optional)") {
            Text("Enter only details you safely observed. Do not approach or follow a vehicle.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            Picker("Who is being reported?", selection: $reportedParty) {
                ForEach(ReportedParty.allCases) { Text($0.label).tag($0) }
            }
            Toggle("A vehicle was involved", isOn: $vehicleInvolved.animation())
            if vehicleInvolved {
                VehicleFields(vehicle: $vehicle)
            }
        }
    }

    private var policeSection: some View {
        Section("Police interaction or complaint") {
            Picker("Police response", selection: $policeResponse) {
                ForEach(PoliceResponse.allCases) { Text($0.label).tag($0) }
            }
            Text("Check only what you personally observed.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            ForEach(PoliceObservation.allCases) { observation in
                SelectionRow(title: observation.label, selected: policeObservations.contains(observation)) {
                    toggle(observation, in: &policeObservations)
                }
            }
            TextField("Names, badge or unit number, sequence of events, and context", text: $policeDetails, axis: .vertical)
                .lineLimit(4...8)
        }
    }

    private var photoSection: some View {
        Section(officialEmailDestinations.isEmpty ? "Photo (optional)" : "Photo (required for field-test email)") {
            Text(officialEmailDestinations.isEmpty
                 ? "Use a photo only when it is safe. If it contains GPS metadata, ColumbiaWalks uses those coordinates for the report, records the source, then removes the embedded metadata from the saved and uploaded JPEG."
                 : "A relevant photo is required for this qualifying report. If the server processes the authorized [TEST]-subject email to the ColumbiaWalks-controlled test mailbox after upload, it includes the normalized photo; embedded metadata is removed from the saved and uploaded JPEG.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            HStack {
                PhotosPicker(
                    selection: $photoItem,
                    matching: .images,
                    preferredItemEncoding: .current
                ) {
                    Label("Choose photo", systemImage: "photo")
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
                    .frame(maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                Button("Remove photo", role: .destructive) {
                    invalidatePhotoLoad()
                    self.photoData = nil
                    photoItem = nil
                    appState.removePhotoProvenance()
                }
            }
        }
    }

    private var showPoliceSection: Bool {
        categories.contains(.policeResponse) || reportedParty == .policeOfficer
    }

    private var officialEmailDestinations: [OfficialEmailDestination] {
        OfficialEmailPolicy.destinations(
            submissionMode: mode,
            quickReportTypes: quickTypes
        )
    }

    private var submitButtonLabel: String {
        officialEmailDestinations.isEmpty
            ? "Save & submit report"
            : "Save, submit & authorize test email"
    }

    private func saveReport() {
        errorMessage = nil
        let selectedCategories = mode == .quick
            ? Set(quickTypes.map(\.category))
            : categories
        let combinedDetails = [
            selectedCategories.contains(.notIncludedElsewhere) ? "Not included elsewhere: \(otherDetails.trimmed)" : "",
            addDetails ? details.trimmed : ""
        ].filter { !$0.isEmpty }.joined(separator: "\n\n")
        if let validationError = ReportValidator.validate(
            mode: mode,
            categories: selectedCategories,
            otherDetails: otherDetails,
            details: combinedDetails,
            locationConfirmed: appState.locationConfirmed
        ) {
            errorMessage = validationError
            return
        }
        guard policeDetails.count <= 1_500 else {
            errorMessage = "Police interaction details must be 1,500 characters or fewer."
            return
        }
        if vehicleInvolved, let validationError = vehicle.validationError {
            errorMessage = validationError
            return
        }
        let emailDestinations = officialEmailDestinations
        if !emailDestinations.isEmpty, photoData == nil {
            errorMessage = "Add a relevant photo before authorizing this field-test email."
            return
        }
        if !emailDestinations.isEmpty, !appState.locationConfirmed {
            errorMessage = "Confirm the report location before authorizing this field-test email."
            return
        }
        if !emailDestinations.isEmpty,
           !OfficialEmailPolicy.isWithinServiceArea(appState.reportCoordinate) {
            errorMessage = "The 3.16 field-test email is limited to reports within 5 km of Columbia Borough center. Review the picture GPS, use device GPS, or override the coordinates before saving. To save an ordinary report outside that area, remove the qualifying issue selection."
            return
        }

        let reportID = UUID()
        let photoFilename: String?
        do {
            photoFilename = try photoData.map { try PhotoStore.saveNormalized($0, reportID: reportID) }
        } catch {
            errorMessage = error.localizedDescription
            return
        }

        let report = SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(),
            observedAt: observedAt,
            categories: selectedCategories.sorted { $0.rawValue < $1.rawValue },
            severity: severity,
            policeResponse: policeResponse,
            details: combinedDetails,
            checklistResponses: checklistResponses,
            reportedParty: reportedParty,
            vehicleInvolved: vehicleInvolved,
            vehicleDetails: vehicle,
            policeObservations: policeObservations.sorted { $0.rawValue < $1.rawValue },
            policeComplaintDetails: policeDetails.trimmed,
            submissionMode: mode,
            quickReportTypes: quickTypes.sorted { $0.rawValue < $1.rawValue },
            nearestIntersection: appState.locationConfirmed ? appState.nearestIntersection : nil,
            latitude: appState.locationConfirmed ? appState.reportCoordinate.latitude : nil,
            longitude: appState.locationConfirmed ? appState.reportCoordinate.longitude : nil,
            locationSource: appState.locationConfirmed ? appState.reportLocation.source : .none,
            photoLatitude: appState.reportLocation.photoLatitude,
            photoLongitude: appState.reportLocation.photoLongitude,
            locationOverridden: appState.reportLocation.locationOverridden,
            photoFilename: photoFilename,
            officialEmailAuthorized: !emailDestinations.isEmpty,
            officialEmailDestinationAuthorized: emailDestinations.isEmpty
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
            if let photoFilename {
                try? FileManager.default.removeItem(at: PhotoStore.url(for: photoFilename))
            }
            errorMessage = "The report could not be saved securely on this iPhone. Check available storage and try again."
            return
        }
        resetForm()
        appState.selectedTab = .saved
    }

    private func resetForm() {
        mode = .quick
        quickTypes.removeAll()
        categories.removeAll()
        otherDetails = ""
        checklistResponses.removeAll()
        severity = .medium
        observedAt = Date()
        addDetails = false
        details = ""
        reportedParty = .unknown
        vehicleInvolved = false
        vehicle = VehicleDetails()
        policeResponse = .notInvolved
        policeObservations.removeAll()
        policeDetails = ""
        invalidatePhotoLoad()
        photoItem = nil
        photoData = nil
        appState.removePhotoProvenance()
        errorMessage = nil
    }

    private func loadPhoto(_ item: PhotosPickerItem) {
        invalidatePhotoLoad()
        errorMessage = nil
        let generation = photoGeneration.begin()
        photoLoadTask = Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw PhotoStore.PhotoError.invalidImage
                }
                try Task.checkCancellation()
                guard photoGeneration.accepts(generation) else { return }
                applyPhoto(PhotoSelection(data: data))
                photoLoadTask = nil
            } catch is CancellationError {
                return
            } catch {
                guard photoGeneration.accepts(generation) else { return }
                errorMessage = "That photo could not be opened. Choose another image."
                photoLoadTask = nil
            }
        }
    }

    private func prepareForCamera() {
        invalidatePhotoLoad()
        photoItem = nil
        showCamera = true
    }

    private func applyCameraPhoto(_ selection: PhotoSelection) {
        invalidatePhotoLoad()
        photoItem = nil
        applyPhoto(selection)
    }

    private func invalidatePhotoLoad() {
        photoLoadTask?.cancel()
        photoLoadTask = nil
        photoGeneration.invalidate()
    }

    private func applyPhoto(_ selection: PhotoSelection) {
        photoData = selection.data
        appState.notePhotoLocation(selection.coordinate)
        if selection.coordinate == nil && !appState.locationConfirmed {
            location.requestLocation { appState.useDeviceLocationFallback($0) }
        }
    }

    private func applyManualCoordinates() {
        guard let coordinate = CoordinateValidator.coordinate(
            latitude: manualLatitude,
            longitude: manualLongitude
        ) else {
            errorMessage = "Enter a latitude from −90 to 90 and longitude from −180 to 180."
            return
        }
        appState.selectLocation(coordinate, source: .manualCoordinates)
        manualLatitude = String(format: "%.6f", coordinate.latitude)
        manualLongitude = String(format: "%.6f", coordinate.longitude)
        showCoordinateEditor = false
        errorMessage = nil
    }

    private func toggle<T: Hashable>(_ value: T, in set: inout Set<T>) {
        if set.contains(value) { set.remove(value) } else { set.insert(value) }
    }

    private func checklistBinding(for id: String) -> Binding<ChecklistResponse?> {
        Binding(
            get: { checklistResponses[id] },
            set: { checklistResponses[id] = $0 }
        )
    }

    private func pruneChecklistResponses() {
        let visibleQuestionIDs = Set(catalog.categories
            .filter { $0.applies(to: categories) }
            .flatMap(\.questions)
            .map(\.id))
        checklistResponses = checklistResponses.filter { visibleQuestionIDs.contains($0.key) }
    }
}

struct OfficialEmailDisclosure: View {
    let destinations: [OfficialEmailDestination]

    var body: some View {
        Section("3.16 field-test email") {
            Label(destinationHeading, systemImage: "envelope.fill")
                .font(.headline)
                .foregroundStyle(Color.cwText)
            Text("Submitting authorizes the ColumbiaWalks server to attempt a field-test email for the \(rulePhrase) after a successful upload. In version 3.16, that message is addressed only to a ColumbiaWalks-controlled test mailbox and has [TEST] in its subject. It is not sent to Police, the Mayor, or Codes.")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.cwText)
            Text("This test route is limited to a confirmed report location within 5 km of Columbia Borough center. If processed, the message includes the report photo, confirmed location, and details.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            if destinations.contains(.policeChiefAndMayor) {
                Text("For the crosswalk field test, any license plate and plate state you enter are included and prominently identified in the message sent to the test mailbox.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }
            Text("Authorization does not confirm delivery; server delivery safeguards still apply. Nothing is sent from your personal email account.")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.cwText)
        }
    }

    private var destinationHeading: String {
        let uniqueDestinations = Set(destinations)
        if uniqueDestinations == [.policeChiefAndMayor] { return "Crosswalk rule — test mailbox only" }
        if uniqueDestinations == [.codes] { return "Missing-sidewalk rule — test mailbox only" }
        return "Two qualifying rules — test mailbox only"
    }

    private var rulePhrase: String {
        let uniqueDestinations = Set(destinations)
        if uniqueDestinations == [.policeChiefAndMayor] { return "crosswalk rule" }
        if uniqueDestinations == [.codes] { return "missing-sidewalk rule" }
        return "crosswalk and missing-sidewalk rules"
    }
}

private struct SelectionRow: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title).foregroundStyle(Color.cwText)
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? Color.cwGreen : Color.cwTextSecondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(selected ? "Selected" : "Not selected")
    }
}

private struct ChecklistQuestionRow: View {
    let question: ChecklistQuestion
    @Binding var response: ChecklistResponse?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(question.text).font(.subheadline)
            Picker("Response", selection: $response) {
                Text("Not answered").tag(ChecklistResponse?.none)
                ForEach(ChecklistResponse.allCases) { value in
                    Text(value.label).tag(Optional(value))
                }
            }
            .pickerStyle(.menu)
        }
        .padding(.vertical, 4)
    }
}

private struct VehicleFields: View {
    @Binding var vehicle: VehicleDetails

    var body: some View {
        Group {
            TextField("License plate", text: $vehicle.licensePlate)
            TextField("Plate state or jurisdiction", text: $vehicle.plateState)
            TextField("Year", text: $vehicle.year)
                .keyboardType(.numberPad)
            TextField("Make", text: $vehicle.make)
            TextField("Model", text: $vehicle.model)
            TextField("Color", text: $vehicle.color)
            TextField("Body style", text: $vehicle.bodyStyle)
            TextField("Fleet or unit number", text: $vehicle.unitNumber)
            TextField("VIN", text: $vehicle.vin)
                .textInputAutocapitalization(.characters)
            Picker("Emergency lights", selection: $vehicle.emergencyLights) {
                ForEach(ObservationStatus.allCases) { Text($0.label).tag($0) }
            }
            Picker("Siren", selection: $vehicle.siren) {
                ForEach(ObservationStatus.allCases) { Text($0.label).tag($0) }
            }
            TextField("Damage, stickers, or distinguishing marks", text: $vehicle.visibleDamage, axis: .vertical)
            TextField("Additional vehicle description", text: $vehicle.description, axis: .vertical)
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
