import SwiftUI

struct PoliceTipView: View {
    @State private var draft: PoliceTipDraft
    @State private var testOnly = false
    @State private var prepared: AnonymousTipSubmission?
    @State private var errorMessage: String?
    @State private var confirmNew = false
    @StateObject private var service = AnonymousTipService()

    init(initialDraft: PoliceTipDraft = PoliceTipDraft()) {
        _draft = State(initialValue: initialDraft)
    }
    private var locked: Bool { service.busy || service.pending != nil || service.completed }
    var body: some View {
        Form {
            Section {
                AppHeader("[TEST] Anonymous Police Tip", subtitle: "Internal build 3.17.0")
                Text("[TEST] INTERNAL TEST ONLY. Private ColumbiaWalks test intake. Columbia Borough Police Department will NOT receive this tip.")
                    .font(.headline).padding(12).background(Color.yellow.opacity(0.25))
                Text("No name, email, phone number, account ID, or device ID is included. Do not identify yourself in the text. Hosting infrastructure can still process network information. Text only in this test; no attachments.")
                    .font(.footnote)
                EmergencyNotice()
            }
            Section("[TEST] Tip details") {
                markedField("Subject (required; 128 characters)", value: $draft.subject)
                DatePicker("[TEST] Observed date and time", selection: $draft.observedAt, in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                markedField("Location (required; 500 characters)", value: $draft.location)
                markedField("Direction of travel (optional; 500 characters)", value: $draft.directionOfTravel)
                markedField("License plate (optional; 500 characters)", value: $draft.licensePlate)
                markedField("Plate state or jurisdiction (optional; 500 characters)", value: $draft.plateState)
                markedField("Vehicle description (optional; 500 characters)", value: $draft.vehicleDescription)
                markedField("What you observed (required; 5,000 characters)", value: $draft.firsthandObservation)
                markedField("Evidence notes (optional; 2,000 characters; no files)", value: $draft.evidenceNotes)
            }.disabled(locked)
            Section("[TEST] Confirm before preview") {
                Toggle("[TEST] This concerns a past or inactive matter.", isOn: $draft.isPastAndNotInProgress)
                Toggle("[TEST] I understand this is a private ColumbiaWalks test and will not reach police.", isOn: $testOnly)
                Text("[TEST] is inserted between every word in all submitted fields, including optional fields. Review the exact marked text below.").font(.footnote)
                Button("Preview [TEST] fields") { prepare() }
            }.disabled(locked)
            if let payload = service.pending ?? prepared {
                Section("[TEST] Marked submission preview") {
                    ForEach(AnonymousTipSubmission.fieldOrder, id: \.self) { key in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("[TEST] " + key.replacingOccurrences(of: "_", with: " ")).font(.headline)
                            Text(payload.fields[key] ?? "[TEST]").textSelection(.enabled)
                        }
                    }
                    if !service.completed {
                        Button(service.pending == nil ? "Submit [TEST] to private intake" : "Retry saved [TEST]") {
                            Task { await service.submit(payload) }
                        }.buttonStyle(.borderedProminent).disabled(service.busy)
                    }
                }
            }
            if let errorMessage { Section { Text(errorMessage).foregroundStyle(Color.cwError) } }
            if !service.message.isEmpty {
                Section("[TEST] Submission status") {
                    Text(service.message).font(.headline).accessibilityAddTraits(.updatesFrequently)
                }
            }
            if service.pending != nil || service.completed {
                Section {
                    Button("Clear and start new [TEST]", role: .destructive) { confirmNew = true }.disabled(service.busy)
                }
            }
        }
        .columbiaWalksScrollSurface()
        .navigationTitle("[TEST] Police Tip")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: draft) { _, _ in prepared = nil; errorMessage = nil }
        .onChange(of: testOnly) { _, _ in prepared = nil; errorMessage = nil }
        .confirmationDialog("Start a new [TEST]?", isPresented: $confirmNew, titleVisibility: .visible) {
            Button("Clear local copy", role: .destructive) {
                service.discard()
                if service.pending == nil { draft = PoliceTipDraft(); testOnly = false; prepared = nil }
            }
        } message: {
            Text("This clears the local draft and pending retry. A test already stored by ColumbiaWalks is not deleted.")
        }
    }
    private func markedField(_ title: String, value: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("[TEST] " + title).font(.subheadline.bold())
            TextField("Enter test text", text: value, axis: .vertical)
                .lineLimit(1...8).autocorrectionDisabled().textInputAutocapitalization(.sentences)
                .accessibilityLabel("[TEST] " + title)
        }
    }
    private func prepare() {
        do {
            prepared = try AnonymousTipSubmission.make(draft, testOnly: testOnly,
                version: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
            errorMessage = nil
        } catch { errorMessage = error.localizedDescription }
    }
}
