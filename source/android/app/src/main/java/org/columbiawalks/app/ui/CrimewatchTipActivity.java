package org.columbiawalks.app.ui;

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import org.columbiawalks.app.domain.TestTipText;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Official, user-submitted web form. No native submission API or JS/native data bridge. */
public final class CrimewatchTipActivity extends AppCompatActivity {
    public static final String TIP_URL = "https://crimewatch.net/us/pa/lancaster/columbia-boro-pd/10552/submit-tip";
    private static final String SUBJECT = "test_subject";
    private static final String MESSAGE = "test_message";
    private WebView web;
    private TextView status;
    private ValueCallback<Uri[]> fileCallback;
    private final ActivityResultLauncher<Intent> filePicker = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), result -> {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(
                            result.getResultCode(), result.getData()));
                    fileCallback = null;
                }
            });

    public static Intent intent(Context context, String subject, String message) {
        return new Intent(context, CrimewatchTipActivity.class)
                .putExtra(SUBJECT, TestTipText.mark(subject))
                .putExtra(MESSAGE, TestTipText.mark(message));
    }

    public static boolean isTipPage(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && "crimewatch.net".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getUserInfo() == null
                && ("/us/pa/lancaster/columbia-boro-pd/10552/submit-tip".equals(uri.getPath())
                || "/us/pa/lancaster/columbia-boro-pd/10552/submit-tip/".equals(uri.getPath()));
    }

    @SuppressLint({"SetJavaScriptEnabled", "SetTextI18n"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String subject = TestTipText.mark(getIntent().getStringExtra(SUBJECT));
        String message = TestTipText.mark(getIntent().getStringExtra(MESSAGE));
        if (subject.length() > 128 || !getIntent().hasExtra(SUBJECT) || !getIntent().hasExtra(MESSAGE)) {
            finish();
            return;
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        TextView title = new TextView(this);
        title.setText("[TEST] CBPD · CRIMEWATCH\ncrimewatch.net • Anonymous / Other");
        title.setTextSize(18);
        title.setPadding(16, 12, 16, 8);
        title.setTextColor(0xff332400);
        title.setBackgroundColor(0xfffff3c4);
        root.addView(title);
        status = new TextView(this);
        status.setPadding(16, 8, 16, 8);
        status.setAccessibilityLiveRegion(android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE);
        status.setText("Loading the official form. Autofill is not submission. Review, agree, complete any CAPTCHA, then submit yourself.");
        root.addView(status);
        LinearLayout controls = new LinearLayout(this);
        addButton(controls, "Back", this::finish);
        addButton(controls, "Copy subject", () -> copy("[TEST] Subject", subject));
        addButton(controls, "Copy message", () -> copy("[TEST] Message", message));
        addButton(controls, "Browser", () -> {
            status.setText("Browser fallback: paste the subject and message, choose anonymous and Other, then review and submit there.");
            openExternal(Uri.parse(TIP_URL));
        });
        root.addView(controls);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSaveFormData(false);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                        FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { filePicker.launch(params.createIntent()); }
                catch (android.content.ActivityNotFoundException error) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    status.setText("No file picker is available. You can use the browser fallback to attach files.");
                }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false; // CRIMEWATCH and CAPTCHA own their frames.
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "crimewatch.net".equals(uri.getHost())
                        && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null) return false;
                if (request.hasGesture()) openExternal(uri);
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!isTipPage(url) || !isTipPage(view.getUrl())) {
                    status.setText("Official website — read its response to determine whether your tip was received.");
                    return;
                }
                try (java.io.InputStream input = getAssets().open("crimewatch-test-autofill.js")) {
                    java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                    String script = bytes.toString(StandardCharsets.UTF_8.name());
                    JSONObject draft = new JSONObject().put("subject", subject).put("message", message);
                    view.evaluateJavascript(script + "(" + draft + ");", result -> {
                        if ("\"filled\"".equals(result) || "\"already-filled\"".equals(result)) {
                            status.setText("[TEST] Filled: Anonymous, Other, subject and message. Review below, accept the agreement, complete any CAPTCHA, and press Submit when ready.");
                        } else {
                            status.setText("Autofill unavailable or this is a response page. Check the page below. Copy controls are available if the form needs manual entry. Nothing is confirmed received by ColumbiaWalks.");
                        }
                    });
                } catch (IOException | org.json.JSONException error) {
                    status.setText("Autofill unavailable. Use Copy subject / Copy message and review the official form.");
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("The official form could not load. Check your connection or use Browser. No submission is confirmed.");
            }
        });
        // A fresh web form on each opening avoids resending POST data on recreation.
        web.loadUrl(TIP_URL);
    }

    private void addButton(LinearLayout parent, String title, Runnable action) {
        Button button = new Button(this);
        button.setText(title);
        button.setTextSize(11);
        button.setAllCaps(false);
        button.setMinWidth(0);
        button.setPadding(4, 4, 4, 4);
        button.setOnClickListener(view -> action.run());
        parent.addView(button, new LinearLayout.LayoutParams(0, -2, 1));
    }

    private void copy(String label, String text) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText(label, TestTipText.mark(text)));
            Toast.makeText(this, "[TEST] Copied. Not submitted.", Toast.LENGTH_SHORT).show();
        }
    }

    private void openExternal(Uri uri) {
        if (!("https".equals(uri.getScheme()) || "tel".equals(uri.getScheme()))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (android.content.ActivityNotFoundException error) {
            status.setText("No browser is available. Return to the draft and try again later.");
        }
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
