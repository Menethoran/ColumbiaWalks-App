import Foundation

enum TrashCanSubmissionKind: String, Codable, CaseIterable, Identifiable {
    case publicComment = "public_comment"
    case privateComplaint = "private_complaint"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .publicComment: "Public comment"
        case .privateComplaint: "Private complaint"
        }
    }

    var categoryOptions: [TrashCanCategoryOption] {
        switch self {
        case .publicComment:
            TrashCanPublicCommentCategory.allCases.map {
                TrashCanCategoryOption(id: $0.rawValue, label: $0.label)
            }
        case .privateComplaint:
            TrashCanPrivateComplaintCategory.allCases.map {
                TrashCanCategoryOption(id: $0.rawValue, label: $0.label)
            }
        }
    }

    func permits(categoryKey: String) -> Bool {
        categoryOptions.contains { $0.id == categoryKey }
    }
}

struct TrashCanCategoryOption: Identifiable, Equatable {
    let id: String
    let label: String
}

enum TrashCanPublicCommentCategory: String, Codable, CaseIterable {
    case cleanWellMaintained = "clean_well_maintained"
    case needsCleaning = "needs_cleaning"
    case fullOrOverflowing = "full_or_overflowing"
    case damaged
    case hardToAccess = "hard_to_access"
    case poorLocation = "poor_location"
    case requestNewCan = "request_new_can"
    case other

    var label: String {
        switch self {
        case .cleanWellMaintained: "Clean / well maintained"
        case .needsCleaning: "Needs cleaning"
        case .fullOrOverflowing: "Full or overflowing"
        case .damaged: "Damaged"
        case .hardToAccess: "Hard to access"
        case .poorLocation: "Poor location"
        case .requestNewCan: "Request a new can"
        case .other: "Other"
        }
    }
}

enum TrashCanPrivateComplaintCategory: String, Codable, CaseIterable {
    case fullOrOverflowing = "full_or_overflowing"
    case damaged
    case missing
    case odorOrPests = "odor_or_pests"
    case illegalDumping = "illegal_dumping"
    case unsafeOrObstructing = "unsafe_or_obstructing"
    case missedService = "missed_service"
    case other

    var label: String {
        switch self {
        case .fullOrOverflowing: "Full or overflowing"
        case .damaged: "Damaged"
        case .missing: "Missing"
        case .odorOrPests: "Odor or pests"
        case .illegalDumping: "Illegal dumping"
        case .unsafeOrObstructing: "Unsafe or obstructing"
        case .missedService: "Missed service"
        case .other: "Other"
        }
    }
}

enum TrashCanAssetScope: String, Codable, CaseIterable, Identifiable {
    case publicProperty = "public"
    case privateProperty = "private_property"
    case unknown

    var id: String { rawValue }

    var label: String {
        switch self {
        case .publicProperty: "Public property"
        case .privateProperty: "Private property"
        case .unknown: "Unknown"
        }
    }
}

struct TrashCanSubmission: Codable, Identifiable, Equatable {
    let id: UUID
    let kind: TrashCanSubmissionKind
    let categories: [String]
    let comment: String
    let address: String
    let latitude: Double?
    let longitude: Double?
    let assetScope: TrashCanAssetScope
    let appVersion: String
    let submissionSource: String

    enum CodingKeys: String, CodingKey {
        case id = "submission_id"
        case kind, categories, comment, address, latitude, longitude
        case assetScope = "asset_scope"
        case appVersion = "app_version"
        case submissionSource = "submission_source"
    }
}

enum TrashCanValidator {
    static func validate(
        kind: TrashCanSubmissionKind,
        categoryKey: String?,
        comment: String,
        address: String,
        assetScope: TrashCanAssetScope,
        latitude: Double?,
        longitude: Double?
    ) -> String? {
        guard let categoryKey, kind.permits(categoryKey: categoryKey) else {
            return "Select a category for this \(kind.label.lowercased())."
        }
        let normalizedComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        // The Node intake and Android String.length() contract count UTF-16
        // code units. Use the same boundary here so queued Unicode text cannot
        // pass iOS validation and then be rejected permanently by the server.
        guard normalizedComment.utf16.count >= 3 else {
            return "Enter at least 3 characters for the comment or complaint."
        }
        guard normalizedComment.utf16.count <= 2_000 else {
            return "The comment must be 2,000 characters or fewer."
        }
        let normalizedAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAddress.isEmpty else {
            return "Enter an address, intersection, or clear location description."
        }
        guard normalizedAddress.utf16.count <= 500 else {
            return "The address or location must be 500 characters or fewer."
        }
        if kind == .publicComment, assetScope != .publicProperty {
            return "Public comments must concern a trash can on public property."
        }
        switch (latitude, longitude) {
        case (nil, nil):
            break
        case let (latitude?, longitude?):
            guard latitude.isFinite, longitude.isFinite,
                  (-90...90).contains(latitude),
                  (-180...180).contains(longitude) else {
                return "The selected report-pin coordinates are invalid."
            }
        default:
            return "Both latitude and longitude are required when including a report pin."
        }
        return nil
    }
}
