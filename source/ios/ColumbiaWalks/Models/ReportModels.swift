import CoreLocation
import Foundation

enum ReportMode: String, Codable, CaseIterable, Identifiable {
    case quick
    case full
    case pos

    var id: String { rawValue }
    var label: String {
        switch self {
        case .quick: "Quick Report"
        case .full: "Full Report"
        case .pos: "Page of Shame"
        }
    }

    static let standardCases: [ReportMode] = [.quick, .full]
}

enum IssueCategory: String, Codable, CaseIterable, Identifiable, Hashable {
    case sidewalkSafety = "sidewalk_safety"
    case vehicleSafety = "vehicle_safety"
    case crosswalkSafety = "crosswalk_safety"
    case tripHazards = "trip_hazards"
    case aggressiveDrivers = "aggressive_drivers"
    case policeResponse = "police_response"
    case lightingOrVisibility = "lighting_or_visibility"
    case accessibilityADA = "accessibility_ada"
    case schoolRouteSafety = "school_route_safety"
    case notIncludedElsewhere = "not_included_elsewhere"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sidewalkSafety: "Sidewalk safety"
        case .vehicleSafety: "Vehicle safety"
        case .crosswalkSafety: "Crosswalk safety"
        case .tripHazards: "Trip hazards"
        case .aggressiveDrivers: "Aggressive drivers"
        case .policeResponse: "Police interaction / conduct"
        case .lightingOrVisibility: "Lighting or visibility"
        case .accessibilityADA: "Accessibility / ADA"
        case .schoolRouteSafety: "School route safety"
        case .notIncludedElsewhere: "Not included elsewhere"
        }
    }
}

enum QuickReportType: String, Codable, CaseIterable, Identifiable, Hashable {
    case crosswalkEncroachment = "crosswalk_encroachment"
    case missingSidewalk = "missing_sidewalk"
    case speeding
    case illegalUTurn = "illegal_u_turn"
    case tripHazard = "trip_hazard"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .crosswalkEncroachment: "Crosswalk encroachment"
        case .missingSidewalk: "Missing sidewalk"
        case .speeding: "Speeding"
        case .illegalUTurn: "Illegal U-turn"
        case .tripHazard: "Trip hazard"
        }
    }

    var category: IssueCategory {
        switch self {
        case .crosswalkEncroachment: .crosswalkSafety
        case .missingSidewalk: .sidewalkSafety
        case .speeding: .aggressiveDrivers
        case .illegalUTurn: .vehicleSafety
        case .tripHazard: .tripHazards
        }
    }
}

enum SidewalkIssueType: String, Codable, CaseIterable, Identifiable {
    case missingSidewalk = "missing_sidewalk"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .missingSidewalk: "Missing sidewalk"
        }
    }
}

enum RapidReportKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case sidewalk
    case vehicle
    case crosswalk
    case tripHazard = "trip_hazard"
    case lightingOrVisibility = "lighting_or_visibility"
    case accessibilityADA = "accessibility_ada"
    case schoolRoute = "school_route"
    case policeResponse = "police_response"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sidewalk: "Sidewalk issue"
        case .vehicle: "Vehicle issue"
        case .crosswalk: "Crosswalk issue"
        case .tripHazard: "Trip hazard"
        case .lightingOrVisibility: "Lighting / visibility"
        case .accessibilityADA: "Accessibility / ADA"
        case .schoolRoute: "School route"
        case .policeResponse: "Police response"
        case .other: "Other"
        }
    }

    var category: IssueCategory {
        switch self {
        case .sidewalk: .sidewalkSafety
        case .vehicle: .vehicleSafety
        case .crosswalk: .crosswalkSafety
        case .tripHazard: .tripHazards
        case .lightingOrVisibility: .lightingOrVisibility
        case .accessibilityADA: .accessibilityADA
        case .schoolRoute: .schoolRouteSafety
        case .policeResponse: .policeResponse
        case .other: .notIncludedElsewhere
        }
    }
}

enum SidewalkLipHeight: String, Codable, CaseIterable, Identifiable {
    case quarterInchOrLess = "quarter_inch_or_less"
    case overQuarterInch = "over_quarter_inch"
    case overHalfInch = "over_half_inch"
    case overOneInch = "over_one_inch"
    case overTwoInches = "over_two_inches"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .quarterInchOrLess: "1/4 inch or less"
        case .overQuarterInch: "More than 1/4 inch"
        case .overHalfInch: "More than 1/2 inch"
        case .overOneInch: "More than 1 inch"
        case .overTwoInches: "In excess of 2 inches"
        }
    }
}

