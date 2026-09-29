package org.columbiawalks.app.submission;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.nio.file.Files;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TrashCanQueueStoreTest {
    @Test public void photoAndHaulerRemainQueuedAfterOriginalIsRemoved() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        String id = UUID.randomUUID().toString();
        File photo = new File(context.getCacheDir(), id + ".jpg");
        try {
            Files.write(photo.toPath(), new byte[] {1, 2, 3});
            String payload = new JSONObject().put("submission_id", id)
                    .put("kind", "private_complaint").put("hauler", "goods").toString();
            TrashCanQueueStore.save(context, id, payload, photo.getPath());
            Files.delete(photo.toPath());
            JSONObject entry = new JSONObject(TrashCanQueueStore.load(context, id));
            assertTrue(entry.getBoolean("has_photo"));
            assertEquals("goods", entry.getJSONObject("submission").getString("hauler"));
            assertArrayEquals(new byte[] {1, 2, 3}, Files.readAllBytes(TrashCanQueueStore.photoFile(context, id).toPath()));
            assertTrue(TrashCanQueueStore.pendingIds(context).contains(id));
        } finally {
            Files.deleteIfExists(photo.toPath());
            TrashCanQueueStore.delete(context, id);
        }
        assertNull(TrashCanQueueStore.load(context, id));
        assertFalse(TrashCanQueueStore.photoFile(context, id).exists());
    }

    @Test public void existingTextOnlyQueueFormatStillLoads() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        String id = UUID.randomUUID().toString();
        try {
            String payload = new JSONObject().put("submission_id", id).put("kind", "public_comment").toString();
            TrashCanQueueStore.save(context, id, payload);
            assertEquals(payload, TrashCanQueueStore.load(context, id));
        } finally { TrashCanQueueStore.delete(context, id); }
    }
}
