package org.columbiawalks.app.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class ReportDatabaseHelperTest {
    private static final String DATABASE_NAME = "columbia_walks.db";
    private static final String TABLE_REPORTS = "safety_reports";
    private static final String COLUMN_OFFICIAL_EMAIL_AUTHORIZED =
            "official_email_authorized";
    private static final String COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED =
            "official_email_destination_authorized";
    private static final String COLUMN_OFFICIAL_EMAIL_RESULT =
            "official_email_result";
    private static final String COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE =
            "official_email_destination_mode";

    private Context context;

    @Before
    public void setUp() {
        context = ApplicationProvider.getApplicationContext();
        context.deleteDatabase(DATABASE_NAME);
    }

    @After
    public void tearDown() {
        context.deleteDatabase(DATABASE_NAME);
    }

    @Test
    public void freshDatabasePersistsOneReportAndOfficialEmailResult() {
        try (ReportDatabaseHelper database = new ReportDatabaseHelper(context)) {
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED
            ));
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_RESULT
            ));
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE
            ));

            SafetyReport report = report();
            long id = database.insertReport(report);
            database.updateSubmission(
                    id,
                    SafetyReport.STATUS_SUBMITTED,
                    "remote-report-id",
                    null,
                    1777150800000L,
                    SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED,
                    SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST
            );

            SafetyReport saved = database.getReport(id);
            assertNotNull(saved);
            assertEquals(
                    SafetyReport.OFFICIAL_EMAIL_RESULT_QUEUED,
                    saved.getOfficialEmailResult()
            );
            assertEquals(
                    SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                    saved.getOfficialEmailDestinationAuthorized()
            );
            assertEquals(
                    SafetyReport.OFFICIAL_EMAIL_DESTINATION_TEST,
                    saved.getOfficialEmailDestinationMode()
            );
            assertEquals(1, database.getAllReports().size());
        }
    }

    @Test
    public void versionEightDatabaseAddsAllOfficialEmailResultColumns() {
        try (SQLiteDatabase legacy = context.openOrCreateDatabase(
                DATABASE_NAME,
                Context.MODE_PRIVATE,
                null
        )) {
            legacy.execSQL(
                    "CREATE TABLE " + TABLE_REPORTS + " ("
                            + "_id INTEGER PRIMARY KEY, "
                            + "official_email_authorized INTEGER NOT NULL DEFAULT 0)"
            );
            legacy.execSQL(
                    "INSERT INTO " + TABLE_REPORTS
                            + " (_id, official_email_authorized) VALUES (1, 1)"
            );
            legacy.setVersion(8);
        }

        try (ReportDatabaseHelper database = new ReportDatabaseHelper(context)) {
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_RESULT
            ));
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED
            ));
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE
            ));
            try (Cursor cursor = database.getReadableDatabase().query(
                    TABLE_REPORTS,
                    new String[]{
                            COLUMN_OFFICIAL_EMAIL_AUTHORIZED,
                            COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED,
                            COLUMN_OFFICIAL_EMAIL_RESULT,
                            COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE
                    },
                    "_id = ?",
                    new String[]{"1"},
                    null,
                    null,
                    null
            )) {
                assertTrue(cursor.moveToFirst());
                assertEquals(0, cursor.getInt(0));
                assertTrue(cursor.isNull(1));
                assertTrue(cursor.isNull(2));
                assertTrue(cursor.isNull(3));
            }
        }
    }

    @Test
    public void versionNineDatabaseAddsDestinationColumns() {
        try (SQLiteDatabase legacy = context.openOrCreateDatabase(
                DATABASE_NAME,
                Context.MODE_PRIVATE,
                null
        )) {
            legacy.execSQL(
                    "CREATE TABLE " + TABLE_REPORTS + " ("
                            + "_id INTEGER PRIMARY KEY, "
                            + "official_email_authorized INTEGER NOT NULL DEFAULT 0, "
                            + COLUMN_OFFICIAL_EMAIL_RESULT + " TEXT)"
            );
            legacy.execSQL(
                    "INSERT INTO " + TABLE_REPORTS + " (_id, "
                            + COLUMN_OFFICIAL_EMAIL_AUTHORIZED + ", "
                            + COLUMN_OFFICIAL_EMAIL_RESULT
                            + ") VALUES (1, 1, 'queued')"
            );
            legacy.setVersion(9);
        }

        try (ReportDatabaseHelper database = new ReportDatabaseHelper(context)) {
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED
            ));
            assertTrue(hasColumn(
                    database.getReadableDatabase(),
                    COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE
            ));
            try (Cursor cursor = database.getReadableDatabase().query(
                    TABLE_REPORTS,
                    new String[]{
                            COLUMN_OFFICIAL_EMAIL_AUTHORIZED,
                            COLUMN_OFFICIAL_EMAIL_DESTINATION_AUTHORIZED,
                            COLUMN_OFFICIAL_EMAIL_RESULT,
                            COLUMN_OFFICIAL_EMAIL_DESTINATION_MODE
                    },
                    "_id = ?",
                    new String[]{"1"},
                    null,
                    null,
                    null
            )) {
                assertTrue(cursor.moveToFirst());
                assertEquals(0, cursor.getInt(0));
                assertTrue(cursor.isNull(1));
                assertTrue(cursor.isNull(2));
                assertTrue(cursor.isNull(3));
            }
        }
    }

    private static boolean hasColumn(SQLiteDatabase database, String name) {
        try (Cursor cursor = database.rawQuery(
                "PRAGMA table_info(" + TABLE_REPORTS + ")",
                null
        )) {
            int nameColumn = cursor.getColumnIndexOrThrow("name");
            while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(nameColumn))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static SafetyReport report() {
        return new SafetyReport(
                0,
                "28fe9565-93b8-44c2-a308-992ee15c31d2",
                1777150800000L,
                "Aug 25, 2026 9:00 PM",
                "sidewalk_safety",
                "Medium",
                "Not specified",
                "Missing sidewalk",
                "quick_report",
                "{}",
                "unknown",
                false,
                "{}",
                "[]",
                "",
                "quick",
                "[\"missing_sidewalk\"]",
                null,
                "sidewalk",
                null,
                null,
                "2c1ae967-470b-45ee-9e69-b2d3a607c77e",
                1,
                true,
                40.033700,
                -76.504400,
                ReportLocationSource.MANUAL_COORDINATES,
                null,
                null,
                true,
                "/tmp/report-photo.jpg",
                SafetyReport.STATUS_PENDING,
                null,
                null,
                0,
                true
        );
    }
}