enum VehicleIssueType: String, Codable, CaseIterable, Identifiable {
    case aggressiveDriving = "aggressive_driving"
    case crosswalkIncursion = "crosswalk_incursion"
    case illegalUTurn = "illegal_u_turn"
    case speeding
    case failureToYield = "failure_to_yield"
    case redLightViolation = "red_light_violation"
    case stopSignViolation = "stop_sign_violation"
    case blockedCrosswalkOrSidewalk = "blocked_crosswalk_or_sidewalk"
    case illegalParking = "illegal_parking"
    case distractedDriving = "distracted_driving"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .aggressiveDriving: "Aggressive driving"
        case .crosswalkIncursion: "Crosswalk incursion"
        case .illegalUTurn: "Illegal U-turn"
        case .speeding: "Speeding"
        case .failureToYield: "Failure to yield"
        case .redLightViolation: "Red-light violation"
        case .stopSignViolation: "Stop-sign violation"
        case .blockedCrosswalkOrSidewalk: "Blocked crosswalk or sidewalk"
        case .illegalParking: "Illegal parking"
        case .distractedDriving: "Distracted driving"
        case .other: "Other"
        }
    }
}

enum OfficialEmailDestination: Hashable {
    case policeChiefAndMayor
    case codes

    var label: String {
        switch self {
        case .policeChiefAndMayor: "Crosswalk field-test rule"
        case .codes: "Missing-sidewalk field-test rule"
        }
    }
}

enum OfficialEmailPolicy {
    static let serviceAreaCenter = CLLocationCoordinate2D(
        latitude: 40.0337,
        longitude: -76.5044
    )
    static let serviceAreaRadiusMeters: CLLocationDistance = 5_000
    private static let earthRadiusMeters: CLLocationDistance = 6_371_000

    static func destinations(
        submissionMode: ReportMode,
        quickReportTypes: some Collection<QuickReportType>,
        rapidReportKind: RapidReportKind? = nil,
        vehicleIssueType: VehicleIssueType? = nil
    ) -> [OfficialEmailDestination] {
        guard submissionMode == .quick else { return [] }
        // The server treats authorization as an exact selection-shape contract.
        // Do not collapse this collection to a Set: duplicate or stray keys
        // must make the report ineligible instead of being normalized away.
        let quickTypes = Array(quickReportTypes)
        if let rapidReportKind {
            if rapidReportKind == .vehicle,
               quickTypes.isEmpty,
               vehicleIssueType == .crosswalkIncursion {
                return [.policeChiefAndMayor]
            }
            if rapidReportKind == .sidewalk,
               quickTypes.count == 1,
               quickTypes.first == .missingSidewalk {
                return [.codes]
            }
            return []
        }

        guard quickTypes.count == 1 else { return [] }
        switch quickTypes[0] {
        case .crosswalkEncroachment: return [.policeChiefAndMayor]
        case .missingSidewalk: return [.codes]
        default: return []
        }
    }

    static func isWithinServiceArea(_ coordinate: CLLocationCoordinate2D) -> Bool {
        guard CLLocationCoordinate2DIsValid(coordinate),
              coordinate.latitude.isFinite,
              coordinate.longitude.isFinite else { return false }
        // Keep this Haversine calculation aligned with the Android and intake
        // server policies so all three components agree at the 5 km boundary.
        let latitudeDelta = radians(
            coordinate.latitude - serviceAreaCenter.latitude
        )
        let longitudeDelta = radians(
            coordinate.longitude - serviceAreaCenter.longitude
        )
        let centerLatitude = radians(serviceAreaCenter.latitude)
        let reportLatitude = radians(coordinate.latitude)
        let a = pow(sin(latitudeDelta / 2), 2)
            + cos(centerLatitude) * cos(reportLatitude)
            * pow(sin(longitudeDelta / 2), 2)
        let distance = earthRadiusMeters * 2
            * atan2(sqrt(a), sqrt(1 - a))
        return isWithinServiceArea(distanceMeters: distance)
    }

    static func isWithinServiceArea(distanceMeters: CLLocationDistance) -> Bool {
        distanceMeters.isFinite
            && distanceMeters >= 0
            && distanceMeters <= serviceAreaRadiusMeters
    }

