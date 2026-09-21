import Foundation
import CoreLocation

enum ReportValidator {
    static func validate(
        mode: ReportMode,
        categories: Set<IssueCategory>,
        otherDetails: String,
        details: String,
        locationConfirmed: Bool
    ) -> String? {
        if mode == .full && categories.isEmpty {
            return "Select at least one issue type for a Full Report."
        }
        if categories.contains(.notIncludedElsewhere)
            && otherDetails.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Add a short description for Not included elsewhere."
        }
        if mode == .full && !locationConfirmed {
            return "Choose a report location on the map for a Full Report."
        }
        if details.count > 1_500 {
            return "Additional information must be 1,500 characters or fewer."
        }
        return nil
    }
}

enum FeedbackValidator {
    static func validate(category: FeedbackCategory?, text: String, email: String) -> String? {
        guard category != nil else { return "Select a reason for your feedback." }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Enter your feedback before submitting." }
        guard trimmed.count <= 5_000 else { return "Feedback must be 5,000 characters or fewer." }
        let validEmail = email.isEmpty
            || email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
        return validEmail ? nil : "Enter a valid email address or leave it blank."
    }
}

enum CoordinateValidator {
    static func coordinate(latitude: String, longitude: String) -> CLLocationCoordinate2D? {
        let latitudeText = latitude.trimmingCharacters(in: .whitespacesAndNewlines)
        let longitudeText = longitude.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let latitude = Double(latitudeText),
              let longitude = Double(longitudeText),
              latitude.isFinite,
              longitude.isFinite,
              (-90...90).contains(latitude),
              (-180...180).contains(longitude) else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

enum RapidReportValidator {
    static func validate(
        hasPhoto: Bool,
        location: ReportLocationDraft,
        comments: String
    ) -> String? {
        guard hasPhoto else { return "Take or choose a picture before submitting." }
        guard location.isConfirmed else {
            return "Confirm a location from the picture, device GPS, or manual coordinates."
        }
        guard comments.count <= 1_500 else {
            return "Comments must be 1,500 characters or fewer."
        }
        return nil
    }
}
