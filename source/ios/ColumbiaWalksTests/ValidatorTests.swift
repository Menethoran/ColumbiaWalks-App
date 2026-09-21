import CoreLocation
import Foundation
import ImageIO
import XCTest
@testable import ColumbiaWalks

final class ValidatorTests: XCTestCase {
    func testQuickReportAllowsNoCategoryOrLocation() {
        XCTAssertNil(ReportValidator.validate(
            mode: .quick,
            categories: [],
            otherDetails: "",
            details: "",
            locationConfirmed: false
        ))
    }

    func testFullReportRequiresCategoryAndLocation() {
        XCTAssertNotNil(ReportValidator.validate(
            mode: .full,
            categories: [],
            otherDetails: "",
            details: "",
            locationConfirmed: false
        ))
        XCTAssertNotNil(ReportValidator.validate(
            mode: .full,
            categories: [.sidewalkSafety],
            otherDetails: "",
            details: "",
            locationConfirmed: false
        ))
    }

    func testOtherCategoryRequiresDescription() {
        XCTAssertNotNil(ReportValidator.validate(
            mode: .full,
            categories: [.notIncludedElsewhere],
            otherDetails: "  ",
            details: "",
            locationConfirmed: true
        ))
    }

    func testFeedbackValidation() {
        XCTAssertNil(FeedbackValidator.validate(
            category: .featureRequest,
            text: "Please add dark mode.",
            email: "resident@example.com"
        ))
        XCTAssertNotNil(FeedbackValidator.validate(
            category: .featureRequest,
            text: "Please add dark mode.",
            email: "not-an-email"
        ))
    }

    func testVehicleFieldLimitsMatchIntakeValidation() {
        var vehicle = VehicleDetails()
        vehicle.licensePlate = String(repeating: "A", count: 20)
        XCTAssertNil(vehicle.validationError)
        vehicle.licensePlate.append("B")
        XCTAssertNotNil(vehicle.validationError)
    }

    func testCoordinateValidationRejectsOutOfRangeValues() {
        XCTAssertNotNil(CoordinateValidator.coordinate(
            latitude: "40.0337",
            longitude: "-76.5044"
        ))
        XCTAssertNil(CoordinateValidator.coordinate(
            latitude: "91",
            longitude: "-76.5044"
        ))
        XCTAssertNil(CoordinateValidator.coordinate(
            latitude: "not a number",
            longitude: "-76.5044"
        ))
    }

    func testRapidReportRequiresPictureAndConfirmedLocation() {
        var draft = ReportLocationDraft()
        XCTAssertNotNil(RapidReportValidator.validate(
            hasPhoto: false,
            location: draft,
            comments: ""
        ))
        XCTAssertNotNil(RapidReportValidator.validate(
            hasPhoto: true,
            location: draft,
            comments: ""
        ))
        draft.useDevice(AppState.columbiaCenter)
        XCTAssertNil(RapidReportValidator.validate(
            hasPhoto: true,
            location: draft,
            comments: "Observed while walking"
        ))
    }
}

final class PoliceTipDraftTests: XCTestCase {
    func testValidationRequiresPastNotInProgressConfirmation() {
        var draft = validDraft()
        draft.isPastAndNotInProgress = false

        XCTAssertEqual(
            PoliceTipValidator.validate(draft, now: Date(timeIntervalSince1970: 100)),
            "Confirm that the incident is in the past and is not currently in progress."
        )
    }

    func testValidationRequiresSubjectLocationAndFirsthandObservation() {
        var draft = validDraft()
        draft.subject = "   "
        XCTAssertNotNil(PoliceTipValidator.validate(draft, now: Date(timeIntervalSince1970: 100)))

        draft = validDraft()
        draft.location = "\n"
        XCTAssertNotNil(PoliceTipValidator.validate(draft, now: Date(timeIntervalSince1970: 100)))

        draft = validDraft()
        draft.firsthandObservation = "  "
        XCTAssertNotNil(PoliceTipValidator.validate(draft, now: Date(timeIntervalSince1970: 100)))
    }

    func testValidationRejectsFutureObservation() {
        var draft = validDraft()
        draft.observedAt = Date(timeIntervalSince1970: 161)

        XCTAssertNotNil(
            PoliceTipValidator.validate(draft, now: Date(timeIntervalSince1970: 100))
        )
    }