    private static func radians(_ degrees: Double) -> Double {
        degrees * .pi / 180
    }
}

struct OfficialEmailServerState: Codable, Equatable {
    struct Delivery: Codable, Equatable {
        let ruleID: String?
        let status: String
        let blockedReason: String?
        let destinationMode: String?

        enum CodingKeys: String, CodingKey {
            case ruleID = "rule_id"
            case status
            case blockedReason = "blocked_reason"
            case destinationMode = "destination_mode"
            case recipientMode = "recipient_mode"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            ruleID = try container.decodeIfPresent(String.self, forKey: .ruleID)
            status = try container.decode(String.self, forKey: .status)
            blockedReason = try container.decodeIfPresent(
                String.self,
                forKey: .blockedReason
            )
            destinationMode = try container.decodeIfPresent(
                String.self,
                forKey: .destinationMode
            ) ?? container.decodeIfPresent(String.self, forKey: .recipientMode)
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encodeIfPresent(ruleID, forKey: .ruleID)
            try container.encode(status, forKey: .status)
            try container.encodeIfPresent(blockedReason, forKey: .blockedReason)
            try container.encodeIfPresent(destinationMode, forKey: .destinationMode)
        }

        var destinationLabel: String {
            switch ruleID {
            case "police_crosswalk_v1": "Crosswalk field-test rule"
            case "codes_missing_sidewalk_v1": "Missing-sidewalk field-test rule"
            default: "Field-test email rule"
            }
        }

        var statusLabel: String {
            switch status {
            case "queued": "Queued for server processing"
            case "retry": "Waiting for a safe server retry"
            case "held_cap": "Paused by the server's daily limit"
            case "review": "Held for server review"
            case "disabled": "Automatic delivery disabled"
            case "blocked": "Blocked: \(Self.reasonLabel(blockedReason))"
            case "preparing", "sending": "Server processing in progress"
            case "sent": "Server send completed; delivery not guaranteed"
            case "uncertain": "Server could not confirm the send result"
            default: "Server status: \(status.replacingOccurrences(of: "_", with: " "))"
            }
        }

        private static func reasonLabel(_ reason: String?) -> String {
            switch reason {
            case "missing_photo": "required photo missing"
            case "missing_location": "confirmed location missing"
            case "outside_service_area": "outside the 5 km service area"
            case "recipient_not_configured": "recipient not configured"
            case "delivery_disabled": "automatic delivery disabled"
            case "daily_recipient_cap": "daily recipient limit reached"
            case "attempt_limit", "preparation_attempt_limit": "server retry limit reached"
            case "provider_rejected": "email provider rejected the request"
            case "policy_mismatch": "server policy did not match the report"
            case let .some(value): value.replacingOccurrences(of: "_", with: " ")
            case .none: "server safeguard"
            }
        }
    }

    let status: String
    let deliveries: [Delivery]
    let destinationMode: String?

    static let responseMissing = OfficialEmailServerState(
        status: "not_reported",
        deliveries: [],
        destinationMode: nil
    )

    enum CodingKeys: String, CodingKey {
        case status, deliveries
        case destinationMode = "destination_mode"
        case recipientMode = "recipient_mode"
    }

