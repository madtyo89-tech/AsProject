package my.id.asproject.launcher;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.EditText;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextClock;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Beranda (home screen) AsProject: jam besar, pencarian, kisi aplikasi, dan dock.
 *
 * Aplikasi ini terdaftar sebagai peluncur sistem lewat kategori HOME, sehingga bisa
 * dipilih sebagai "Aplikasi beranda" bawaan di Pengaturan Android.
 */
public final class LauncherActivity extends Activity implements TextWatcher,
        AdapterView.OnItemClickListener, AdapterView.OnItemLongClickListener,
        View.OnClickListener {

    private static final long CLOCK_REFRESH_MS = 60000L;

    private final List<AppItem> allApps = new ArrayList<AppItem>();
    private final Handler clockHandler = new Handler();
    private final Runnable clockTick = new Runnable() {
        @Override
        public void run() {
            showDate();
            clockHandler.postDelayed(this, CLOCK_REFRESH_MS);
        }
    };

    /** Memuat ulang beranda saat aplikasi dipasang, diperbarui, atau dicabut. */
    private final BroadcastReceiver packageReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            icons.clear();
            reloadApps();
        }
    };

    /** Layar menyala → tampilkan layar kunci lagi (seperti ponsel terbangun). */
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_ON.equals(intent.getAction()) && prefs.lockScreen()) {
                showLockScreen(true);
            }
        }
    };

    private Prefs prefs;
    private AppRepository repository;
    private IconLoader icons;
    private AppGridAdapter adapter;
    private boolean receiverRegistered;
    private boolean firstResume = true;

    private View homeWallpaper;
    private View glowLayer;
    private View scrimLayer;
    private LockScreenView lockScreen;
    private LinearLayout content;
    private TextClock clockView;
    private TextView dateView;
    private LinearLayout searchBar;
    private EditText searchInput;
    private ImageView clearSearch;
    private GridView grid;
    private TextView emptyView;
    private LinearLayout dockBar;

    // --------------------------------------------------------------- siklus hidup

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_launcher);

        prefs = new Prefs(this);
        repository = new AppRepository(this);
        icons = new IconLoader(this, getResources().getDimensionPixelSize(R.dimen.app_icon_size));
        adapter = new AppGridAdapter(this, icons, prefs.showLabels());

        homeWallpaper = findViewById(R.id.homeWallpaper);
        glowLayer = findViewById(R.id.glowLayer);
        scrimLayer = findViewById(R.id.scrimLayer);
        lockScreen = (LockScreenView) findViewById(R.id.lockScreen);
        lockScreen.setListener(new LockScreenView.Listener() {
            @Override
            public void onUnlocked() {
                hideKeyboard();
                searchInput.clearFocus();
                reloadApps();
            }
        });

        content = (LinearLayout) findViewById(R.id.content);
        clockView = (TextClock) findViewById(R.id.clock);
        dateView = (TextView) findViewById(R.id.date);
        searchBar = (LinearLayout) findViewById(R.id.searchBar);
        searchInput = (EditText) findViewById(R.id.searchInput);
        clearSearch = (ImageView) findViewById(R.id.clearSearch);
        grid = (GridView) findViewById(R.id.appGrid);
        emptyView = (TextView) findViewById(R.id.emptyView);
        dockBar = (LinearLayout) findViewById(R.id.dockBar);

        applyEdgeToEdge();
        applyInsets();
        applyVisibility();
        applyWallpaper();
        registerScreenReceiver();

        grid.setAdapter(adapter);
        grid.setNumColumns(prefs.columns());
        grid.setOnItemClickListener(this);
        grid.setOnItemLongClickListener(this);

        searchInput.addTextChangedListener(this);
        searchInput.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView view, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_SEARCH || actionId == EditorInfo.IME_ACTION_DONE) {
                    hideKeyboard();
                    return true;
                }
                return false;
            }
        });

        clearSearch.setOnClickListener(this);
        findViewById(R.id.settingsButton).setOnClickListener(this);
        findViewById(R.id.clockHeader).setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View view) {
                showHomeOptions();
                return true;
            }
        });
        content.setLongClickable(true);
        content.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View view) {
                showHomeOptions();
                return true;
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyVisibility();
        adapter.setShowLabels(prefs.showLabels());
        grid.setNumColumns(prefs.columns());
        showDate();
        clockHandler.removeCallbacks(clockTick);
        clockHandler.postDelayed(clockTick, CLOCK_REFRESH_MS);
        registerPackageReceiver();
        applyWallpaper();
        icons.setNeonEnabled(prefs.neonIcons());
        reloadApps();
        if (firstResume) {
            firstResume = false;
            if (prefs.lockScreen()) {
                showLockScreen(true);
            }
        } else if (!prefs.lockScreen() && lockScreen.isShowingLock()) {
            lockScreen.hideNow();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterScreenReceiver();
    }

    @Override
    protected void onPause() {
        super.onPause();
        clockHandler.removeCallbacks(clockTick);
        unregisterPackageReceiver();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Menekan tombol Home saat beranda sudah terbuka: kembali ke keadaan awal.
        hideKeyboard();
        searchInput.setText("");
        searchInput.clearFocus();
        grid.setSelection(0);
    }

    @Override
    public void onBackPressed() {
        if (lockScreen != null && lockScreen.isShowingLock()) {
            return;   // beranda terkunci: Kembali tidak melakukan apa pun
        }
        if (searchInput.getText().length() > 0) {
            searchInput.setText("");
            hideKeyboard();
            return;
        }
        if (searchInput.hasFocus()) {
            searchInput.clearFocus();
            hideKeyboard();
            return;
        }
        hideKeyboard();
        // Launcher sengaja tidak memanggil super: menekan Kembali tidak boleh
        // membuka aplikasi lain di belakang beranda.
    }

    private void registerPackageReceiver() {
        if (receiverRegistered) {
            return;
        }
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_REPLACED);
        filter.addDataScheme("package");
        try {
            registerReceiver(packageReceiver, filter);
            receiverRegistered = true;
        } catch (RuntimeException error) {
            receiverRegistered = false;
        }
    }

    private void registerScreenReceiver() {
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(screenReceiver, filter);
            }
        } catch (RuntimeException ignored) {
            // sebagian ROM menolak penerima layar; layar kunci tetap jalan saat beranda dibuka
        }
    }

    private void unregisterScreenReceiver() {
        try {
            unregisterReceiver(screenReceiver);
        } catch (RuntimeException ignored) {
            // belum terdaftar
        }
    }

    private void unregisterPackageReceiver() {
        if (!receiverRegistered) {
            return;
        }
        try {
            unregisterReceiver(packageReceiver);
        } catch (RuntimeException ignored) {
            // penerima sudah dilepas sistem
        }
        receiverRegistered = false;
    }

    // ------------------------------------------------------------------ tampilan

    private void applyVisibility() {
        int clockVisibility = prefs.showClock() ? View.VISIBLE : View.GONE;
        clockView.setVisibility(clockVisibility);
        dateView.setVisibility(clockVisibility);
        searchBar.setVisibility(prefs.showSearch() ? View.VISIBLE : View.GONE);
    }

    /** Wallpaper neon + opasitas lapisan gelap yang menyesuaikan. */
    private void applyWallpaper() {
        boolean figure = prefs.figureWallpaper();
        homeWallpaper.setVisibility(figure ? View.VISIBLE : View.GONE);
        glowLayer.setAlpha(figure ? 0f : 1f);
        scrimLayer.setAlpha(figure ? 0.34f : 1f);
    }

    private void showLockScreen(boolean animate) {
        if (!prefs.lockScreen()) {
            return;
        }
        searchInput.setText("");
        searchInput.clearFocus();
        hideKeyboard();
        lockScreen.show(animate);
    }

    private void applyEdgeToEdge() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(0x66000000);
        window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private void applyInsets() {
        final View root = findViewById(R.id.root);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                content.setPadding(dp(16), insets.getSystemWindowInsetTop() + dp(8),
                        dp(16), insets.getSystemWindowInsetBottom() + dp(10));
                return insets;
            }
        });
    }

    // -------------------------------------------------------------------- data

    private void reloadApps() {
        int firstVisible = grid.getFirstVisiblePosition();
        List<AppItem> installed = repository.loadApps();
        allApps.clear();
        allApps.addAll(installed);
        renderDock();
        applyFilter(searchInput.getText().toString());
        if (firstVisible > 0) {
            grid.setSelection(firstVisible);
        }
    }

    private void applyFilter(String query) {
        String needle = normalise(query);
        List<AppItem> visible = new ArrayList<AppItem>();
        for (int i = 0; i < allApps.size(); i++) {
            AppItem item = allApps.get(i);
            if (prefs.isHidden(item.packageName)) {
                continue;
            }
            if (needle.length() == 0 || normalise(item.label).contains(needle)) {
                visible.add(item);
            }
        }
        adapter.setItems(visible);

        boolean empty = visible.isEmpty();
        if (empty) {
            emptyView.setText(allApps.isEmpty() ? R.string.no_apps : R.string.empty_search);
        }
        emptyView.setVisibility(empty ? View.VISIBLE : View.GONE);
        grid.setVisibility(empty ? View.GONE : View.VISIBLE);
    }

    private void renderDock() {
        dockBar.removeAllViews();
        List<AppItem> dockApps = resolveDock();
        if (dockApps.isEmpty()) {
            dockBar.setVisibility(View.GONE);
            return;
        }
        dockBar.setVisibility(View.VISIBLE);

        int iconSize = getResources().getDimensionPixelSize(R.dimen.dock_icon_size);
        for (int i = 0; i < dockApps.size(); i++) {
            final AppItem item = dockApps.get(i);
            ImageView slot = new ImageView(this);
            slot.setLayoutParams(new LinearLayout.LayoutParams(0, iconSize, 1f));
            slot.setScaleType(ImageView.ScaleType.FIT_CENTER);
            slot.setPadding(dp(6), dp(6), dp(6), dp(6));
            slot.setImageBitmap(icons.get(item));
            slot.setContentDescription(item.label);
            slot.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    launch(item);
                }
            });
            slot.setOnLongClickListener(new View.OnLongClickListener() {
                @Override
                public boolean onLongClick(View view) {
                    showAppOptions(item);
                    return true;
                }
            });
            dockBar.addView(slot);
        }
    }

    private List<AppItem> resolveDock() {
        List<String> wanted = prefs.dock();
        if (wanted.isEmpty() && !prefs.hasDock()) {
            wanted = repository.suggestDockPackages(Prefs.MAX_DOCK);
            if (wanted.isEmpty()) {
                // Sebagian ROM tidak menjawab ACTION_DIAL/CATEGORY_APP_*: pakai
                // aplikasi pertama (urutan abjad) supaya dock tetap berisi.
                for (int i = 0; i < allApps.size() && wanted.size() < Prefs.MAX_DOCK; i++) {
                    String name = allApps.get(i).packageName;
                    if (!prefs.isHidden(name)) {
                        wanted.add(name);
                    }
                }
            }
            if (!wanted.isEmpty()) {
                prefs.setDock(wanted);
            }
        }
        List<AppItem> resolved = new ArrayList<AppItem>();
        for (int i = 0; i < wanted.size() && resolved.size() < Prefs.MAX_DOCK; i++) {
            AppItem item = findByPackage(wanted.get(i));
            if (item != null && !prefs.isHidden(item.packageName)) {
                resolved.add(item);
            }
        }
        return resolved;
    }

    private AppItem findByPackage(String packageName) {
        for (int i = 0; i < allApps.size(); i++) {
            if (allApps.get(i).packageName.equals(packageName)) {
                return allApps.get(i);
            }
        }
        return null;
    }

    // ------------------------------------------------------------------- aksi

    private void launch(AppItem item) {
        try {
            startActivity(item.launchIntent());
            hideKeyboard();
            if (searchInput.getText().length() > 0) {
                searchInput.setText("");
            }
        } catch (ActivityNotFoundException error) {
            toast(getString(R.string.app_unavailable, item.label));
        } catch (SecurityException error) {
            toast(getString(R.string.app_unavailable, item.label));
        }
    }

    private void showAppOptions(final AppItem item) {
        final boolean inDock = prefs.dock().contains(item.packageName);
        String[] actions = {
                getString(R.string.action_open),
                getString(inDock ? R.string.action_remove_dock : R.string.action_add_dock),
                getString(R.string.action_hide),
                getString(R.string.action_app_info)
        };
        new AlertDialog.Builder(this)
                .setTitle(item.label)
                .setItems(actions, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) {
                            launch(item);
                        } else if (which == 1) {
                            toggleDock(item, inDock);
                        } else if (which == 2) {
                            prefs.setHidden(item.packageName, true);
                            reloadApps();
                            toast(getString(R.string.app_hidden, item.label));
                        } else {
                            openAppInfo(item.packageName);
                        }
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void toggleDock(AppItem item, boolean inDock) {
        if (inDock) {
            prefs.removeFromDock(item.packageName);
            renderDock();
            toast(getString(R.string.dock_removed, item.label));
        } else if (prefs.addToDock(item.packageName)) {
            renderDock();
            toast(getString(R.string.dock_added, item.label));
        } else {
            toast(getString(R.string.dock_full));
        }
    }

    private void showHomeOptions() {
        String[] actions = {
                getString(R.string.action_lock_now),
                getString(R.string.action_wallpaper),
                getString(R.string.action_settings),
                getString(R.string.action_about)
        };
        new AlertDialog.Builder(this)
                .setTitle(R.string.home_options)
                .setItems(actions, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) {
                            showLockScreen(true);
                        } else if (which == 1) {
                            chooseWallpaper();
                        } else if (which == 2) {
                            openSettings();
                        } else {
                            showAbout();
                        }
                    }
                })
                .show();
    }

    private void chooseWallpaper() {
        Intent intent = new Intent(Intent.ACTION_SET_WALLPAPER);
        try {
            startActivity(Intent.createChooser(intent, getString(R.string.choose_wallpaper)));
        } catch (ActivityNotFoundException error) {
            toast(getString(R.string.wallpaper_unavailable));
        }
    }

    private void openAppInfo(String packageName) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", packageName, null));
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            toast(getString(R.string.app_info_unavailable));
        }
    }

    private void openSettings() {
        startActivity(new Intent(this, SettingsActivity.class));
    }

    private void showAbout() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.action_about)
                .setMessage(getString(R.string.about_message))
                .setPositiveButton(android.R.string.ok, null)
                .show();
    }

    // ------------------------------------------------------------------ pencarian

    @Override
    public void beforeTextChanged(CharSequence text, int start, int count, int after) {
        // tidak dipakai
    }

    @Override
    public void onTextChanged(CharSequence text, int start, int before, int count) {
        applyFilter(text.toString());
        clearSearch.setVisibility(text.length() > 0 ? View.VISIBLE : View.GONE);
        grid.setSelection(0);
    }

    @Override
    public void afterTextChanged(Editable text) {
        // tidak dipakai
    }

    // -------------------------------------------------------------------- klik

    @Override
    public void onClick(View view) {
        int id = view.getId();
        if (id == R.id.clearSearch) {
            searchInput.setText("");
        } else if (id == R.id.settingsButton) {
            openSettings();
        }
    }

    @Override
    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
        launch(adapter.getItem(position));
    }

    @Override
    public boolean onItemLongClick(AdapterView<?> parent, View view, int position, long id) {
        showAppOptions(adapter.getItem(position));
        return true;
    }

    // -------------------------------------------------------------------- util

    private void showDate() {
        SimpleDateFormat format = new SimpleDateFormat("EEEE, d MMMM yyyy", new Locale("id", "ID"));
        dateView.setText(format.format(new Date()));
    }

    private void hideKeyboard() {
        InputMethodManager manager = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (manager != null) {
            manager.hideSoftInputFromWindow(searchInput.getWindowToken(), 0);
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics()));
    }

    private static String normalise(String text) {
        return text == null ? "" : text.toLowerCase(Locale.getDefault()).trim();
    }
}
