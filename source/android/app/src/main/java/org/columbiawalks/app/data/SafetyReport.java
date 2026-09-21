package org.columbiawalks.app.data;

import java.util.Locale;

public final class SafetyReport {
    public static final String STATUS_LOCAL = "local";
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_SUBMITTING = "submitting";
    public static final String STATUS_SUBMITTED = "submitted";
    public static final String STATUS_FAILED = "failed";
    public static final String OFFICIAL_EMAIL_RESULT_QUEUED = "queued";
    public static final String OFFICIAL_EMAIL_RESULT_REVIEW = "review";
    public static final String OFFICIAL_EMAIL_RESULT_DISABLED = "disabled";
    public static final String OFFICIAL_EMAIL_RESULT_BLOCKED = "blocked";
    public static final String OFFICIAL_EMAIL_RESULT_DEFERRED = "deferred";
    public static final String OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE = "not_eligible";
    public static final String OFFICIAL_EMAIL_RESULT_HELD_CAP = "held_cap";
    public static final String OFFICIAL_EMAIL_RESULT_RETRY = "retry";
    public static final String OFFICIAL_EMAIL_RESULT_PREPARING = "preparing";
    public static final String OFFICIAL_EMAIL_RESULT_SENDING = "sending";
    public static final String OFFICIAL_EMAIL_RESULT_SENT = "sent";
    public static final String OFFICIAL_EMAIL_RESULT_UNCERTAIN = "uncertain";
    public static final String OFFICIAL_EMAIL_RESULT_MIXED = "mixed";
    public static final String OFFICIAL_EMAIL_RESULT_UNAVAILABLE = "unavailable";
    public static final String OFFICIAL_EMAIL_DESTINATION_TEST = "test";
    public static final String OFFICIAL_EMAIL_DESTINATION_OFFICIAL = "official";

    private final long id;
    private final String clientReportId;
    private final long createdAt;
    private final String observedAt;
    private final String categories;
    private final String severity;
    private final String policeResponse;
    private final String details;
    private final String assessmentMode;
    private final String checklistResponses;
    private final String reportedPartyType;
    private final boolean vehicleInvolved;
    private final String vehicleDetails;
    private final String policeObservations;
    private final String policeComplaintDetails;
    private final String submissionMode;
    private final String quickReportTypes;
    private final String nearestIntersection;
    private final String rapidReportKind;
    private final String sidewalkLipHeight;
    private final String vehicleIssueType;
    private final String continuousSessionId;
    private final int continuousSequence;
    private final boolean locationConfirmed;
    private final double latitude;
    private final double longitude;
    private final String locationSource;
    private final Double photoLatitude;
    private final Double photoLongitude;
    private final boolean locationOverridden;
    private final String photoPath;
    private final String submissionStatus;
    private final String remoteId;
    private final String lastSubmissionError;
    private final long lastSubmissionAttempt;
    private final boolean officialEmailAuthorized;
    private final String officialEmailDestinationAuthorized;
    private final String officialEmailResult;
    private final String officialEmailDestinationMode;

    public SafetyReport(
            long id,
            String clientReportId,
            long createdAt,
            String observedAt,
            String categories,
            String severity,
            String policeResponse,
            String details,
            String assessmentMode,
            String checklistResponses,
            String reportedPartyType,
            boolean vehicleInvolved,
            String vehicleDetails,
            String policeObservations,
            String policeComplaintDetails,
            String submissionMode,
            String quickReportTypes,
            String nearestIntersection,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String photoPath,
            String submissionStatus,
            String remoteId,
            String lastSubmissionError,
            long lastSubmissionAttempt
    ) {
        this(
                id,
                clientReportId,
                createdAt,
                observedAt,
                categories,
                severity,
                policeResponse,
                details,
                assessmentMode,
                checklistResponses,
                reportedPartyType,
                vehicleInvolved,
                vehicleDetails,
                policeObservations,
                policeComplaintDetails,
                submissionMode,
                quickReportTypes,
                nearestIntersection,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                photoPath,
                submissionStatus,
                remoteId,
                lastSubmissionError,
                lastSubmissionAttempt,
                false,
                null
        );
    }

