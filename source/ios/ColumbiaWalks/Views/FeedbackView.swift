import SwiftUI

struct FeedbackView: View {
    @EnvironmentObject private var feedbackService: FeedbackService
    @State private var category: FeedbackCategory?
    @State private var feedbackText = ""
    @State private var offersContact = false
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var address = ""
    @State private var contactNotes = ""
    @State private var consent = false
    @State private var errorMessage: String?
    @State private var confirmation: String?

    var body: some View {
        Form {
                Section {
                    AppHeader("App Feedback", subtitle: "Help improve ColumbiaWalks. Feedback is anonymous by default.")
                }

                Section("Reason for feedback") {
                    Picker("Reason", selection: $category) {
                        Text("Select a reason…").tag(FeedbackCategory?.none)
                        ForEach(FeedbackCategory.allCases) { value in
                            Text(value.label).tag(Optional(value))
                        }
                    }
                    if category != nil {
                        TextField(
                            "Tell us what worked, what did not, or what you would like to see",
                            text: $feedbackText,
                            axis: .vertical
                        )
                        .lineLimit(5...10)
                    }
                }

                Section("Contact information") {
                    Toggle("Show optional contact fields", isOn: $offersContact.animation())
                    Text("Every contact field is optional. Providing it does not grant permission to contact you unless you also select consent.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                    if offersContact {
                        TextField("Name (optional)", text: $name)
                            .textContentType(.name)
                        TextField("Phone number (optional)", text: $phone)
                            .textContentType(.telephoneNumber)
                            .keyboardType(.phonePad)
                        TextField("Email address (optional)", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        TextField("Street address (optional)", text: $address, axis: .vertical)
                            .textContentType(.fullStreetAddress)
                        TextField("Additional contact details or notes (optional)", text: $contactNotes, axis: .vertical)
                        Toggle("I consent to being contacted about this feedback", isOn: $consent)
                    }
                }

                if let message = errorMessage {
                    Section { Label(message, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.cwError) }
                }
                if let confirmation {
                    Section { Label(confirmation, systemImage: "checkmark.circle.fill").foregroundStyle(Color.cwGreen) }
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        Label("Submit feedback", systemImage: "paperplane.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
            .columbiaWalksScrollSurface()
            .navigationTitle("App Feedback")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: offersContact) { _, offered in
                if !offered { clearContactFields() }
            }
    }

    private func submit() {
        errorMessage = nil
        confirmation = nil
        if let validationError = FeedbackValidator.validate(
            category: category,
            text: feedbackText,
            email: email
        ) {
            errorMessage = validationError
            return
        }
        guard let category else { return }
        let text = feedbackText.trimmingCharacters(in: .whitespacesAndNewlines)
        let limitsAreValid = name.count <= 200
            && phone.count <= 64
            && email.count <= 254
            && address.count <= 500
            && contactNotes.count <= 1_500
        guard limitsAreValid else {
            errorMessage = "One or more contact fields is too long."
            return
        }

        let submission = FeedbackSubmission(
            id: UUID(),
            feedbackCategory: category,
            feedbackText: text,
            appVersion: "ios-\(APIClient.version)",
            submissionSource: "ios",
            contactInformationOffered: offersContact,
            contactName: offersContact ? name.trimmed : "",
            contactPhone: offersContact ? phone.trimmed : "",
            contactEmail: offersContact ? email.trimmed : "",
            contactStreetAddress: offersContact ? address.trimmed : "",
            contactNotes: offersContact ? contactNotes.trimmed : "",
            consentToContact: offersContact && consent
        )
        do {
            try feedbackService.enqueue(submission)
            confirmation = "Feedback saved privately and queued for secure submission."
            reset()
        } catch {
            errorMessage = "The feedback could not be saved. Please try again."
        }
    }

    private func reset() {
        category = nil
        feedbackText = ""
        offersContact = false
        clearContactFields()
    }

    private func clearContactFields() {
        name = ""
        phone = ""
        email = ""
        address = ""
        contactNotes = ""
        consent = false
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
