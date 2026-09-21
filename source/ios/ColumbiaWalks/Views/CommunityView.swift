import SwiftUI

struct CommunityView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    AppHeader(
                        "Community",
                        subtitle: "Contact ColumbiaWalks, prepare police tips, report cans, and share app feedback"
                    )
                }

                Section("Community tools") {
                    NavigationLink {
                        ContactUsView()
                    } label: {
                        CommunityDestinationLabel(
                            title: "Contact Us",
                            detail: "Call or text Robert, or send a private message through ColumbiaWalks.",
                            systemImage: "person.crop.circle.badge.questionmark"
                        )
                    }

                    NavigationLink {
                        PoliceTipView()
                    } label: {
                        CommunityDestinationLabel(
                            title: "Prepare an Anonymous Police Tip",
                            detail: "Create a local-only draft, then continue on Columbia Police's official site.",
                            systemImage: "shield.lefthalf.filled"
                        )
                    }

                    NavigationLink {
                        TrashCanView()
                    } label: {
                        CommunityDestinationLabel(
                            title: "Trash Cans",
                            detail: "Comment on public cans or privately report a can concern.",
                            systemImage: "trash"
                        )
                    }

                    NavigationLink {
                        FeedbackView()
                    } label: {
                        CommunityDestinationLabel(
                            title: "App Feedback",
                            detail: "Tell ColumbiaWalks what works, what does not, or what to add.",
                            systemImage: "text.bubble"
                        )
                    }
                }

                Section {
                    Text("ColumbiaWalks is an independent community app. It does not dispatch police or emergency services and does not automatically forward trash-can complaints to Columbia Borough.")
                        .font(.footnote)
                        .foregroundStyle(Color.cwTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .columbiaWalksScrollSurface()
            .navigationTitle("Community")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct ContactUsView: View {
    private static let phoneDisplay = "(717) 466-9069"
    private static let phoneDigits = "7174669069"

    var body: some View {
        List {
            Section {
                AppHeader(
                    "Contact Us",
                    subtitle: "Reach ColumbiaWalks about a report, the app, or the project"
                )
                Text("Robert is the current ColumbiaWalks contact.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section("Phone") {
                LabeledContent("Robert", value: Self.phoneDisplay)
                Link(destination: URL(string: "tel:\(Self.phoneDigits)")!) {
                    Label("Call Robert", systemImage: "phone.fill")
                }
                Link(destination: URL(string: "sms:\(Self.phoneDigits)")!) {
                    Label("Text Robert", systemImage: "message.fill")
                }
            }

            Section("Private ColumbiaWalks message") {
                NavigationLink {
                    FeedbackView()
                } label: {
                    Label("Send app or project feedback", systemImage: "text.bubble.fill")
                }
                Text("Messages use the private ColumbiaWalks feedback path. Include a report ID when you are following up about a saved submission.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
            }

            Section {
                Text("ColumbiaWalks is independent from Columbia Borough and CBPD. This contact path does not dispatch emergency services or file a police report. Call 911 for an emergency or an incident in progress.")
                    .font(.footnote)
                    .foregroundStyle(Color.cwTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .columbiaWalksScrollSurface()
        .navigationTitle("Contact Us")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct CommunityDestinationLabel: View {
    let title: String
    let detail: String
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(Color.cwGreen)
                .frame(width: 30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(Color.cwText)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(Color.cwTextSecondary)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 4)
    }
}
