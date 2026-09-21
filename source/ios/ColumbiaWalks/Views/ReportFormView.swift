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
    @State private var showLocationDetails = false
    @State private var showIdentificationDetails = false
    @State private var showCoordinateEditor = false
    @State private var showTestEmailDetails = false
    @State private var testEmailOptIn = false
    @State private var showAuthoritiesHandoff = false
    @State private var authoritiesDraft = PoliceTipDraft()
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

                if !officialEmailDestinations.isEmpty {
                    OfficialEmailDisclosure(
                        destinations: officialEmailDestinations,
                        isOptedIn: $testEmailOptIn,
                        isExpanded: $showTestEmailDetails,
                        requirementsMet: testEmailRequirementsMet
                    )
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.cwError)
                    }
                }

                Section {
                    Button {
                        saveReport(notifyAuthorities: false)
                    } label: {
                        Label("Submit complaint to CW", systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button {
                        saveReport(notifyAuthorities: true)
                    } label: {
                        Label("Submit to CW & Notify CBPD", systemImage: "building.columns.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                } header: {
                    Text("Submit")
                } footer: {
                    Text("The second option saves the CW report, then opens a prepared anonymous-tip draft. You must review and submit it yourself on CBPD's official site; opening that site is not delivery.")
                }

                Section("More reporting options") {
                    NavigationLink {
                        PoliceTipView()
                    } label: {
                        Label("Notify the Authorities", systemImage: "building.columns")
                    }
                    Text("Prepare an anonymous tip without first submitting a CW report. ColumbiaWalks does not automatically send it to police.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)

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
                testEmailOptIn = false
                showTestEmailDetails = false
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
            .onChange(of: appState.reportLocation) { _, _ in
                if testEmailOptIn && !testEmailRequirementsMet {
                    testEmailOptIn = false
                }
            }
            .sheet(isPresented: $showCamera) {
                CameraCaptureSheet(onImage: applyCameraPhoto)
            }
            .sheet(isPresented: $showAuthoritiesHandoff) {
                NavigationStack {
                    PoliceTipView(initialDraft: authoritiesDraft)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { showAuthoritiesHandoff = false }
                            }
                        }
                }
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
            Text("Choose every complaint that applies, or submit without selecting one. An optional test-email control appears only when Crosswalk encroachment or Missing sidewalk is the single selected type.")
                .font(.footnote)
                .foregroundStyle(Color.cwTextSecondary)
            ForEach(QuickReportType.allCases) { type in
                SelectionRow(title: type.label, selected: quickTypes.contains(type)) {
                    toggle(type, in: &quickTypes)
                    if type == .crosswalkEncroachment, quickTypes.contains(type) {
                        vehicleInvolved = true
                    }
                    if officialEmailDestinations.isEmpty {
                        testEmailOptIn = false
                        showTestEmailDetails = false
                    }
                }
            }
            if quickTypes.count > 1,
               quickTypes.contains(.crosswalkEncroachment) ||
               quickTypes.contains(.missingSidewalk) {
                Label(
                    "Multiple selections are saved as an ordinary CW report; the optional test-email control is unavailable.",
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
        Section("Location (optional for Quick Report)") {
            DisclosureGroup(isExpanded: $showLocationDetails) {
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
                    Text("No report pin set. Quick Report can still be submitted; Repeat and Page of Shame reports require a confirmed location.")
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
            } label: {
                Label(locationSummary, systemImage: "mappin.and.ellipse")
            }
        }
    }

    private var identificationSection: some View {
        Section("People and vehicles (optional)") {
            DisclosureGroup("Identification details", isExpanded: $showIdentificationDetails) {
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
        Section("Photo (optional)") {
            Text("A photo is never required for this CW report. If you add one with GPS metadata, ColumbiaWalks uses those coordinates for the report, records the source, then removes the embedded metadata from the saved and uploaded JPEG. A photo is needed only to enable the separate optional test-email control.")
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
                    testEmailOptIn = false
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

    private var testEmailRequirementsMet: Bool {
        guard photoData != nil, appState.locationConfirmed else { return false }
        return OfficialEmailPolicy.isWithinServiceArea(appState.reportCoordinate)
    }

    private var locationSummary: String {
        guard appState.locationConfirmed else { return "Add or review location" }
        return appState.nearestIntersection?.label ?? appState.reportLocation.source.label
    }

    private func saveReport(notifyAuthorities: Bool) {
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
        let officialEmailAuthorized = testEmailOptIn && testEmailRequirementsMet

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
            if let photoFilename {
                try? FileManager.default.removeItem(at: PhotoStore.url(for: photoFilename))
            }
            errorMessage = "The report could not be saved securely on this iPhone. Check available storage and try again."
            return
        }
        let handoffDraft = makeAuthoritiesDraft(
            reportID: reportID,
            selectedCategories: selectedCategories,
            combinedDetails: combinedDetails,
            hadPhoto: photoData != nil
        )
        resetForm()
        if notifyAuthorities {
            authoritiesDraft = handoffDraft
            showAuthoritiesHandoff = true
        } else {
            appState.selectedTab = .saved
        }
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
        testEmailOptIn = false
        showTestEmailDetails = false
        appState.removePhotoProvenance()
        errorMessage = nil
    }

    private func makeAuthoritiesDraft(
        reportID: UUID,
        selectedCategories: Set<IssueCategory>,
        combinedDetails: String,
        hadPhoto: Bool
    ) -> PoliceTipDraft {
        let issueLabels = mode == .quick
            ? quickTypes.sorted { $0.rawValue < $1.rawValue }.map(\.label)
            : selectedCategories.sorted { $0.rawValue < $1.rawValue }.map(\.label)
        let subject = issueLabels.first.map { "Pedestrian safety: \($0)" }
            ?? "Pedestrian safety concern"
        let observation = [
            issueLabels.isEmpty ? "" : "Issue type(s): \(issueLabels.joined(separator: ", "))",
            combinedDetails,
            policeDetails.trimmed
        ].filter { !$0.isEmpty }.joined(separator: "\n\n")
        let locationText: String
        if let intersection = appState.nearestIntersection?.label {
            locationText = intersection
        } else if appState.locationConfirmed {
            locationText = String(
                format: "%.6f, %.6f",
                appState.reportCoordinate.latitude,
                appState.reportCoordinate.longitude
            )
        } else {
            locationText = ""
        }
        let vehicleDescription = [
            vehicle.year,
            vehicle.color,
            vehicle.make,
            vehicle.model,
            vehicle.bodyStyle,
            vehicle.description
        ].map(\.trimmed).filter { !$0.isEmpty }.joined(separator: " ")

        return PoliceTipDraft(
            subject: String(subject.prefix(128)),
            observedAt: observedAt,
            location: locationText,
            licensePlate: vehicle.licensePlate,
            plateState: vehicle.plateState,
            vehicleDescription: vehicleDescription,
            firsthandObservation: observation,
            evidenceNotes: hadPhoto
                ? "CW report \(reportID.uuidString.lowercased()) includes a photo. Attach the original relevant file yourself on the official CBPD form."
                : "CW report \(reportID.uuidString.lowercased()) did not include a photo.",
            sourceWasSubmittedToColumbiaWalks: true
        )
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
    @Binding var isOptedIn: Bool
    @Binding var isExpanded: Bool
    let requirementsMet: Bool

    var body: some View {
        Section("Optional test email") {
            DisclosureGroup(isExpanded: $isExpanded) {
                Text("This is a separate field test for the \(rulePhrase). It is off unless you turn it on. In version 3.16.1, the server addresses any resulting [TEST]-subject message only to a ColumbiaWalks-controlled test mailbox, not Police, the Mayor, or Codes.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.cwText)
                Text("The optional test needs a photo and a confirmed report location within 5 km of Columbia Borough center. Those items remain optional for the CW report itself.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                if destinations.contains(.policeChiefAndMayor) {
                    Text("For the crosswalk test, any license plate and plate state you enter are included and prominently identified in the test-mailbox message.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                }
                Text("Authorization does not confirm delivery. Nothing is sent from your personal email account.")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.cwText)

                Toggle("Opt in to the [TEST] email", isOn: $isOptedIn)
                    .tint(.cwGreen)
                    .disabled(!requirementsMet)
                    .accessibilityHint("This optional control does not affect whether the CW report can be submitted.")

                if !requirementsMet {
                    Label(
                        "Add a photo and a confirmed in-area location to enable this optional test. You can submit to CW without either one.",
                        systemImage: "info.circle"
                    )
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                }
            } label: {
                Label(destinationHeading, systemImage: "envelope.badge")
            }
        }
    }

    private var destinationHeading: String {
        let uniqueDestinations = Set(destinations)
        let status = isOptedIn ? "on" : "off"
        if uniqueDestinations == [.policeChiefAndMayor] { return "Crosswalk test email (\(status))" }
        if uniqueDestinations == [.codes] { return "Missing-sidewalk test email (\(status))" }
        return "Qualifying test email (\(status))"
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