    func testBuilderProducesDeterministicLabeledClipboardText() {
        var draft = validDraft()
        draft.subject = "  Unsafe   pass\nnear crosswalk  "
        draft.observedAt = Date(timeIntervalSince1970: 0)
        draft.location = "  Third and Locust Streets  "
        draft.directionOfTravel = "east toward Fourth Street"
        draft.licensePlate = " ABC   123 "
        draft.plateState = " PA "
        draft.vehicleDescription = "Blue four-door sedan"
        draft.firsthandObservation = "The driver entered the occupied crosswalk."
        draft.evidenceNotes = "Original plate photo and MOV video are on the device."

        let prepared = PoliceTipDraftBuilder.prepare(draft)

        XCTAssertEqual(prepared.subject, "Unsafe pass near crosswalk")
        XCTAssertEqual(
            prepared.narrative,
            """
            Incident status: Past / not currently in progress

            Date/time observed: 1969-12-31 7:00 PM EST

            Location: Third and Locust Streets

            Direction of travel: east toward Fourth Street

            License plate: ABC 123

            Plate state/jurisdiction: PA

            Vehicle description:
            Blue four-door sedan

            Firsthand observation:
            The driver entered the occupied crosswalk.

            Evidence notes:
            Original plate photo and MOV video are on the device.

            Local-only privacy note: This draft and any media were not sent to ColumbiaWalks.
            """
        )
        XCTAssertEqual(
            prepared.clipboardText,
            "Subject:\nUnsafe pass near crosswalk\n\nMessage:\n\(prepared.narrative)"
        )
    }

    private func validDraft() -> PoliceTipDraft {
        PoliceTipDraft(
            subject: "Traffic safety concern",
            observedAt: Date(timeIntervalSince1970: 50),
            location: "Third and Locust Streets",
            directionOfTravel: "",
            licensePlate: "",
            plateState: "",
            vehicleDescription: "",
            firsthandObservation: "I saw the vehicle enter the crosswalk.",
            evidenceNotes: "",
            isPastAndNotInProgress: true
        )
    }
}

final class TrashCanSubmissionTests: XCTestCase {
    func testCategoryKeysExactlyMatchThe316Contract() {
        XCTAssertEqual(
            TrashCanPublicCommentCategory.allCases.map(\.rawValue),
            [
                "clean_well_maintained",
                "needs_cleaning",
                "full_or_overflowing",
                "damaged",
                "hard_to_access",
                "poor_location",
                "request_new_can",
                "other"
            ]
        )
        XCTAssertEqual(
            TrashCanPrivateComplaintCategory.allCases.map(\.rawValue),
            [
                "full_or_overflowing",
                "damaged",
                "missing",
                "odor_or_pests",
                "illegal_dumping",
                "unsafe_or_obstructing",
                "missed_service",
                "other"
            ]
        )
    }

    func testPublicCommentRequiresPublicScopeAndMatchingCategory() {
        XCTAssertNil(TrashCanValidator.validate(
            kind: .publicComment,
            categoryKey: "needs_cleaning",
            comment: "Needs a cleaning visit.",
            address: "300 block of Locust Street",
            assetScope: .publicProperty,
            latitude: nil,
            longitude: nil
        ))
        XCTAssertNotNil(TrashCanValidator.validate(
            kind: .publicComment,
            categoryKey: "odor_or_pests",
            comment: "There is a persistent odor.",
            address: "300 block of Locust Street",
            assetScope: .publicProperty,
            latitude: nil,
            longitude: nil
        ))
        XCTAssertNotNil(TrashCanValidator.validate(
            kind: .publicComment,
            categoryKey: "needs_cleaning",
            comment: "Needs a cleaning visit.",
            address: "300 block of Locust Street",
            assetScope: .privateProperty,
            latitude: nil,
            longitude: nil
        ))
    }

    func testCommentLengthMatchesServerMinimumAndMaximum() {
        XCTAssertNotNil(validationError(comment: "ab"))
        XCTAssertNil(validationError(comment: "abc"))
        XCTAssertNil(validationError(comment: String(repeating: "x", count: 2_000)))
        XCTAssertNotNil(validationError(comment: String(repeating: "x", count: 2_001)))
        XCTAssertNil(validationError(comment: "😀😀"))
        XCTAssertNil(validationError(comment: String(repeating: "😀", count: 1_000)))
        XCTAssertNotNil(validationError(comment: String(repeating: "😀", count: 1_001)))
    }

    func testAddressLengthUsesTheServersUTF16Boundary() {
        XCTAssertNil(validationError(address: String(repeating: "😀", count: 250)))
        XCTAssertNotNil(validationError(address: String(repeating: "😀", count: 251)))
    }

    func testCoordinatesMustBePairedAndInRange() {
        XCTAssertNotNil(validationError(latitude: 40.03, longitude: nil))
        XCTAssertNotNil(validationError(latitude: 91, longitude: -76.5))
        XCTAssertNil(validationError(latitude: 40.03, longitude: -76.5))
    }

