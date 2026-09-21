import SwiftUI

@main
struct ColumbiaWalksApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var appState = AppState()
    @StateObject private var reports = ReportStore()
    @StateObject private var feedback = FeedbackService()
    @StateObject private var trashCans = TrashCanService()
    @StateObject private var location = LocationService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(reports)
                .environmentObject(feedback)
                .environmentObject(trashCans)
                .environmentObject(location)
                .tint(.cwGreen)
                .task {
                    await reports.submitPending()
                    await feedback.submitPending()
                    await trashCans.submitPending()
                }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task {
                await reports.submitPending()
                await feedback.submitPending()
                await trashCans.submitPending()
            }
        }
    }
}
