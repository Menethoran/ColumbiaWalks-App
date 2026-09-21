package org.columbiawalks.app.submission;

import android.content.Context;

import androidx.annotation.Nullable;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Stores pending trash-can JSON in Android's no-backup files directory. */
public final class TrashCanQueueStore {
    private static final String DIRECTORY_NAME = "trash_can_queue";
    private static final String EXTENSION = ".json";
    private static final int MAX_PAYLOAD_BYTES = 64 * 1024;
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
                    + "[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            Pattern.CASE_INSENSITIVE
    );

    private TrashCanQueueStore() {
    }

    public static void save(
            Context context,
            String submissionId,
            String payload
    ) throws IOException {
        File file = fileFor(context, submissionId);
        File directory = file.getParentFile();
        if (directory == null
                || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException(
                    "The trash-can submission queue is unavailable."
            );
        }

        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_PAYLOAD_BYTES) {
            throw new IOException("The trash-can payload is too large.");
        }
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(bytes);
            output.flush();
        }
    }

    @Nullable
    static String load(Context context, String submissionId)
            throws IOException {
        File file = fileFor(context, submissionId);
        if (!file.isFile()) {
            return null;
        }
        if (file.length() > MAX_PAYLOAD_BYTES) {
            throw new IOException("The queued trash-can payload is too large.");
        }

        try (InputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[2048];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_PAYLOAD_BYTES) {
                    throw new IOException(
                            "The queued trash-can payload is too large."
                    );
                }
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static void delete(Context context, String submissionId) {
        File file = fileFor(context, submissionId);
        if (file.isFile()) {
            // A duplicate retry is harmless if deletion ever fails.
            file.delete();
        }
    }

    static List<String> pendingIds(Context context) {
        List<String> ids = new ArrayList<>();
        File[] files = queueDirectory(context).listFiles();
        if (files == null) {
            return ids;
        }
        for (File file : files) {
            String name = file.getName();
            if (!file.isFile() || !name.endsWith(EXTENSION)) {
                continue;
            }
            String id = name.substring(0, name.length() - EXTENSION.length());
            if (UUID_PATTERN.matcher(id).matches()) {
                ids.add(id);
            }
        }
        return ids;
    }

    private static File fileFor(Context context, String submissionId) {
        if (!UUID_PATTERN.matcher(submissionId).matches()) {
            throw new IllegalArgumentException(
                    "submissionId must be a UUID."
            );
        }
        return new File(
                queueDirectory(context),
                submissionId + EXTENSION
        );
    }

    private static File queueDirectory(Context context) {
        return new File(context.getNoBackupFilesDir(), DIRECTORY_NAME);
    }
}
