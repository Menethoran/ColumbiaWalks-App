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

public final class FeedbackQueueStore {
    private static final String DIRECTORY_NAME = "feedback_queue";
    private static final String EXTENSION = ".json";
    private static final int MAX_PAYLOAD_BYTES = 64 * 1024;
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
                    + "[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            Pattern.CASE_INSENSITIVE
    );

    private FeedbackQueueStore() {
    }

    public static void save(
            Context context,
            String feedbackId,
            String payload
    ) throws IOException {
        File file = fileFor(context, feedbackId);
        File directory = file.getParentFile();
        if (directory == null
                || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException("The feedback queue directory is unavailable.");
        }

        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_PAYLOAD_BYTES) {
            throw new IOException("The feedback payload is too large.");
        }
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(bytes);
            output.flush();
        }
    }

    @Nullable
    static String load(Context context, String feedbackId) throws IOException {
        File file = fileFor(context, feedbackId);
        if (!file.isFile()) {
            return null;
        }
        if (file.length() > MAX_PAYLOAD_BYTES) {
            throw new IOException("The queued feedback payload is too large.");
        }

        try (InputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[2048];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_PAYLOAD_BYTES) {
                    throw new IOException("The queued feedback payload is too large.");
                }
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static void delete(Context context, String feedbackId) {
        File file = fileFor(context, feedbackId);
        if (file.isFile()) {
            // A duplicate retry is harmless if deletion ever fails.
            file.delete();
        }
    }

    static List<String> pendingIds(Context context) {
        List<String> ids = new ArrayList<>();
        File directory = queueDirectory(context);
        File[] files = directory.listFiles();
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

    private static File fileFor(Context context, String feedbackId) {
        if (!UUID_PATTERN.matcher(feedbackId).matches()) {
            throw new IllegalArgumentException("feedbackId must be a UUID.");
        }
        return new File(queueDirectory(context), feedbackId + EXTENSION);
    }

    private static File queueDirectory(Context context) {
        return new File(context.getNoBackupFilesDir(), DIRECTORY_NAME);
    }
}

