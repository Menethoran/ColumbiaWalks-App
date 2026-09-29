package org.columbiawalks.app.submission;

import android.content.Context;
import android.util.AtomicFile;

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
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import org.json.JSONException;
import org.json.JSONObject;

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
        save(context, submissionId, payload, null);
    }

    public static void save(Context context, String submissionId, String payload,
                            @Nullable String photoPath) throws IOException {
        File file = fileFor(context, submissionId);
        File directory = file.getParentFile();
        if (directory == null
                || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException(
                    "The trash-can submission queue is unavailable."
            );
        }

        String storedPayload = payload;
        if (photoPath != null) {
            try {
                storedPayload = new JSONObject()
                        .put("submission", new JSONObject(payload))
                        .put("has_photo", true).toString();
            } catch (JSONException exception) {
                throw new IOException("The trash-can payload is invalid.", exception);
            }
        }
        byte[] bytes = storedPayload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_PAYLOAD_BYTES) {
            throw new IOException("The trash-can payload is too large.");
        }
        if (photoPath != null) {
            File source = new File(photoPath);
            if (!source.isFile() || source.length() == 0 || source.length() > 10 * 1024 * 1024) {
                throw new IOException("The trash-can photo is unavailable or too large.");
            }
            File photo = photoFile(context, submissionId);
            File pending = new File(photo.getPath() + ".tmp");
            try {
                Files.copy(source.toPath(), pending.toPath(), StandardCopyOption.REPLACE_EXISTING);
                Files.move(pending.toPath(), photo.toPath(), StandardCopyOption.REPLACE_EXISTING);
            } finally {
                pending.delete();
            }
        }
        AtomicFile atomicFile = new AtomicFile(file);
        FileOutputStream output = null;
        try {
            output = atomicFile.startWrite();
            output.write(bytes);
            atomicFile.finishWrite(output);
        } catch (IOException exception) {
            atomicFile.failWrite(output);
            throw exception;
        }
    }

    static File photoFile(Context context, String submissionId) {
        File payloadFile = fileFor(context, submissionId);
        return new File(payloadFile.getParentFile(), submissionId + ".jpg");
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

        try (InputStream input = new AtomicFile(file).openRead();
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
            if (file.delete()) photoFile(context, submissionId).delete();
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
