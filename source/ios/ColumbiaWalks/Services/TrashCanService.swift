import Combine
import Foundation

@MainActor
final class TrashCanService: ObservableObject {
    @Published private(set) var isSubmitting = false
    @Published var lastMessage: String?

    private let fileManager = FileManager.default

    func enqueue(_ submission: TrashCanSubmission) throws {
        let url = queueURL(for: submission.id)
        let directory = url.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)

        let data = try JSONEncoder.api.encode(submission)
        guard data.count <= 64 * 1024 else { throw QueueError.tooLarge }
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        lastMessage = "Trash-can submission saved locally and queued for secure submission."
        Task { await submitPending() }
    }

    func submitPending() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        for url in pendingFiles() {
            guard let data = try? Data(contentsOf: url),
                  let submission = try? JSONDecoder().decode(TrashCanSubmission.self, from: data)
            else {
                try? fileManager.removeItem(at: url)
                continue
            }

            do {
                try await APIClient.shared.submit(trashCan: submission)
                try? fileManager.removeItem(at: url)
            } catch {
                // Keep every valid local submission for a later launch/foreground retry.
                continue
            }
        }
    }

    private func pendingFiles() -> [URL] {
        (try? fileManager.contentsOfDirectory(
            at: queueDirectory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" }) ?? []
    }

    private func queueURL(for id: UUID) -> URL {
        queueDirectory
            .appendingPathComponent(id.uuidString.lowercased())
            .appendingPathExtension("json")
    }

    private var queueDirectory: URL {
        fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ColumbiaWalks/TrashCanQueue", isDirectory: true)
    }

    enum QueueError: LocalizedError {
        case tooLarge

        var errorDescription: String? {
            "The trash-can submission is too large to queue."
        }
    }
}
