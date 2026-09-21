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
