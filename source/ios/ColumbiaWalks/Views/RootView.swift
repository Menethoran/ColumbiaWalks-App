import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            MapScreen()
                .tabItem { Label("Map", systemImage: "map") }
                .tag(AppState.Tab.map)

            ReportFormView()
                .tabItem { Label("Report", systemImage: "exclamationmark.bubble") }
                .tag(AppState.Tab.report)

            RepeatReportView()
                .tabItem { Label("Repeat", systemImage: "repeat.circle") }
                .tag(AppState.Tab.repeatReport)

            SavedReportsView()
                .tabItem { Label("Saved", systemImage: "tray.full") }
                .tag(AppState.Tab.saved)

            CommunityView()
                .tabItem { Label("Community", systemImage: "person.3") }
                .tag(AppState.Tab.community)
        }
        .background(Color.cwSurface.ignoresSafeArea())
        .preferredColorScheme(.light)
    }
}

extension View {
    func columbiaWalksScrollSurface() -> some View {
        scrollContentBackground(.hidden)
            .background(Color.cwSurface)
    }
}

struct AppHeader: View {
    let title: String
    let subtitle: String?

    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        HStack(spacing: 14) {
            Image("BrandBadge")
                .resizable()
                .scaledToFit()
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(Color.cwBlueDark)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(Color.cwTextSecondary)
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct EmergencyNotice: View {
    var body: some View {
        Label {
            Text("If someone is in immediate danger or needs urgent medical help, call 911. This app does not contact emergency services.")
                .font(.footnote)
        } icon: {
            Image(systemName: "phone.fill")
        }
        .foregroundStyle(Color.cwError)
        .padding(12)
        .background(Color.cwError.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}