    init(
        status: String,
        deliveries: [Delivery],
        destinationMode: String? = nil
    ) {
        self.status = status
        self.deliveries = deliveries
        self.destinationMode = destinationMode
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status)
            ?? "not_reported"
        deliveries = try container.decodeIfPresent(
            [Delivery].self,
            forKey: .deliveries
        ) ?? []
        destinationMode = try container.decodeIfPresent(
            String.self,
            forKey: .destinationMode
        ) ?? container.decodeIfPresent(String.self, forKey: .recipientMode)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(status, forKey: .status)
        try container.encode(deliveries, forKey: .deliveries)
        try container.encodeIfPresent(destinationMode, forKey: .destinationMode)
    }

    var destinationModeLabel: String {
        switch effectiveDestinationMode {
        case "test": "ColumbiaWalks-controlled test mailbox"
        case "official": "Unexpected non-test server mode"
        case let .some(value):
            "Unrecognized server mode: \(value.replacingOccurrences(of: "_", with: " "))"
        case .none: "Test-mailbox mode not confirmed by server"
        }
    }

    var shortLabel: String {
        switch status {
        case "recorded": recordedShortLabel
        case "not_eligible": "Field-test email not eligible"
        case "deferred": "Field-test email setup deferred"
        case "not_reported": "Field-test email status unavailable"
        default: "Field-test email status: \(status.replacingOccurrences(of: "_", with: " "))"
        }
    }

    var acceptanceSummary: String {
        let prefix = "Report accepted by ColumbiaWalks. \(fieldTestRoutingSummary)"
        switch status {
        case "recorded": return "\(prefix) \(recordedSummary)"
        case "not_eligible":
            return "\(prefix) The server did not accept this report for field-test email processing; no email was authorized by this response."
        case "deferred":
            return "\(prefix) Field-test email setup was deferred for server reconciliation; delivery is not confirmed."
        case "not_reported":
            return "\(prefix) The server did not return a field-test email status; delivery is not confirmed."
        default:
            return "\(prefix) The server returned field-test email status “\(status.replacingOccurrences(of: "_", with: " "))”; delivery is not confirmed."
        }
    }

    private var effectiveDestinationMode: String? {
        let value = destinationMode
            ?? deliveries.compactMap(\.destinationMode).first
        return value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var fieldTestRoutingSummary: String {
        switch effectiveDestinationMode {
        case "test":
            "The server reports test mode: any authorized message is addressed only to a ColumbiaWalks-controlled test mailbox with [TEST] in its subject, not to Police, the Mayor, or Codes."
        case "official":
            "ColumbiaWalks 3.16.1 authorizes only its controlled test-mailbox field test, but the server reported an inconsistent non-test mode. This app does not confirm any recipient or delivery."
        default:
            "ColumbiaWalks 3.16.1 authorizes only a [TEST]-subject message to its controlled test mailbox, never Police, the Mayor, or Codes. The server did not confirm test mode, so no recipient or delivery is confirmed."
        }
    }

    private var recordedShortLabel: String {
        let states = Set(deliveries.map(\.status))
        if states.contains("uncertain") { return "Field-test email result uncertain" }
        if states.contains("blocked") { return "Field-test email blocked" }
        if states.contains("disabled") { return "Field-test email delivery disabled" }
        if states.contains("review") { return "Field-test email held for review" }
        if states.contains("held_cap") { return "Field-test email paused by daily limit" }
        if !states.isEmpty, states.allSatisfy({ $0 == "sent" }) {
            return "Field-test email send completed"
        }
        if states.contains("queued") || states.contains("retry")
            || states.contains("preparing") || states.contains("sending") {
            return "Field-test email queued for processing"
        }
        return "Field-test email recorded by server"
    }

    private var recordedSummary: String {
        let states = Set(deliveries.map(\.status))
        if states.contains("uncertain") {
            return "The server could not confirm at least one email send result and will not automatically retry that uncertain route; recipient delivery is not confirmed."
        }
        if states.contains("blocked") {
            let reasons = Set(deliveries.compactMap { delivery in
                delivery.status == "blocked" ? delivery.blockedReason : nil
            })
            let detail = reasons.isEmpty
                ? ""
                : " (\(reasons.sorted().map { $0.replacingOccurrences(of: "_", with: " ") }.joined(separator: ", ")))"
            return "At least one official-email route is blocked by server safeguards\(detail); delivery is not confirmed."
        }
        if states.contains("disabled") {
            return "Automatic official-email delivery is disabled on the server; no delivery is confirmed."
        }
        if states.contains("review") {
            return "The field-test email is held for server review; delivery is not confirmed."
        }
        if states.contains("held_cap") {
            return "The field-test email is paused by the server's daily limit and will be checked again; delivery is not confirmed."
        }
        if !states.isEmpty, states.allSatisfy({ $0 == "sent" }) {
            return "The server reports that the email send request completed; recipient delivery is not guaranteed."
        }
        if states.contains("queued") || states.contains("retry")
            || states.contains("preparing") || states.contains("sending") {
            return "The field-test email is queued for server processing; delivery is not confirmed."
        }
        return "Field-test email processing was recorded; delivery is not confirmed."
    }
}

enum ReportLocationSource: String, Codable, CaseIterable {
    case none
    case photoEXIF = "photo_exif"
    case deviceGPS = "device_gps"
    case manualMap = "manual_map"
    case manualCoordinates = "manual_coordinates"
    case legacy