    public SafetyReport(
            long id,
            String clientReportId,
            long createdAt,
            String observedAt,
            String categories,
            String severity,
            String policeResponse,
            String details,
            String assessmentMode,
            String checklistResponses,
            String reportedPartyType,
            boolean vehicleInvolved,
            String vehicleDetails,
            String policeObservations,
            String policeComplaintDetails,
            String submissionMode,
            String quickReportTypes,
            String nearestIntersection,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String photoPath,
            String submissionStatus,
            String remoteId,
            String lastSubmissionError,
            long lastSubmissionAttempt,
            boolean officialEmailAuthorized
    ) {
        this(
                id,
                clientReportId,
                createdAt,
                observedAt,
                categories,
                severity,
                policeResponse,
                details,
                assessmentMode,
                checklistResponses,
                reportedPartyType,
                vehicleInvolved,
                vehicleDetails,
                policeObservations,
                policeComplaintDetails,
                submissionMode,
                quickReportTypes,
                nearestIntersection,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                photoPath,
                submissionStatus,
                remoteId,
                lastSubmissionError,
                lastSubmissionAttempt,
                officialEmailAuthorized,
                null
        );
    }

    public SafetyReport(
            long id,
            String clientReportId,
            long createdAt,
            String observedAt,
            String categories,
            String severity,
            String policeResponse,
            String details,
            String assessmentMode,
            String checklistResponses,
            String reportedPartyType,
            boolean vehicleInvolved,
            String vehicleDetails,
            String policeObservations,
            String policeComplaintDetails,
            String submissionMode,
            String quickReportTypes,
            String nearestIntersection,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String photoPath,
            String submissionStatus,
            String remoteId,
            String lastSubmissionError,
            long lastSubmissionAttempt,
            boolean officialEmailAuthorized,
            String officialEmailResult
    ) {
        this(
                id,
                clientReportId,
                createdAt,
                observedAt,
                categories,
                severity,
                policeResponse,
                details,
                assessmentMode,
                checklistResponses,
                reportedPartyType,
                vehicleInvolved,
                vehicleDetails,
                policeObservations,
                policeComplaintDetails,
                submissionMode,
                quickReportTypes,
                nearestIntersection,
                rapidReportKind,
                sidewalkLipHeight,
                vehicleIssueType,
                continuousSessionId,
                continuousSequence,
                locationConfirmed,
                latitude,
                longitude,
                locationSource,
                photoLatitude,
                photoLongitude,
                locationOverridden,
                photoPath,
                submissionStatus,
                remoteId,
                lastSubmissionError,
                lastSubmissionAttempt,
                officialEmailAuthorized,
                officialEmailAuthorized
                        ? OFFICIAL_EMAIL_DESTINATION_TEST
                        : null,
                officialEmailResult,
                null
        );
    }