    func testJSONEncodingUsesExactTrashCanContractKeysAndValues() throws {
        let id = try XCTUnwrap(UUID(uuidString: "7d9be9f8-540d-4b06-88ed-b7700583a1d2"))
        let submission = TrashCanSubmission(
            id: id,
            kind: .privateComplaint,
            categories: ["illegal_dumping"],
            comment: "Bags were left beside the can.",
            address: "Fourth and Locust Streets",
            latitude: 40.0319,
            longitude: -76.5022,
            assetScope: .unknown,
            appVersion: "ios-3.16.0",
            submissionSource: "ios"
        )

        let data = try JSONEncoder.api.encode(submission)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(
            Set(json.keys),
            Set([
                "submission_id",
                "kind",
                "categories",
                "comment",
                "address",
                "latitude",
                "longitude",
                "asset_scope",
                "app_version",
                "submission_source"
            ])
        )
        XCTAssertEqual((json["submission_id"] as? String)?.lowercased(), id.uuidString.lowercased())
        XCTAssertEqual(json["kind"] as? String, "private_complaint")
        XCTAssertEqual(json["categories"] as? [String], ["illegal_dumping"])
        XCTAssertEqual(json["comment"] as? String, "Bags were left beside the can.")
        XCTAssertEqual(json["address"] as? String, "Fourth and Locust Streets")
        XCTAssertEqual(json["asset_scope"] as? String, "unknown")
        XCTAssertEqual(json["app_version"] as? String, "ios-3.16.0")
        XCTAssertEqual(json["submission_source"] as? String, "ios")
    }

    private func validationError(
        comment: String = "Valid comment",
        address: String = "Fourth and Locust Streets",
        latitude: Double? = nil,
        longitude: Double? = nil
    ) -> String? {
        TrashCanValidator.validate(
            kind: .privateComplaint,
            categoryKey: "damaged",
            comment: comment,
            address: address,
            assetScope: .unknown,
            latitude: latitude,
            longitude: longitude
        )
    }
}

final class ColumbiaAreaTests: XCTestCase {
    func testColumbiaCenterIsNearby() {
        XCTAssertTrue(ColumbiaArea.contains(AppState.columbiaCenter))
    }

    func testPhiladelphiaIsOutsideNearbyRadius() {
        XCTAssertFalse(ColumbiaArea.contains(
            CLLocationCoordinate2D(latitude: 39.9526, longitude: -75.1652)
        ))
    }
}

final class ReportLocationDraftTests: XCTestCase {
    func testAutomaticDeviceFallbackCannotReplacePictureGPS() throws {
        var draft = ReportLocationDraft()
        let photo = CLLocationCoordinate2D(latitude: 40.0337, longitude: -76.5044)
        let device = CLLocationCoordinate2D(latitude: 40.0400, longitude: -76.5100)

        draft.usePhoto(photo)
        XCTAssertFalse(draft.useDeviceFallback(device))
        XCTAssertEqual(draft.source, .photoEXIF)
        XCTAssertFalse(draft.locationOverridden)
        XCTAssertEqual(try XCTUnwrap(draft.latitude), photo.latitude, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(draft.longitude), photo.longitude, accuracy: 0.000_001)

        draft.useDevice(device)
        XCTAssertEqual(draft.source, .deviceGPS)
        XCTAssertTrue(draft.locationOverridden)
        XCTAssertEqual(try XCTUnwrap(draft.latitude), device.latitude, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(draft.longitude), device.longitude, accuracy: 0.000_001)
    }

    func testAutomaticDeviceFallbackFillsAnEmptyDraft() {
        var draft = ReportLocationDraft()

        XCTAssertTrue(draft.useDeviceFallback(AppState.columbiaCenter))
        XCTAssertEqual(draft.source, .deviceGPS)
        XCTAssertTrue(draft.isConfirmed)
        XCTAssertFalse(draft.locationOverridden)
    }

    func testPhotoLocationCanBeManuallyOverriddenWithoutLosingProvenance() throws {
        var draft = ReportLocationDraft()
        let photo = CLLocationCoordinate2D(latitude: 40.0337, longitude: -76.5044)
        let manual = CLLocationCoordinate2D(latitude: 40.0340, longitude: -76.5050)

        draft.usePhoto(photo)
        XCTAssertEqual(draft.source, .photoEXIF)
        XCTAssertFalse(draft.locationOverridden)

        draft.useManual(manual, source: .manualCoordinates)
        XCTAssertEqual(draft.source, .manualCoordinates)
        XCTAssertTrue(draft.locationOverridden)
        XCTAssertEqual(try XCTUnwrap(draft.photoLatitude), photo.latitude, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(draft.photoLongitude), photo.longitude, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(draft.latitude), manual.latitude, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(draft.longitude), manual.longitude, accuracy: 0.000_001)
    }

