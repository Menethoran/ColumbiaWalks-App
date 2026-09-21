package org.columbiawalks.app.data;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.columbiawalks.app.domain.OfficialEmailPolicy;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public final class ReportDatabaseHelper extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "columbia_walks.db";
    private static final int DATABASE_VERSION = 10;
    private static final String TABLE_REPORTS = "safety_reports";

    private static final String COLUMN_ID = "_id";
    private static final String COLUMN_CREATED_AT = "created_at";
    private static final String COLUMN_OBSERVED_AT = "observed_at";
    private static final String COLUMN_CATEGORIES = "categories";
    private static final String COLUMN_SEVERITY = "severity";
    private static final String COLUMN_POLICE_RESPONSE = "police_response";
    private static final String COLUMN_DETAILS = "details";
    private static final String COLUMN_ASSESSMENT_MODE = "assessment_mode";
    private static final String COLUMN_CHECKLIST_RESPONSES =
            "checklist_responses";
    private static final String COLUMN_REPORTED_PARTY_TYPE =
            "reported_party_type";
    private static final String COLUMN_VEHICLE_INVOLVED =
            "vehicle_involved";
    private static final String COLUMN_VEHICLE_DETAILS = "vehicle_details";
    private static final String COLUMN_POLICE_OBSERVATIONS =
            "police_observations";
    private static final String COLUMN_POLICE_COMPLAINT_DETAILS =
            "police_complaint_details";
    private static final String COLUMN_SUBMISSION_MODE = "submission_mode";
    private static final String COLUMN_QUICK_REPORT_TYPE =
            "quick_report_type";
    private static final String COLUMN_NEAREST_INTERSECTION =
            "nearest_intersection";
    private static final String COLUMN_RAPID_REPORT_KIND =
            "rapid_report_kind";
    private static final String COLUMN_SIDEWALK_LIP_HEIGHT =
            "sidewalk_lip_height";
    private static final String COLUMN_VEHICLE_ISSUE_TYPE =
            "vehicle_issue_type";
    private static final String COLUMN_CONTINUOUS_SESSION_ID =
            "continuous_session_id";
    private static final String COLUMN_CONTINUOUS_SEQUENCE =
            "continuous_sequence";
    private static final String COLUMN_LOCATION_CONFIRMED =
            "location_confirmed";
    private static final String COLUMN_LATITUDE = "latitude";
    private static final String COLUMN_LONGITUDE = "longitude";
    private static final String COLUMN_LOCATION_SOURCE = "location_source";
    private static final String COLUMN_PHOTO_LATITUDE = "photo_latitude";
    private static final String COLUMN_PHOTO_LONGITUDE = "photo_longitude";
    private static final String COLUMN_LOCATION_OVERRIDDEN =
            "location_overridden";
    private static final String COLUMN_PHOTO_PATH = "photo_path";
    private static final String COLUMN_CLIENT_REPORT_ID = "client_report_id";
    private static final String COLUMN_SUBMISSION_STATUS = "submission_status";
    private static final String COLUMN_REMOTE_ID = "remote_id";
    private static final String COLUMN_LAST_SUBMISSION_ERROR = "last_submission_error";
    private static final String COLUMN_LAST_SUBMISSION_ATTEMPT =
            "last_submission_attempt";
    private static final String COLUMN_OFFICIAL_EMAIL_AUTHORIZED =
            "official_email_authorized";
    private static final String COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED =
            "official_email_destination_authorized";
    private static final String COLUMN_OFFICIAL_EMAIL_RESULT =
            "official_email_result";
    private static final String COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE =
            "official_email_destination_mode";

    public ReportDatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase database) {
        database.execSQL(
                "CREATE TABLE " + TABLE_REPORTS + " (" +
                        COLUMN_ID + " INTEGER PRIMARY KEY AUTOINCREMENT, " +
                        COLUMN_CREATED_AT + " INTEGER NOT NULL, " +
                        COLUMN_OBSERVED_AT + " TEXT NOT NULL, " +
                        COLUMN_CATEGORIES + " TEXT NOT NULL, " +
                        COLUMN_SEVERITY + " TEXT NOT NULL, " +
                        COLUMN_POLICE_RESPONSE + " TEXT NOT NULL, " +
                        COLUMN_DETAILS + " TEXT NOT NULL, " +
                        COLUMN_ASSESSMENT_MODE
                        + " TEXT NOT NULL DEFAULT 'quick_report', " +
                        COLUMN_CHECKLIST_RESPONSES
                        + " TEXT NOT NULL DEFAULT '{}', " +
                        COLUMN_REPORTED_PARTY_TYPE
                        + " TEXT NOT NULL DEFAULT 'unknown', " +
                        COLUMN_VEHICLE_INVOLVED
                        + " INTEGER NOT NULL DEFAULT 0, " +
                        COLUMN_VEHICLE_DETAILS
                        + " TEXT NOT NULL DEFAULT '{}', " +
                        COLUMN_POLICE_OBSERVATIONS
                        + " TEXT NOT NULL DEFAULT '[]', " +
                        COLUMN_POLICE_COMPLAINT_DETAILS
                        + " TEXT NOT NULL DEFAULT '', " +
                        COLUMN_SUBMISSION_MODE
                        + " TEXT NOT NULL DEFAULT 'full', " +
                        COLUMN_QUICK_REPORT_TYPE + " TEXT, " +
                        COLUMN_NEAREST_INTERSECTION + " TEXT, " +
                        COLUMN_RAPID_REPORT_KIND + " TEXT, " +
                        COLUMN_SIDEWALK_LIP_HEIGHT + " TEXT, " +
                        COLUMN_VEHICLE_ISSUE_TYPE + " TEXT, " +
                        COLUMN_CONTINUOUS_SESSION_ID + " TEXT, " +
                        COLUMN_CONTINUOUS_SEQUENCE
                        + " INTEGER NOT NULL DEFAULT 0, " +
                        COLUMN_LOCATION_CONFIRMED
                        + " INTEGER NOT NULL DEFAULT 1, " +
                        COLUMN_LATITUDE + " REAL NOT NULL, " +
                        COLUMN_LONGITUDE + " REAL NOT NULL, " +
                        COLUMN_LOCATION_SOURCE
                        + " TEXT NOT NULL DEFAULT 'none', " +
                        COLUMN_PHOTO_LATITUDE + " REAL, " +
                        COLUMN_PHOTO_LONGITUDE + " REAL, " +
                        COLUMN_LOCATION_OVERRIDDEN
                        + " INTEGER NOT NULL DEFAULT 0, " +
                        COLUMN_PHOTO_PATH + " TEXT, " +
                        COLUMN_CLIENT_REPORT_ID + " TEXT NOT NULL UNIQUE, " +
                        COLUMN_SUBMISSION_STATUS + " TEXT NOT NULL, " +
                        COLUMN_REMOTE_ID + " TEXT, " +
                        COLUMN_LAST_SUBMISSION_ERROR + " TEXT, " +
                        COLUMN_LAST_SUBMISSION_ATTEMPT
                        + " INTEGER NOT NULL DEFAULT 0, " +
                        COLUMN_OFFICIAL_EMAIL_AUTHORIZED
                        + " INTEGER NOT NULL DEFAULT 0, " +
                        COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED + " TEXT, " +
                        COLUMN_OFFICIAL_EMAIL_RESULT + " TEXT, " +
                        COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE + " TEXT)"
        );
    }

    @Override
    public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_CLIENT_REPORT_ID + " TEXT NOT NULL DEFAULT ''");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_SUBMISSION_STATUS + " TEXT NOT NULL DEFAULT '"
                    + SafetyReport.STATUS_LOCAL + "'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_REMOTE_ID + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_LAST_SUBMISSION_ERROR + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_LAST_SUBMISSION_ATTEMPT
                    + " INTEGER NOT NULL DEFAULT 0");

            try (Cursor cursor = database.query(
                    TABLE_REPORTS,
                    new String[]{COLUMN_ID},
                    null,
                    null,
                    null,
                    null,
                    null
            )) {
                while (cursor.moveToNext()) {
                    ContentValues values = new ContentValues();
                    values.put(COLUMN_CLIENT_REPORT_ID, UUID.randomUUID().toString());
                    database.update(
                            TABLE_REPORTS,
                            values,
                            COLUMN_ID + " = ?",
                            new String[]{String.valueOf(cursor.getLong(0))}
                    );
                }
            }
            database.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS "
                    + "idx_safety_reports_client_id ON " + TABLE_REPORTS
                    + "(" + COLUMN_CLIENT_REPORT_ID + ")");
        }
        if (oldVersion < 3) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_PHOTO_PATH + " TEXT");
        }
        if (oldVersion < 4) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_ASSESSMENT_MODE
                    + " TEXT NOT NULL DEFAULT 'quick_report'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_CHECKLIST_RESPONSES
                    + " TEXT NOT NULL DEFAULT '{}'");
        }
        if (oldVersion < 5) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_REPORTED_PARTY_TYPE
                    + " TEXT NOT NULL DEFAULT 'unknown'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_VEHICLE_INVOLVED
                    + " INTEGER NOT NULL DEFAULT 0");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_VEHICLE_DETAILS
                    + " TEXT NOT NULL DEFAULT '{}'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_POLICE_OBSERVATIONS
                    + " TEXT NOT NULL DEFAULT '[]'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_POLICE_COMPLAINT_DETAILS
                    + " TEXT NOT NULL DEFAULT ''");
        }
        if (oldVersion < 6) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_SUBMISSION_MODE
                    + " TEXT NOT NULL DEFAULT 'full'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_QUICK_REPORT_TYPE + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_NEAREST_INTERSECTION + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_LOCATION_CONFIRMED
                    + " INTEGER NOT NULL DEFAULT 1");
        }
        if (oldVersion < 7) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_RAPID_REPORT_KIND + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_SIDEWALK_LIP_HEIGHT + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_VEHICLE_ISSUE_TYPE + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_CONTINUOUS_SESSION_ID + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_CONTINUOUS_SEQUENCE
                    + " INTEGER NOT NULL DEFAULT 0");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_LOCATION_SOURCE
                    + " TEXT NOT NULL DEFAULT 'none'");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_PHOTO_LATITUDE + " REAL");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_PHOTO_LONGITUDE + " REAL");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_LOCATION_OVERRIDDEN
                    + " INTEGER NOT NULL DEFAULT 0");
            database.execSQL("UPDATE " + TABLE_REPORTS + " SET "
                    + COLUMN_LOCATION_SOURCE + " = CASE WHEN "
                    + COLUMN_LOCATION_CONFIRMED + " = 1 THEN 'legacy' "
                    + "ELSE 'none' END");
        }
        if (oldVersion < 8) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_OFFICIAL_EMAIL_AUTHORIZED
                    + " INTEGER NOT NULL DEFAULT 0");
        }
        if (oldVersion < 9) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_OFFICIAL_EMAIL_RESULT + " TEXT");
        }
        if (oldVersion < 10) {
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED + " TEXT");
            database.execSQL("ALTER TABLE " + TABLE_REPORTS + " ADD COLUMN "
                    + COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE + " TEXT");
            // Pre-v10 authorization referred to a different recipient model.
            // It must not be relabeled or reused as consent for the field-test
            // mailbox. Preserve the report evidence while revoking only the
            // stale email authorization and delivery-result state.
            database.execSQL("UPDATE " + TABLE_REPORTS + " SET "
                    + COLUMN_OFFICIAL_EMAIL_AUTHORIZED + " = 0, "
                    + COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED + " = NULL, "
                    + COLUMN_OFFICIAL_EMAIL_RESULT + " = NULL, "
                    + COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE + " = NULL");
        }
    }

    public long insertReport(SafetyReport report) {
        ContentValues values = new ContentValues();
        values.put(COLUMN_CLIENT_REPORT_ID, report.getClientReportId());
        values.put(COLUMN_CREATED_AT, report.getCreatedAt());
        values.put(COLUMN_OBSERVED_AT, report.getObservedAt());
        values.put(COLUMN_CATEGORIES, report.getCategories());
        values.put(COLUMN_SEVERITY, report.getSeverity());
        values.put(COLUMN_POLICE_RESPONSE, report.getPoliceResponse());
        values.put(COLUMN_DETAILS, report.getDetails());
        values.put(COLUMN_ASSESSMENT_MODE, report.getAssessmentMode());
        values.put(
                COLUMN_CHECKLIST_RESPONSES,
                report.getChecklistResponses()
        );
        values.put(
                COLUMN_REPORTED_PARTY_TYPE,
                report.getReportedPartyType()
        );
        values.put(
                COLUMN_VEHICLE_INVOLVED,
                report.isVehicleInvolved() ? 1 : 0
        );
        values.put(COLUMN_VEHICLE_DETAILS, report.getVehicleDetails());
        values.put(
                COLUMN_POLICE_OBSERVATIONS,
                report.getPoliceObservations()
        );
        values.put(
                COLUMN_POLICE_COMPLAINT_DETAILS,
                report.getPoliceComplaintDetails()
        );
        values.put(COLUMN_SUBMISSION_MODE, report.getSubmissionMode());
        if (report.getQuickReportTypes() == null) {
            values.putNull(COLUMN_QUICK_REPORT_TYPE);
        } else {
            values.put(
                    COLUMN_QUICK_REPORT_TYPE,
                    report.getQuickReportTypes()
            );
        }
        if (report.getNearestIntersection() == null) {
            values.putNull(COLUMN_NEAREST_INTERSECTION);
        } else {
            values.put(
                    COLUMN_NEAREST_INTERSECTION,
                    report.getNearestIntersection()
            );
        }
        putNullableString(values, COLUMN_RAPID_REPORT_KIND,
                report.getRapidReportKind());
        putNullableString(values, COLUMN_SIDEWALK_LIP_HEIGHT,
                report.getSidewalkLipHeight());
        putNullableString(values, COLUMN_VEHICLE_ISSUE_TYPE,
                report.getVehicleIssueType());
        putNullableString(values, COLUMN_CONTINUOUS_SESSION_ID,
                report.getContinuousSessionId());
        values.put(COLUMN_CONTINUOUS_SEQUENCE, report.getContinuousSequence());
        values.put(
                COLUMN_LOCATION_CONFIRMED,
                report.isLocationConfirmed() ? 1 : 0
        );
        values.put(COLUMN_LATITUDE, report.getLatitude());
        values.put(COLUMN_LONGITUDE, report.getLongitude());
        values.put(COLUMN_LOCATION_SOURCE, report.getLocationSource());
        putNullableDouble(values, COLUMN_PHOTO_LATITUDE,
                report.getPhotoLatitude());
        putNullableDouble(values, COLUMN_PHOTO_LONGITUDE,
                report.getPhotoLongitude());
        values.put(COLUMN_LOCATION_OVERRIDDEN,
                report.isLocationOverridden() ? 1 : 0);
        if (report.hasPhoto()) {
            values.put(COLUMN_PHOTO_PATH, report.getPhotoPath());
        } else {
            values.putNull(COLUMN_PHOTO_PATH);
        }
        values.put(COLUMN_SUBMISSION_STATUS, report.getSubmissionStatus());
        values.put(COLUMN_REMOTE_ID, report.getRemoteId());
        values.put(COLUMN_LAST_SUBMISSION_ERROR, report.getLastSubmissionError());
        values.put(COLUMN_LAST_SUBMISSION_ATTEMPT, report.getLastSubmissionAttempt());
        values.put(
                COLUMN_OFFICIAL_EMAIL_AUTHORIZED,
                report.isOfficialEmailAuthorized() ? 1 : 0
        );
        putNullableString(
                values,
                COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED,
                OfficialEmailPolicy.isAuthorizedForTestDestination(report)
                        ? SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST
                        : null
        );
        putNullableString(
                values,
                COLUMN_OFFICIAL_EMAIL_RESULT,
                report.getOfficialEmailResult()
        );
        putNullableString(
                values,
                COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE,
                report.getOfficialEmailDestinationMode()
        );
        return getWritableDatabase().insertOrThrow(TABLE_REPORTS, null, values);
    }

    public List<SafetyReport> getAllReports() {
        List<SafetyReport> reports = new ArrayList<>();
        String orderBy = COLUMN_CREATED_AT + " DESC";

        try (Cursor cursor = getReadableDatabase().query(
                TABLE_REPORTS,
                null,
                null,
                null,
                null,
                null,
                orderBy
        )) {
            while (cursor.moveToNext()) {
                reports.add(readReport(cursor));
            }
        }
        return reports;
    }

    public SafetyReport getReport(long id) {
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_REPORTS,
                null,
                COLUMN_ID + " = ?",
                new String[]{String.valueOf(id)},
                null,
                null,
                null,
                "1"
        )) {
            return cursor.moveToFirst() ? readReport(cursor) : null;
        }
    }

    /**
     * Returns the first unused one-based sequence for a continuous-report
     * session. This lets a recreated reporting flow reconcile its saved UI
     * state with reports that were already committed locally.
     */
    public int getNextContinuousSequence(String sessionId) {
        if (sessionId == null || sessionId.trim().isEmpty()) {
            return 1;
        }
        String sql = "SELECT MAX(" + COLUMN_CONTINUOUS_SEQUENCE + ") FROM "
                + TABLE_REPORTS + " WHERE " + COLUMN_CONTINUOUS_SESSION_ID
                + " = ?";
        try (Cursor cursor = getReadableDatabase().rawQuery(
                sql,
                new String[]{sessionId}
        )) {
            if (!cursor.moveToFirst() || cursor.isNull(0)) {
                return 1;
            }
            long highestSequence = cursor.getLong(0);
            if (highestSequence < 1) {
                return 1;
            }
            if (highestSequence >= Integer.MAX_VALUE) {
                throw new IllegalStateException(
                        "The continuous-report sequence is exhausted."
                );
            }
            return (int) highestSequence + 1;
        }
    }

    public List<Long> getPendingReportIds() {
        List<Long> ids = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_REPORTS,
                new String[]{COLUMN_ID},
                COLUMN_SUBMISSION_STATUS + " IN (?, ?)",
                new String[]{
                        SafetyReport.STATUS_PENDING,
                        SafetyReport.STATUS_SUBMITTING
                },
                null,
                null,
                null
        )) {
            while (cursor.moveToNext()) {
                ids.add(cursor.getLong(0));
            }
        }
        return ids;
    }

    public void markPending(long id) {
        updateSubmission(
                id,
                SafetyReport.STATUS_PENDING,
                null,
                null,
                System.currentTimeMillis()
        );
    }

    public void updateSubmission(
            long id,
            String status,
            String remoteId,
            String error,
            long attemptTime
    ) {
        updateSubmission(
                id,
                status,
                remoteId,
                error,
                attemptTime,
                null,
                false,
                null,
                false
        );
    }

    public void updateSubmission(
            long id,
            String status,
            String remoteId,
            String error,
            long attemptTime,
            String officialEmailResult
    ) {
        updateSubmission(
                id,
                status,
                remoteId,
                error,
                attemptTime,
                officialEmailResult,
                true,
                null,
                false
        );
    }

    public void updateSubmission(
            long id,
            String status,
            String remoteId,
            String error,
            long attemptTime,
            String officialEmailResult,
            String officialEmailDestinationMode
    ) {
        updateSubmission(
                id,
                status,
                remoteId,
                error,
                attemptTime,
                officialEmailResult,
                true,
                officialEmailDestinationMode,
                true
        );
    }

    private void updateSubmission(
            long id,
            String status,
            String remoteId,
            String error,
            long attemptTime,
            String officialEmailResult,
            boolean updateOfficialEmailResult,
            String officialEmailDestinationMode,
            boolean updateOfficialEmailDestinationMode
    ) {
        ContentValues values = new ContentValues();
        values.put(COLUMN_SUBMISSION_STATUS, status);
        values.put(COLUMN_LAST_SUBMISSION_ATTEMPT, attemptTime);
        if (remoteId == null) {
            values.putNull(COLUMN_REMOTE_ID);
        } else {
            values.put(COLUMN_REMOTE_ID, remoteId);
        }
        if (error == null) {
            values.putNull(COLUMN_LAST_SUBMISSION_ERROR);
        } else {
            values.put(COLUMN_LAST_SUBMISSION_ERROR, error);
        }
        if (updateOfficialEmailResult) {
            putNullableString(
                    values,
                    COLUMN_OFFICIAL_EMAIL_RESULT,
                    officialEmailResult
            );
        }
        if (updateOfficialEmailDestinationMode) {
            putNullableString(
                    values,
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE,
                    officialEmailDestinationMode
            );
        }
        getWritableDatabase().update(
                TABLE_REPORTS,
                values,
                COLUMN_ID + " = ?",
                new String[]{String.valueOf(id)}
        );
    }

    private SafetyReport readReport(Cursor cursor) {
        return new SafetyReport(
                cursor.getLong(cursor.getColumnIndexOrThrow(COLUMN_ID)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_CLIENT_REPORT_ID)),
                cursor.getLong(cursor.getColumnIndexOrThrow(COLUMN_CREATED_AT)),
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_OBSERVED_AT)),
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_CATEGORIES)),
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_SEVERITY)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_POLICE_RESPONSE)),
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_DETAILS)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_ASSESSMENT_MODE)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_CHECKLIST_RESPONSES)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_REPORTED_PARTY_TYPE)),
                cursor.getInt(cursor.getColumnIndexOrThrow(
                        COLUMN_VEHICLE_INVOLVED)) != 0,
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_VEHICLE_DETAILS)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_POLICE_OBSERVATIONS)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_POLICE_COMPLAINT_DETAILS)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_SUBMISSION_MODE)),
                cursor.isNull(cursor.getColumnIndexOrThrow(
                        COLUMN_QUICK_REPORT_TYPE))
                        ? null
                        : cursor.getString(cursor.getColumnIndexOrThrow(
                                COLUMN_QUICK_REPORT_TYPE)),
                cursor.isNull(cursor.getColumnIndexOrThrow(
                        COLUMN_NEAREST_INTERSECTION))
                        ? null
                        : cursor.getString(cursor.getColumnIndexOrThrow(
                                COLUMN_NEAREST_INTERSECTION)),
                nullableString(cursor, COLUMN_RAPID_REPORT_KIND),
                nullableString(cursor, COLUMN_SIDEWALK_LIP_HEIGHT),
                nullableString(cursor, COLUMN_VEHICLE_ISSUE_TYPE),
                nullableString(cursor, COLUMN_CONTINUOUS_SESSION_ID),
                cursor.getInt(cursor.getColumnIndexOrThrow(
                        COLUMN_CONTINUOUS_SEQUENCE)),
                cursor.getInt(cursor.getColumnIndexOrThrow(
                        COLUMN_LOCATION_CONFIRMED)) != 0,
                cursor.getDouble(cursor.getColumnIndexOrThrow(COLUMN_LATITUDE)),
                cursor.getDouble(cursor.getColumnIndexOrThrow(COLUMN_LONGITUDE)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_LOCATION_SOURCE)),
                nullableDouble(cursor, COLUMN_PHOTO_LATITUDE),
                nullableDouble(cursor, COLUMN_PHOTO_LONGITUDE),
                cursor.getInt(cursor.getColumnIndexOrThrow(
                        COLUMN_LOCATION_OVERRIDDEN)) != 0,
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_PHOTO_PATH)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_SUBMISSION_STATUS)),
                cursor.getString(cursor.getColumnIndexOrThrow(COLUMN_REMOTE_ID)),
                cursor.getString(cursor.getColumnIndexOrThrow(
                        COLUMN_LAST_SUBMISSION_ERROR)),
                cursor.getLong(cursor.getColumnIndexOrThrow(
                        COLUMN_LAST_SUBMISSION_ATTEMPT)),
                cursor.getInt(cursor.getColumnIndexOrThrow(
                        COLUMN_OFFICIAL_EMAIL_AUTHORIZED)) != 0,
                nullableString(
                        cursor,
                        COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED
                ),
                nullableString(cursor, COLUMN_OFFICIAL_EMAIL_RESULT),
                nullableString(cursor, COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE)
        );
    }

    private static void putNullableString(
            ContentValues values,
            String column,
            String value
    ) {
        if (value == null || value.trim().isEmpty()) {
            values.putNull(column);
        } else {
            values.put(column, value);
        }
    }

    private static void putNullableDouble(
            ContentValues values,
            String column,
            Double value
    ) {
        if (value == null) {
            values.putNull(column);
        } else {
            values.put(column, value);
        }
    }

    private static String nullableString(Cursor cursor, String column) {
        int index = cursor.getColumnIndexOrThrow(column);
        return cursor.isNull(index) ? null : cursor.getString(index);
    }

    private static Double nullableDouble(Cursor cursor, String column) {
        int index = cursor.getColumnIndexOrThrow(column);
        return cursor.isNull(index) ? null : cursor.getDouble(index);
    }

    public boolean deleteReport(long id) {
        SafetyReport report = getReport(id);
        int deleted = getWritableDatabase().delete(
                TABLE_REPORTS,
                COLUMN_ID + " = ?",
                new String[]{String.valueOf(id)}
        );
        if (deleted > 0 && report != null && report.hasPhoto()) {
            File photo = new File(report.getPhotoPath());
            if (photo.isFile()) {
                // The database row is authoritative; a stale file is harmless
                // if the operating system cannot remove it immediately.
                photo.delete();
            }
        }
        return deleted > 0;
    }
}