    public SafetyReport(
            long id,
            String clientReportId,
            long createdAt,
            String observedAt,
            String categories,
            String severity,
            String policeResponse,
            String details,
            String assessmentMode,
            String checklistResponses,
            String reportedPartyType,
            boolean vehicleInvolved,
            String vehicleDetails,
            String policeObservations,
            String policeComplaintDetails,
            String submissionMode,
            String quickReportTypes,
            String nearestIntersection,
            String rapidReportKind,
            String sidewalkLipHeight,
            String vehicleIssueType,
            String continuousSessionId,
            int continuousSequence,
            boolean locationConfirmed,
            double latitude,
            double longitude,
            String locationSource,
            Double photoLatitude,
            Double photoLongitude,
            boolean locationOverridden,
            String photoPath,
            String submissionStatus,
            String remoteId,
            String lastSubmissionError,
            long lastSubmissionAttempt,
            boolean officialEmailAuthorized,
            String officialEmailDestinationAuthorized,
            String officialEmailResult,
            String officialEmailDestinationMode
    ) {
        this.id = id;
        this.clientReportId = clientReportId;
        this.createdAt = createdAt;
        this.observedAt = observedAt;
        this.categories = categories;
        this.severity = severity;
        this.policeResponse = policeResponse;
        this.details = details;
        this.assessmentMode = assessmentMode;
        this.checklistResponses = checklistResponses;
        this.reportedPartyType = reportedPartyType;
        this.vehicleInvolved = vehicleInvolved;
        this.vehicleDetails = vehicleDetails;
        this.policeObservations = policeObservations;
        this.policeComplaintDetails = policeComplaintDetails;
        this.submissionMode = submissionMode;
        this.quickReportTypes = quickReportTypes;
        this.nearestIntersection = nearestIntersection;
        this.rapidReportKind = rapidReportKind;
        this.sidewalkLipHeight = sidewalkLipHeight;
        this.vehicleIssueType = vehicleIssueType;
        this.continuousSessionId = continuousSessionId;
        this.continuousSequence = continuousSequence;
        this.locationConfirmed = locationConfirmed;
        this.latitude = latitude;
        this.longitude = longitude;
        this.locationSource = locationSource;
        this.photoLatitude = photoLatitude;
        this.photoLongitude = photoLongitude;
        this.locationOverridden = locationOverridden;
        this.photoPath = photoPath;
        this.submissionStatus = submissionStatus;
        this.remoteId = remoteId;
        this.lastSubmissionError = lastSubmissionError;
        this.lastSubmissionAttempt = lastSubmissionAttempt;
        this.officialEmailAuthorized = officialEmailAuthorized;
        this.officialEmailDestinationAuthorized = officialEmailAuthorized
                && OFFICIAL_EMAIL_DESTINATION_TEST.equals(
                officialEmailDestinationAuthorized)
                ? OFFICIAL_EMAIL_DESTINATION_TEST
                : null;
        this.officialEmailResult = officialEmailResult;
        this.officialEmailDestinationMode =
                OFFICIAL_EMAIL_DESTINATION_TEST.equals(
                        officialEmailDestinationMode)
                        ? OFFICIAL_EMAIL_DESTINATION_TEST
                        : OFFICIAL_EMAIL_DESTINATION_OFFICIAL.equals(
                        officialEmailDestinationMode)
                        ? OFFICIAL_EMAIL_DESTINATION_OFFICIAL
                        : null;
    }

