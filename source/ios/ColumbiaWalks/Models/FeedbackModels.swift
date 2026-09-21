import Foundation

enum FeedbackCategory: String, Codable, CaseIterable, Identifiable {
    case appFeedback = "app_feedback"
    case featureRequest = "feature_request"
    case bugReport = "bug_report"
    case other

    var id: String { rawValue }
    var label: String {
        switch self {
        case .appFeedback: "App Feedback"
        case .featureRequest: "Feature Request"
        case .bugReport: "Bug Report"
        case .other: "Other"
        }
    }
}

struct FeedbackSubmission: Codable, Identifiable {
    let id: UUID
    let feedbackCategory: FeedbackCategory
    let feedbackText: String
    let appVersion: String
    let submissionSource: String
    let contactInformationOffered: Bool
    let contactName: String
    let contactPhone: String
    let contactEmail: String
    let contactStreetAddress: String
    let contactNotes: String
    let consentToContact: Bool

    enum CodingKeys: String, CodingKey {
        case id = "feedback_id"
        case feedbackCategory = "feedback_category"
        case feedbackText = "feedback_text"
        case appVersion = "app_version"
        case submissionSource = "submission_source"
        case contactInformationOffered = "contact_information_offered"
        case contactName = "contact_name"
        case contactPhone = "contact_phone"
        case contactEmail = "contact_email"
        case contactStreetAddress = "contact_street_address"
        case contactNotes = "contact_notes"
        case consentToContact = "consent_to_contact"
    }
}

