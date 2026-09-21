import Foundation
import UIKit

enum PhotoStore {
    static func saveNormalized(_ sourceData: Data, reportID: UUID) throws -> String {
        guard let image = UIImage(data: sourceData) else {
            throw PhotoError.invalidImage
        }
        let maximumDimension: CGFloat = 2048
        let scale = min(1, maximumDimension / max(image.size.width, image.size.height))
        let target = CGSize(
            width: max(1, image.size.width * scale),
            height: max(1, image.size.height * scale)
        )
        let format = UIGraphicsImageRendererFormat()
        format.opaque = true
        format.scale = 1
        let normalized = UIGraphicsImageRenderer(size: target, format: format).image { context in
            UIColor.white.setFill()
            context.cgContext.fill(CGRect(origin: .zero, size: target))
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        guard let data = normalized.jpegData(compressionQuality: 0.82) else {
            throw PhotoError.invalidImage
        }
        let filename = "\(reportID.uuidString.lowercased()).jpg"
        let destination = url(for: filename)
        let directory = destination.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)
        try data.write(to: destination, options: [.atomic, .completeFileProtection])
        return filename
    }

    static func url(for filename: String) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ColumbiaWalks/Photos", isDirectory: true)
            .appendingPathComponent(filename)
    }

    enum PhotoError: LocalizedError {
        case invalidImage
        var errorDescription: String? { "That photo could not be prepared. Try another image." }
    }
}

