package my.id.asproject.studio;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * AsProject Studio for Android.
 *
 * <p>The Studio stays on the server: this activity only renders
 * {@code https://asproject.my.id/studio.html} in a WebView, so every site update is picked up on the
 * next load without shipping a new APK. Around that WebView it adds what a browser tab cannot:
 *
 * <ul>
 *   <li>navigation allow-list ({@link UrlPolicy}) with external links handed to the right app
 *       (WhatsApp, Google Maps, browser) — see {@link ExternalLinks};</li>
 *   <li>native pickers for the upload buttons (camera / gallery / documents);</li>
 *   <li>native saving of exported files (invitation HTML, guest CSV, QR PNG) and blob downloads
 *       through {@link NativeBridge} + {@link ExportWriter};</li>
 *   <li>a reload button, a loading indicator, and an offline/error screen with "Coba Lagi";</li>
 *   <li>back navigation with exit confirmation on the first page;</li>
 *   <li>zero automatic reloads, so an in-progress edit is never discarded by the wrapper.</li>
 * </ul>
 */
public class StudioActivity extends Activity implements NativeBridge.Host {

    private static final String TAG = "AsProjectStudio";

    private static final String STATE_LAST_URL = "asproject.last_url";
    private static final String STATE_LAST_UPLOAD_NAME = "asproject.last_upload";

    private static final int REQ_FILE_CHOOSER = 4001;
    private static final int REQ_CAMERA_PERMISSION = 4002;
    /** Permintaan izin kamera dari halaman web (getUserMedia) yang menunggu izin runtime. */
    private PermissionRequest pendingWebPermission;

    private static final long EXPORT_BAR_TIMEOUT_MS = 12_000L;

    /** Enables console logging; derived from the debuggable flag of the build. */
    static boolean DEBUG_LOGS = false;

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingOverlay;
    private TextView loadingText;
    private View errorPanel;
    private TextView errorTitle;
    private TextView errorMessage;
    private TextView errorDetail;
    private ImageButton reloadButton;
    private View exportBar;
    private TextView exportText;

    private ExportWriter exportWriter;
    private NativeBridge bridge;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ValueCallback<Uri[]> pendingFileCallback;
    private Uri pendingCameraUri;

    private boolean pageReadyOnce = false;
    private boolean errorVisible = false;
    private boolean destroying = false;

    private String currentUrl = UrlPolicy.STUDIO_URL;
    private String uploadedFileName = "";

    private ExportWriter.Saved lastSaved;

    private final Runnable hideExportBar = new Runnable() {
        @Override
        public void run() {
            if (exportBar != null) {
                exportBar.setVisibility(View.GONE);
            }
            lastSaved = null;
        }
    };

    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean online = true;

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        DEBUG_LOGS = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

        setContentView(R.layout.activity_studio);
        bindViews();
        applySystemBarStyle();

        exportWriter = new ExportWriter(this);
        bridge = new NativeBridge(this);

        setupWebView();
        setupButtons();
        setupConnectivity();

        if (savedInstanceState != null) {
            uploadedFileName = savedInstanceState.getString(STATE_LAST_UPLOAD_NAME, "");
        }

        String startUrl = UrlPolicy.STUDIO_URL;
        if (savedInstanceState != null) {
            String restored = savedInstanceState.getString(STATE_LAST_URL, "");
            if (restored != null && !restored.isEmpty() && UrlPolicy.isInternalNavigable(restored)) {
                startUrl = restored;
            }
        }
        currentUrl = startUrl;
        loadInternal(startUrl);
    }

    private void bindViews() {
        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);
        loadingOverlay = findViewById(R.id.loading_overlay);
        loadingText = findViewById(R.id.loading_text);
        errorPanel = findViewById(R.id.error_panel);
        errorTitle = findViewById(R.id.error_title);
        errorMessage = findViewById(R.id.error_message);
        errorDetail = findViewById(R.id.error_detail);
        reloadButton = findViewById(R.id.reload_button);
        exportBar = findViewById(R.id.export_bar);
        exportText = findViewById(R.id.export_text);
    }

    private void applySystemBarStyle() {
        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        int background = dark ? Color.parseColor("#FF121212") : Color.parseColor("#FFFAF9F7");
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        int flags = 0;
        if (!dark) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        String url = webView == null ? null : webView.getUrl();
        outState.putString(STATE_LAST_URL,
                url != null && UrlPolicy.isInternalNavigable(url) ? url : currentUrl);
        outState.putString(STATE_LAST_UPLOAD_NAME, uploadedFileName);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        destroying = true;
        unregisterConnectivity();
        mainHandler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
            }
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ---------------------------------------------------------------- WebView setup

    private void setupWebView() {
        WebView.setWebContentsDebuggingEnabled(DEBUG_LOGS);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Cache default: the page follows the server's own Cache-Control/ETag headers, so a Studio
        // update is picked up on the next load and can never be pinned to a stale copy.
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString()
                + " AsProjectStudio/" + appVersionName());

        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new StudioWebViewClient());
        webView.setWebChromeClient(new StudioChromeClient());
        webView.setDownloadListener(new StudioDownloadListener());
        webView.addJavascriptInterface(bridge, "AsProject");
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            // Keep the editor reachable while the soft keyboard is open (adjustResize already
            // resizes the window on most devices; this covers the ones that only report insets).
            int keyboard = keyboardHeight(insets);
            if (view.getPaddingBottom() != keyboard) {
                view.setPadding(view.getPaddingLeft(), view.getPaddingTop(),
                        view.getPaddingRight(), keyboard);
            }
            return insets;
        });
    }

    private static int keyboardHeight(WindowInsets insets) {
        if (insets == null) {
            return 0;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (insets.isVisible(WindowInsets.Type.ime())) {
                return insets.getInsets(WindowInsets.Type.ime()).bottom;
            }
            return 0;
        }
        // API < 30: a bottom inset larger than the stable (navigation bar) inset is the keyboard.
        int bottom = insets.getSystemWindowInsetBottom();
        return bottom > insets.getStableInsetBottom() ? bottom : 0;
    }

    private String appVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "1.0";
        }
    }

    private void loadInternal(String url) {
        if (webView == null) {
            return;
        }
        String target = UrlPolicy.upgradeToHttps(url);
        currentUrl = target;
        hideError();
        showLoadingOverlay(true);
        loadingText.setText(R.string.loading_connecting);
        if (!isOnline()) {
            showError(getString(R.string.error_title), getString(R.string.error_offline),
                    "offline", DEBUG_LOGS);
            return;
        }
        webView.loadUrl(target);
    }

    /** Manual reload — the only path that refreshes the page, and it always follows a tap. */
    private void reloadStudio() {
        if (webView == null) {
            return;
        }
        hideError();
        showLoadingOverlay(!pageReadyOnce);
        progressBar.setVisibility(View.VISIBLE);
        progressBar.setProgress(0);
        String url = webView.getUrl();
        if (url == null || !UrlPolicy.isInternalNavigable(url)) {
            webView.loadUrl(UrlPolicy.STUDIO_URL);
        } else {
            webView.reload();
        }
    }

    private void showLoadingOverlay(boolean show) {
        loadingOverlay.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    // ---------------------------------------------------------------- error & retry

    private void showError(String title, String message, String detail, boolean showDetail) {
        errorVisible = true;
        errorTitle.setText(title);
        errorMessage.setText(message);
        errorDetail.setText(showDetail && detail != null ? detail : "");
        errorDetail.setVisibility(showDetail ? View.VISIBLE : View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
        loadingOverlay.setVisibility(View.GONE);
        progressBar.setVisibility(View.GONE);
        reloadButton.setVisibility(View.GONE);
    }

    private void hideError() {
        if (errorVisible) {
            errorPanel.setVisibility(View.GONE);
            errorVisible = false;
        }
        if (reloadButton != null) {
            reloadButton.setVisibility(View.VISIBLE);
        }
    }

    private String describeError(WebResourceError error) {
        if (error == null) {
            return getString(R.string.error_generic);
        }
        switch (error.getErrorCode()) {
            case WebViewClient.ERROR_HOST_LOOKUP:
                return getString(R.string.error_host);
            case WebViewClient.ERROR_TIMEOUT:
            case WebViewClient.ERROR_CONNECT:
            case WebViewClient.ERROR_IO:
                return getString(R.string.error_timeout);
            default:
                return getString(R.string.error_generic);
        }
    }

    // ---------------------------------------------------------------- buttons

    private void setupButtons() {
        reloadButton.setOnClickListener(v -> confirmReload());
        findViewById(R.id.error_retry).setOnClickListener(v -> loadInternal(UrlPolicy.STUDIO_URL));
        findViewById(R.id.error_open_browser).setOnClickListener(v -> openExternally(UrlPolicy.STUDIO_URL));

        findViewById(R.id.export_open).setOnClickListener(v -> {
            if (lastSaved != null && lastSaved.ok && !openLocalFile(lastSaved.uri, lastSaved.mime)) {
                toast(getString(R.string.export_no_app));
            }
        });
        findViewById(R.id.export_share).setOnClickListener(v -> {
            if (lastSaved != null && lastSaved.ok) {
                if (!shareLocalFile(lastSaved.uri, lastSaved.mime, lastSaved.name)) {
                    toast(getString(R.string.export_no_app));
                }
            }
        });
        findViewById(R.id.export_close).setOnClickListener(v -> {
            mainHandler.removeCallbacks(hideExportBar);
            hideExportBar.run();
        });
    }

    private void confirmReload() {
        if (errorVisible) {
            loadInternal(UrlPolicy.STUDIO_URL);
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.reload_confirm_title)
                .setMessage(R.string.reload_confirm_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.reload_confirm_yes, (dialog, which) -> reloadStudio())
                .show();
    }

    @Override
    public void onBackPressed() {
        if (pendingFileCallback != null) {
            cancelFileChooser();
            return;
        }
        if (exportBar.getVisibility() == View.VISIBLE) {
            mainHandler.removeCallbacks(hideExportBar);
            hideExportBar.run();
            return;
        }
        if (!errorVisible && webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        confirmExit();
    }

    private void confirmExit() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.exit_title)
                .setMessage(R.string.exit_message)
                .setNegativeButton(R.string.exit_no, null)
                .setNeutralButton(R.string.reload, (dialog, which) -> reloadStudio())
                .setPositiveButton(R.string.exit_yes, (dialog, which) -> finish())
                .show();
    }

    // ---------------------------------------------------------------- WebViewClient

    private final class StudioWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String url = uri == null ? "" : uri.toString();
            String scheme = uri == null ? "" : uri.getScheme();

            if (!request.isForMainFrame()) {
                // Sub-frames (the Studio preview iframe, blob: documents) stay inside the WebView.
                // Only schemes the WebView cannot render at all are swallowed here.
                return UrlPolicy.isExternalAppScheme(url);
            }
            if ("http".equalsIgnoreCase(scheme) && UrlPolicy.isInternalHost(url)) {
                // The Studio is never loaded over plain HTTP: upgrade and continue internally.
                view.loadUrl(UrlPolicy.upgradeToHttps(url));
                return true;
            }
            if (UrlPolicy.isInternalNavigable(url)) {
                return false; // stay inside the app
            }
            if (UrlPolicy.isNonNavigableScheme(url)) {
                // blob:/data:/about: live inside the WebView (document preview, downloads).
                return false;
            }
            openExternally(url);
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            String scheme = UrlPolicy.parse(url).scheme;
            if ("http".equalsIgnoreCase(scheme) && UrlPolicy.isInternalHost(url)) {
                view.loadUrl(UrlPolicy.upgradeToHttps(url));
                return true;
            }
            if (UrlPolicy.isInternalNavigable(url) || UrlPolicy.isNonNavigableScheme(url)) {
                return false;
            }
            openExternally(url);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (destroying) {
                return;
            }
            currentUrl = url;
            if (!errorVisible) {
                progressBar.setVisibility(View.VISIBLE);
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (destroying) {
                return;
            }
            pageReadyOnce = true;
            currentUrl = url;
            progressBar.setVisibility(View.GONE);
            showLoadingOverlay(false);
            // Install the (idempotent) native bridge for pages that ship without it. Nothing else
            // touches the page: no auto reload, so an edit in progress is never discarded.
            if (!errorVisible && UrlPolicy.isInternalNavigable(url)) {
                evaluateJavascript(bridgeScript());
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (destroying || request == null || !request.isForMainFrame()) {
                return;
            }
            String url = request.getUrl() == null ? currentUrl : request.getUrl().toString();
            if (!UrlPolicy.isInternalHost(url)) {
                return;
            }
            int code = error == null ? 0 : error.getErrorCode();
            Log.w(TAG, "Gagal memuat (code=" + code + "): " + url);
            if (code == WebViewClient.ERROR_UNKNOWN || code == 0) {
                // Usually a cancelled load (quick reload); not a real connection problem.
                return;
            }
            showError(getString(R.string.error_title), describeError(error),
                    "code=" + code + " url=" + url, DEBUG_LOGS);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                        WebResourceResponse errorResponse) {
            if (destroying || request == null || !request.isForMainFrame() || errorResponse == null) {
                return;
            }
            int status = errorResponse.getStatusCode();
            String url = request.getUrl() == null ? "" : request.getUrl().toString();
            Log.w(TAG, "HTTP " + status + " untuk " + url);
            if (status < 500) {
                // 4xx is rendered by the site itself (404.html routes /u/{slug}), so leave it alone.
                return;
            }
            showError(getString(R.string.error_title), getString(R.string.error_http, status),
                    "http=" + status + " url=" + url, DEBUG_LOGS);
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                       android.net.http.SslError error) {
            // Certificate problems are never bypassed.
            handler.cancel();
            String detail = error == null ? "" : (error.getUrl() + " (" + error.getPrimaryError() + ")");
            Log.e(TAG, "Kesalahan sertifikat, pemuatan dibatalkan: " + detail);
            showError(getString(R.string.error_title), getString(R.string.error_ssl),
                    "ssl " + detail, DEBUG_LOGS);
        }

        @Override
        public void onReceivedClientCertRequest(WebView view, android.webkit.ClientCertRequest request) {
            request.cancel();
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            currentUrl = url;
        }

        @Override
        public boolean onRenderProcessGone(WebView view,
                                           android.webkit.RenderProcessGoneDetail detail) {
            if (destroying) {
                return true;
            }
            Log.e(TAG, "Proses render WebView berhenti (crash="
                    + (detail != null && detail.didCrash()) + ")");
            toast(getString(R.string.renderer_gone));
            // true = sudah ditangani (aplikasi tidak ikut dimatikan sistem).
            recreateWebView();
            return true;
        }
    }

    private void recreateWebView() {
        if (webView == null) {
            return;
        }
        WebView old = webView;
        ViewGroup parent = (ViewGroup) old.getParent();
        int index = parent == null ? -1 : parent.indexOfChild(old);
        if (parent != null) {
            parent.removeView(old);
        }
        old.destroy();

        webView = new WebView(this);
        webView.setId(R.id.webview);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setupWebView();
        pageReadyOnce = false;
        if (parent != null && index >= 0) {
            parent.addView(webView, index);
        }
        loadInternal(UrlPolicy.STUDIO_URL);
    }

    // ---------------------------------------------------------------- WebChromeClient

    private final class StudioChromeClient extends WebChromeClient {

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            if (newProgress >= 100) {
                progressBar.setVisibility(View.GONE);
            } else if (!errorVisible) {
                progressBar.setVisibility(View.VISIBLE);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(null);
            }
            pendingFileCallback = callback;
            String[] acceptTypes = params == null ? null : params.getAcceptTypes();
            boolean multiple = params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
            showSourceChooser(acceptTypes, multiple);
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            // Kamera web dipakai halaman scan.html (Scan QR Panitia). Mikrofon tetap
            // ditolak — tidak ada fitur yang membutuhkannya.
            String[] diminta = request.getResources();
            boolean butuhKamera = false;
            for (String r : diminta) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                    butuhKamera = true;
                    break;
                }
            }
            if (!butuhKamera) {
                request.deny();
                Log.i(TAG, "Permintaan izin web ditolak: " + java.util.Arrays.toString(diminta));
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                    || checkSelfPermission(android.Manifest.permission.CAMERA)
                       == PackageManager.PERMISSION_GRANTED) {
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                return;
            }
            // Minta izin kamera Android dulu; grant/deny diteruskan di
            // onRequestPermissionsResult.
            pendingWebPermission = request;
            requestPermissions(new String[]{android.Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION);
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin,
                                                       GeolocationPermissions.Callback callback) {
            callback.invoke(origin, false, false);
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                      android.os.Message resultMsg) {
            // window.open(): internal links stay in this WebView, everything else leaves the app.
            WebView transport = new WebView(StudioActivity.this);
            transport.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView unused, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    handleWindowOpen(uri == null ? "" : uri.toString());
                    return true;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView unused, String url) {
                    handleWindowOpen(url);
                    return true;
                }
            });
            Object transportObject = resultMsg.obj;
            if (transportObject instanceof WebView.WebViewTransport) {
                ((WebView.WebViewTransport) transportObject).setWebView(transport);
            }
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public boolean onConsoleMessage(android.webkit.ConsoleMessage message) {
            if (DEBUG_LOGS && message != null) {
                Log.d("AsProjectWeb", message.message() + " @" + message.sourceId()
                        + ":" + message.lineNumber());
            }
            return true;
        }
    }

    private void handleWindowOpen(String url) {
        if (UrlPolicy.isInternalNavigable(url) && webView != null) {
            webView.loadUrl(url);
            return;
        }
        if (UrlPolicy.isNonNavigableScheme(url)) {
            return;
        }
        openExternally(url);
    }

    // ---------------------------------------------------------------- upload / camera

    private void showSourceChooser(String[] acceptTypes, boolean multiple) {
        boolean wantsImage = accepts(acceptTypes, "image/");
        boolean wantsAudio = accepts(acceptTypes, "audio/");
        String type = guessMimeType(acceptTypes, wantsImage, wantsAudio);
        boolean cameraAvailable = wantsImage && !wantsAudio && hasCameraApp();

        List<String> labels = new ArrayList<>();
        final List<Integer> actions = new ArrayList<>();
        if (cameraAvailable) {
            labels.add(getString(R.string.chooser_camera));
            actions.add(0);
        }
        labels.add(getString(R.string.chooser_gallery));
        actions.add(1);
        labels.add(getString(R.string.chooser_document));
        actions.add(2);

        new AlertDialog.Builder(this)
                .setTitle(R.string.chooser_title)
                .setItems(labels.toArray(new CharSequence[0]), (dialog, which) -> {
                    int action = actions.get(which);
                    if (action == 0) {
                        startCameraCapture();
                    } else if (action == 1) {
                        startPicker(buildGalleryIntent(type, multiple));
                    } else {
                        startPicker(buildDocumentIntent(type, multiple));
                    }
                })
                .setOnCancelListener(dialog -> cancelFileChooser())
                .show();
    }

    private boolean accepts(String[] acceptTypes, String prefix) {
        if (acceptTypes == null) {
            return false;
        }
        for (String accept : acceptTypes) {
            if (accept != null && accept.trim().toLowerCase(Locale.ROOT).startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private String guessMimeType(String[] acceptTypes, boolean wantsImage, boolean wantsAudio) {
        boolean wantsVideo = accepts(acceptTypes, "video/");
        if (wantsImage && !wantsAudio && !wantsVideo) {
            return "image/*";
        }
        if (wantsAudio && !wantsImage && !wantsVideo) {
            return "audio/*";
        }
        if (wantsVideo && !wantsImage && !wantsAudio) {
            return "video/*";
        }
        return "*/*";
    }

    private Intent buildGalleryIntent(String type, boolean multiple) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type == null ? "*/*" : type);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        return intent;
    }

    private Intent buildDocumentIntent(String type, boolean multiple) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type == null ? "*/*" : type);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        return intent;
    }

    private void startPicker(Intent intent) {
        try {
            startActivityForResult(Intent.createChooser(intent, getString(R.string.chooser_title)),
                    REQ_FILE_CHOOSER);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Tidak ada aplikasi pemilih berkas", e);
            toast(getString(R.string.chooser_no_app));
            cancelFileChooser();
        }
    }

    private boolean hasCameraApp() {
        PackageManager manager = getPackageManager();
        return manager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
                || manager.hasSystemFeature(PackageManager.FEATURE_CAMERA);
    }

    private void startCameraCapture() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(android.Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION);
            return;
        }
        launchCameraIntent();
    }

    private void launchCameraIntent() {
        Intent capture = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (capture.resolveActivity(getPackageManager()) == null) {
            toast(getString(R.string.chooser_camera_failed));
            cancelFileChooser();
            return;
        }
        try {
            File target = ShareFileProvider.newCameraTarget(this);
            Uri uri = ShareFileProvider.uriFor(this, target);
            if (uri == null) {
                toast(getString(R.string.chooser_camera_failed));
                cancelFileChooser();
                return;
            }
            pendingCameraUri = uri;
            capture.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            capture.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(capture, REQ_FILE_CHOOSER);
        } catch (IOException e) {
            Log.e(TAG, "Kamera gagal disiapkan", e);
            toast(getString(R.string.chooser_camera_failed));
            cancelFileChooser();
        } catch (ActivityNotFoundException e) {
            toast(getString(R.string.chooser_camera_failed));
            cancelFileChooser();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA_PERMISSION) {
            return;
        }
        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (pendingWebPermission != null) {
            // Hasil izin untuk getUserMedia (halaman scan QR).
            PermissionRequest web = pendingWebPermission;
            pendingWebPermission = null;
            if (granted) {
                web.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                web.deny();
                toast(getString(R.string.permission_denied));
            }
            return;
        }
        if (granted) {
            launchCameraIntent();
        } else {
            // Gallery / documents remain available, so the upload is not a dead end.
            toast(getString(R.string.permission_denied));
            if (pendingFileCallback != null) {
                showSourceChooser(new String[]{"image/*"}, false);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE_CHOOSER) {
            return;
        }
        ValueCallback<Uri[]> callback = pendingFileCallback;
        pendingFileCallback = null;
        Uri cameraUri = pendingCameraUri;
        pendingCameraUri = null;
        if (callback == null) {
            return;
        }
        if (resultCode != RESULT_OK) {
            callback.onReceiveValue(null);
            return;
        }
        List<Uri> results = new ArrayList<>();
        if (data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int i = 0; i < clip.getItemCount(); i++) {
                    Uri uri = clip.getItemAt(i).getUri();
                    if (uri != null) {
                        results.add(uri);
                    }
                }
            }
            Uri single = data.getData();
            if (single != null && results.isEmpty()) {
                results.add(single);
            }
            // Some camera apps return the photo as a thumbnail only.
            if (results.isEmpty() && data.getExtras() != null) {
                Object thumb = data.getExtras().get("data");
                if (thumb instanceof Bitmap) {
                    Uri saved = persistCameraThumbnail((Bitmap) thumb);
                    if (saved != null) {
                        results.add(saved);
                    }
                }
            }
        }
        if (results.isEmpty() && cameraUri != null) {
            results.add(cameraUri);
        }
        if (results.isEmpty()) {
            callback.onReceiveValue(null);
            return;
        }
        if (data != null && data.getData() != null) {
            uploadedFileName = safeName(data.getData());
        }
        for (Uri uri : results) {
            grantReadPermission(uri);
        }
        callback.onReceiveValue(results.toArray(new Uri[0]));
    }

    private String safeName(Uri uri) {
        try {
            String name = uri.getLastPathSegment();
            return name == null ? "" : name;
        } catch (Exception e) {
            return "";
        }
    }

    private void grantReadPermission(Uri uri) {
        try {
            if (uri != null && "content".equals(uri.getScheme())
                    && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                getContentResolver().takePersistableUriPermission(uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        } catch (Exception e) {
            // Not a persistable URI (e.g. camera output) — safe to ignore.
        }
    }

    private Uri persistCameraThumbnail(Bitmap bitmap) {
        try {
            File target = ShareFileProvider.newCameraTarget(this);
            FileOutputStream out = new FileOutputStream(target);
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out);
            out.flush();
            out.close();
            return ShareFileProvider.uriFor(this, target);
        } catch (Exception e) {
            Log.w(TAG, "Thumbnail kamera gagal disimpan", e);
            return null;
        }
    }

    private void cancelFileChooser() {
        ValueCallback<Uri[]> callback = pendingFileCallback;
        pendingFileCallback = null;
        pendingCameraUri = null;
        if (callback != null) {
            callback.onReceiveValue(null);
        }
    }

    // ---------------------------------------------------------------- downloads / exports

    private final class StudioDownloadListener implements DownloadListener {

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                    String mimeType, long contentLength) {
            if (url == null) {
                return;
            }
            String scheme = UrlPolicy.parse(url).scheme;
            if ("blob".equals(scheme)) {
                saveBlobUrl(url, contentDisposition, mimeType);
            } else if ("data".equals(scheme)) {
                saveDataUrl(url, contentDisposition, mimeType);
            } else {
                downloadWithSystem(url, userAgent, contentDisposition, mimeType);
            }
        }
    }

    /**
     * Blob exports (the Studio builds the invitation HTML, the guest CSV and the QR PNG through
     * {@code URL.createObjectURL}) cannot be fetched by DownloadManager, so the bytes are streamed
     * to {@link ExportWriter} in base64 chunks over the JavaScript bridge.
     */
    private void saveBlobUrl(String blobUrl, String contentDisposition, String mimeType) {
        String name = URLUtil.guessFileName(blobUrl, contentDisposition, mimeType);
        String mime = mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType;
        if (name == null || name.isEmpty()) {
            name = "asproject-export";
        }
        String script = "(function(){"
                + "if(!window.AsProject||!window.AsProject.saveBegin){return 'no-bridge';}"
                + "var u=" + jsString(blobUrl) + ",n=" + jsString(name) + ",m=" + jsString(mime) + ";"
                + "fetch(u).then(function(r){return r.blob();}).then(function(b){"
                + " if(b.size>48*1024*1024){window.AsProject.toast('Berkas terlalu besar untuk disimpan di aplikasi');return;}"
                + " var mime=b.type||m;"
                + " var fr=new FileReader();"
                + " fr.onload=function(){var s=String(fr.result),c=s.indexOf(','),b64=s.substring(c+1);"
                + "  var t=window.AsProject.saveBegin(n,mime);"
                + "  if(!t||t.indexOf('ERR')===0){window.AsProject.toast('Gagal memulai penyimpanan');return;}"
                + "  var step=1048576;"
                + "  for(var o=0;o<b64.length;o+=step){"
                + "   if(!window.AsProject.saveChunk(t,b64.substr(o,step))){window.AsProject.toast('Gagal menulis berkas');return;}}"
                + "  var res=window.AsProject.saveFinish(t);"
                + "  if(window.AsProjectDownloader&&window.AsProjectDownloader.onSaved){window.AsProjectDownloader.onSaved(res);}};"
                + " fr.onerror=function(){window.AsProject.toast('Gagal membaca berkas ekspor');};"
                + " fr.readAsDataURL(b);"
                + "}).catch(function(e){if(window.AsProject){window.AsProject.toast('Ekspor gagal: '+e);}});"
                + "})();";
        evaluateJavascript(script);
    }

    private void saveDataUrl(String dataUrl, String contentDisposition, String mimeType) {
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) {
                return;
            }
            String meta = dataUrl.substring(0, comma);
            String payload = dataUrl.substring(comma + 1);
            String mime = mimeType;
            int colon = meta.indexOf(':');
            int semi = meta.indexOf(';');
            if (colon >= 0 && semi > colon) {
                String declared = meta.substring(colon + 1, semi);
                if (!declared.isEmpty()) {
                    mime = declared;
                }
            }
            if (!meta.toLowerCase(Locale.ROOT).contains(";base64")) {
                payload = Base64.encodeToString(Uri.decode(payload).getBytes("UTF-8"), Base64.NO_WRAP);
            }
            String name = URLUtil.guessFileName(dataUrl, contentDisposition, mime);
            onExportSavedJson(exportWriter.saveNow(name, mime, payload), name);
        } catch (Exception e) {
            Log.e(TAG, "Gagal menyimpan data URL", e);
            toast(getString(R.string.export_failed, e.getClass().getSimpleName()));
        }
    }

    private void downloadWithSystem(String url, String userAgent, String contentDisposition,
                                    String mimeType) {
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimeType);
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }
            request.setTitle(name);
            request.setDescription(getString(R.string.app_name));
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Public Downloads collection; no storage permission needed on Android 10+.
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            } else {
                // App specific folder on older releases keeps the app free of storage permissions.
                request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
            }
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                openExternally(url);
                return;
            }
            manager.enqueue(request);
            toast(getString(R.string.export_saved, name));
        } catch (Exception e) {
            Log.w(TAG, "DownloadManager gagal, membuka di peramban", e);
            openExternally(url);
        }
    }

    private String jsString(String value) {
        if (value == null) {
            return "''";
        }
        StringBuilder builder = new StringBuilder("'");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '\\':
                    builder.append("\\\\");
                    break;
                case '\'':
                    builder.append("\\'");
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '<':
                    builder.append("\\u003c");
                    break;
                case '\u2028':
                    builder.append("\\u2028");
                    break;
                case '\u2029':
                    builder.append("\\u2029");
                    break;
                default:
                    builder.append(c);
            }
        }
        return builder.append('\'').toString();
    }

    /**
     * The web side of the bridge, bundled in {@code assets/native-bridge.js}
     * (kept in {@code android/web/native-bridge.js} in the repository and copied by the build
     * script). It is injected after each successful page load so that the wrapper works even
     * before the site itself references the file.
     */
    private String bridgeScript() {
        if (cachedBridgeScript == null) {
            try (java.io.InputStream in = getAssets().open("native-bridge.js")) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                }
                cachedBridgeScript = out.toString("UTF-8");
            } catch (IOException e) {
                Log.w(TAG, "native-bridge.js tidak ada di aset", e);
                cachedBridgeScript = "";
            }
        }
        return cachedBridgeScript;
    }

    private String cachedBridgeScript;

    private void evaluateJavascript(String script) {
        if (webView == null || destroying) {
            return;
        }
        runOnUiThread(() -> {
            if (webView != null && !destroying) {
                webView.evaluateJavascript(script, null);
            }
        });
    }

    // ---------------------------------------------------------------- NativeBridge.Host

    @Override
    public boolean isTrustedPage() {
        if (webView == null) {
            return false;
        }
        String url = webView.getUrl();
        return url != null && !url.isEmpty() && UrlPolicy.isInternalNavigable(url);
    }

    @Override
    public void copyToClipboard(String text) {
        runOnUiThread(() -> {
            try {
                ClipboardManager manager = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (manager == null) {
                    return;
                }
                manager.setPrimaryClip(ClipData.newPlainText(getString(R.string.app_name), text));
                if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
                    // Android 13+ shows its own clipboard confirmation UI.
                    toast(getString(R.string.copy_done));
                }
            } catch (Exception e) {
                Log.w(TAG, "Gagal menyalin", e);
            }
        });
    }

    @Override
    public boolean openExternal(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        return openExternally(url.trim());
    }

    /** Opens a link outside the app, with the browser as a fallback. */
    private boolean openExternally(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        String target = url.trim();
        if (UrlPolicy.isNonNavigableScheme(target)) {
            toast(getString(R.string.export_no_app));
            return false;
        }
        boolean opened = ExternalLinks.open(this, target);
        if (!opened) {
            toast(getString(R.string.chooser_no_app));
        }
        return opened;
    }

    @Override
    public void showToast(String message) {
        if (message != null) {
            runOnUiThread(() -> toast(message));
        }
    }

    @Override
    public ExportWriter exportWriter() {
        return exportWriter;
    }

    @Override
    public void onExportSaved(ExportWriter.Saved saved) {
        if (saved == null) {
            return;
        }
        runOnUiThread(() -> {
            if (!saved.ok) {
                toast(getString(R.string.export_failed, saved.error == null ? "?" : saved.error));
                return;
            }
            lastSaved = saved;
            exportText.setText(getString(R.string.export_saved, saved.name));
            exportBar.setVisibility(View.VISIBLE);
            mainHandler.removeCallbacks(hideExportBar);
            mainHandler.postDelayed(hideExportBar, EXPORT_BAR_TIMEOUT_MS);
        });
    }

    private void onExportSavedJson(String json, String fallbackName) {
        try {
            JSONObject object = new JSONObject(json);
            onExportSaved(new ExportWriter.Saved(
                    object.optBoolean("ok"),
                    object.optString("name", fallbackName),
                    object.optString("mime", null),
                    object.optString("uri", null),
                    object.optString("location", null),
                    object.optString("error", null)));
        } catch (Exception e) {
            Log.w(TAG, "Hasil simpan tidak terbaca", e);
        }
    }

    @Override
    public boolean openLocalFile(String uri, String mime) {
        if (uri == null || uri.isEmpty()) {
            return false;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(uri), mime == null || mime.isEmpty() ? "*/*" : mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(uri));
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (Exception inner) {
                Log.w(TAG, "Tidak ada aplikasi untuk membuka " + uri, inner);
                return false;
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal membuka " + uri, e);
            return false;
        }
    }

    @Override
    public boolean shareLocalFile(String uri, String mime, String name) {
        if (uri == null || uri.isEmpty()) {
            return false;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mime == null || mime.isEmpty() ? "*/*" : mime);
            intent.putExtra(Intent.EXTRA_STREAM, Uri.parse(uri));
            intent.putExtra(Intent.EXTRA_TITLE, name);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(intent,
                    name == null ? getString(R.string.export_share) : name);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(chooser);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Gagal membagikan " + uri, e);
            return false;
        }
    }

    @Override
    public String platformInfo() {
        return appVersionName();
    }

    // ---------------------------------------------------------------- connectivity

    private void setupConnectivity() {
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        online = isOnline();
        if (connectivityManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }
        try {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    onConnectivityChanged(true);
                }

                @Override
                public void onLost(Network network) {
                    onConnectivityChanged(isOnline());
                }
            };
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception e) {
            Log.w(TAG, "Pemantauan jaringan tidak tersedia", e);
        }
    }

    private void unregisterConnectivity() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                // not registered any more
            }
        }
        networkCallback = null;
    }

    private void onConnectivityChanged(boolean nowOnline) {
        boolean wasOnline = online;
        online = nowOnline;
        if (!wasOnline && nowOnline && errorVisible) {
            // No automatic reload — that could discard an edit in progress. Just say the button
            // will work now.
            runOnUiThread(() -> errorMessage.setText(getString(R.string.error_reconnected)));
        }
    }

    @SuppressWarnings("deprecation")
    private boolean isOnline() {
        try {
            ConnectivityManager manager =
                    (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (manager == null) {
                return true;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network network = manager.getActiveNetwork();
                if (network == null) {
                    return false;
                }
                NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
                return capabilities != null
                        && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
            NetworkInfo info = manager.getActiveNetworkInfo();
            return info != null && info.isConnected();
        } catch (Exception e) {
            return true;
        }
    }

    // ---------------------------------------------------------------- misc

    private void toast(String message) {
        if (message == null || message.isEmpty() || isFinishing()) {
            return;
        }
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