    var label: String {
        switch self {
        case .none: "No location selected"
        case .photoEXIF: "Photo GPS"
        case .deviceGPS: "Device GPS"
        case .manualMap: "Manual map pin"
        case .manualCoordinates: "Manual coordinates"
        case .legacy: "Saved location"
        }
    }
}

struct ReportLocationDraft: Equatable {
    private(set) var latitude: Double?
    private(set) var longitude: Double?
    private(set) var source: ReportLocationSource = .none
    private(set) var photoLatitude: Double?
    private(set) var photoLongitude: Double?
    private(set) var locationOverridden = false

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var photoCoordinate: CLLocationCoordinate2D? {
        guard let photoLatitude, let photoLongitude else { return nil }
        return CLLocationCoordinate2D(latitude: photoLatitude, longitude: photoLongitude)
    }

    var isConfirmed: Bool { coordinate != nil && source != .none }

    mutating func usePhoto(_ coordinate: CLLocationCoordinate2D) {
        photoLatitude = coordinate.latitude
        photoLongitude = coordinate.longitude
        latitude = coordinate.latitude
        longitude = coordinate.longitude
        source = .photoEXIF
        locationOverridden = false
    }

    mutating func notePhotoWithoutLocation() {
        removePhotoProvenance()
    }

    mutating func useDevice(_ coordinate: CLLocationCoordinate2D) {
        let replacesPhoto = photoCoordinate != nil
        latitude = coordinate.latitude
        longitude = coordinate.longitude
        source = .deviceGPS
        locationOverridden = replacesPhoto
    }

    @discardableResult
    mutating func useDeviceFallback(_ coordinate: CLLocationCoordinate2D) -> Bool {
        guard !isConfirmed else { return false }
        useDevice(coordinate)
        return true
    }

    mutating func useManual(
        _ coordinate: CLLocationCoordinate2D,
        source manualSource: ReportLocationSource
    ) {
        precondition(manualSource == .manualMap || manualSource == .manualCoordinates)
        let replacesAutomatic = locationOverridden
            || source == .photoEXIF
            || source == .deviceGPS
            || photoCoordinate != nil
        latitude = coordinate.latitude
        longitude = coordinate.longitude
        source = manualSource
        locationOverridden = replacesAutomatic
    }

    mutating func removePhotoProvenance() {
        photoLatitude = nil
        photoLongitude = nil
        if source == .photoEXIF {
            clearLocation()
        } else {
            locationOverridden = false
        }
    }

    mutating func clearLocation() {
        latitude = nil
        longitude = nil
        source = .none
        locationOverridden = false
    }

    mutating func reset() {
        self = ReportLocationDraft()
    }
}

enum Severity: String, Codable, CaseIterable, Identifiable {
    case low
    case medium
    case high

    var id: String { rawValue }
    var label: String {
        switch self {
        case .low: "Low — inconvenient"
        case .medium: "Medium — could cause injury"
        case .high: "High — immediate danger"
        }
    }
}

enum PoliceResponse: String, Codable, CaseIterable, Identifiable {
    case notInvolved = "not_involved"
    case good
    case poor
    case mixed

    var id: String { rawValue }
    var label: String {
        switch self {
        case .notInvolved: "Not applicable"
        case .good: "Good response"
        case .poor: "Poor response"
        case .mixed: "Mixed response"
        }
    }
}

enum ReportedParty: String, Codable, CaseIterable, Identifiable {
    case unknown
    case civilianDriver = "civilian_driver"
    case policeOfficer = "police_officer"
    case otherGovernmentDriver = "other_government_driver"
    case commercialDriver = "commercial_driver"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .unknown: "Unknown / not observed"
        case .civilianDriver: "Civilian driver"
        case .policeOfficer: "Police officer"
        case .otherGovernmentDriver: "Other government or agency driver"
        case .commercialDriver: "Commercial driver"
        }
    }
}

enum ObservationStatus: String, Codable, CaseIterable, Identifiable {
    case unknown
    case on
    case off

    var id: String { rawValue }
    var label: String {
        switch self {
        case .unknown: "Unknown / not observed"
        case .on: "Active / audible"
        case .off: "Not active / not audible"
        }
    }
}

