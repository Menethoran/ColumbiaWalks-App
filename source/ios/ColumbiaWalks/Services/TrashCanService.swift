import Combine
import Foundation

@MainActor
final class TrashCanService: ObservableObject {
    @Published private(set) var isSubmitting = false
    @Published var lastMessage: String?

    private let fileManager = FileManager.default
    private var needsAnotherPass = false

    private struct PhotoQueueEntry: Codable {
        let submission: TrashCanSubmission
        let hasPhoto: Bool
    }

    func enqueue(_ submission: TrashCanSubmission, photoData: Data? = nil) throws {
        let url = queueURL(for: submission.id)
        let directory = url.deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)

        let data: Data
        if photoData == nil {
            data = try JSONEncoder.api.encode(submission)
        } else {
            data = try JSONEncoder.api.encode(PhotoQueueEntry(submission: submission, hasPhoto: true))
        }
        guard data.count <= 64 * 1024 else { throw QueueError.tooLarge }
        if let photoData {
            let normalizedPhoto = try PhotoStore.normalizedData(photoData)
            guard normalizedPhoto.count <= 10 * 1024 * 1024 else { throw QueueError.tooLarge }
            try normalizedPhoto.write(to: photoURL(for: submission.id), options: [.atomic, .completeFileProtection])
        }
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        lastMessage = "Trash-can submission saved locally and queued for secure submission."
        needsAnotherPass = true
        Task { await submitPending() }
    }

    func submitPending() async {
        guard !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        repeat {
            needsAnotherPass = false
            for url in pendingFiles() {
                guard let data = try? Data(contentsOf: url) else { continue }
                let entry = try? JSONDecoder().decode(PhotoQueueEntry.self, from: data)
                guard let submission = entry?.submission
                    ?? (try? JSONDecoder().decode(TrashCanSubmission.self, from: data)) else { continue }
                let photo = entry?.hasPhoto == true ? photoURL(for: submission.id) : nil
                if let photo, !fileManager.fileExists(atPath: photo.path) { continue }

                do {
                    try await APIClient.shared.submit(trashCan: submission, photoURL: photo)
                    try fileManager.removeItem(at: url)
                    if let photo { try? fileManager.removeItem(at: photo) }
                } catch {
                    // Keep the submission and photo together until accepted.
                    continue
                }
            }
        } while needsAnotherPass
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

    private func photoURL(for id: UUID) -> URL {
        queueURL(for: id).deletingPathExtension().appendingPathExtension("jpg")
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
