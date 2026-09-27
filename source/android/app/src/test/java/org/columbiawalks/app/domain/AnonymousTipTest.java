package org.columbiawalks.app.domain;

import org.columbiawalks.app.submission.AnonymousTipClient;
import org.json.JSONObject;
import org.junit.Test;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.junit.Assert.*;

public final class AnonymousTipTest {
    public static Map<String, String> fixture() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("subject", "Fixture test"); fields.put("observed_time", "2026-09-27 10:00 EDT");
        fields.put("location", "Synthetic location"); fields.put("observation", "Synthetic observation only");
        return fields;
    }
    @Test public void marksEveryWordAndOptionalFieldWithoutDoubleMarking() throws Exception {
        JSONObject fields = AnonymousTip.payload(fixture(), "3.17.0").getJSONObject("fields");
        for (String key : AnonymousTip.KEYS) {
            String marked = fields.getString(key);
            String[] tokens = marked.split(" ");
            for (int i = 0; i < tokens.length; i += 2) assertEquals("[TEST]", tokens[i]);
            assertEquals("[TEST]", tokens[tokens.length - 1]);
            assertEquals(marked, AnonymousTip.mark(marked));
        }
        assertEquals("[TEST] one [TEST] two [TEST]", AnonymousTip.mark("[test] one\n[TEST] two"));
        assertEquals("[TEST] α [TEST] β [TEST] γ [TEST]", AnonymousTip.mark("α\u00a0β\u200bγ"));
    }
    @Test public void requiresConfirmationAndActualContent() {
        assertNotNull(AnonymousTip.validationError(fixture(), false, true));
        assertNotNull(AnonymousTip.validationError(fixture(), true, false));
        Map<String, String> fields = fixture(); fields.put("subject", "[TEST]");
        assertNotNull(AnonymousTip.validationError(fields, true, true));
        fields.put("subject", "x".repeat(129));
        assertNotNull(AnonymousTip.validationError(fields, true, true));
        assertThrows(IllegalArgumentException.class, () -> AnonymousTip.payload(fixture(), "3.17.1"));
    }
    @Test public void acceptsOnlyReceiptForThisExactPrivateTest() throws Exception {
        JSONObject request = AnonymousTip.payload(fixture(), "3.17.0");
        String id = request.getString("submission_id");
        JSONObject data = new JSONObject().put("submission_id", id).put("reference", "[TEST] CW-TIP-" + id)
                .put("test_mode", true).put("status", "test_received").put("police_contacted", false)
                .put("destination", "private_columbiawalks_test_intake");
        JSONObject response = new JSONObject().put("data", data);
        assertEquals("[TEST] CW-TIP-" + id, AnonymousTipClient.verifiedReference(request.toString(), response.toString()));
        for (Object value : new Object[]{true, "false"}) {
            data.put("police_contacted", value);
            assertThrows(Exception.class, () -> AnonymousTipClient.verifiedReference(request.toString(), response.toString()));
        }
        data.put("police_contacted", false).put("submission_id", "wrong");
        assertThrows(Exception.class, () -> AnonymousTipClient.verifiedReference(request.toString(), response.toString()));
    }
}
