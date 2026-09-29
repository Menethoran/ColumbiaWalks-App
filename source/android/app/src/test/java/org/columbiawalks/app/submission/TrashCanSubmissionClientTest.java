package org.columbiawalks.app.submission;

import static org.junit.Assert.*;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.Test;

public class TrashCanSubmissionClientTest {
    @Test public void legacyJsonAndPhotoMultipartUseTheExistingIntakeContract() throws Exception {
        String payload = "{\"kind\":\"private_complaint\",\"hauler\":\"goods\"}";
        assertArrayEquals(payload.getBytes(StandardCharsets.UTF_8),
                TrashCanSubmissionClient.requestBody(payload, null, "test-boundary"));
        File photo = File.createTempFile("trash-can-test-", ".jpg");
        try {
            Files.write(photo.toPath(), new byte[] {1, 2, 3});
            byte[] body = TrashCanSubmissionClient.requestBody(payload, photo, "test-boundary");
            String text = new String(body, StandardCharsets.UTF_8);
            assertTrue(text.contains("name=\"submission\"\r\n"));
            assertTrue(text.contains(payload));
            assertTrue(text.contains("name=\"photo\"; filename=\"trash-can.jpg\""));
            assertFalse(text.contains(photo.getName()));
            assertTrue(text.endsWith("\r\n--test-boundary--\r\n"));
        } finally { Files.deleteIfExists(photo.toPath()); }
    }

    @Test(expected = java.io.IOException.class)
    public void missingPhotoCannotBecomeASilentTextOnlySubmission() throws Exception {
        TrashCanSubmissionClient.requestBody("{}", new File("absent-test-photo.jpg"), "test-boundary");
    }
}
