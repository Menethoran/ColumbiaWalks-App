package org.columbiawalks.app.data;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.exifinterface.media.ExifInterface;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

public final class PhotoStorage {
    private static final int MAX_IMAGE_DIMENSION = 1920;
    private static final int JPEG_QUALITY = 84;
    private static final long PENDING_MAX_AGE_MILLIS = 24L * 60L * 60L * 1000L;

    private PhotoStorage() {
    }

    public static final class PreparedPhoto {
        private final String path;
        private final Double latitude;
        private final Double longitude;

        PreparedPhoto(
                String path,
                Double latitude,
                Double longitude
        ) {
            this.path = path;
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public String getPath() {
            return path;
        }

        public boolean hasCoordinates() {
            return latitude != null && longitude != null;
        }

        public Double getLatitude() {
            return latitude;
        }

        public Double getLongitude() {
            return longitude;
        }
    }

    public static File createCameraCaptureFile(Context context) throws IOException {
        File directory = captureDirectory(context);
        ensureDirectory(directory);
        return File.createTempFile("capture-", ".jpg", directory);
    }

    public static PreparedPhoto createPendingPhoto(Context context, Uri source)
            throws IOException {
        File captureDirectory = captureDirectory(context);
        ensureDirectory(captureDirectory);
        File sourceFile = File.createTempFile(
                "source-",
                ".image",
                captureDirectory
        );
        copyFromUri(context, source, sourceFile);
        Double[] coordinates = readCoordinates(sourceFile);

        File pending = new File(
                pendingDirectory(context),
                "pending-" + UUID.randomUUID() + ".jpg"
        );
        ensureDirectory(pending.getParentFile());

        try {
            normalizeJpeg(sourceFile, pending);
            return preparedPhoto(pending, coordinates);
        } finally {
            sourceFile.delete();
        }
    }

    public static PreparedPhoto createPendingPhoto(Context context, File source)
            throws IOException {
        Double[] coordinates = readCoordinates(source);
        File pending = new File(
                pendingDirectory(context),
                "pending-" + UUID.randomUUID() + ".jpg"
        );
        ensureDirectory(pending.getParentFile());
        try {
            normalizeJpeg(source, pending);
            return preparedPhoto(pending, coordinates);
        } finally {
            source.delete();
        }
    }

    public static String commitPendingPhoto(
            Context context,
            String pendingPath,
            String clientReportId
    ) throws IOException {
        if (pendingPath == null || pendingPath.trim().isEmpty()) {
            return null;
        }

        File source = new File(pendingPath);
        if (!source.isFile()) {
            throw new IOException("The selected photo is no longer available.");
        }

        File destination = new File(
                reportPhotoDirectory(context),
                clientReportId + ".jpg"
        );
        ensureDirectory(destination.getParentFile());
        if (source.renameTo(destination)) {
            return destination.getAbsolutePath();
        }

        copyFile(source, destination);
        source.delete();
        return destination.getAbsolutePath();
    }

    /**
     * Stages a report copy without consuming the pending draft. Callers that
     * need crash-recoverable persistence delete the pending source only after
     * the database row referencing the committed copy has been inserted.
     */
    public static String copyPendingPhotoForCommit(
            Context context,
            String pendingPath,
            String clientReportId
    ) throws IOException {
        if (pendingPath == null || pendingPath.trim().isEmpty()) {
            return null;
        }
        File source = new File(pendingPath);
        if (!source.isFile()) {
            throw new IOException("The selected photo is no longer available.");
        }
        File destination = new File(
                reportPhotoDirectory(context),
                clientReportId + ".jpg"
        );
        ensureDirectory(destination.getParentFile());
        copyFile(source, destination);
        return destination.getAbsolutePath();
    }

    public static void delete(String path) {
        if (path == null || path.trim().isEmpty()) {
            return;
        }
        File file = new File(path);
        if (file.isFile()) {
            file.delete();
        }
    }

