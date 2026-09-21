import Combine
import Foundation

@MainActor
final class ReportStore: ObservableObject {
    @Published private(set) var reports: [SafetyReport] = []
    @Published private(set) var isSubmitting = false

    private let fileManager = FileManager.default
    private let storeURL: URL
    private let maxAutomaticAttempts = 8

    init() {
        storeURL = Self.applicationSupportDirectory()
            .appendingPathComponent("reports.json")
        if ScreenshotConfiguration.isEnabled {
            reports = Self.screenshotFixtures
            return
        }
        reports = Self.load(from: storeURL)
        for index in reports.indices where reports[index].submissionStatus == .submitting {
            reports[index].submissionStatus = .pending
        }
        try? persist()
    }

    func add(_ report: SafetyReport) throws {
        reports.insert(report, at: 0)
        do {
            try persist()
        } catch {
            reports.removeAll { $0.id == report.id }
            throw error
        }
        Task { await submitPending() }
    }

    func delete(_ report: SafetyReport) {
        reports.removeAll { $0.id == report.id }
        if let photoFilename = report.photoFilename {
            try? fileManager.removeItem(at: PhotoStore.url(for: photoFilename))
        }
        try? persist()
    }

    func retry(_ report: SafetyReport) {
        guard let index = reports.firstIndex(where: { $0.id == report.id }) else { return }
        reports[index].submissionStatus = .pending
        reports[index].lastSubmissionError = nil
        reports[index].submissionAttempts = 0
        try? persist()
        Task { await submitPending() }
    }