    func testRemovingThePhotoClearsAnExifOnlyLocation() {
        var draft = ReportLocationDraft()
        draft.usePhoto(AppState.columbiaCenter)
        draft.removePhotoProvenance()
        XCTAssertFalse(draft.isConfirmed)
        XCTAssertEqual(draft.source, .none)
        XCTAssertNil(draft.photoCoordinate)
    }
}

final class PhotoSelectionGenerationTests: XCTestCase {
    func testOnlyTheNewestPhotoLoadCanApply() {
        var generation = PhotoSelectionGeneration()
        let first = generation.begin()
        let second = generation.begin()

        XCTAssertFalse(generation.accepts(first))
        XCTAssertTrue(generation.accepts(second))

        generation.invalidate()
        XCTAssertFalse(generation.accepts(second))
    }
}

final class PendingSubmissionDrainTests: XCTestCase {
    func testNewPendingReportIsDrainedWithoutRetryingAnAttemptedReport() {
        let first = makeReport(status: .pending)
        let second = makeReport(status: .pending)
        var reports = [first]
        var drain = PendingSubmissionDrain()

        XCTAssertEqual(drain.takeNextIDs(from: reports), [first.id])

        reports.insert(second, at: 0)
        XCTAssertEqual(drain.takeNextIDs(from: reports), [second.id])
        XCTAssertTrue(drain.takeNextIDs(from: reports).isEmpty)
    }

    private func makeReport(status: SubmissionStatus) -> SafetyReport {
        let id = UUID()
        return SafetyReport(
            id: id,
            clientReportID: id,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            observedAt: Date(timeIntervalSince1970: 1_700_000_000),
            categories: [],
            severity: .medium,
            policeResponse: .notInvolved,
            details: "",
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: false,
            vehicleDetails: VehicleDetails(),
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .quick,
            quickReportTypes: [],
            nearestIntersection: nil,
            latitude: nil,
            longitude: nil,
            photoFilename: nil,
            submissionStatus: status,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )
    }
}

final class PhotoMetadataTests: XCTestCase {
    func testReadsSignedGPSCoordinateFromImageProperties() throws {
        let properties: [String: Any] = [
            kCGImagePropertyGPSDictionary as String: [
                kCGImagePropertyGPSLatitude as String: NSNumber(value: 40.0337),
                kCGImagePropertyGPSLatitudeRef as String: "N",
                kCGImagePropertyGPSLongitude as String: NSNumber(value: 76.5044),
                kCGImagePropertyGPSLongitudeRef as String: "W"
            ]
        ]
        let coordinate = try XCTUnwrap(PhotoMetadata.coordinate(from: properties))
        XCTAssertEqual(coordinate.latitude, 40.0337, accuracy: 0.000_001)
        XCTAssertEqual(coordinate.longitude, -76.5044, accuracy: 0.000_001)
    }
}