enum PoliceObservation: String, Codable, CaseIterable, Identifiable, Hashable {
    case enteredAgainstRedSignal = "entered_against_red_signal"
    case failedToStopAtStopSign = "failed_to_stop_at_stop_sign"
    case unsafeSpeed = "unsafe_speed"
    case failedToYield = "failed_to_yield"
    case blockedCrosswalkOrSidewalk = "blocked_crosswalk_or_sidewalk"
    case aggressiveOrThreateningConduct = "aggressive_or_threatening_conduct"
    case complaintOrReportNotTaken = "complaint_or_report_not_taken"
    case identificationNotProvided = "identification_not_provided"
    case noFollowUpObserved = "no_follow_up_observed"
    case professionalOrHelpfulResponse = "professional_or_helpful_response"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .enteredAgainstRedSignal: "Entered an intersection against a red signal"
        case .failedToStopAtStopSign: "Did not stop at a stop sign"
        case .unsafeSpeed: "Speed appeared unsafe for the conditions"
        case .failedToYield: "Did not yield to a pedestrian"
        case .blockedCrosswalkOrSidewalk: "Stopped or parked in a crosswalk or sidewalk"
        case .aggressiveOrThreateningConduct: "Aggressive, intimidating, or threatening conduct observed"
        case .complaintOrReportNotTaken: "Complaint or incident report was not taken"
        case .identificationNotProvided: "Requested officer name or badge number was not provided"
        case .noFollowUpObserved: "No follow-up was provided or observed"
        case .professionalOrHelpfulResponse: "Professional or helpful response observed"
        }
    }
}

enum ChecklistResponse: String, Codable, CaseIterable, Identifiable {
    case ok
    case needsAttention = "needs_attention"
    case notApplicable = "not_applicable"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .ok: "OK"
        case .needsAttention: "Needs attention"
        case .notApplicable: "Not applicable"
        }
    }
}

struct VehicleDetails: Codable, Equatable {
    var licensePlate = ""
    var plateState = ""
    var year = ""
    var make = ""
    var model = ""
    var color = ""
    var bodyStyle = ""
    var vin = ""
    var unitNumber = ""
    var visibleDamage = ""
    var description = ""
    var emergencyLights: ObservationStatus = .unknown
    var siren: ObservationStatus = .unknown

    enum CodingKeys: String, CodingKey {
        case licensePlate = "license_plate"
        case plateState = "plate_state"
        case year, make, model, color
        case bodyStyle = "body_style"
        case vin
        case unitNumber = "unit_number"
        case visibleDamage = "visible_damage"
        case description
        case emergencyLights = "emergency_lights"
        case siren
    }

    var validationError: String? {
        let fields: [(label: String, value: String, limit: Int)] = [
            ("License plate", licensePlate, 20),
            ("Plate state or jurisdiction", plateState, 32),
            ("Vehicle year", year, 8),
            ("Vehicle make", make, 80),
            ("Vehicle model", model, 80),
            ("Vehicle color", color, 80),
            ("Vehicle body style", bodyStyle, 80),
            ("VIN", vin, 32),
            ("Fleet or unit number", unitNumber, 80),
            ("Visible damage or distinguishing marks", visibleDamage, 500),
            ("Additional vehicle description", description, 1_000)
        ]
        guard let invalid = fields.first(where: {
            $0.value.utf16.count > $0.limit
        }) else { return nil }
        return "\(invalid.label) must be \(invalid.limit) characters or fewer."
    }
}

struct IntersectionEstimate: Codable, Equatable {
    let label: String
    let latitude: Double
    let longitude: Double
    let distanceMeters: Double
    let major: Bool

    enum CodingKeys: String, CodingKey {
        case label, latitude, longitude, major
        case distanceMeters = "distance_meters"
    }
}

enum SubmissionStatus: String, Codable {
    case local
    case pending
    case submitting
    case submitted
    case failed

    var label: String {
        switch self {
        case .local: "Local only"
        case .pending: "Waiting to submit"
        case .submitting: "Submitting"
        case .submitted: "Submitted"
        case .failed: "Submission needs attention"
        }
    }
}

