package org.columbiawalks.app.update;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import org.columbiawalks.app.BuildConfig;
import org.columbiawalks.app.R;
import org.json.JSONException;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.net.ssl.HttpsURLConnection;

public final class UpdateManager {
    private static final String LOG_TAG = "ColumbiaWalksUpdate";
    private static final String PREFERENCES = "app_updates";
    private static final String KEY_CACHED_RELEASE = "cached_release";
    private static final String KEY_DEFERRED_UNTIL = "deferred_until";
    private static final String KEY_DEFERRED_VERSION = "deferred_version";
    private static final String KEY_ETAG = "release_etag";
    private static final String KEY_INSTALL_VERSION_CODE = "install_version_code";
    private static final String KEY_INSTALL_VERSION_NAME = "install_version_name";
    private static final String KEY_PENDING_APK = "pending_apk";
    private static final String KEY_PENDING_RELEASE = "pending_release";
    private static final long PROMPT_DEFERRAL_MILLIS = 24L * 60L * 60L * 1_000L;
    private static final int MAX_RELEASE_BYTES = 1024 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean CHECKING = new AtomicBoolean(false);
    private static final AtomicBoolean DOWNLOADING = new AtomicBoolean(false);
    private static final AtomicBoolean AWAITING_INSTALL_PERMISSION = new AtomicBoolean(false);

    private UpdateManager() {}

    public static void checkOnLaunch(Activity activity) {
        recordInstalledUpdate(activity);
        if (!CHECKING.compareAndSet(false, true)) return;
        EXECUTOR.execute(() -> {
            try {
                FetchResult result = fetchLatestRelease(activity);
                ReleaseMetadata release = result.release;
                if (release.versionCode <= BuildConfig.VERSION_CODE) {
                    UpdateTracker.record(activity, "up_to_date", release, null);
                    return;
                }
                UpdateTracker.record(activity, "update_available", release, null);
                SharedPreferences preferences = preferences(activity);
                boolean deferred = preferences.getInt(KEY_DEFERRED_VERSION, 0)
                        == release.versionCode
                        && System.currentTimeMillis()
                        < preferences.getLong(KEY_DEFERRED_UNTIL, 0L);
                if (!deferred) {
                    activity.runOnUiThread(() -> showUpdateAvailable(activity, result));
                }
            } catch (UpdateException exception) {
                Log.w(LOG_TAG, "Update check failed: " + exception.code);
                UpdateTracker.record(activity, "check_failed", null, exception.code);
            } catch (Exception exception) {
                Log.w(LOG_TAG, "Update check failed", exception);
                UpdateTracker.record(activity, "check_failed", null, "unexpected_error");
            } finally {
                CHECKING.set(false);
            }
        });
    }

    public static void onResume(Activity activity) {
        if (!AWAITING_INSTALL_PERMISSION.compareAndSet(true, false)) return;
        if (activity.getPackageManager().canRequestPackageInstalls()) {
            resumePendingInstall(activity);
        } else {
            UpdateTracker.record(activity, "install_permission_denied", null, null);
            Toast.makeText(
                    activity,
                    R.string.update_permission_not_granted,
                    Toast.LENGTH_LONG).show();
        }
    }