final class ReportPayloadTests: XCTestCase {
    func testRapidSidewalkPayloadMatchesThe316IntakeContract() throws {
        let sessionID = try XCTUnwrap(UUID(uuidString: "e03e14d7-2f0b-4ec7-b48c-e1386ebd72ca"))
        let reportID = UUID()
        let report = SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            observedAt: Date(timeIntervalSince1970: 1_700_000_000),
            categories: [.sidewalkSafety],
            severity: .medium,
            policeResponse: .notInvolved,
            details: "Raised panel",
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: false,
            vehicleDetails: VehicleDetails(),
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .quick,
            quickReportTypes: [],
            nearestIntersection: nil,
            rapidReportKind: .sidewalk,
            sidewalkLipHeight: .overHalfInch,
            continuousSessionID: sessionID,
            continuousSequence: 4,
            latitude: 40.034,
            longitude: -76.505,
            locationSource: .manualCoordinates,
            photoLatitude: 40.0337,
            photoLongitude: -76.5044,
            locationOverridden: true,
            photoFilename: "report.jpg",
            submissionStatus: .pending,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["app_version"] as? String, "3.16.0")
        XCTAssertEqual(json["submission_mode"] as? String, "quick")
        XCTAssertEqual(json["rapid_report_kind"] as? String, "sidewalk")
        XCTAssertEqual(json["sidewalk_lip_height"] as? String, "over_half_inch")
        XCTAssertEqual(json["continuous_session_id"] as? String, sessionID.uuidString.lowercased())
        XCTAssertEqual(json["continuous_sequence"] as? Int, 4)
        XCTAssertEqual(json["location_source"] as? String, "manual_coordinates")
        XCTAssertEqual(try XCTUnwrap(json["photo_latitude"] as? Double), 40.0337, accuracy: 0.000_001)
        XCTAssertEqual(try XCTUnwrap(json["photo_longitude"] as? Double), -76.5044, accuracy: 0.000_001)
        XCTAssertEqual(json["location_overridden"] as? Bool, true)
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
        XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
        XCTAssertEqual(json["categories"] as? [String], ["sidewalk_safety"])
    }

    func testRapidMissingSidewalkUsesQuickTypesAndAuthorizesTestEmail() throws {
        let report = makeReport(
            quickReportTypes: [.missingSidewalk],
            rapidReportKind: .sidewalk,
            officialEmailAuthorized: true,
            officialEmailDestinationAuthorized: "test"
        )

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["quick_report_types"] as? [String], ["missing_sidewalk"])
        XCTAssertEqual(json["rapid_report_kind"] as? String, "sidewalk")
        XCTAssertNil(json["sidewalk_issue_type"])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, true)
        XCTAssertEqual(json["official_email_destination_authorized"] as? String, "test")
        XCTAssertEqual(report.officialEmailDestinations, [.codes])
    }

    func testRapidVehicleCrosswalkIncursionIncludesPlateAndAuthorizesTestEmail() throws {
        var vehicle = VehicleDetails()
        vehicle.licensePlate = "ABC1234"
        vehicle.plateState = "PA"
        let report = makeReport(
            rapidReportKind: .vehicle,
            vehicleIssueType: .crosswalkIncursion,
            vehicleInvolved: true,
            vehicleDetails: vehicle,
            officialEmailAuthorized: true,
            officialEmailDestinationAuthorized: "test"
        )

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let vehicleJSON = try XCTUnwrap(json["vehicle_details"] as? [String: Any])
        XCTAssertEqual(json["vehicle_issue_type"] as? String, "crosswalk_incursion")
        XCTAssertEqual(vehicleJSON["license_plate"] as? String, "ABC1234")
        XCTAssertEqual(vehicleJSON["plate_state"] as? String, "PA")
        XCTAssertEqual(json["official_email_authorized"] as? Bool, true)
        XCTAssertEqual(json["official_email_destination_authorized"] as? String, "test")
        XCTAssertEqual(report.officialEmailDestinations, [.policeChiefAndMayor])
    }

    func testOfficialEmailAuthorizationIsForcedFalseForNonqualifyingIssue() throws {
        let report = makeReport(
            quickReportTypes: [.speeding],
            officialEmailAuthorized: true
        )

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
        XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
        XCTAssertTrue(report.officialEmailDestinations.isEmpty)
    }

    func testMixedStandardQuickSelectionsNeverAuthorizeFieldTestEmail() throws {
        let mixedSelections: [[QuickReportType]] = [
            [.crosswalkEncroachment, .speeding],
            [.crosswalkEncroachment, .missingSidewalk]
        ]

        for quickTypes in mixedSelections {
            let report = makeReport(
                quickReportTypes: quickTypes,
                officialEmailAuthorized: true,
                officialEmailDestinationAuthorized: "test"
            )
            let data = try APIClient.payloadData(for: report)
            let json = try XCTUnwrap(
                JSONSerialization.jsonObject(with: data) as? [String: Any]
            )

            XCTAssertTrue(report.officialEmailDestinations.isEmpty)
            XCTAssertFalse(report.hasAuthorizedOfficialEmail)
            XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
            XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
        }
    }

    func testDuplicateQuickSelectionNeverAuthorizesFieldTestEmail() throws {
        let duplicateReports = [
            makeReport(
                quickReportTypes: [.crosswalkEncroachment, .crosswalkEncroachment],
                officialEmailAuthorized: true,
                officialEmailDestinationAuthorized: "test"
            ),
            makeReport(
                quickReportTypes: [.missingSidewalk, .missingSidewalk],
                rapidReportKind: .sidewalk,
                officialEmailAuthorized: true,
                officialEmailDestinationAuthorized: "test"
            )
        ]

        for report in duplicateReports {
            let data = try APIClient.payloadData(for: report)
            let json = try XCTUnwrap(
                JSONSerialization.jsonObject(with: data) as? [String: Any]
            )

            XCTAssertTrue(report.officialEmailDestinations.isEmpty)
            XCTAssertFalse(report.hasAuthorizedOfficialEmail)
            XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
            XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
        }
    }

    func testRepeatVehicleCrosswalkRejectsEveryStrayQuickKey() throws {
        for strayType in QuickReportType.allCases {
            let report = makeReport(
                quickReportTypes: [strayType],
                rapidReportKind: .vehicle,
                vehicleIssueType: .crosswalkIncursion,
                vehicleInvolved: true,
                officialEmailAuthorized: true,
                officialEmailDestinationAuthorized: "test"
            )
            let data = try APIClient.payloadData(for: report)
            let json = try XCTUnwrap(
                JSONSerialization.jsonObject(with: data) as? [String: Any]
            )

            XCTAssertTrue(report.officialEmailDestinations.isEmpty)
            XCTAssertFalse(report.hasAuthorizedOfficialEmail)
            XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
            XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
        }
    }

    func testQualifyingClassificationDoesNotAuthorizeWithoutDisclosureFlag() throws {
        let report = makeReport(quickReportTypes: [.crosswalkEncroachment])

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(report.officialEmailDestinations, [.policeChiefAndMayor])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
        XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)
    }

    func testOfficialEmailRequiresTestDestinationConsentAndNeverEmitsOfficial() throws {
        var report = makeReport(
            quickReportTypes: [.crosswalkEncroachment],
            officialEmailAuthorized: true
        )

        var data = try APIClient.payloadData(for: report)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertFalse(report.hasAuthorizedOfficialEmail)
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
        XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)

        report.officialEmailDestinationAuthorized = "official"
        data = try APIClient.payloadData(for: report)
        json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertFalse(report.hasAuthorizedOfficialEmail)
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
        XCTAssertTrue(json["official_email_destination_authorized"] is NSNull)

        report.officialEmailDestinationAuthorized = "test"
        data = try APIClient.payloadData(for: report)
        json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertTrue(report.hasAuthorizedOfficialEmail)
        XCTAssertEqual(json["official_email_authorized"] as? Bool, true)
        XCTAssertEqual(json["official_email_destination_authorized"] as? String, "test")
    }

    func testOfficialEmailAuthorizationIsForcedFalseWithoutRequiredPhotoOrLocation() throws {
        var report = makeReport(
            quickReportTypes: [.crosswalkEncroachment],
            officialEmailAuthorized: true,
            officialEmailDestinationAuthorized: "test"
        )
        report.photoFilename = nil

        var data = try APIClient.payloadData(for: report)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)

        report.photoFilename = "report.jpg"
        report.latitude = nil
        report.longitude = nil
        data = try APIClient.payloadData(for: report)
        json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
    }

    func testOfficialEmailAuthorizationIsForcedFalseOutsideServiceArea() throws {
        var report = makeReport(
            quickReportTypes: [.missingSidewalk],
            officialEmailAuthorized: true,
            officialEmailDestinationAuthorized: "test"
        )
        report.latitude = 41.0
        report.longitude = -76.5

        let data = try APIClient.payloadData(for: report)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["official_email_authorized"] as? Bool, false)
    }

    func testOfficialEmailPolicyAllowsOnlyExactInitialRules() {
        XCTAssertEqual(
            OfficialEmailPolicy.destinations(
                submissionMode: .quick,
                quickReportTypes: [QuickReportType.crosswalkEncroachment]
            ),
            [.policeChiefAndMayor]
        )
        XCTAssertEqual(
            OfficialEmailPolicy.destinations(
                submissionMode: .quick,
                quickReportTypes: [QuickReportType.missingSidewalk]
            ),
            [.codes]
        )
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [QuickReportType.speeding]
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [
                QuickReportType.crosswalkEncroachment,
                QuickReportType.speeding
            ]
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [
                QuickReportType.crosswalkEncroachment,
                QuickReportType.missingSidewalk
            ]
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [
                QuickReportType.crosswalkEncroachment,
                QuickReportType.crosswalkEncroachment
            ]
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .full,
            quickReportTypes: [QuickReportType.crosswalkEncroachment]
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .pos,
            quickReportTypes: [],
            rapidReportKind: .vehicle,
            vehicleIssueType: .crosswalkIncursion
        ).isEmpty)
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [],
            rapidReportKind: .crosswalk
        ).isEmpty)
        XCTAssertEqual(
            OfficialEmailPolicy.destinations(
                submissionMode: .quick,
                quickReportTypes: [],
                rapidReportKind: .vehicle,
                vehicleIssueType: .crosswalkIncursion
            ),
            [.policeChiefAndMayor]
        )
        XCTAssertTrue(OfficialEmailPolicy.destinations(
            submissionMode: .quick,
            quickReportTypes: [QuickReportType.speeding],
            rapidReportKind: .vehicle,
            vehicleIssueType: .crosswalkIncursion
        ).isEmpty)
    }

    func testOfficialEmailServiceAreaIncludesCenterAndExactBoundary() {
        XCTAssertTrue(OfficialEmailPolicy.isWithinServiceArea(
            OfficialEmailPolicy.serviceAreaCenter
        ))
        XCTAssertTrue(OfficialEmailPolicy.isWithinServiceArea(
            distanceMeters: OfficialEmailPolicy.serviceAreaRadiusMeters
        ))
    }

    func testOfficialEmailServiceAreaRejectsOutsideAndInvalidCoordinates() {
        XCTAssertFalse(OfficialEmailPolicy.isWithinServiceArea(
            CLLocationCoordinate2D(latitude: 40.10, longitude: -76.5044)
        ))
        XCTAssertFalse(OfficialEmailPolicy.isWithinServiceArea(
            distanceMeters: OfficialEmailPolicy.serviceAreaRadiusMeters + 0.01
        ))
        XCTAssertFalse(OfficialEmailPolicy.isWithinServiceArea(
            CLLocationCoordinate2D(latitude: .nan, longitude: -76.5044)
        ))
    }

    func testLegacySavedReportStillDecodesWithout314Fields() throws {
        let reportID = UUID()
        let report = SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            observedAt: Date(timeIntervalSince1970: 1_700_000_000),
            categories: [],
            severity: .low,
            policeResponse: .notInvolved,
            details: "",
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: false,
            vehicleDetails: VehicleDetails(),
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .quick,
            quickReportTypes: [],
            nearestIntersection: nil,
            latitude: nil,
            longitude: nil,
            photoFilename: nil,
            submissionStatus: .local,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )
        let data = try JSONEncoder.persistence.encode(report)
        let decoded = try JSONDecoder.persistence.decode(SafetyReport.self, from: data)
        XCTAssertEqual(decoded.id, reportID)
        XCTAssertNil(decoded.rapidReportKind)
        XCTAssertNil(decoded.locationSource)
        XCTAssertNil(decoded.locationOverridden)
        XCTAssertNil(decoded.officialEmailAuthorized)
        XCTAssertNil(decoded.officialEmailDestinationAuthorized)
    }

    private func makeReport(
        quickReportTypes: [QuickReportType] = [],
        rapidReportKind: RapidReportKind? = nil,
        vehicleIssueType: VehicleIssueType? = nil,
        vehicleInvolved: Bool = false,
        vehicleDetails: VehicleDetails = VehicleDetails(),
        officialEmailAuthorized: Bool = false,
        officialEmailDestinationAuthorized: String? = nil
    ) -> SafetyReport {
        let reportID = UUID()
        return SafetyReport(
            id: reportID,
            clientReportID: reportID,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            observedAt: Date(timeIntervalSince1970: 1_700_000_000),
            categories: rapidReportKind == .sidewalk ? [.sidewalkSafety] : [.vehicleSafety],
            severity: .medium,
            policeResponse: .notInvolved,
            details: "Test report",
            checklistResponses: [:],
            reportedParty: .unknown,
            vehicleInvolved: vehicleInvolved,
            vehicleDetails: vehicleDetails,
            policeObservations: [],
            policeComplaintDetails: "",
            submissionMode: .quick,
            quickReportTypes: quickReportTypes,
            nearestIntersection: nil,
            rapidReportKind: rapidReportKind,
            vehicleIssueType: vehicleIssueType,
            latitude: 40.034,
            longitude: -76.505,
            locationSource: .deviceGPS,
            photoFilename: "report.jpg",
            officialEmailAuthorized: officialEmailAuthorized,
            officialEmailDestinationAuthorized: officialEmailDestinationAuthorized,
            submissionStatus: .pending,
            remoteID: nil,
            lastSubmissionError: nil,
            lastSubmissionAttempt: nil,
            submissionAttempts: 0
        )
    }
}