struct SafetyReport: Codable, Identifiable, Equatable {
    let id: UUID
    let clientReportID: UUID
    let createdAt: Date
    let observedAt: Date
    var categories: [IssueCategory]
    var severity: Severity
    var policeResponse: PoliceResponse
    var details: String
    var checklistResponses: [String: ChecklistResponse]
    var reportedParty: ReportedParty
    var vehicleInvolved: Bool
    var vehicleDetails: VehicleDetails
    var policeObservations: [PoliceObservation]
    var policeComplaintDetails: String
    var submissionMode: ReportMode
    var quickReportTypes: [QuickReportType]
    var nearestIntersection: IntersectionEstimate?
    var rapidReportKind: RapidReportKind? = nil
    var sidewalkLipHeight: SidewalkLipHeight? = nil
    var vehicleIssueType: VehicleIssueType? = nil
    var continuousSessionID: UUID? = nil
    var continuousSequence: Int? = nil
    var latitude: Double?
    var longitude: Double?
    var locationSource: ReportLocationSource? = nil
    var photoLatitude: Double? = nil
    var photoLongitude: Double? = nil
    var locationOverridden: Bool? = nil
    var photoFilename: String?
    var officialEmailAuthorized: Bool? = nil
    var officialEmailDestinationAuthorized: String? = nil
    var officialEmailServerState: OfficialEmailServerState? = nil
    var submissionStatus: SubmissionStatus
    var remoteID: String?
    var lastSubmissionError: String?
    var lastSubmissionAttempt: Date?
    var submissionAttempts: Int

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var officialEmailDestinations: [OfficialEmailDestination] {
        OfficialEmailPolicy.destinations(
            submissionMode: submissionMode,
            quickReportTypes: quickReportTypes,
            rapidReportKind: rapidReportKind,
            vehicleIssueType: vehicleIssueType
        )
    }

    var hasAuthorizedOfficialEmail: Bool {
        officialEmailAuthorized == true
            && officialEmailDestinationAuthorized == "test"
            && !officialEmailDestinations.isEmpty
            && photoFilename != nil
            && coordinate.map {
                OfficialEmailPolicy.isWithinServiceArea($0)
            } == true
    }

    var categorySummary: String {
        if submissionMode == .pos { return "Page of Shame" }
        if let rapidReportKind { return "Repeat · \(rapidReportKind.label)" }
        return categories.isEmpty ? "Quick report" : categories.map(\.label).joined(separator: ", ")
    }

    var shareText: String {
        var lines = [
            "ColumbiaWalks safety report",
            "",
            "Issue: \(categorySummary)",
            "Urgency: \(severity.label)",
            "Observed: \(observedAt.formatted(date: .abbreviated, time: .shortened))",
            "Police involvement: \(policeResponse.label)",
            "Reported party: \(reportedParty.label)",
            "Vehicle involved: \(vehicleInvolved ? "Yes" : "No")",
            "Detailed checklist answers: \(checklistResponses.count)",
            "Submission: \(submissionStatus.label)"
        ]
        if let coordinate {
            lines.append(String(format: "Location: %.6f, %.6f", coordinate.latitude, coordinate.longitude))
            lines.append("Location source: \((locationSource ?? .legacy).label)")
            lines.append(String(format: "Map: https://www.openstreetmap.org/?mlat=%.6f&mlon=%.6f#map=18/%.6f/%.6f", coordinate.latitude, coordinate.longitude, coordinate.latitude, coordinate.longitude))
        } else {
            lines.append("Location: No report pin")
        }
        lines.append("Photo attached: \(photoFilename == nil ? "No" : "Yes")")
        if !quickReportTypes.isEmpty {
            lines.append("Quick type: \(quickReportTypes.map(\.label).joined(separator: ", "))")
        }
        if vehicleInvolved {
            let plate = vehicleDetails.licensePlate.trimmingCharacters(in: .whitespacesAndNewlines)
            let plateState = vehicleDetails.plateState.trimmingCharacters(in: .whitespacesAndNewlines)
            if !plate.isEmpty {
                lines.append("License plate: \(plate)\(plateState.isEmpty ? "" : " (\(plateState))")")
            }
        }
        if let officialEmailServerState {
            lines.append("Field-test email: \(officialEmailServerState.shortLabel)")
        } else if hasAuthorizedOfficialEmail {
            lines.append("Field-test email: Authorized only for the ColumbiaWalks-controlled test mailbox with a [TEST] subject after successful upload; delivery is not confirmed")
        }
        if !details.isEmpty {
            lines += ["", "Additional information:", details]
        }
        lines += ["", "Saved locally with ColumbiaWalks."]
        return lines.joined(separator: "\n")
    }
}
