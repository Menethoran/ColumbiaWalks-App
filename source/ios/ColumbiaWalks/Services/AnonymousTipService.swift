import Combine
import Foundation

@MainActor
final class AnonymousTipService: ObservableObject {
    @Published private(set) var pending: AnonymousTipSubmission?
    @Published private(set) var busy = false
    @Published private(set) var completed = false
    @Published private(set) var message = ""
    private let fileManager = FileManager.default
    private let redirectGuard = TipRedirectGuard()
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCache = nil
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 40
        return URLSession(configuration: config, delegate: redirectGuard, delegateQueue: nil)
    }()
    private var pendingURL: URL {
        fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ColumbiaWalks/AnonymousTipTests/pending.json")
    }
    init() {
        if fileManager.fileExists(atPath: pendingURL.path) {
            do {
                let values = try pendingURL.resourceValues(forKeys: [.fileSizeKey])
                guard (values.fileSize ?? Int.max) <= 128 * 1024 else { throw CocoaError(.fileReadCorruptFile) }
                pending = try JSONDecoder().decode(AnonymousTipSubmission.self, from: Data(contentsOf: pendingURL))
                message = "[TEST] A saved test is awaiting confirmation. Retry sends the same marked test."
            } catch { message = "[TEST] The saved test could not be read. No delivery is confirmed." }
        }
    }
    func submit(_ submission: AnonymousTipSubmission) async {
        guard !busy, !completed else { return }
        do {
            if pending == nil {
                let data = try JSONEncoder().encode(submission)
                guard data.count <= 128 * 1024 else { throw CocoaError(.fileWriteUnknown) }
                var directory = pendingURL.deletingLastPathComponent()
                try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
                var values = URLResourceValues(); values.isExcludedFromBackup = true
                try directory.setResourceValues(values)
                try data.write(to: pendingURL, options: [.atomic, .completeFileProtection])
                pending = submission
            }
        } catch {
            message = "[TEST] Could not save this test on your device. Nothing was sent."
            return
        }
        guard let saved = pending else { return }
        busy = true
        defer { busy = false }
        message = "[TEST] Sending to private ColumbiaWalks test intake…"
        do {
            var request = URLRequest(url: URL(string: "https://directus.rndtech.org/columbiawalks-api/anonymous-tip-tests")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.httpBody = try JSONEncoder().encode(saved)
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, [200, 201].contains(http.statusCode), data.count <= 16384 else {
                throw CocoaError(.fileReadUnknown)
            }
            let receipt = try JSONDecoder().decode(AnonymousTipReceipt.self, from: data)
            let reference = try receipt.verifiedReference(for: saved)
            try fileManager.removeItem(at: pendingURL)
            pending = nil
            completed = true
            message = "[TEST] Saved to private ColumbiaWalks test intake. Police were not contacted.\n\(reference)"
        } catch {
            message = "[TEST] Storage is not confirmed. The marked test is saved on this device. Retry this same test when intake is available; police were not contacted."
        }
    }
    func discard() {
        guard !busy else { return }
        do {
            if fileManager.fileExists(atPath: pendingURL.path) { try fileManager.removeItem(at: pendingURL) }
            pending = nil; completed = false
            message = "[TEST] Local pending copy removed. This does not remove a test already stored by the server."
        } catch { message = "[TEST] The local pending copy could not be removed." }
    }
}

private final class TipRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
