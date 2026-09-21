import Combine
import Foundation

@MainActor
final class FeedbackService: ObservableObject {
    @Published private(set) var isSubmitting = false
    @Published var lastMessage: String?

    private let fileManager = FileManager.default

    func enqueue(_ submission: FeedbackSubmission) throws {
        let url = queueURL(for: submission.id)
        let directory = url.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)
        let data = try JSONEncoder.persistence.encode(submission)
        guard data.count <= 64 * 1024 else { throw QueueError.tooLarge }
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        lastMessage = "Feedback saved privately and queued for secure submission."
        Task { await submitPending() }
    }

    func submitPending() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        for url in pendingFiles() {
            guard let data = try? Data(contentsOf: url),
                  let submission = try? JSONDecoder.persistence.decode(FeedbackSubmission.self, from: data)
            else {
                try? fileManager.removeItem(at: url)
                continue
            }
            do {
                try await APIClient.shared.submit(feedback: submission)
                try? fileManager.removeItem(at: url)
            } catch {
                // Preserve the local copy even for a 4xx response. A client/server
                // rollout can briefly make an otherwise valid payload unsupported.
                continue
            }
        }
    }

    private func pendingFiles() -> [URL] {
        let directory = queueDirectory
        return (try? fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" }) ?? []
    }

    private func queueURL(for id: UUID) -> URL {
        queueDirectory.appendingPathComponent(id.uuidString.lowercased()).appendingPathExtension("json")
    }

    private var queueDirectory: URL {
        fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ColumbiaWalks/FeedbackQueue", isDirectory: true)
    }

    enum QueueError: LocalizedError {
        case tooLarge
        var errorDescription: String? { "The feedback is too large to queue." }
    }
}

