import CoreLocation
import Foundation
import SwiftUI

enum ScreenshotConfiguration {
    static var isEnabled: Bool {
#if DEBUG
        ProcessInfo.processInfo.arguments.contains("--app-store-screenshots")
#else
        false
#endif
    }
}

@MainActor
final class AppState: ObservableObject {
    enum Tab: Hashable {
        case map
        case report
        case repeatReport
        case saved
        case community
    }

    nonisolated static let columbiaCenter = CLLocationCoordinate2D(
        latitude: 40.0337,
        longitude: -76.5044
    )

    @Published var selectedTab: Tab = .map
    @Published private(set) var reportLocation = ReportLocationDraft()
    @Published var nearestIntersection: IntersectionEstimate?
    @Published var intersectionLookupInProgress = false
    private var intersectionTask: Task<Void, Never>?

    init() {
        guard ScreenshotConfiguration.isEnabled else { return }

        let coordinate = CLLocationCoordinate2D(latitude: 40.03352, longitude: -76.50486)
        var draft = ReportLocationDraft()
        draft.useManual(coordinate, source: .manualMap)
        reportLocation = draft
        nearestIntersection = IntersectionEstimate(
            label: "Locust Street & North 3rd Street",
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            distanceMeters: 18,
            major: true
        )
    }

    var reportCoordinate: CLLocationCoordinate2D {
        reportLocation.coordinate ?? Self.columbiaCenter
    }

    var locationConfirmed: Bool { reportLocation.isConfirmed }

    func selectLocation(
        _ coordinate: CLLocationCoordinate2D,
        source: ReportLocationSource = .manualMap
    ) {
        var draft = reportLocation
        switch source {
        case .photoEXIF:
            draft.usePhoto(coordinate)
        case .deviceGPS:
            draft.useDevice(coordinate)
        case .manualMap, .manualCoordinates:
            draft.useManual(coordinate, source: source)
        case .none, .legacy:
            draft.useManual(coordinate, source: .manualMap)
        }
        reportLocation = draft
        lookupIntersection(at: coordinate)
    }

    @discardableResult
    func useDeviceLocationFallback(_ coordinate: CLLocationCoordinate2D) -> Bool {
        var draft = reportLocation
        guard draft.useDeviceFallback(coordinate) else { return false }
        reportLocation = draft
        lookupIntersection(at: coordinate)
        return true
    }

    func notePhotoLocation(_ coordinate: CLLocationCoordinate2D?) {
        var draft = reportLocation
        if let coordinate {
            draft.usePhoto(coordinate)
            reportLocation = draft
            lookupIntersection(at: coordinate)
        } else {
            draft.notePhotoWithoutLocation()
            reportLocation = draft
            if !draft.isConfirmed { clearIntersection() }
        }
    }

    func removePhotoProvenance() {
        var draft = reportLocation
        draft.removePhotoProvenance()
        reportLocation = draft
        if !draft.isConfirmed { clearIntersection() }
    }

    func resetReportLocation() {
        reportLocation.reset()
        clearIntersection()
    }

    private func lookupIntersection(at coordinate: CLLocationCoordinate2D) {
        intersectionTask?.cancel()
        nearestIntersection = nil
        intersectionLookupInProgress = true
        intersectionTask = Task { [weak self] in
            let estimate = try? await APIClient.shared.nearestIntersection(at: coordinate)
            guard !Task.isCancelled, let self else { return }
            guard self.reportCoordinate.latitude == coordinate.latitude,
                  self.reportCoordinate.longitude == coordinate.longitude else { return }
            self.nearestIntersection = estimate
            self.intersectionLookupInProgress = false
        }
    }

    private func clearIntersection() {
        intersectionTask?.cancel()
        intersectionTask = nil
        nearestIntersection = nil
        intersectionLookupInProgress = false
    }
}

extension Color {
    static let cwBlue = Color(red: 30 / 255, green: 90 / 255, blue: 122 / 255)
    static let cwBlueDark = Color(red: 18 / 255, green: 62 / 255, blue: 85 / 255)
    static let cwGreen = Color(red: 39 / 255, green: 110 / 255, blue: 72 / 255)
    static let cwGold = Color(red: 242 / 255, green: 181 / 255, blue: 68 / 255)
    static let cwSurface = Color(red: 251 / 255, green: 253 / 255, blue: 252 / 255)
    static let cwText = Color(red: 16 / 255, green: 24 / 255, blue: 28 / 255)
    static let cwTextSecondary = Color(red: 61 / 255, green: 75 / 255, blue: 82 / 255)
    static let cwError = Color(red: 179 / 255, green: 38 / 255, blue: 30 / 255)
    static let cwWarning = Color(red: 122 / 255, green: 75 / 255, blue: 0 / 255)
}
