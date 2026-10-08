package my.id.asproject.studio;

import android.os.Build;
import android.util.Log;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/**
 * The {@code window.AsProject} object that {@code native-bridge.js} talks to.
 *
 * <p>All methods are invoked on the WebView JavaScript bridge thread (never the UI thread), so
 * implementations must marshal UI work back with {@code runOnUiThread}. Every entry point is guarded
 * by {@link Host#isTrustedPage()}: a page that is not served from the Studio domain cannot use the
 * bridge, which keeps {@code addJavascriptInterface} from becoming a host of privilege escalation
 * should an unexpected document ever end up inside the WebView.
 */
public final class NativeBridge {

    private static final String TAG = "AsProjectBridge";

    /** Implemented by the activity. */
    public interface Host {
        boolean isTrustedPage();

        void copyToClipboard(String text);

        boolean openExternal(String url);

        void showToast(String message);

        ExportWriter exportWriter();

        void onExportSaved(ExportWriter.Saved saved);

        boolean openLocalFile(String uri, String mime);

        boolean shareLocalFile(String uri, String mime, String name);

        String platformInfo();
    }

    private final Host host;

    public NativeBridge(Host host) {
        this.host = host;
    }

    private boolean trusted() {
        boolean ok = host.isTrustedPage();
        if (!ok) {
            Log.w(TAG, "Panggilan jembatan ditolak: halaman tidak dipercaya");
        }
        return ok;
    }

    @JavascriptInterface
    public String platform() {
        try {
            JSONObject json = new JSONObject();
            json.put("app", "AsProject Studio");
            json.put("native", true);
            json.put("sdk", Build.VERSION.SDK_INT);
            json.put("platform", "android");
            String extra = host.platformInfo();
            if (extra != null && !extra.isEmpty()) {
                json.put("version", extra);
            }
            return json.toString();
        } catch (Exception e) {
            return "{\"native\":true,\"platform\":\"android\"}";
        }
    }

    @JavascriptInterface
    public boolean copyText(String text) {
        if (!trusted()) {
            return false;
        }
        if (text == null) {
            text = "";
        }
        if (text.length() > 100_000) {
            text = text.substring(0, 100_000);
        }
        host.copyToClipboard(text);
        return true;
    }

    @JavascriptInterface
    public boolean openExternal(String url) {
        if (!trusted() || url == null || url.trim().isEmpty()) {
            return false;
        }
        return host.openExternal(url.trim());
    }

    @JavascriptInterface
    public String saveBegin(String name, String mime) {
        if (!trusted()) {
            return "ERR:untrusted";
        }
        return host.exportWriter().begin(name, mime);
    }

    @JavascriptInterface
    public boolean saveChunk(String token, String base64Chunk) {
        if (!trusted()) {
            return false;
        }
        return host.exportWriter().append(token, base64Chunk);
    }

    @JavascriptInterface
    public String saveFinish(String token) {
        if (!trusted()) {
            return "{\"ok\":false,\"error\":\"untrusted\"}";
        }
        String json = host.exportWriter().finish(token);
        notifySaved(json);
        return json;
    }

    @JavascriptInterface
    public String saveFile(String name, String mime, String base64Data) {
        if (!trusted()) {
            return "{\"ok\":false,\"error\":\"untrusted\"}";
        }
        String json = host.exportWriter().saveNow(name, mime, base64Data);
        notifySaved(json);
        return json;
    }

    @JavascriptInterface
    public boolean shareSavedFile(String uri, String mime, String name) {
        if (!trusted()) {
            return false;
        }
        return host.shareLocalFile(uri, mime, name);
    }

    @JavascriptInterface
    public boolean openSavedFile(String uri, String mime) {
        if (!trusted()) {
            return false;
        }
        return host.openLocalFile(uri, mime);
    }

    @JavascriptInterface
    public void toast(String message) {
        if (!trusted() || message == null) {
            return;
        }
        host.showToast(message);
    }

    @JavascriptInterface
    public void log(String message) {
        if (!trusted() || message == null) {
            return;
        }
        if (StudioActivity.DEBUG_LOGS) {
            Log.d("AsProjectWeb", message);
        }
    }

    private void notifySaved(String json) {
        try {
            JSONObject object = new JSONObject(json);
            ExportWriter.Saved saved = new ExportWriter.Saved(
                    object.optBoolean("ok"),
                    object.optString("name", null),
                    object.optString("mime", null),
                    object.optString("uri", null),
                    object.optString("location", null),
                    object.optString("error", null));
            host.onExportSaved(saved);
        } catch (Exception e) {
            Log.w(TAG, "Hasil ekspor tidak bisa dibaca", e);
        }
    }
}