    private static FetchResult fetchLatestRelease(Context context) throws UpdateException {
        SharedPreferences preferences = preferences(context);
        HttpsURLConnection connection = null;
        try {
            URL endpoint = requireHttps(BuildConfig.UPDATE_RELEASE_API);
            connection = (HttpsURLConnection) endpoint.openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            connection.setRequestProperty(
                    "User-Agent", "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME);
            String etag = preferences.getString(KEY_ETAG, "");
            if (etag != null && !etag.isBlank()) {
                connection.setRequestProperty("If-None-Match", etag);
            }

            int status = connection.getResponseCode();
            String releaseJson;
            if (status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                releaseJson = preferences.getString(KEY_CACHED_RELEASE, "");
                if (releaseJson == null || releaseJson.isBlank()) {
                    throw new UpdateException("empty_cache");
                }
            } else if (status == HttpURLConnection.HTTP_OK) {
                releaseJson = readLimited(connection.getInputStream(), MAX_RELEASE_BYTES);
                SharedPreferences.Editor editor = preferences.edit()
                        .putString(KEY_CACHED_RELEASE, releaseJson);
                String responseEtag = connection.getHeaderField("ETag");
                if (responseEtag != null && !responseEtag.isBlank()) {
                    editor.putString(KEY_ETAG, responseEtag);
                }
                editor.apply();
            } else {
                throw new UpdateException("release_http_" + status);
            }
            try {
                return new FetchResult(ReleaseMetadata.parse(releaseJson), releaseJson);
            } catch (JSONException exception) {
                throw new UpdateException("invalid_release");
            }
        } catch (UpdateException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new UpdateException("network_error");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void showUpdateAvailable(Activity activity, FetchResult result) {
        if (!isUsable(activity)) return;
        ReleaseMetadata release = result.release;
        String notes = release.releaseNotes == null ? "" : release.releaseNotes.trim();
        if (notes.length() > 700) notes = notes.substring(0, 700) + "…";
        String message = activity.getString(
                R.string.update_available_message,
                release.versionName,
                notes.isBlank() ? activity.getString(R.string.update_no_release_notes) : notes);
        new MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.update_available_title)
                .setMessage(message)
                .setPositiveButton(R.string.update_download, (dialog, which) ->
                        downloadUpdate(activity, result))
                .setNegativeButton(R.string.update_later, (dialog, which) -> {
                    preferences(activity).edit()
                            .putInt(KEY_DEFERRED_VERSION, release.versionCode)
                            .putLong(
                                    KEY_DEFERRED_UNTIL,
                                    System.currentTimeMillis() + PROMPT_DEFERRAL_MILLIS)
                            .apply();
                    UpdateTracker.record(activity, "update_deferred", release, null);
                })
                .setNeutralButton(R.string.update_release_page, (dialog, which) ->
                        openReleasePage(activity, release))
                .show();
    }

    private static void downloadUpdate(Activity activity, FetchResult result) {
        if (!DOWNLOADING.compareAndSet(false, true)) return;
        ReleaseMetadata release = result.release;
        UpdateTracker.record(activity, "download_started", release, null);
        AlertDialog progress = new MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.update_downloading_title)
                .setMessage(R.string.update_downloading_message)
                .setCancelable(false)
                .show();
        EXECUTOR.execute(() -> {
            try {
                File apk = downloadAndVerify(activity, release);
                preferences(activity).edit()
                        .putString(KEY_PENDING_APK, apk.getAbsolutePath())
                        .putString(KEY_PENDING_RELEASE, result.json)
                        .apply();
                UpdateTracker.record(activity, "download_verified", release, null);
                activity.runOnUiThread(() -> {
                    progress.dismiss();
                    requestInstallPermissionOrInstall(activity, release, apk);
                });
            } catch (UpdateException exception) {
                UpdateTracker.record(activity, "download_failed", release, exception.code);
                activity.runOnUiThread(() -> {
                    progress.dismiss();
                    showFailure(activity);
                });
            } finally {
                DOWNLOADING.set(false);
            }
        });
    }

    private static File downloadAndVerify(Context context, ReleaseMetadata release)
            throws UpdateException {
        File updateDirectory = new File(context.getCacheDir(), "app_updates");
        if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
            throw new UpdateException("storage_error");
        }
        String safeVersion = release.versionName.replaceAll("[^0-9A-Za-z._-]", "_");
        File temporary = new File(updateDirectory, "columbiawalks-" + safeVersion + ".part");
        File destination = new File(updateDirectory, "columbiawalks-" + safeVersion + ".apk");
        if (temporary.exists() && !temporary.delete()) {
            throw new UpdateException("storage_error");
        }

        HttpsURLConnection connection = null;
        try {
            connection = openDownload(release.apkUrl);
            long headerSize = connection.getContentLengthLong();
            if (headerSize > 0L && headerSize != release.assetSize) {
                throw new UpdateException("size_mismatch");
            }
            long written = 0L;
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                    FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    written += count;
                    if (written > release.assetSize) {
                        throw new UpdateException("size_mismatch");
                    }
                    output.write(buffer, 0, count);
                }
                output.getFD().sync();
            }
            if (written != release.assetSize) {
                throw new UpdateException("size_mismatch");
            }
            if (!release.sha256.equals(sha256(temporary))) {
                throw new UpdateException("digest_mismatch");
            }
            verifyApkIdentity(context, temporary, release);
            if (destination.exists() && !destination.delete()) {
                throw new UpdateException("storage_error");
            }
            if (!temporary.renameTo(destination)) {
                throw new UpdateException("storage_error");
            }
            return destination;
        } catch (UpdateException exception) {
            temporary.delete();
            throw exception;
        } catch (IOException exception) {
            temporary.delete();
            throw new UpdateException("network_error");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static HttpsURLConnection openDownload(String initialUrl)
            throws IOException, UpdateException {
        URL current = requireHttps(initialUrl);
        for (int redirects = 0; redirects <= 5; redirects++) {
            HttpsURLConnection connection = (HttpsURLConnection) current.openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(60_000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty(
                    "User-Agent", "ColumbiaWalks-Android/" + BuildConfig.VERSION_NAME);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_OK) return connection;
            if (status == HttpURLConnection.HTTP_MOVED_PERM
                    || status == HttpURLConnection.HTTP_MOVED_TEMP
                    || status == HttpURLConnection.HTTP_SEE_OTHER
                    || status == 307
                    || status == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isBlank()) {
                    throw new UpdateException("download_redirect_error");
                }
                current = requireHttps(new URL(current, location).toString());
                continue;
            }
            connection.disconnect();
            throw new UpdateException("download_http_" + status);
        }
        throw new UpdateException("too_many_redirects");
    }

    private static void verifyApkIdentity(
            Context context,
            File apk,
            ReleaseMetadata release) throws UpdateException {
        PackageManager manager = context.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo archive = manager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null || !context.getPackageName().equals(archive.packageName)) {
            throw new UpdateException("package_mismatch");
        }
        long archiveVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? archive.getLongVersionCode()
                : archive.versionCode;
        if (archiveVersion != release.versionCode || archiveVersion <= BuildConfig.VERSION_CODE) {
            throw new UpdateException("version_mismatch");
        }
        try {
            PackageInfo installed = manager.getPackageInfo(context.getPackageName(), flags);
            if (!signerDigests(installed).equals(signerDigests(archive))) {
                throw new UpdateException("signer_mismatch");
            }
        } catch (PackageManager.NameNotFoundException exception) {
            throw new UpdateException("installed_package_missing");
        }
    }

    private static Set<String> signerDigests(PackageInfo packageInfo) throws UpdateException {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo == null) throw new UpdateException("signer_missing");
            signatures = packageInfo.signingInfo.getApkContentsSigners();
        } else {
            signatures = packageInfo.signatures;
        }
        if (signatures == null || signatures.length == 0) {
            throw new UpdateException("signer_missing");
        }
        Set<String> digests = new HashSet<>();
        for (Signature signature : signatures) {
            digests.add(hexDigest(signature.toByteArray()));
        }
        return digests;
    }

    private static String sha256(File file) throws UpdateException {
        try (InputStream input = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
            }
            return toHex(digest.digest());
        } catch (Exception exception) {
            throw new UpdateException("digest_error");
        }
    }

    private static String hexDigest(byte[] value) throws UpdateException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return toHex(digest.digest(value));
        } catch (Exception exception) {
            throw new UpdateException("digest_error");
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) value.append(String.format(Locale.ROOT, "%02x", item));
        return value.toString();
    }

    private static void requestInstallPermissionOrInstall(
            Activity activity,
            ReleaseMetadata release,
            File apk) {
        if (!isUsable(activity)) return;
        if (activity.getPackageManager().canRequestPackageInstalls()) {
            launchInstaller(activity, release, apk);
            return;
        }
        new MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.update_permission_title)
                .setMessage(R.string.update_permission_message)
                .setPositiveButton(R.string.update_open_settings, (dialog, which) -> {
                    Intent settings = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + activity.getPackageName()));
                    if (settings.resolveActivity(activity.getPackageManager()) == null) {
                        settings = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                    }
                    AWAITING_INSTALL_PERMISSION.set(true);
                    activity.startActivity(settings);
                })
                .setNegativeButton(R.string.update_later, null)
                .show();
    }

    private static void resumePendingInstall(Activity activity) {
        SharedPreferences preferences = preferences(activity);
        String json = preferences.getString(KEY_PENDING_RELEASE, "");
        String path = preferences.getString(KEY_PENDING_APK, "");
        if (json == null || json.isBlank() || path == null || path.isBlank()) return;
        try {
            ReleaseMetadata release = ReleaseMetadata.parse(json);
            File apk = new File(path);
            if (!apk.isFile() || !release.sha256.equals(sha256(apk))) {
                throw new UpdateException("pending_apk_invalid");
            }
            verifyApkIdentity(activity, apk, release);
            launchInstaller(activity, release, apk);
        } catch (Exception exception) {
            preferences.edit()
                    .remove(KEY_PENDING_APK)
                    .remove(KEY_PENDING_RELEASE)
                    .apply();
            showFailure(activity);
        }
    }

    private static void launchInstaller(
            Activity activity,
            ReleaseMetadata release,
            File apk) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".files",
                    apk);
            Intent install = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apkUri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.setClipData(ClipData.newRawUri("ColumbiaWalks update", apkUri));
            if (install.resolveActivity(activity.getPackageManager()) == null) {
                throw new UpdateException("installer_unavailable");
            }
            preferences(activity).edit()
                    .putInt(KEY_INSTALL_VERSION_CODE, release.versionCode)
                    .putString(KEY_INSTALL_VERSION_NAME, release.versionName)
                    .remove(KEY_PENDING_APK)
                    .remove(KEY_PENDING_RELEASE)
                    .apply();
            UpdateTracker.record(activity, "installer_opened", release, null);
            activity.startActivity(install);
        } catch (Exception exception) {
            UpdateTracker.record(activity, "install_failed", release, "installer_unavailable");
            showFailure(activity);
        }
    }

    private static void recordInstalledUpdate(Context context) {
        SharedPreferences preferences = preferences(context);
        int installedTarget = preferences.getInt(KEY_INSTALL_VERSION_CODE, 0);
        if (installedTarget <= 0 || BuildConfig.VERSION_CODE < installedTarget) return;
        String installedName = preferences.getString(KEY_INSTALL_VERSION_NAME, "");
        UpdateTracker.recordInstalled(context, installedTarget, installedName);
        preferences.edit()
                .remove(KEY_INSTALL_VERSION_CODE)
                .remove(KEY_INSTALL_VERSION_NAME)
                .remove(KEY_DEFERRED_VERSION)
                .remove(KEY_DEFERRED_UNTIL)
                .apply();
        Log.i(LOG_TAG, "Confirmed update installation to " + installedName);
    }

    private static void openReleasePage(Activity activity, ReleaseMetadata release) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(release.releasePageUrl)));
        } catch (Exception exception) {
            showFailure(activity);
        }
    }

    private static String readLimited(InputStream input, int maximumBytes)
            throws IOException, UpdateException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8 * 1024];
            int total = 0;
            int count;
            while ((count = stream.read(buffer)) != -1) {
                total += count;
                if (total > maximumBytes) throw new UpdateException("release_too_large");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static URL requireHttps(String value) throws UpdateException {
        try {
            URL url = new URL(value);
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                throw new UpdateException("insecure_url");
            }
            return url;
        } catch (IOException exception) {
            throw new UpdateException("invalid_url");
        }
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private static boolean isUsable(Activity activity) {
        return !activity.isFinishing() && !activity.isDestroyed();
    }

    private static void showFailure(Activity activity) {
        if (!isUsable(activity)) return;
        Toast.makeText(activity, R.string.update_failed, Toast.LENGTH_LONG).show();
    }

    private static final class FetchResult {
        final String json;
        final ReleaseMetadata release;

        FetchResult(ReleaseMetadata release, String json) {
            this.release = release;
            this.json = json;
        }
    }

    private static final class UpdateException extends Exception {
        final String code;

        UpdateException(String code) {
            super(code);
            this.code = code;
        }
    }
}