    public static void cleanupOldPending(Context context) {
        File[] files = pendingDirectory(context).listFiles();
        if (files == null) {
            return;
        }
        long cutoff = System.currentTimeMillis() - PENDING_MAX_AGE_MILLIS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) {
                file.delete();
            }
        }
    }

    private static void copyFromUri(
            Context context,
            Uri source,
            File destination
    ) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        Uri readableSource = requireOriginalWhenAllowed(context, source);
        InputStream opened;
        try {
            opened = resolver.openInputStream(readableSource);
        } catch (SecurityException | UnsupportedOperationException exception) {
            opened = resolver.openInputStream(source);
        }
        try (InputStream input = opened) {
            if (input == null) {
                throw new IOException("The selected photo could not be opened.");
            }
            try (OutputStream output = new FileOutputStream(destination)) {
                copy(input, output);
            }
        }
    }

    private static Uri requireOriginalWhenAllowed(
            Context context,
            Uri source
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || !ContentResolver.SCHEME_CONTENT.equals(source.getScheme())
                || !MediaStore.AUTHORITY.equals(source.getAuthority())
                || ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.ACCESS_MEDIA_LOCATION
                ) != PackageManager.PERMISSION_GRANTED) {
            return source;
        }
        try {
            return MediaStore.setRequireOriginal(source);
        } catch (IllegalArgumentException exception) {
            return source;
        }
    }

    private static PreparedPhoto preparedPhoto(
            File pending,
            Double[] coordinates
    ) {
        return new PreparedPhoto(
                pending.getAbsolutePath(),
                coordinates == null ? null : coordinates[0],
                coordinates == null ? null : coordinates[1]
        );
    }

    private static Double[] readCoordinates(File source) {
        try {
            double[] coordinates = new ExifInterface(
                    source.getAbsolutePath()
            ).getLatLong();
            if (coordinates == null
                    || coordinates.length != 2
                    || !validLatitude(coordinates[0])
                    || !validLongitude(coordinates[1])) {
                return null;
            }
            return new Double[]{coordinates[0], coordinates[1]};
        } catch (IOException | RuntimeException ignored) {
            return null;
        }
    }

    private static boolean validLatitude(double latitude) {
        return Double.isFinite(latitude)
                && latitude >= -90.0
                && latitude <= 90.0;
    }

    private static boolean validLongitude(double longitude) {
        return Double.isFinite(longitude)
                && longitude >= -180.0
                && longitude <= 180.0;
    }

    private static void normalizeJpeg(File source, File destination)
            throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(source.getAbsolutePath(), bounds);
        if (bounds.outWidth < 1 || bounds.outHeight < 1) {
            throw new IOException("The selected file is not a readable image.");
        }

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight);
        Bitmap decoded = BitmapFactory.decodeFile(source.getAbsolutePath(), options);
        if (decoded == null) {
            throw new IOException("The selected photo could not be decoded.");
        }

        Bitmap oriented = applyOrientation(decoded, readOrientation(source));
        Bitmap resized = resizeIfNeeded(oriented);
        try (OutputStream output = new FileOutputStream(destination)) {
            if (!resized.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, output)) {
                throw new IOException("The selected photo could not be prepared.");
            }
        } finally {
            if (resized != oriented) {
                resized.recycle();
            }
            if (oriented != decoded) {
                oriented.recycle();
            }
            decoded.recycle();
        }
    }

    private static int sampleSize(int width, int height) {
        int sample = 1;
        while (width / sample > MAX_IMAGE_DIMENSION * 2
                || height / sample > MAX_IMAGE_DIMENSION * 2) {
            sample *= 2;
        }
        return sample;
    }

    private static Bitmap resizeIfNeeded(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int largest = Math.max(width, height);
        if (largest <= MAX_IMAGE_DIMENSION) {
            return source;
        }

        float scale = (float) MAX_IMAGE_DIMENSION / largest;
        return Bitmap.createScaledBitmap(
                source,
                Math.round(width * scale),
                Math.round(height * scale),
                true
        );
    }

    private static int readOrientation(File source) {
        try {
            return new ExifInterface(source.getAbsolutePath()).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
            );
        } catch (IOException ignored) {
            return ExifInterface.ORIENTATION_NORMAL;
        }
    }

    private static Bitmap applyOrientation(Bitmap source, int orientation) {
        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL:
                matrix.setScale(-1, 1);
                break;
            case ExifInterface.ORIENTATION_ROTATE_180:
                matrix.setRotate(180);
                break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL:
                matrix.setScale(1, -1);
                break;
            case ExifInterface.ORIENTATION_TRANSPOSE:
                matrix.setRotate(90);
                matrix.postScale(-1, 1);
                break;
            case ExifInterface.ORIENTATION_ROTATE_90:
                matrix.setRotate(90);
                break;
            case ExifInterface.ORIENTATION_TRANSVERSE:
                matrix.setRotate(-90);
                matrix.postScale(-1, 1);
                break;
            case ExifInterface.ORIENTATION_ROTATE_270:
                matrix.setRotate(-90);
                break;
            default:
                return source;
        }
        return Bitmap.createBitmap(
                source,
                0,
                0,
                source.getWidth(),
                source.getHeight(),
                matrix,
                true
        );
    }

    private static void copyFile(File source, File destination)
            throws IOException {
        try (InputStream input = new FileInputStream(source);
             OutputStream output = new FileOutputStream(destination)) {
            copy(input, output);
        }
    }

    private static void copy(InputStream input, OutputStream output)
            throws IOException {
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) {
            output.write(buffer, 0, count);
        }
    }

    private static File captureDirectory(Context context) {
        File directory = new File(context.getCacheDir(), "photo_capture");
        try {
            ensureDirectory(directory);
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
        return directory;
    }

    private static File pendingDirectory(Context context) {
        return new File(context.getCacheDir(), "pending_report_photos");
    }

    private static File reportPhotoDirectory(Context context) {
        return new File(context.getFilesDir(), "report_photos");
    }

    private static void ensureDirectory(File directory) throws IOException {
        if (directory == null) {
            throw new IOException("Photo directory is unavailable.");
        }
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("Photo directory could not be created.");
        }
    }
}