final class ReportSubmissionResultTests: XCTestCase {
    func testDecodesRecordedOfficialEmailDeliveryStatesAndBlockedReason() throws {
        let cases: [(deliveryStatus: String, blockedReason: String?, expectedLabel: String)] = [
            ("queued", nil, "Queued for server processing"),
            ("review", nil, "Held for server review"),
            ("disabled", "delivery_disabled", "Automatic delivery disabled"),
            ("blocked", "outside_service_area", "Blocked: outside the 5 km service area")
        ]
        for (deliveryStatus, blockedReason, expectedLabel) in cases {
            let result = try submissionResult(
                intakeStatus: "recorded",
                deliveryStatus: deliveryStatus,
                blockedReason: blockedReason
            )
            let state = try XCTUnwrap(result.officialEmailServerState)
            XCTAssertEqual(result.remoteID, "417")
            XCTAssertEqual(state.status, "recorded")
            XCTAssertEqual(state.deliveries.count, 1)
            XCTAssertEqual(state.deliveries[0].ruleID, "codes_missing_sidewalk_v1")
            XCTAssertEqual(state.deliveries[0].status, deliveryStatus)
            XCTAssertEqual(state.deliveries[0].blockedReason, blockedReason)
            XCTAssertEqual(state.destinationMode, "test")
            XCTAssertEqual(state.deliveries[0].destinationMode, "test")
            XCTAssertEqual(
                state.destinationModeLabel,
                "ColumbiaWalks-controlled test mailbox"
            )
            XCTAssertEqual(state.deliveries[0].statusLabel, expectedLabel)
            XCTAssertTrue(state.acceptanceSummary.contains("Report accepted by ColumbiaWalks."))
            XCTAssertTrue(state.acceptanceSummary.contains("[TEST]"))
            XCTAssertTrue(state.acceptanceSummary.contains("not to Police, the Mayor, or Codes"))
        }
    }

