package org.columbiawalks.app.submission;

import android.app.Application;
import android.util.AtomicFile;
import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.MutableLiveData;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One durable marked test at a time; retries reuse the exact payload and UUID. */
public final class AnonymousTipSubmissionModel extends AndroidViewModel {
    public final MutableLiveData<String> message = new MutableLiveData<>("");
    public final MutableLiveData<Boolean> busy = new MutableLiveData<>(false);
    public String pending;
    public boolean completed;
    private final AtomicFile file;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public AnonymousTipSubmissionModel(@NonNull Application app) {
        super(app);
        file = new AtomicFile(new File(app.getNoBackupFilesDir(), "anonymous-tip-test-pending.json"));
        try {
            if (file.getBaseFile().exists()) {
                if (file.getBaseFile().length() > 128 * 1024) throw new IllegalStateException();
                pending = new String(file.readFully(), StandardCharsets.UTF_8);
                new JSONObject(pending).getString("submission_id");
                message.setValue("[TEST] A saved test is awaiting confirmation. Retry sends the same marked test.");
            }
        } catch (Exception error) {
            pending = null;
            message.setValue("[TEST] The saved test could not be read. No delivery is confirmed.");
        }
    }

    public void submit(String payload) {
        if (Boolean.TRUE.equals(busy.getValue()) || completed) return;
        if (pending == null) {
            FileOutputStream output = null;
            try {
                byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > 128 * 1024) throw new IllegalArgumentException();
                output = file.startWrite();
                output.write(bytes);
                file.finishWrite(output);
                pending = payload;
            } catch (Exception error) {
                if (output != null) file.failWrite(output);
                message.setValue("[TEST] Could not save this test on your device. Nothing was sent.");
                return;
            }
        }
        busy.setValue(true);
        message.setValue("[TEST] Sending to private ColumbiaWalks test intake…");
        final String savedPayload = pending;
        executor.execute(() -> {
            String result;
            boolean success = false;
            try {
                String reference = AnonymousTipClient.submit(savedPayload);
                file.delete();
                success = true;
                result = "[TEST] Saved to private ColumbiaWalks test intake. Police were not contacted.\n" + reference;
            } catch (Exception error) {
                result = "[TEST] Storage is not confirmed. The marked test is saved on this device. Retry this same test when intake is available; police were not contacted.";
            }
            final boolean completed = success;
            final String status = result;
            new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                if (completed) { pending = null; this.completed = true; }
                busy.setValue(false);
                message.setValue(status);
            });
        });
    }

    public void discard() {
        if (Boolean.TRUE.equals(busy.getValue())) return;
        file.delete();
        pending = null;
        completed = false;
        message.setValue("[TEST] Local pending copy removed. This does not remove a test already stored by the server.");
    }
    @Override protected void onCleared() { executor.shutdown(); }
}
