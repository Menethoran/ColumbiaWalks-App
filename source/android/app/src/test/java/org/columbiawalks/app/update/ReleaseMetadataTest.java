package org.columbiawalks.app.update;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.json.JSONException;
import org.junit.Test;

public class ReleaseMetadataTest {
    private static final String DIGEST =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    @Test
    public void parseAcceptsProductionApkWithDigest() throws Exception {
        ReleaseMetadata release = ReleaseMetadata.parse(releaseJson(
                "v3.14.2",
                "https://github.com/Menethoran/ColumbiaWalks-App/releases/tag/v3.14.2",
                "https://github.com/Menethoran/ColumbiaWalks-App/releases/download/v3.14.2/app.apk",
                "sha256:" + DIGEST,
                false));

        assertEquals(31402, release.versionCode);
        assertEquals("3.14.2", release.versionName);
        assertEquals(DIGEST, release.sha256);
        assertEquals(12345L, release.assetSize);
    }

    @Test
    public void parseRejectsMissingDigest() {
        assertThrows(JSONException.class, () -> ReleaseMetadata.parse(releaseJson(
                "v3.14.2",
                "https://github.com/example/release",
                "https://github.com/example/app.apk",
                "",
                false)));
    }

    @Test
    public void parseRejectsInsecureDownload() {
        assertThrows(JSONException.class, () -> ReleaseMetadata.parse(releaseJson(
                "v3.14.2",
                "https://github.com/example/release",
                "http://example.com/app.apk",
                "sha256:" + DIGEST,
                false)));
    }

    @Test
    public void parseRejectsPrerelease() {
        assertThrows(JSONException.class, () -> ReleaseMetadata.parse(releaseJson(
                "v3.14.2",
                "https://github.com/example/release",
                "https://github.com/example/app.apk",
                "sha256:" + DIGEST,
                true)));
    }

    @Test
    public void parseRejectsVersionComponentsThatCannotMapToVersionCode() {
        assertThrows(JSONException.class, () -> ReleaseMetadata.parse(releaseJson(
                "v3.100.0",
                "https://github.com/example/release",
                "https://github.com/example/app.apk",
                "sha256:" + DIGEST,
                false)));
    }

    private static String releaseJson(
            String tag,
            String pageUrl,
            String apkUrl,
            String digest,
            boolean prerelease) {
        return "{"
                + "\"tag_name\":\"" + tag + "\","
                + "\"html_url\":\"" + pageUrl + "\","
                + "\"draft\":false,"
                + "\"prerelease\":" + prerelease + ","
                + "\"body\":\"Release notes\","
                + "\"assets\":[{"
                + "\"name\":\"ColumbiaWalks.apk\","
                + "\"browser_download_url\":\"" + apkUrl + "\","
                + "\"digest\":\"" + digest + "\","
                + "\"size\":12345"
                + "}]}";
    }
}

