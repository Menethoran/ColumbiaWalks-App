import SwiftUI
import UIKit

struct PoliceTipView: View {
    @Environment(\.openURL) private var openURL
    @State private var draft: PoliceTipDraft
    @State private var errorMessage: String?
    @State private var showHandoffAlert = false

    init(initialDraft: PoliceTipDraft = PoliceTipDraft()) {
        _draft = State(initialValue: initialDraft)
    }

    private static let tipURL = URL(
        string: "https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip"
    )!
    private static let formalReportURL = URL(
        string: "https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/report"
    )!
    private static let officerComplaintURL = URL(
        string: "https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/content/citizen-complaint-form"
    )!

    var body: some View {
        Form {
            Section {
                AppHeader(
                    "Anonymous Police Tip",
                    subtitle: "Prepare a local-only draft for the official Columbia Borough Police form"
                )
                Label {
                    Text(draft.sourceWasSubmittedToColumbiaWalks
                         ? "This draft was prepared from the CW report you just saved. ColumbiaWalks has not sent it or any media to CBPD."
                         : "Nothing entered here is uploaded to or stored by ColumbiaWalks. No media is selected in this app.")
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "lock.shield.fill")
                }
                .font(.footnote)
                .foregroundStyle(Color.cwBlueDark)
            }

            Section("Emergency or happening now") {
                Label {
                    Text("Do not use an online form for an emergency or an incident currently in progress.")
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                }
                .font(.headline)
                .foregroundStyle(Color.cwError)

                PoliceCallLink(
                    title: "Call 911",
                    detail: "Emergency or incident in progress",
                    number: "911"
                )
                PoliceCallLink(
                    title: "Call County Dispatch",
                    detail: "Non-emergency: 717-664-1180",
                    number: "7176641180"
                )
                PoliceCallLink(
                    title: "Call Toll-Free Dispatch",
                    detail: "1-800-957-2677",
                    number: "18009572677"
                )
                PoliceCallLink(
                    title: "Call Columbia Police Station",
                    detail: "717-684-7735",
                    number: "7176847735"
                )
            }

            Section("Required confirmation") {
                Toggle(
                    "I confirm this incident is in the past and is not currently in progress.",
                    isOn: $draft.isPastAndNotInProgress
                )
                .tint(.cwGreen)
                Text("The official police form will require you to personally make the same confirmation before submitting.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section("Tip subject and time") {
                TextField("Short subject (required)", text: $draft.subject)
                    .textInputAutocapitalization(.sentences)
                Text("The official form accepts up to 128 characters for its subject.")
                    .font(.caption)
                    .foregroundStyle(Color.cwTextSecondary)
                DatePicker(
                    "Date and time observed",
                    selection: $draft.observedAt,
                    in: ...Date(),
                    displayedComponents: [.date, .hourAndMinute]
                )
            }

            Section("Where and which vehicle") {
                TextField(
                    "Location or nearest landmark (required)",
                    text: $draft.location,
                    axis: .vertical
                )
                .lineLimit(2...5)
                TextField(
                    "Direction of travel (optional)",
                    text: $draft.directionOfTravel,
                    axis: .vertical
                )
                .lineLimit(1...3)
                TextField("License plate (optional)", text: $draft.licensePlate)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                TextField("Plate state or jurisdiction (optional)", text: $draft.plateState)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                TextField(
                    "Vehicle description (optional)",
                    text: $draft.vehicleDescription,
                    axis: .vertical
                )
                .lineLimit(3...8)
            }

            Section("What you observed") {
                TextField(
                    "Describe only what you personally observed (required)",
                    text: $draft.firsthandObservation,
                    axis: .vertical
                )
                .lineLimit(5...12)
                TextField(
                    "Evidence notes (optional)",
                    text: $draft.evidenceNotes,
                    axis: .vertical
                )
                .lineLimit(3...8)
                Text("Mention what each original photo, plate image, or video shows. You will attach the files yourself on the official police site.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section("What happens next") {
                PoliceTipInstruction(number: 1, text: "ColumbiaWalks copies a subject and message to your clipboard, with clear Subject and Message labels.")
                PoliceTipInstruction(number: 2, text: "On the official form, choose “I wish to remain anonymous” and select “Other” as the type.")
                PoliceTipInstruction(number: 3, text: "Paste the copied text and attach the original relevant files yourself.")
                Text("Accepted types published by the police form: JPG, JPEG, PNG, TXT, PDF, AVI, MOV, MP4, MP3, and WAV. HEIC is not listed.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                PoliceTipInstruction(number: 4, text: "Review everything, personally accept the truth/not-in-progress attestation, complete reCAPTCHA, and press Submit on the official site.")
                Label {
                    Text("Opening the official site does not submit the tip. ColumbiaWalks cannot confirm delivery.")
                        .fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "hand.raised.fill")
                }
                .font(.footnote.bold())
                .foregroundStyle(Color.cwWarning)
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.cwError)
                }
            }

            Section {
                Button {
                    prepareTip()
                } label: {
                    Label("Copy Draft and Continue", systemImage: "doc.on.clipboard.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .accessibilityHint("Validates and copies the draft, then offers to open the official Columbia Borough Police tip form.")
            }

            Section("Other official police forms") {
                Link(destination: Self.formalReportURL) {
                    Label("Formal named online report", systemImage: "arrow.up.right.square")
                }
                Text("Use the named report for a formal non-active traffic complaint. It requires contact information and is not anonymous.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                Link(destination: Self.officerComplaintURL) {
                    Label("Complaint about a police employee", systemImage: "arrow.up.right.square")
                }
                Text("The officer-conduct form is separate from a complaint about a driver or vehicle.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section {
                Text(draft.sourceWasSubmittedToColumbiaWalks
                     ? "Handoff check: your CW report was saved, but this police tip and any media have not been sent to CBPD."
                     : "Privacy check: the draft and any media were not sent to ColumbiaWalks or CBPD.")
                    .font(.footnote.bold())
                    .foregroundStyle(Color.cwBlueDark)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .columbiaWalksScrollSurface()
        .navigationTitle("Police Tip")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Draft copied — not submitted", isPresented: $showHandoffAlert) {
            Button("Open Official Police Form") {
                openURL(Self.tipURL)
            }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Your Subject and Message are on the clipboard. ColumbiaWalks has not submitted anything to CBPD. You must finish and submit the tip on the official police site.")
        }
    }

    private func prepareTip() {
        errorMessage = nil
        if let validationError = PoliceTipValidator.validate(draft) {
            errorMessage = validationError
            return
        }

        let prepared = PoliceTipDraftBuilder.prepare(draft)
        UIPasteboard.general.string = prepared.clipboardText
        showHandoffAlert = true
    }
}

private struct PoliceCallLink: View {
    let title: String
    let detail: String
    let number: String

    var body: some View {
        Link(destination: URL(string: "tel:\(number)")!) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "phone.fill")
                    .foregroundStyle(Color.cwGreen)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(Color.cwTextSecondary)
                }
                .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right")
                    .font(.caption.bold())
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .accessibilityHint("Opens the Phone app with this number.")
    }
}

private struct PoliceTipInstruction: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 24, height: 24)
                .background(Color.cwBlue, in: Circle())
                .accessibilityHidden(true)
            Text(text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(text)")
    }
}
