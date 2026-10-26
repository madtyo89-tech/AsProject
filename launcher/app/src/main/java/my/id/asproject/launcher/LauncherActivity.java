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
import android.view.GestureDetector;
import android.view.LayoutInflater;
import android.view.MotionEvent;
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
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
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

    private HomeWallpaperView homeWallpaper;
    private View glowLayer;
    private View scrimLayer;
    private LockScreenView lockScreen;
    private LinearLayout content;
    private SevenSegmentClockView clockView;
    private TextView dateView;
    private LinearLayout searchBar;
    private EditText searchInput;
    private ImageView clearSearch;
    private GridView grid;
    private TextView emptyView;
    private LinearLayout dockBar;
    private AppDrawerView drawer;
    private View clockHeader;
    private AppGridAdapter drawerAdapter;
    private GestureDetector swipeDetector;

    // --------------------------------------------------------------- siklus hidup

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_launcher);

        prefs = new Prefs(this);
        repository = new AppRepository(this);
        icons = new IconLoader(this, prefs, getResources().getDimensionPixelSize(R.dimen.app_icon_size));
        adapter = new AppGridAdapter(this, icons, prefs.showLabels());

        homeWallpaper = (HomeWallpaperView) findViewById(R.id.homeWallpaper);
        glowLayer = findViewById(R.id.glowLayer);
        scrimLayer = findViewById(R.id.scrimLayer);
        lockScreen = (LockScreenView) findViewById(R.id.lockScreen);
        lockScreen.setListener(new LockScreenView.Listener() {
            @Override
            public void onUnlocked() {
                hideKeyboard();
                searchInput.clearFocus();
                reloadApps();
                // Wallpaper beranda tidak perlu bergerak selama layar kunci tampil.
                homeWallpaper.setMotionEnabled(prefs.figureWallpaper() && prefs.liquidMotion());
            }
        });

        content = (LinearLayout) findViewById(R.id.content);
        clockHeader = findViewById(R.id.clockHeader);
        clockView = (SevenSegmentClockView) findViewById(R.id.clock);
        dateView = (TextView) findViewById(R.id.date);
        searchBar = (LinearLayout) findViewById(R.id.searchBar);
        searchInput = (EditText) findViewById(R.id.searchInput);
        clearSearch = (ImageView) findViewById(R.id.clearSearch);
        grid = (GridView) findViewById(R.id.appGrid);
        emptyView = (TextView) findViewById(R.id.emptyView);
        dockBar = (LinearLayout) findViewById(R.id.dockBar);

        drawer = (AppDrawerView) findViewById(R.id.appDrawer);
        drawerAdapter = new AppGridAdapter(this, icons, prefs.showLabels());
        drawer.attach(drawerAdapter);
        drawer.setColumns(prefs.columns());
        drawer.setListener(new AppDrawerView.Listener() {
            @Override
            public void onProgress(float progress) {
                applyDrawerParallax(progress);
            }

            @Override
            public void onOpened() {
                // Tidak ada yang perlu dilakukan: beranda sudah menyusut.
            }

            @Override
            public void onClosed() {
                applyDrawerParallax(0f);
            }

            @Override
            public void onAppClick(AppItem item) {
                drawer.close();
                launch(item);
            }

            @Override
            public boolean onAppLongClick(AppItem item) {
                showAppOptions(item);
                return true;
            }
        });

        // Geser ke atas pada area kosong beranda → buka laci aplikasi.
        swipeDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float velocityX, float velocityY) {
                if (e1 == null || e2 == null) {
                    return false;
                }
                float dy = e2.getY() - e1.getY();
                if (dy < -dp(48) && Math.abs(velocityY) > Math.abs(velocityX) && velocityY < -600f) {
                    if (drawer != null && !drawer.isOpen()
                            && !lockScreen.isShowingLock()) {
                        drawer.open();
                        return true;
                    }
                }
                return false;
            }
        });
        content.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View view, MotionEvent event) {
                if (drawer != null && drawer.isOpen()) {
                    return false;
                }
                return swipeDetector != null && swipeDetector.onTouchEvent(event);
            }
        });

        // Font tema untuk seluruh beranda & laci.
        Typefaces.apply(this, content);
        Typefaces.apply(this, drawer);

        applyEdgeToEdge();
        applyInsets();
        applyVisibility();
        applyWallpaper();
        registerScreenReceiver();

        grid.setAdapter(adapter);
        grid.setNumColumns(prefs.columns());
        grid.setOnItemClickListener(this);
        grid.setOnItemLongClickListener(this);
        grid.setOnScrollListener(new android.widget.AbsListView.OnScrollListener() {
            @Override
            public void onScrollStateChanged(android.widget.AbsListView view, int state) {
            }

            @Override
            public void onScroll(android.widget.AbsListView view, int firstVisible,
                                 int visibleCount, int totalCount) {
                applyHomeScroll(view, firstVisible);
            }
        });

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
        if (drawer != null && drawer.isOpen()) {
            drawer.close();
            return;
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
        // Wallpaper neon sudah ramai: lapisan emas tambahan tidak perlu.
        glowLayer.setAlpha(figure ? 0f : 1f);
        scrimLayer.setAlpha(figure ? 0.24f : 1f);
        homeWallpaper.setMotionEnabled(figure && prefs.liquidMotion());
        lockScreen.applyPrefs(prefs);
    }

    private void showLockScreen(boolean animate) {
        if (!prefs.lockScreen()) {
            return;
        }
        if (drawer != null && drawer.isOpen()) {
            drawer.close();
        }
        searchInput.setText("");
        searchInput.clearFocus();
        hideKeyboard();
        // Hemat baterai: hentikan animasi wallpaper yang tertutup layar kunci.
        homeWallpaper.setMotionEnabled(false);
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

    /**
     * Efek scroll beranda: saat kisi aplikasi digulir, kepala (jam + tanggal)
     * menyusut & memudar, dan kolom pencarian ikut memudar — seperti tajuk yang
     * melipat. Keadaan dipulihkan bila kisi kembali ke posisi paling atas.
     */
    private void applyHomeScroll(android.widget.AbsListView view, int firstVisible) {
        if (clockHeader == null) {
            return;
        }
        float offset = 0f;
        if (view != null && view.getChildCount() > 0) {
            // Perkiraan jarak gulung: baris yang lewat + porsi baris terlihat.
            float row = dp(86);
            offset = firstVisible * row - view.getChildAt(0).getTop();
        }
        float progress = Math.max(0f, Math.min(1f, offset / dp(150)));
        float scale = 1f - 0.18f * progress;
        clockHeader.setScaleX(scale);
        clockHeader.setScaleY(scale);
        clockHeader.setAlpha(1f - 0.75f * progress);
        clockHeader.setTranslationY(-dp(18) * progress);
        if (searchBar != null) {
            searchBar.setAlpha(1f - 0.85f * progress);
        }
    }

    /**
     * Efek scroll halaman utama saat laci bergerak: beranda menyusut & memudar,
     * wallpaper sedikit memper besar (parallax), dan dock ikut memudar.
     */
    private void applyDrawerParallax(float progress) {
        if (content != null) {
            float scale = 1f - 0.10f * progress;
            content.setScaleX(scale);
            content.setScaleY(scale);
            content.setAlpha(1f - 0.45f * progress);
            content.setTranslationY(-dp(26) * progress);
            content.setPivotY(getResources().getDisplayMetrics().heightPixels * 0.45f);
        }
        if (homeWallpaper != null) {
            float zoom = 1f + 0.07f * progress;
            homeWallpaper.setScaleX(zoom);
            homeWallpaper.setScaleY(zoom);
        }
        if (dockBar != null) {
            dockBar.setAlpha(1f - progress);
        }
    }

    // -------------------------------------------------------------------- data

    private void reloadApps() {
        int firstVisible = grid.getFirstVisiblePosition();
        List<AppItem> installed = repository.loadApps();
        allApps.clear();
        allApps.addAll(installed);
        renderDock();
        applyFilter(searchInput.getText().toString());
        if (drawer != null) {
            List<AppItem> forDrawer = new ArrayList<AppItem>();
            for (int i = 0; i < allApps.size(); i++) {
                AppItem item = allApps.get(i);
                if (!prefs.isHidden(item.packageName)) {
                    forDrawer.add(item);
                }
            }
            drawer.setItems(forDrawer);
            drawer.setColumns(prefs.columns());
            drawer.setShowLabels(prefs.showLabels());
        }
        if (firstVisible > 0) {
            grid.setSelection(firstVisible);
        }
    }

    private void applyFilter(String query) {
        String needle = normalise(query);
        List<AppItem> visible;
        if (needle.length() == 0) {
            // Tanpa pencarian: kisi biasa dengan folder dikelompokkan.
            visible = HomeModel.build(allApps, prefs);
        } else {
            // Mencari: tampilkan aplikasi yang cocok apa adanya (folder dibongkar
            // sementara) supaya aplikasi di dalam folder tetap bisa ditemukan.
            visible = new ArrayList<AppItem>();
            for (int i = 0; i < allApps.size(); i++) {
                AppItem item = allApps.get(i);
                if (prefs.isHidden(item.packageName)) {
                    continue;
                }
                if (normalise(item.label).contains(needle)) {
                    visible.add(item);
                }
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

    /** Panel sederhana: kisi aplikasi anggota folder, bisa diketuk langsung. */
    private void showFolder(final AppItem folder) {
        View view = LayoutInflater.from(this).inflate(R.layout.view_folder, null);
        GridView folderGrid = (GridView) view.findViewById(R.id.folderGrid);
        TextView title = (TextView) view.findViewById(R.id.folderTitle);
        title.setText(folder.label);
        AppGridAdapter folderAdapter = new AppGridAdapter(this, icons, prefs.showLabels());
        folderAdapter.setItems(folder.members);
        folderGrid.setNumColumns(Math.min(4, Math.max(2, folder.members.size())));
        folderGrid.setAdapter(folderAdapter);
        Typefaces.apply(this, view);

        final AlertDialog dialog = new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_NoActionBar)
                .setView(view)
                .create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }
        folderGrid.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View v, int position, long id) {
                dialog.dismiss();
                launch(folder.members.get(position));
            }
        });
        folderGrid.setOnItemLongClickListener(new AdapterView.OnItemLongClickListener() {
            @Override
            public boolean onItemLongClick(AdapterView<?> parent, View v, int position, long id) {
                dialog.dismiss();
                showAppOptions(folder.members.get(position));
                return true;
            }
        });
        dialog.show();
    }

    private void showFolderOptions(final AppItem folder) {
        new AlertDialog.Builder(this)
                .setTitle(folder.label)
                .setItems(new String[]{
                        getString(R.string.action_open),
                        getString(R.string.action_ungroup)
                }, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) {
                            showFolder(folder);
                        } else {
                            LinkedHashMap<String, List<String>> folders = prefs.folders();
                            folders.remove(folder.label);
                            prefs.saveFolders(folders);
                            reloadApps();
                            toast(getString(R.string.folder_ungrouped, folder.label));
                        }
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    /** Tawarkan: taruh aplikasi ke folder yang sudah ada, atau buat folder baru. */
    private void showGroupDialog(final AppItem item) {
        final LinkedHashMap<String, List<String>> folders = prefs.folders();
        final List<String> names = new ArrayList<String>(folders.keySet());
        String[] options = new String[names.size() + 1];
        for (int i = 0; i < names.size(); i++) {
            options[i] = names.get(i);
        }
        options[names.size()] = getString(R.string.new_folder);

        new AlertDialog.Builder(this)
                .setTitle(R.string.action_group)
                .setItems(options, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        if (which < names.size()) {
                            addToFolder(folders, names.get(which), item);
                        } else {
                            promptNewFolder(folders, item);
                        }
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void promptNewFolder(final LinkedHashMap<String, List<String>> folders, final AppItem item) {
        final EditText input = new EditText(this);
        input.setHint(R.string.folder_name_hint);
        input.setSingleLine(true);
        new AlertDialog.Builder(this)
                .setTitle(R.string.new_folder)
                .setView(input)
                .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String name = input.getText().toString().trim();
                        if (name.length() == 0) {
                            name = item.label;
                        }
                        while (folders.containsKey(name)) {
                            name = name + " ";
                        }
                        addToFolder(folders, name, item);
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void addToFolder(LinkedHashMap<String, List<String>> folders, String name, AppItem item) {
        List<String> members = folders.get(name);
        if (members == null) {
            members = new ArrayList<String>();
            folders.put(name, members);
        }
        if (!members.contains(item.key)) {
            members.add(item.key);
        }
        prefs.saveFolders(folders);
        reloadApps();
        toast(getString(R.string.added_to_folder, item.label, name));
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
                getString(R.string.action_group),
                getString(R.string.action_icon_style),
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
                            showGroupDialog(item);
                        } else if (which == 3) {
                            showIconStyleDialog(item);
                        } else if (which == 4) {
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

    /** Pilih bentuk tile ikon untuk satu aplikasi: squircle, lingkaran, kotak, segi delapan. */
    private void showIconStyleDialog(final AppItem item) {
        final String[] keys = {"auto", "cincin", "sudut", "hexa"};
        String[] labels = {
                getString(R.string.icon_style_auto),
                getString(R.string.icon_style_circle),
                getString(R.string.icon_style_square),
                getString(R.string.icon_style_octagon)
        };
        int current = 0;
        for (int i = 0; i < keys.length; i++) {
            if (keys[i].equals(prefs.iconStyle(item.key))) {
                current = i;
                break;
            }
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.action_icon_style)
                .setSingleChoiceItems(labels, current, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        prefs.setIconStyle(item.key, keys[which]);
                        icons.clear();
                        reloadApps();
                        dialog.dismiss();
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
        openOrLaunch(adapter.getItem(position));
    }

    @Override
    public boolean onItemLongClick(AdapterView<?> parent, View view, int position, long id) {
        if (adapter.getItem(position).folder) {
            showFolderOptions(adapter.getItem(position));
        } else {
            showAppOptions(adapter.getItem(position));
        }
        return true;
    }

    /** Ketuk entri beranda: buka folder, atau luncurkan aplikasi. */
    private void openOrLaunch(AppItem item) {
        if (item.folder) {
            showFolder(item);
        } else {
            launch(item);
        }
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
