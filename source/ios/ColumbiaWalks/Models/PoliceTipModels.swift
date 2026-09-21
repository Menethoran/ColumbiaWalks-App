import Foundation

struct PoliceTipDraft: Equatable {
    var subject = ""
    var observedAt = Date()
    var location = ""
    var directionOfTravel = ""
    var licensePlate = ""
    var plateState = ""
    var vehicleDescription = ""
    var firsthandObservation = ""
    var evidenceNotes = ""
    var isPastAndNotInProgress = false
    var sourceWasSubmittedToColumbiaWalks = false
}

struct PreparedPoliceTip: Equatable {
    let subject: String
    let narrative: String

    var clipboardText: String {
        "Subject:\n\(subject)\n\nMessage:\n\(narrative)"
    }
}

enum PoliceTipValidator {
    static func validate(_ draft: PoliceTipDraft, now: Date = Date()) -> String? {
        guard draft.isPastAndNotInProgress else {
            return "Confirm that the incident is in the past and is not currently in progress."
        }
        let subject = draft.subject.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !subject.isEmpty else { return "Enter a short subject for the tip." }
        guard PoliceTipDraftBuilder.subject(for: draft).count <= 128 else {
            return "The subject must be 128 characters or fewer to fit the official form."
        }
        guard draft.observedAt <= now.addingTimeInterval(60) else {
            return "Choose a date and time that is not in the future."
        }
        let location = draft.location.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !location.isEmpty else { return "Enter the incident location or nearest landmark." }
        guard location.count <= 500 else { return "The location must be 500 characters or fewer." }
        let observation = draft.firsthandObservation.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !observation.isEmpty else { return "Describe only what you personally observed." }
        guard observation.count <= 5_000 else {
            return "The firsthand observation must be 5,000 characters or fewer."
        }
        guard draft.directionOfTravel.count <= 300 else {
            return "The direction of travel must be 300 characters or fewer."
        }
        guard draft.licensePlate.count <= 20 else {
            return "The license plate must be 20 characters or fewer."
        }
        guard draft.plateState.count <= 32 else {
            return "The plate state or jurisdiction must be 32 characters or fewer."
        }
        guard draft.vehicleDescription.count <= 1_500 else {
            return "The vehicle description must be 1,500 characters or fewer."
        }
        guard draft.evidenceNotes.count <= 2_500 else {
            return "The evidence notes must be 2,500 characters or fewer."
        }
        return nil
    }
}

enum PoliceTipDraftBuilder {
    static func prepare(_ draft: PoliceTipDraft) -> PreparedPoliceTip {
        PreparedPoliceTip(
            subject: subject(for: draft),
            narrative: narrative(for: draft)
        )
    }

    static func subject(for draft: PoliceTipDraft) -> String {
        singleLine(draft.subject)
    }

    static func narrative(for draft: PoliceTipDraft) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateFormat = "yyyy-MM-dd h:mm a zzz"

        return [
            "Incident status: Past / not currently in progress",
            "Date/time observed: \(formatter.string(from: draft.observedAt))",
            "Location: \(valueOrNotProvided(draft.location))",
            "Direction of travel: \(valueOrNotProvided(draft.directionOfTravel))",
            "License plate: \(singleLineOrNotProvided(draft.licensePlate))",
            "Plate state/jurisdiction: \(singleLineOrNotProvided(draft.plateState))",
            "Vehicle description:\n\(valueOrNotProvided(draft.vehicleDescription))",
            "Firsthand observation:\n\(valueOrNotProvided(draft.firsthandObservation))",
            "Evidence notes:\n\(valueOrNotProvided(draft.evidenceNotes))",
            draft.sourceWasSubmittedToColumbiaWalks
                ? "Handoff note: This report was saved to ColumbiaWalks. ColumbiaWalks did not send this draft or any media to CBPD; I am submitting it personally through the official form."
                : "Local-only privacy note: This draft and any media were not sent to ColumbiaWalks or CBPD."
        ].joined(separator: "\n\n")
    }

    private static func singleLine(_ value: String) -> String {
        value.split(whereSeparator: \Character.isWhitespace).joined(separator: " ")
    }

    private static func singleLineOrNotProvided(_ value: String) -> String {
        let normalized = singleLine(value)
        return normalized.isEmpty ? "Not provided" : normalized
    }

    private static func valueOrNotProvided(_ value: String) -> String {
        let normalized = value
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? "Not provided" : normalized
    }
}
