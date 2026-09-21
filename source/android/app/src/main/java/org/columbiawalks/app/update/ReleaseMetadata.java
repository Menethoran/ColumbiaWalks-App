package org.columbiawalks.app.update;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ReleaseMetadata {
    private static final long MAX_APK_BYTES = 250L * 1024L * 1024L;
    private static final Pattern SHA256_PATTERN = Pattern.compile("^sha256:([0-9a-fA-F]{64})$");
    private static final Pattern VERSION_PATTERN = Pattern.compile("^v?(\\d+)\\.(\\d+)\\.(\\d+)$");

    final String apkUrl;
    final long assetSize;
    final String publishedAt;
    final String releaseNotes;
    final String releasePageUrl;
    final String sha256;
    final String tagName;
    final int versionCode;
    final String versionName;

    private ReleaseMetadata(
            String apkUrl,
            long assetSize,
            String publishedAt,
            String releaseNotes,
            String releasePageUrl,
            String sha256,
            String tagName,
            int versionCode,
            String versionName) {
        this.apkUrl = apkUrl;
        this.assetSize = assetSize;
        this.publishedAt = publishedAt;
        this.releaseNotes = releaseNotes;
        this.releasePageUrl = releasePageUrl;
        this.sha256 = sha256;
        this.tagName = tagName;
        this.versionCode = versionCode;
        this.versionName = versionName;
    }

    static ReleaseMetadata parse(String json) throws JSONException {
        JSONObject release = new JSONObject(json);
        if (release.optBoolean("draft", false) || release.optBoolean("prerelease", false)) {
            throw new JSONException("The latest release is not a production release.");
        }

        String tagName = requireText(release, "tag_name");
        ParsedVersion version = parseVersion(tagName);
        String pageUrl = requireHttpsUrl(release, "html_url");
        JSONArray assets = release.optJSONArray("assets");
        if (assets == null) {
            throw new JSONException("The release does not include any assets.");
        }

        JSONObject selectedAsset = null;
        for (int index = 0; index < assets.length(); index++) {
            JSONObject asset = assets.optJSONObject(index);
            if (asset == null) continue;
            String name = asset.optString("name", "").toLowerCase(Locale.ROOT);
            if (name.endsWith(".apk")) {
                selectedAsset = asset;
                break;
            }
        }
        if (selectedAsset == null) {
            throw new JSONException("The release does not include an APK.");
        }

        String apkUrl = requireHttpsUrl(selectedAsset, "browser_download_url");
        long size = selectedAsset.optLong("size", -1L);
        if (size <= 0L || size > MAX_APK_BYTES) {
            throw new JSONException("The release APK size is invalid.");
        }
        Matcher digestMatcher = SHA256_PATTERN.matcher(
                requireText(selectedAsset, "digest"));
        if (!digestMatcher.matches()) {
            throw new JSONException("The release APK is missing a valid SHA-256 digest.");
        }

        return new ReleaseMetadata(
                apkUrl,
                size,
                release.optString("published_at", ""),
                release.optString("body", ""),
                pageUrl,
                digestMatcher.group(1).toLowerCase(Locale.ROOT),
                tagName,
                version.versionCode,
                version.versionName);
    }

    private static ParsedVersion parseVersion(String tag) throws JSONException {
        Matcher matcher = VERSION_PATTERN.matcher(tag.trim());
        if (!matcher.matches()) {
            throw new JSONException("The release tag is not a semantic version.");
        }
        try {
            long major = Long.parseLong(matcher.group(1));
            long minor = Long.parseLong(matcher.group(2));
            long patch = Long.parseLong(matcher.group(3));
            if (minor > 99L || patch > 99L) {
                throw new JSONException("Release version components must be below 100.");
            }
            long encoded = major * 10_000L + minor * 100L + patch;
            if (encoded <= 0L || encoded > Integer.MAX_VALUE) {
                throw new JSONException("The release version is outside the supported range.");
            }
            return new ParsedVersion(
                    major + "." + minor + "." + patch,
                    (int) encoded);
        } catch (NumberFormatException exception) {
            throw new JSONException("The release version contains an invalid number.");
        }
    }

    private static String requireHttpsUrl(JSONObject object, String key) throws JSONException {
        String value = requireText(object, key);
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new JSONException("Release URLs must use HTTPS.");
            }
            return value;
        } catch (URISyntaxException exception) {
            throw new JSONException("The release contains an invalid URL.");
        }
    }

    private static String requireText(JSONObject object, String key) throws JSONException {
        String value = object.optString(key, "").trim();
        if (value.isEmpty()) {
            throw new JSONException("The release is missing " + key + ".");
        }
        return value;
    }

    private static final class ParsedVersion {
        final int versionCode;
        final String versionName;

        ParsedVersion(String versionName, int versionCode) {
            this.versionName = versionName;
            this.versionCode = versionCode;
        }
    }
}

