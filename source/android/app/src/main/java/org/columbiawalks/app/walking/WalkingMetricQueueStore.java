package org.columbiawalks.app.walking;

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

public final class WalkingMetricQueueStore {
    private static final String DIRECTORY_NAME = "walking_metric_queue";
    private static final String EXTENSION = ".json";
    private static final int MAX_PAYLOAD_BYTES = 16 * 1024;
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
                    + "[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            Pattern.CASE_INSENSITIVE
    );

    private WalkingMetricQueueStore() {
    }

    public static void save(Context context, String metricId, String payload)
            throws IOException {
        File file = fileFor(context, metricId);
        File directory = file.getParentFile();
        if (directory == null
                || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException("The walking summary queue is unavailable.");
        }
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_PAYLOAD_BYTES) {
            throw new IOException("The walking summary is too large.");
        }
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(bytes);
            output.flush();
        }
    }

    @Nullable
    static String load(Context context, String metricId) throws IOException {
        File file = fileFor(context, metricId);
        if (!file.isFile()) return null;
        if (file.length() > MAX_PAYLOAD_BYTES) {
            throw new IOException("The queued walking summary is too large.");
        }
        try (InputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[2048];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_PAYLOAD_BYTES) {
                    throw new IOException("The queued walking summary is too large.");
                }
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static void delete(Context context, String metricId) {
        File file = fileFor(context, metricId);
        if (file.isFile()) file.delete();
    }

    static List<String> pendingIds(Context context) {
        List<String> ids = new ArrayList<>();
        File[] files = queueDirectory(context).listFiles();
        if (files == null) return ids;
        for (File file : files) {
            String name = file.getName();
            if (!file.isFile() || !name.endsWith(EXTENSION)) continue;
            String id = name.substring(0, name.length() - EXTENSION.length());
            if (UUID_PATTERN.matcher(id).matches()) ids.add(id);
        }
        return ids;
    }

    private static File fileFor(Context context, String metricId) {
        if (!UUID_PATTERN.matcher(metricId).matches()) {
            throw new IllegalArgumentException("metricId must be a UUID.");
        }
        return new File(queueDirectory(context), metricId + EXTENSION);
    }

    private static File queueDirectory(Context context) {
        return new File(context.getNoBackupFilesDir(), DIRECTORY_NAME);
    }
}