    func testDecodesRecipientModeAliasAsTestMailbox() throws {
        let data = Data(#"{"data":{"id":"alias-id"},"official_email":{"status":"recorded","recipient_mode":"test","deliveries":[]}}"#.utf8)
        let result = APIClient.submissionResult(
            from: data,
            fallbackReportID: "fallback-id",
            officialEmailWasAuthorized: true
        )
        let state = try XCTUnwrap(result.officialEmailServerState)
        XCTAssertEqual(state.destinationMode, "test")
        XCTAssertEqual(
            state.destinationModeLabel,
            "ColumbiaWalks-controlled test mailbox"
        )
    }

    func testMissingOrUnexpectedDestinationModeNeverImpliesOfficialRecipient() throws {
        let missing = try submissionResult(
            intakeStatus: "recorded",
            destinationMode: nil
        )
        let missingState = try XCTUnwrap(missing.officialEmailServerState)
        XCTAssertEqual(
            missingState.destinationModeLabel,
            "Test-mailbox mode not confirmed by server"
        )
        XCTAssertTrue(missingState.acceptanceSummary.contains("controlled test mailbox"))

        let unexpected = try submissionResult(
            intakeStatus: "recorded",
            destinationMode: "official"
        )
        let unexpectedState = try XCTUnwrap(unexpected.officialEmailServerState)
        XCTAssertEqual(
            unexpectedState.destinationModeLabel,
            "Unexpected non-test server mode"
        )
        XCTAssertTrue(unexpectedState.acceptanceSummary.contains("inconsistent non-test mode"))
        XCTAssertTrue(unexpectedState.acceptanceSummary.contains("does not confirm any recipient"))
    }

    func testDecodesNotEligibleAndDeferredOfficialEmailResults() throws {
        let notEligible = try submissionResult(intakeStatus: "not_eligible")
        XCTAssertEqual(
            notEligible.officialEmailServerState?.shortLabel,
            "Field-test email not eligible"
        )
        XCTAssertTrue(
            try XCTUnwrap(notEligible.officialEmailServerState)
                .acceptanceSummary.contains("no email was authorized")
        )

        let deferred = try submissionResult(intakeStatus: "deferred")
        XCTAssertEqual(
            deferred.officialEmailServerState?.shortLabel,
            "Field-test email setup deferred"
        )
        XCTAssertTrue(
            try XCTUnwrap(deferred.officialEmailServerState)
                .acceptanceSummary.contains("delivery is not confirmed")
        )
    }

    func testAuthorizedSubmissionRecordsMissingServerEmailStatusHonestly() throws {
        let data = Data(#"{"data":{"id":"accepted-id"}}"#.utf8)
        let authorized = APIClient.submissionResult(
            from: data,
            fallbackReportID: "fallback-id",
            officialEmailWasAuthorized: true
        )
        XCTAssertEqual(authorized.remoteID, "accepted-id")
        XCTAssertEqual(
            authorized.officialEmailServerState,
            OfficialEmailServerState.responseMissing
        )
        XCTAssertTrue(
            try XCTUnwrap(authorized.officialEmailServerState)
                .acceptanceSummary.contains("did not return a field-test email status")
        )

        let ordinary = APIClient.submissionResult(
            from: data,
            fallbackReportID: "fallback-id",
            officialEmailWasAuthorized: false
        )
        XCTAssertNil(ordinary.officialEmailServerState)
    }

    private func submissionResult(
        intakeStatus: String,
        deliveryStatus: String? = nil,
        blockedReason: String? = nil,
        destinationMode: String? = "test"
    ) throws -> ReportSubmissionResult {
        var officialEmail: [String: Any] = [
            "status": intakeStatus,
            "deliveries": []
        ]
        if let destinationMode {
            officialEmail["destination_mode"] = destinationMode
        }
        if let deliveryStatus {
            var delivery: [String: Any] = [
                "rule_id": "codes_missing_sidewalk_v1",
                "status": deliveryStatus
            ]
            if let destinationMode {
                delivery["destination_mode"] = destinationMode
            }
            if let blockedReason {
                delivery["blocked_reason"] = blockedReason
            } else {
                delivery["blocked_reason"] = NSNull()
            }
            officialEmail["deliveries"] = [delivery]
        }
        let data = try JSONSerialization.data(withJSONObject: [
            "data": ["id": 417],
            "official_email": officialEmail
        ])
        return APIClient.submissionResult(
            from: data,
            fallbackReportID: "fallback-id",
            officialEmailWasAuthorized: true
        )
    }
}