    public long getId() {
        return id;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public String getClientReportId() {
        return clientReportId;
    }

    public String getObservedAt() {
        return observedAt;
    }

    public String getCategories() {
        return categories;
    }

    public String getCategoriesForDisplay() {
        if (categories == null || categories.trim().isEmpty()) {
            return "Quick report";
        }
        return categories.replace("|", ", ").replace('_', ' ');
    }

    public String getSeverity() {
        return severity;
    }

    public String getPoliceResponse() {
        return policeResponse;
    }

    public String getDetails() {
        return details;
    }

    public String getAssessmentMode() {
        return assessmentMode;
    }

    public String getChecklistResponses() {
        return checklistResponses;
    }

    public int getChecklistResponseCount() {
        try {
            return new org.json.JSONObject(checklistResponses).length();
        } catch (org.json.JSONException ignored) {
            return 0;
        }
    }

    public String getReportedPartyType() {
        return reportedPartyType;
    }

    public boolean isVehicleInvolved() {
        return vehicleInvolved;
    }

    public String getVehicleDetails() {
        return vehicleDetails;
    }

    public String getPoliceObservations() {
        return policeObservations;
    }

    public String getPoliceComplaintDetails() {
        return policeComplaintDetails;
    }

    public String getSubmissionMode() {
        return submissionMode;
    }

    public String getQuickReportTypes() {
        return quickReportTypes;
    }

    public String getNearestIntersection() {
        return nearestIntersection;
    }

    public String getRapidReportKind() {
        return rapidReportKind;
    }

    public String getSidewalkLipHeight() {
        return sidewalkLipHeight;
    }

    public String getVehicleIssueType() {
        return vehicleIssueType;
    }

    public String getContinuousSessionId() {
        return continuousSessionId;
    }

    public int getContinuousSequence() {
        return continuousSequence;
    }

    public boolean isLocationConfirmed() {
        return locationConfirmed;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getLocationSource() {
        return locationSource;
    }

    public Double getPhotoLatitude() {
        return photoLatitude;
    }

    public Double getPhotoLongitude() {
        return photoLongitude;
    }

    public boolean hasPhotoCoordinates() {
        return photoLatitude != null && photoLongitude != null;
    }

    public boolean isLocationOverridden() {
        return locationOverridden;
    }

    public String getPhotoPath() {
        return photoPath;
    }

    public boolean hasPhoto() {
        return photoPath != null && !photoPath.trim().isEmpty();
    }

    public String getSubmissionStatus() {
        return submissionStatus;
    }

    public String getRemoteId() {
        return remoteId;
    }

    public String getLastSubmissionError() {
        return lastSubmissionError;
    }

    public long getLastSubmissionAttempt() {
        return lastSubmissionAttempt;
    }

    public boolean isOfficialEmailAuthorized() {
        return officialEmailAuthorized;
    }

    public boolean isOfficialEmailAuthorizedForTestDestination() {
        return officialEmailAuthorized
                && OFFICIAL_EMAIL_DESTINATION_TEST.equals(
                officialEmailDestinationAuthorized);
    }

    public String getOfficialEmailDestinationAuthorized() {
        return officialEmailDestinationAuthorized;
    }

    public String getOfficialEmailResult() {
        return officialEmailResult;
    }

    public String getOfficialEmailDestinationMode() {
        return officialEmailDestinationMode;
    }

    public String getOfficialEmailResultForDisplay() {
        if (!isOfficialEmailAuthorizedForTestDestination()) {
            return "";
        }
        if (!isSubmitted()) {
            return "[TEST] email to the ColumbiaWalks-controlled test mailbox "
                    + "authorized; report upload pending";
        }
        String emailLabel = officialEmailDestinationLabel();
        if (OFFICIAL_EMAIL_RESULT_QUEUED.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel
                    + " queued — delivery not confirmed";
        }
        if (OFFICIAL_EMAIL_RESULT_REVIEW.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " awaiting review";
        }
        if (OFFICIAL_EMAIL_RESULT_DISABLED.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " disabled";
        }
        if (OFFICIAL_EMAIL_RESULT_BLOCKED.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " blocked";
        }
        if (OFFICIAL_EMAIL_RESULT_DEFERRED.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " setup deferred";
        }
        if (OFFICIAL_EMAIL_RESULT_NOT_ELIGIBLE.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " not eligible";
        }
        if (OFFICIAL_EMAIL_RESULT_HELD_CAP.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel
                    + " paused by the delivery limit";
        }
        if (OFFICIAL_EMAIL_RESULT_RETRY.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel
                    + " waiting for a safe retry";
        }
        if (OFFICIAL_EMAIL_RESULT_PREPARING.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " is being prepared";
        }
        if (OFFICIAL_EMAIL_RESULT_SENDING.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " send is in progress";
        }
        if (OFFICIAL_EMAIL_RESULT_SENT.equals(officialEmailResult)) {
            return "Report accepted; Gmail accepted the " + emailLabel
                    + " — recipient delivery not confirmed";
        }
        if (OFFICIAL_EMAIL_RESULT_UNCERTAIN.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel + " outcome needs review";
        }
        if (OFFICIAL_EMAIL_RESULT_MIXED.equals(officialEmailResult)) {
            return "Report accepted; " + emailLabel
                    + " has mixed server states";
        }
        return "Report accepted; " + emailLabel + " result unavailable";
    }

    private String officialEmailDestinationLabel() {
        if (OFFICIAL_EMAIL_DESTINATION_OFFICIAL.equals(
                officialEmailDestinationMode)) {
            return "server-reported official-recipient email "
                    + "(unexpected in this 3.16.1 field test)";
        }
        return "[TEST] email to the ColumbiaWalks-controlled test mailbox";
    }

    public boolean isSubmitted() {
        return STATUS_SUBMITTED.equals(submissionStatus);
    }

    public String getCoordinateText() {
        if (!locationConfirmed) {
            return "No report pin";
        }
        return String.format(Locale.US, "%.6f, %.6f", latitude, longitude);
    }

    public String getMapUrl() {
        if (!locationConfirmed) {
            return "";
        }
        return String.format(
                Locale.US,
                "https://www.openstreetmap.org/?mlat=%.6f&mlon=%.6f#map=18/%.6f/%.6f",
                latitude,
                longitude,
                latitude,
                longitude
        );
    }

    public String toShareText() {
        StringBuilder text = new StringBuilder();
        text.append("ColumbiaWalks safety report\n\n");
        text.append("Issue: ").append(getCategoriesForDisplay()).append('\n');
        text.append("Urgency: ").append(severity).append('\n');
        text.append("Observed: ").append(observedAt).append('\n');
        text.append("Police involvement: ").append(policeResponse).append('\n');
        text.append("Reported party: ")
                .append(reportedPartyType.replace('_', ' '))
                .append('\n');
        text.append("Vehicle involved: ")
                .append(vehicleInvolved ? "Yes" : "No")
                .append('\n');
        text.append("Detailed checklist answers: ")
                .append(getChecklistResponseCount())
                .append('\n');
        text.append("Submission: ").append(getSubmissionStatusForDisplay()).append('\n');
        if (isOfficialEmailAuthorizedForTestDestination()) {
            text.append("Official email: ")
                    .append(getOfficialEmailResultForDisplay())
                    .append('\n');
        }
        text.append("Location: ").append(getCoordinateText()).append('\n');
        text.append("Location source: ")
                .append(locationSource == null
                        ? ReportLocationSource.NONE
                        : locationSource.replace('_', ' '))
                .append('\n');
        if (locationOverridden) {
            text.append("Original photo location overridden: Yes\n");
        }
        if (rapidReportKind != null && !rapidReportKind.isEmpty()) {
            text.append("Rapid report stream: ")
                    .append(rapidReportKind.replace('_', ' '))
                    .append('\n');
        }
        if (sidewalkLipHeight != null && !sidewalkLipHeight.isEmpty()) {
            text.append("Sidewalk lip height: ")
                    .append(sidewalkLipHeight.replace('_', ' '))
                    .append('\n');
        }
        if (vehicleIssueType != null && !vehicleIssueType.isEmpty()) {
            text.append("Vehicle issue: ")
                    .append(vehicleIssueType.replace('_', ' '))
                    .append('\n');
        }
        if (continuousSessionId != null && !continuousSessionId.isEmpty()) {
            text.append("Continuous report number: ")
                    .append(continuousSequence)
                    .append('\n');
        }
        text.append("Photo attached: ").append(hasPhoto() ? "Yes" : "No").append('\n');
        if (locationConfirmed) {
            text.append("Map: ").append(getMapUrl()).append('\n');
        }
        if (!details.trim().isEmpty()) {
            text.append("\nAdditional information:\n").append(details).append('\n');
        }
        text.append("\nSaved locally with ColumbiaWalks.");
        return text.toString();
    }

    public String getSubmissionStatusForDisplay() {
        if (STATUS_PENDING.equals(submissionStatus)) {
            return "Waiting to submit";
        }
        if (STATUS_SUBMITTING.equals(submissionStatus)) {
            return "Submitting";
        }
        if (STATUS_SUBMITTED.equals(submissionStatus)) {
            return "Submitted";
        }
        if (STATUS_FAILED.equals(submissionStatus)) {
            return "Submission needs attention";
        }
        return "Local only";
    }
}
