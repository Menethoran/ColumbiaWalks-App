import SwiftUI

struct CommunityView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    AppHeader(
                        "Community",
                        subtitle: "Police-tip preparation, trash-can comments, and app feedback"
                    )
                }

                Section("Community tools") {
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