    func submitPending() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        var drain = PendingSubmissionDrain()
        while true {
            let ids = drain.takeNextIDs(from: reports)
            guard !ids.isEmpty else { break }
            for id in ids {
                await submit(id: id)
            }
        }
    }

    private func submit(id: UUID) async {
        guard let startIndex = reports.firstIndex(where: { $0.id == id }) else { return }
        reports[startIndex].submissionStatus = .submitting
        reports[startIndex].lastSubmissionAttempt = Date()
        reports[startIndex].submissionAttempts += 1
        let report = reports[startIndex]
        try? persist()

        do {
            let photoURL: URL?
            if let photoFilename = report.photoFilename {
                let candidate = PhotoStore.url(for: photoFilename)
                guard fileManager.fileExists(atPath: candidate.path) else {
                    throw SubmissionPreparationError.photoUnavailable
                }
                photoURL = candidate
            } else {
                photoURL = nil
            }
            let submission = try await APIClient.shared.submit(
                report: report,
                photoURL: photoURL
            )
            guard let index = reports.firstIndex(where: { $0.id == id }) else { return }
            reports[index].submissionStatus = .submitted
            reports[index].remoteID = submission.remoteID
            reports[index].officialEmailServerState = submission.officialEmailServerState
            reports[index].lastSubmissionError = nil
        } catch {
            guard let index = reports.firstIndex(where: { $0.id == id }) else { return }
            let apiError = error as? APIError
            let retryable: Bool
            if let apiError {
                retryable = apiError.isRetryable
            } else if error is SubmissionPreparationError {
                retryable = false
            } else {
                retryable = true
            }
            reports[index].submissionStatus = retryable && reports[index].submissionAttempts < maxAutomaticAttempts
                ? .pending
                : .failed
            reports[index].lastSubmissionError = error.localizedDescription
        }
        try? persist()
    }

    private func persist() throws {
        let directory = storeURL.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)
        let data = try JSONEncoder.persistence.encode(reports)
        try data.write(to: storeURL, options: [.atomic, .completeFileProtection])
    }

    private static func load(from url: URL) -> [SafetyReport] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder.persistence.decode([SafetyReport].self, from: data)) ?? []
    }

    private static func applicationSupportDirectory() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ColumbiaWalks", isDirectory: true)
    }

    private static var screenshotFixtures: [SafetyReport] {
        let intersection = IntersectionEstimate(
            label: "Locust Street & North 3rd Street",
            latitude: 40.03352,
            longitude: -76.50486,
            distanceMeters: 18,
            major: true
        )
        let calendar = Calendar(identifier: .gregorian)
        let observedAt = calendar.date(
            from: DateComponents(
                timeZone: TimeZone(identifier: "America/New_York"),
                year: 2026,
                month: 9,
                day: 20,
                hour: 16,
                minute: 12
            )
        ) ?? Date(timeIntervalSince1970: 1_790_000_000)

        return [
            SafetyReport(
                id: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000001")!,
                clientReportID: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000001")!,
                createdAt: observedAt,
                observedAt: observedAt,
                categories: [.crosswalkSafety],
                severity: .medium,
                policeResponse: .notInvolved,
                details: "Vehicle stopped across the marked pedestrian path.",
                checklistResponses: [:],
                reportedParty: .civilianDriver,
                vehicleInvolved: true,
                vehicleDetails: VehicleDetails(),
                policeObservations: [],
                policeComplaintDetails: "",
                submissionMode: .quick,
                quickReportTypes: [.crosswalkEncroachment],
                nearestIntersection: intersection,
                latitude: 40.03352,
                longitude: -76.50486,
                locationSource: .manualMap,
                submissionStatus: .submitted,
                remoteID: "CW-31601-DEMO-001",
                lastSubmissionError: nil,
                lastSubmissionAttempt: observedAt,
                submissionAttempts: 1
            ),
            SafetyReport(
                id: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000002")!,
                clientReportID: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000002")!,
                createdAt: observedAt.addingTimeInterval(-2_700),
                observedAt: observedAt.addingTimeInterval(-2_700),
                categories: [.sidewalkSafety],
                severity: .medium,
                policeResponse: .notInvolved,
                details: "Missing sidewalk creates an unsafe walking route.",
                checklistResponses: [:],
                reportedParty: .unknown,
                vehicleInvolved: false,
                vehicleDetails: VehicleDetails(),
                policeObservations: [],
                policeComplaintDetails: "",
                submissionMode: .quick,
                quickReportTypes: [.missingSidewalk],
                nearestIntersection: IntersectionEstimate(
                    label: "Walnut Street & North 4th Street",
                    latitude: 40.03517,
                    longitude: -76.50291,
                    distanceMeters: 24,
                    major: false
                ),
                latitude: 40.03517,
                longitude: -76.50291,
                locationSource: .manualMap,
                submissionStatus: .submitted,
                remoteID: "CW-31601-DEMO-002",
                lastSubmissionError: nil,
                lastSubmissionAttempt: observedAt.addingTimeInterval(-2_700),
                submissionAttempts: 1
            ),
            SafetyReport(
                id: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000003")!,
                clientReportID: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000003")!,
                createdAt: observedAt.addingTimeInterval(-5_400),
                observedAt: observedAt.addingTimeInterval(-5_400),
                categories: [.vehicleSafety],
                severity: .high,
                policeResponse: .notInvolved,
                details: "Driver did not yield while a pedestrian was entering the crosswalk.",
                checklistResponses: [:],
                reportedParty: .civilianDriver,
                vehicleInvolved: true,
                vehicleDetails: VehicleDetails(),
                policeObservations: [],
                policeComplaintDetails: "",
                submissionMode: .quick,
                quickReportTypes: [],
                nearestIntersection: intersection,
                rapidReportKind: .vehicle,
                vehicleIssueType: .failureToYield,
                latitude: 40.03352,
                longitude: -76.50486,
                locationSource: .deviceGPS,
                photoFilename: "screenshot-fixture.jpg",
                submissionStatus: .submitted,
                remoteID: "CW-31601-DEMO-003",
                lastSubmissionError: nil,
                lastSubmissionAttempt: observedAt.addingTimeInterval(-5_400),
                submissionAttempts: 1
            ),
            SafetyReport(
                id: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000004")!,
                clientReportID: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000004")!,
                createdAt: observedAt.addingTimeInterval(-8_100),
                observedAt: observedAt.addingTimeInterval(-8_100),
                categories: [.notIncludedElsewhere],
                severity: .medium,
                policeResponse: .notInvolved,
                details: "Submitted for administrator review before any public use.",
                checklistResponses: [:],
                reportedParty: .unknown,
                vehicleInvolved: false,
                vehicleDetails: VehicleDetails(),
                policeObservations: [],
                policeComplaintDetails: "",
                submissionMode: .pos,
                quickReportTypes: [],
                nearestIntersection: intersection,
                latitude: 40.03352,
                longitude: -76.50486,
                locationSource: .photoEXIF,
                photoLatitude: 40.03352,
                photoLongitude: -76.50486,
                photoFilename: "screenshot-fixture.jpg",
                submissionStatus: .submitted,
                remoteID: "CW-31601-DEMO-004",
                lastSubmissionError: nil,
                lastSubmissionAttempt: observedAt.addingTimeInterval(-8_100),
                submissionAttempts: 1
            ),
            SafetyReport(
                id: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000005")!,
                clientReportID: UUID(uuidString: "7D9119B4-7A42-4B18-91C0-316010000005")!,
                createdAt: observedAt.addingTimeInterval(-10_800),
                observedAt: observedAt.addingTimeInterval(-10_800),
                categories: [.tripHazards],
                severity: .medium,
                policeResponse: .notInvolved,
                details: "Raised pavement edge along the walking route.",
                checklistResponses: [:],
                reportedParty: .unknown,
                vehicleInvolved: false,
                vehicleDetails: VehicleDetails(),
                policeObservations: [],
                policeComplaintDetails: "",
                submissionMode: .quick,
                quickReportTypes: [.tripHazard],
                nearestIntersection: intersection,
                latitude: 40.03352,
                longitude: -76.50486,
                locationSource: .manualMap,
                submissionStatus: .submitted,
                remoteID: "CW-31601-DEMO-005",
                lastSubmissionError: nil,
                lastSubmissionAttempt: observedAt.addingTimeInterval(-10_800),
                submissionAttempts: 1
            )
        ]
    }
}

struct PendingSubmissionDrain {
    private var attemptedIDs: Set<UUID> = []

    mutating func takeNextIDs(from reports: [SafetyReport]) -> [UUID] {
        let ids = reports.compactMap { report -> UUID? in
            guard !attemptedIDs.contains(report.id),
                  report.submissionStatus == .pending || report.submissionStatus == .submitting else {
                return nil
            }
            return report.id
        }
        attemptedIDs.formUnion(ids)
        return ids
    }
}

private enum SubmissionPreparationError: LocalizedError {
    case photoUnavailable

    var errorDescription: String? {
        "The saved photo is no longer available. Delete this report and create it again with a new photo."
    }
}

extension JSONEncoder {
    static var persistence: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }
}

extension JSONDecoder {
    static var persistence: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
