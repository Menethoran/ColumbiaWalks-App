package org.columbiawalks.app.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * A local-only draft used to prepare text for the Police Department's own
 * website. This type intentionally has no networking or media APIs.
 */
public final class PoliceTipDraft {
    private static final int MAX_SUBJECT_LENGTH = 128;
    private static final int MAX_SHORT_FIELD_LENGTH = 500;
    private static final int MAX_OBSERVATION_LENGTH = 5_000;
    private static final int MAX_EVIDENCE_LENGTH = 2_000;

    public enum ValidationResult {
        VALID,
        NOT_CONFIRMED_PAST_OR_INACTIVE,
        NO_SUBJECT,
        NO_OBSERVED_TIME,
        NO_LOCATION,
        NO_FIRSTHAND_OBSERVATION,
        FIELD_TOO_LONG
    }

    private final boolean pastOrInactiveConfirmed;
    private final String subject;
    private final String observedTime;
    private final String location;
    private final String direction;
    private final String licensePlate;
    private final String plateState;
    private final String vehicleDescription;
    private final String firsthandObservation;
    private final String evidenceNotes;
    private final boolean sourceWasSubmittedToColumbiaWalks;

    private PoliceTipDraft(Builder builder) {
        pastOrInactiveConfirmed = builder.pastOrInactiveConfirmed;
        subject = clean(builder.subject);
        observedTime = clean(builder.observedTime);
        location = clean(builder.location);
        direction = clean(builder.direction);
        licensePlate = clean(builder.licensePlate);
        plateState = clean(builder.plateState);
        vehicleDescription = clean(builder.vehicleDescription);
        firsthandObservation = clean(builder.firsthandObservation);
        evidenceNotes = clean(builder.evidenceNotes);
        sourceWasSubmittedToColumbiaWalks =
                builder.sourceWasSubmittedToColumbiaWalks;
    }

    public ValidationResult validate() {
        if (!pastOrInactiveConfirmed) {
            return ValidationResult.NOT_CONFIRMED_PAST_OR_INACTIVE;
        }
        if (subject.isEmpty()) {
            return ValidationResult.NO_SUBJECT;
        }
        if (observedTime.isEmpty()) {
            return ValidationResult.NO_OBSERVED_TIME;
        }
        if (location.isEmpty()) {
            return ValidationResult.NO_LOCATION;
        }
        if (firsthandObservation.isEmpty()) {
            return ValidationResult.NO_FIRSTHAND_OBSERVATION;
        }
        if (subject.length() > MAX_SUBJECT_LENGTH
                || observedTime.length() > MAX_SHORT_FIELD_LENGTH
                || location.length() > MAX_SHORT_FIELD_LENGTH
                || direction.length() > MAX_SHORT_FIELD_LENGTH
                || licensePlate.length() > MAX_SHORT_FIELD_LENGTH
                || plateState.length() > MAX_SHORT_FIELD_LENGTH
                || vehicleDescription.length() > MAX_SHORT_FIELD_LENGTH
                || firsthandObservation.length() > MAX_OBSERVATION_LENGTH
                || evidenceNotes.length() > MAX_EVIDENCE_LENGTH) {
            return ValidationResult.FIELD_TOO_LONG;
        }
        return ValidationResult.VALID;
    }

    public PreparedTip prepare() {
        ValidationResult validation = validate();
        if (validation != ValidationResult.VALID) {
            throw new IllegalStateException(
                    "Cannot prepare an invalid police tip: " + validation
            );
        }

        String preparedSubject = singleLine(subject);
        List<String> sections = new ArrayList<>();
        sections.add("ANONYMOUS TIP — PAST / NOT IN PROGRESS");
        sections.add("Subject: " + subject);
        sections.add("Observed date/time: " + observedTime);
        sections.add("Location: " + location);
        addIfPresent(sections, "Direction of travel: ", direction);

        String plate = licensePlate;
        if (!plateState.isEmpty()) {
            plate = plate.isEmpty()
                    ? "State/jurisdiction only: " + plateState
                    : plate + " (" + plateState + ")";
        }
        addIfPresent(sections, "License plate: ", plate);
        addIfPresent(
                sections,
                "Vehicle description: ",
                vehicleDescription
        );
        sections.add("Firsthand observation:\n" + firsthandObservation);
        addIfPresent(sections, "Evidence available:\n", evidenceNotes);
        sections.add(sourceWasSubmittedToColumbiaWalks
                ? "This report was saved to ColumbiaWalks. ColumbiaWalks "
                + "did not send this draft or media to CBPD; I am "
                + "submitting it personally through the official form."
                : "Prepared locally in ColumbiaWalks. No tip text or media "
                + "was sent to ColumbiaWalks or CBPD.");

        String narrative = String.join("\n\n", sections);
        return new PreparedTip(
                preparedSubject,
                narrative,
                "Subject:\n" + preparedSubject
                        + "\n\nMessage:\n" + narrative
        );
    }

    private static void addIfPresent(
            List<String> sections,
            String label,
            String value
    ) {
        if (!value.isEmpty()) {
            sections.add(label + value);
        }
    }

    private static String clean(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\r\n", "\n")
                .replace('\r', '\n')
                .trim();
    }

    private static String singleLine(String value) {
        return value.replaceAll("\\s+", " ").trim();
    }

    public static final class PreparedTip {
        private final String subject;
        private final String narrative;
        private final String clipboardText;

        private PreparedTip(
                String subject,
                String narrative,
                String clipboardText
        ) {
            this.subject = subject;
            this.narrative = narrative;
            this.clipboardText = clipboardText;
        }

        public String getSubject() {
            return subject;
        }

        public String getNarrative() {
            return narrative;
        }

        public String getClipboardText() {
            return clipboardText;
        }
    }

    public static final class Builder {
        private boolean pastOrInactiveConfirmed;
        private String subject;
        private String observedTime;
        private String location;
        private String direction;
        private String licensePlate;
        private String plateState;
        private String vehicleDescription;
        private String firsthandObservation;
        private String evidenceNotes;
        private boolean sourceWasSubmittedToColumbiaWalks;

        public Builder setPastOrInactiveConfirmed(boolean confirmed) {
            pastOrInactiveConfirmed = confirmed;
            return this;
        }

        public Builder setSubject(String value) {
            subject = value;
            return this;
        }

        public Builder setObservedTime(String value) {
            observedTime = value;
            return this;
        }

        public Builder setLocation(String value) {
            location = value;
            return this;
        }

        public Builder setDirection(String value) {
            direction = value;
            return this;
        }

        public Builder setLicensePlate(String value) {
            licensePlate = value;
            return this;
        }

        public Builder setPlateState(String value) {
            plateState = value;
            return this;
        }

        public Builder setVehicleDescription(String value) {
            vehicleDescription = value;
            return this;
        }

        public Builder setFirsthandObservation(String value) {
            firsthandObservation = value;
            return this;
        }

        public Builder setEvidenceNotes(String value) {
            evidenceNotes = value;
            return this;
        }

        public Builder setSourceWasSubmittedToColumbiaWalks(boolean value) {
            sourceWasSubmittedToColumbiaWalks = value;
            return this;
        }

        public PoliceTipDraft build() {
            return new PoliceTipDraft(this);
        }
    }
}
