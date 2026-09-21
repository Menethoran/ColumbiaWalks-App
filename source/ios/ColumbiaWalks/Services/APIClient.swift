import CoreLocation
import Foundation

struct ReportSubmissionResult: Equatable {
    let remoteID: String
    let officialEmailServerState: OfficialEmailServerState?
}

actor APIClient {
    static let shared = APIClient()

    static let version = "3.16.1"
    private let reportEndpoint = URL(string: "https://directus.rndtech.org/columbiawalks-api/reports")!
    private let feedbackEndpoint = URL(string: "https://directus.rndtech.org/columbiawalks-api/feedback")!
    private let trashCanEndpoint = URL(string: "https://directus.rndtech.org/columbiawalks-api/trash-can-submissions")!
    private let intersectionEndpoint = URL(string: "https://directus.rndtech.org/columbiawalks-api/intersection")!

    func nearestIntersection(at coordinate: CLLocationCoordinate2D) async throws -> IntersectionEstimate? {
        var components = URLComponents(url: intersectionEndpoint, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(format: "%.7f", coordinate.latitude)),
            URLQueryItem(name: "longitude", value: String(format: "%.7f", coordinate.longitude))
        ]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 18
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ColumbiaWalks-iOS/\(Self.version)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(IntersectionResponse.self, from: data).data
    }

    func submit(
        report: SafetyReport,
        photoURL: URL?
    ) async throws -> ReportSubmissionResult {
        let boundary = "ColumbiaWalks-\(UUID().uuidString)"
        let payload = try Self.payloadData(for: report)
        var body = Data()
        body.appendMultipart(
            boundary: boundary,
            name: "report",
            contentType: "application/json; charset=UTF-8",
            value: payload
        )
        if let photoURL {
            let photo = try Data(contentsOf: photoURL, options: .mappedIfSafe)
            body.appendMultipart(
                boundary: boundary,
                name: "photo",
                filename: "columbiawalks-\(report.clientReportID.uuidString).jpg",
                contentType: "image/jpeg",
                value: photo
            )
        }
        body.append("--\(boundary)--\r\n")

        var request = URLRequest(url: reportEndpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 35
        request.httpBody = body
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ColumbiaWalks-iOS/\(Self.version)", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        let bodyText = String(data: data.prefix(16_384), encoding: .utf8) ?? ""
        if bodyText.contains("RECORD_NOT_UNIQUE") {
            return Self.submissionResult(
                from: data,
                fallbackReportID: report.clientReportID.uuidString,
                officialEmailWasAuthorized: report.hasAuthorizedOfficialEmail
            )
        }
        try validate(response: response, data: data)
        return Self.submissionResult(
            from: data,
            fallbackReportID: report.clientReportID.uuidString,
            officialEmailWasAuthorized: report.hasAuthorizedOfficialEmail
        )
    }

    static func submissionResult(
        from data: Data,
        fallbackReportID: String,
        officialEmailWasAuthorized: Bool
    ) -> ReportSubmissionResult {
        let response = try? JSONDecoder().decode(SubmissionResponse.self, from: data)
        let emailState: OfficialEmailServerState?
        if let returnedState = response?.officialEmailServerState {
            emailState = returnedState
        } else if officialEmailWasAuthorized {
            emailState = .responseMissing
        } else {
            emailState = nil
        }
        return ReportSubmissionResult(
            remoteID: response?.data?.id ?? fallbackReportID,
            officialEmailServerState: emailState
        )
    }

    func submit(feedback: FeedbackSubmission) async throws {
        var request = URLRequest(url: feedbackEndpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.httpBody = try JSONEncoder.api.encode(feedback)
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ColumbiaWalks-iOS/\(Self.version)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    func submit(trashCan submission: TrashCanSubmission) async throws {
        var request = URLRequest(url: trashCanEndpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.httpBody = try JSONEncoder.api.encode(submission)
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ColumbiaWalks-iOS/\(Self.version)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    static func payloadData(for report: SafetyReport) throws -> Data {
        try JSONEncoder.api.encode(ReportPayload(report: report))
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard 200..<300 ~= http.statusCode else {
            let message = String(data: data.prefix(16_384), encoding: .utf8) ?? ""
            throw APIError.http(status: http.statusCode, message: message)
        }
    }
}

enum APIError: LocalizedError {
    case invalidResponse
    case http(status: Int, message: String)

    var isRetryable: Bool {
        switch self {
        case .invalidResponse: true
        case let .http(status, _):
            status == 404 || status == 408 || status == 425 || status == 429 || status >= 500
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The report server returned an invalid response."
        case let .http(status, _):
            status == 404
                ? "The report endpoint is not available (HTTP 404)."
                : "The server rejected the request (HTTP \(status))."
        }
    }
}

private struct IntersectionResponse: Decodable {
    let data: IntersectionEstimate?
}

private struct SubmissionResponse: Decodable {
    struct Body: Decodable {
        let id: String

        enum CodingKeys: String, CodingKey { case id }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            if let value = try? container.decode(String.self, forKey: .id) {
                id = value
            } else if let value = try? container.decode(Int.self, forKey: .id) {
                id = String(value)
            } else {
                throw DecodingError.typeMismatch(
                    String.self,
                    .init(codingPath: decoder.codingPath, debugDescription: "Expected a string or integer id")
                )
            }
        }
    }
    let data: Body?
    let officialEmailServerState: OfficialEmailServerState?

    enum CodingKeys: String, CodingKey {
        case data
        case officialEmailServerState = "official_email"
    }
}

struct ReportPayload: Encodable {
    let report: SafetyReport

    enum CodingKeys: String, CodingKey {
        case clientReportID = "client_report_id"
        case observedAt = "observed_at"
        case categories, severity
        case policeResponse = "police_response"
        case details
        case assessmentMode = "assessment_mode"
        case checklistResponses = "checklist_responses"
        case reportedPartyType = "reported_party_type"
        case vehicleInvolved = "vehicle_involved"
        case vehicleDetails = "vehicle_details"
        case policeObservations = "police_observations"
        case policeComplaintDetails = "police_complaint_details"
        case submissionMode = "submission_mode"
        case quickReportType = "quick_report_type"
        case quickReportTypes = "quick_report_types"
        case nearestIntersection = "nearest_intersection"
        case rapidReportKind = "rapid_report_kind"
        case sidewalkLipHeight = "sidewalk_lip_height"
        case vehicleIssueType = "vehicle_issue_type"
        case continuousSessionID = "continuous_session_id"
        case continuousSequence = "continuous_sequence"
        case locationSource = "location_source"
        case photoLatitude = "photo_latitude"
        case photoLongitude = "photo_longitude"
        case locationOverridden = "location_overridden"
        case officialEmailAuthorized = "official_email_authorized"
        case officialEmailDestinationAuthorized = "official_email_destination_authorized"
        case appVersion = "app_version"
        case latitude, longitude, location
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(report.clientReportID.uuidString.lowercased(), forKey: .clientReportID)
        try container.encode(ISO8601DateFormatter().string(from: report.observedAt), forKey: .observedAt)
        try container.encode(report.categories.map(\.rawValue), forKey: .categories)
        try container.encode(report.severity.rawValue, forKey: .severity)
        try container.encode(report.policeResponse.rawValue, forKey: .policeResponse)
        try container.encode(report.details, forKey: .details)
        try container.encode(report.checklistResponses.isEmpty ? "quick_report" : "walkability_assessment", forKey: .assessmentMode)
        try container.encode(report.checklistResponses.mapValues(\.rawValue), forKey: .checklistResponses)
        try container.encode(report.reportedParty.rawValue, forKey: .reportedPartyType)
        try container.encode(report.vehicleInvolved, forKey: .vehicleInvolved)
        if report.vehicleInvolved {
            try container.encode(report.vehicleDetails, forKey: .vehicleDetails)
        } else {
            try container.encode(EmptyObject(), forKey: .vehicleDetails)
        }
        try container.encode(report.policeObservations.map(\.rawValue), forKey: .policeObservations)
        try container.encode(report.policeComplaintDetails, forKey: .policeComplaintDetails)
        try container.encode(report.submissionMode.rawValue, forKey: .submissionMode)
        try container.encodeIfPresent(report.quickReportTypes.first?.rawValue, forKey: .quickReportType)
        try container.encode(report.quickReportTypes.map(\.rawValue), forKey: .quickReportTypes)
        try container.encodeIfPresent(report.nearestIntersection, forKey: .nearestIntersection)
        try container.encodeIfPresent(report.rapidReportKind?.rawValue, forKey: .rapidReportKind)
        try container.encodeIfPresent(report.sidewalkLipHeight?.rawValue, forKey: .sidewalkLipHeight)
        try container.encodeIfPresent(report.vehicleIssueType?.rawValue, forKey: .vehicleIssueType)
        try container.encodeIfPresent(
            report.continuousSessionID?.uuidString.lowercased(),
            forKey: .continuousSessionID
        )
        try container.encodeIfPresent(report.continuousSequence, forKey: .continuousSequence)
        try container.encode(report.hasAuthorizedOfficialEmail, forKey: .officialEmailAuthorized)
        if report.hasAuthorizedOfficialEmail {
            // Version 3.16.1 remains pinned to the controlled field-test destination.
            // This client must never authorize the server's `official` mode.
            try container.encode("test", forKey: .officialEmailDestinationAuthorized)
        } else {
            try container.encodeNil(forKey: .officialEmailDestinationAuthorized)
        }
        try container.encode(APIClient.version, forKey: .appVersion)

        if let latitude = report.latitude, let longitude = report.longitude {
            try container.encode(latitude, forKey: .latitude)
            try container.encode(longitude, forKey: .longitude)
            try container.encode(GeoJSONPoint(coordinates: [longitude, latitude]), forKey: .location)
        } else {
            try container.encodeNil(forKey: .latitude)
            try container.encodeNil(forKey: .longitude)
            try container.encodeNil(forKey: .location)
        }

        let hasCoordinates = report.latitude != nil && report.longitude != nil
        let source = report.locationSource ?? (hasCoordinates ? .legacy : .none)
        try container.encode(source.rawValue, forKey: .locationSource)
        if let photoLatitude = report.photoLatitude,
           let photoLongitude = report.photoLongitude {
            try container.encode(photoLatitude, forKey: .photoLatitude)
            try container.encode(photoLongitude, forKey: .photoLongitude)
        } else {
            try container.encodeNil(forKey: .photoLatitude)
            try container.encodeNil(forKey: .photoLongitude)
        }
        try container.encode(report.locationOverridden ?? false, forKey: .locationOverridden)
    }
}

private struct GeoJSONPoint: Encodable {
    let type = "Point"
    let coordinates: [Double]
}

private struct EmptyObject: Encodable {}

extension JSONEncoder {
    static var api: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(string.data(using: .utf8)!)
    }

    mutating func appendMultipart(
        boundary: String,
        name: String,
        filename: String? = nil,
        contentType: String,
        value: Data
    ) {
        append("--\(boundary)\r\n")
        let filenamePart = filename.map { "; filename=\"\($0)\"" } ?? ""
        append("Content-Disposition: form-data; name=\"\(name)\"\(filenamePart)\r\n")
        append("Content-Type: \(contentType)\r\n\r\n")
        append(value)
        append("\r\n")
    }
}
