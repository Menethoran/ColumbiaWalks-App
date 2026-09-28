import SwiftUI
import UIKit
import WebKit

struct PoliceTipView: View {
    @Environment(\.openURL) private var openURL
    @State private var draft: PoliceTipDraft
    @State private var errorMessage: String?
    @State private var showHandoff = false
    @State private var preparedTip: PreparedPoliceTip?

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
                    "[TEST] Anonymous Police Tip",
                    subtitle: "3.17.10 internal police-assisted test"
                )
                Label {
                    Text(draft.sourceWasSubmittedToColumbiaWalks
                         ? "[TEST] These details came from your saved ColumbiaWalks report. Review them before filling the official CBPD CRIMEWATCH form. No police tip is submitted yet."
                         : "[TEST] Drafts stay on your phone until you open the official form. ColumbiaWalks fills Anonymous, Other, subject and message. You personally review and submit on CRIMEWATCH.")
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
                TextField("[TEST] Short subject (required)", text: $draft.subject)
                    .textInputAutocapitalization(.sentences)
                Text("[TEST] between every word counts toward the official 128-character subject limit.")
                    .font(.caption)
                    .foregroundStyle(Color.cwTextSecondary)
                DatePicker(
                    "[TEST] Date and time observed",
                    selection: $draft.observedAt,
                    in: ...Date(),
                    displayedComponents: [.date, .hourAndMinute]
                )
            }

            Section("Where and which vehicle") {
                TextField(
                    "[TEST] Location or nearest landmark (required)",
                    text: $draft.location,
                    axis: .vertical
                )
                .lineLimit(2...5)
                TextField(
                    "[TEST] Direction of travel (optional)",
                    text: $draft.directionOfTravel,
                    axis: .vertical
                )
                .lineLimit(1...3)
                TextField("[TEST] License plate (optional)", text: $draft.licensePlate)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                TextField("[TEST] Plate state or jurisdiction (optional)", text: $draft.plateState)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                TextField(
                    "[TEST] Vehicle description (optional)",
                    text: $draft.vehicleDescription,
                    axis: .vertical
                )
                .lineLimit(3...8)
            }

            Section("What you observed") {
                TextField(
                    "[TEST] Describe only what you personally observed (required)",
                    text: $draft.firsthandObservation,
                    axis: .vertical
                )
                .lineLimit(5...12)
                TextField(
                    "[TEST] Evidence notes (optional)",
                    text: $draft.evidenceNotes,
                    axis: .vertical
                )
                .lineLimit(3...8)
                Text("Mention what each original photo, plate image, or video shows. You will attach the files yourself on the official police site.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section("What happens next") {
                PoliceTipInstruction(number: 1, text: "ColumbiaWalks carries your report details into the official CRIMEWATCH subject and message with [TEST] between every word.")
                PoliceTipInstruction(number: 2, text: "The form automatically selects “I wish to remain anonymous” and “Other”. Contact fields stay empty.")
                PoliceTipInstruction(number: 3, text: "Review the filled subject and message. Attach relevant original files yourself if needed. Test markings are reapplied before submission.")
                Text("Accepted types published by the police form: JPG, JPEG, PNG, TXT, PDF, AVI, MOV, MP4, MP3, and WAV. HEIC is not listed.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                PoliceTipInstruction(number: 4, text: "Review everything, personally accept the truth/not-in-progress attestation, complete reCAPTCHA, and press Submit on the official site.")
                Label {
                    Text("Filling the official site does not submit the tip. ColumbiaWalks cannot confirm delivery.")
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
                    Label("Fill CRIMEWATCH Form [TEST]", systemImage: "doc.on.clipboard.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .accessibilityHint("Validates test markings and opens the official form with Anonymous and Other selected and the subject and message filled.")
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
        .sheet(isPresented: $showHandoff) {
            if let preparedTip {
                CrimewatchTipSheet(tip: preparedTip)
            }
        }
    }

    private func prepareTip() {
        errorMessage = nil
        if let validationError = PoliceTipValidator.validate(draft) {
            errorMessage = validationError
            return
        }

        preparedTip = PoliceTipDraftBuilder.prepare(draft)
        showHandoff = true
    }
}

private struct CrimewatchTipSheet: View {
    let tip: PreparedPoliceTip
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var status = "Loading the official form. Autofill is not submission."

    var body: some View {
        NavigationStack {
            VStack(spacing: 8) {
                Text("[TEST] Anonymous / Other · crimewatch.net")
                    .font(.headline).padding(8).background(Color.yellow.opacity(0.25))
                Text(status).font(.footnote).padding(.horizontal).accessibilityLabel(status)
                HStack {
                    Button("Copy subject") { UIPasteboard.general.string = tip.subject }
                    Button("Copy message") { UIPasteboard.general.string = tip.narrative }
                    Button("Browser") {
                        status = "Browser fallback: paste both fields, choose anonymous and Other, then review and submit there."
                        openURL(CrimewatchForm.url)
                    }
                }.font(.caption).buttonStyle(.bordered)
                CrimewatchForm(tip: tip, status: $status)
            }
            .navigationTitle("[TEST] CBPD CRIMEWATCH")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        }
    }
}

private struct CrimewatchForm: UIViewRepresentable {
    static let url = URL(string: "https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip")!
    let tip: PreparedPoliceTip
    @Binding var status: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: Self.url))
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: CrimewatchForm
        init(_ parent: CrimewatchForm) { self.parent = parent }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard action.targetFrame?.isMainFrame != false else { decisionHandler(.allow); return }
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "https", url.host == "crimewatch.net", url.user == nil,
               url.port == nil || url.port == 443 {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                if action.navigationType == .linkActivated, ["https", "tel"].contains(url.scheme ?? "") {
                    UIApplication.shared.open(url)
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard let url = webView.url, url.scheme == "https", url.host == "crimewatch.net",
                  url.user == nil, url.port == nil || url.port == 443,
                  url.path == CrimewatchForm.url.path || url.path == CrimewatchForm.url.path + "/" else {
                parent.status = "Official website — read its response to determine whether your tip was received."
                return
            }
            guard let scriptURL = Bundle.main.url(forResource: "crimewatch-test-autofill", withExtension: "js"),
                  let script = try? String(contentsOf: scriptURL, encoding: .utf8),
                  let data = try? JSONSerialization.data(withJSONObject: [
                    "subject": TestTipText.mark(parent.tip.subject),
                    "message": TestTipText.mark(parent.tip.narrative)
                  ]), let payload = String(data: data, encoding: .utf8) else {
                parent.status = "Autofill unavailable. Use Copy subject and Copy message, then review the official form."
                return
            }
            webView.evaluateJavaScript(script + "(" + payload + ");") { result, error in
                if error == nil, let result = result as? String, ["filled", "already-filled"].contains(result) {
                    self.parent.status = "[TEST] Filled: Anonymous, Other, subject and message. Review, personally accept the agreement, complete any CAPTCHA, and press Submit when ready."
                } else {
                    self.parent.status = "Autofill unavailable or this is a response page. Review the page below. Copy controls are available for manual entry. ColumbiaWalks cannot confirm receipt."
                }
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.status = "The official form could not load. Check your connection or use Browser. No submission is confirmed."
        }
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
