import Foundation

struct AnonymousTipSubmission: Codable, Equatable {
    let submissionID: UUID
    let appVersion: String
    let pastOrInactiveConfirmed: Bool
    let testOnlyAcknowledged: Bool
    let fields: [String: String]
    enum CodingKeys: String, CodingKey {
        case submissionID = "submission_id", appVersion = "app_version"
        case pastOrInactiveConfirmed = "past_or_inactive_confirmed"
        case testOnlyAcknowledged = "test_only_acknowledged", fields
    }
    static let fieldOrder = ["subject", "observed_time", "location", "direction", "license_plate",
                             "plate_state", "vehicle_description", "observation", "evidence_notes"]
    static let limits = [128, 500, 500, 500, 500, 500, 500, 5000, 2000]

    static func plain(_ text: String) -> String {
        text.replacingOccurrences(of: "\\[TEST\\]", with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "[\\x{0000}-\\x{001f}\\x{007f}-\\x{009f}\\x{200b}-\\x{200f}\\x{202a}-\\x{202e}\\x{2060}-\\x{206f}\\x{feff}]", with: " ", options: .regularExpression)
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
    static func mark(_ value: String) -> String {
        let clean = plain(value)
        return "[TEST] " + (clean.isEmpty ? "Not provided" : clean)
            .replacingOccurrences(of: " ", with: " [TEST] ") + " [TEST]"
    }
    static func make(_ draft: PoliceTipDraft, testOnly: Bool, version: String) throws -> Self {
        guard draft.isPastAndNotInProgress, testOnly else {
            throw TipError.invalid("[TEST] Confirm both statements before submitting.")
        }
        guard version.range(of: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.0$", options: .regularExpression) != nil else {
            throw TipError.invalid("[TEST] Only internal .0 builds can use test intake.")
        }
        let date = ISO8601DateFormatter().string(from: draft.observedAt)
        let values = [draft.subject, date, draft.location, draft.directionOfTravel, draft.licensePlate,
                      draft.plateState, draft.vehicleDescription, draft.firsthandObservation, draft.evidenceNotes]
        var marked: [String: String] = [:]
        for index in fieldOrder.indices {
            let clean = plain(values[index])
            guard !([0, 1, 2, 7].contains(index) && clean.isEmpty), clean.utf16.count <= limits[index] else {
                throw TipError.invalid("[TEST] Check the required fields and their length limits.")
            }
            marked[fieldOrder[index]] = mark(clean)
        }
        return Self(submissionID: UUID(), appVersion: version, pastOrInactiveConfirmed: true,
                    testOnlyAcknowledged: true, fields: marked)
    }
    enum TipError: LocalizedError {
        case invalid(String)
        var errorDescription: String? { if case let .invalid(message) = self { return message }; return nil }
    }
}

struct AnonymousTipReceipt: Decodable {
    let data: Details
    struct Details: Decodable {
        let submission_id: UUID
        let reference: String
        let test_mode: Bool
        let status: String
        let police_contacted: Bool
        let destination: String
    }
    func verifiedReference(for submission: AnonymousTipSubmission) throws -> String {
        let expected = "[TEST] CW-TIP-" + submission.submissionID.uuidString.lowercased()
        guard data.submission_id == submission.submissionID, data.reference == expected,
              data.test_mode, !data.police_contacted, data.status == "test_received",
              data.destination == "private_columbiawalks_test_intake" else {
            throw AnonymousTipSubmission.TipError.invalid("[TEST] Storage receipt could not be verified.")
        }
        return expected
    }
}
