package my.id.asproject.floating;

import android.annotation.TargetApi;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Layar utama: menyalakan gelembung, mengatur izin overlay, dan memilih aplikasi mana saja
 * yang muncul di gelembung.
 *
 * <p>Semua tampilan memakai widget framework (tanpa AndroidX). Baris daftar dibangun dari
 * {@code res/layout/row_shortcut.xml} supaya urutan pengguna mudah digeser.
 */
public final class LauncherActivity extends Activity {

    /** Izin notifikasi Android 13+; dipakai untuk notifikasi layanan gelembung. */
    private static final String PERMISSION_POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";
    private static final int REQUEST_NOTIFICATIONS = 91;

    private ShortcutStore store;
    private List<Shortcut> items = new ArrayList<Shortcut>();

    private TextView overlayState;
    private TextView overlayHint;
    private Button overlayPermission;
    private Button toggleBubble;
    private LinearLayout listContainer;
    private TextView listEmpty;
    private CheckBox showUninstalled;
    private CheckBox autostart;
    private TextView freeformStatus;
    private CheckBox freeformCheck;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_launcher);
        store = new ShortcutStore(this);

        overlayState = (TextView) findViewById(R.id.overlay_state);
        overlayHint = (TextView) findViewById(R.id.overlay_hint);
        overlayPermission = (Button) findViewById(R.id.btn_overlay_permission);
        toggleBubble = (Button) findViewById(R.id.btn_toggle);
        listContainer = (LinearLayout) findViewById(R.id.list_container);
        listEmpty = (TextView) findViewById(R.id.list_empty);
        showUninstalled = (CheckBox) findViewById(R.id.chk_show_uninstalled);
        autostart = (CheckBox) findViewById(R.id.chk_autostart);
        freeformStatus = (TextView) findViewById(R.id.freeform_status);
        freeformCheck = (CheckBox) findViewById(R.id.chk_freeform);

        overlayPermission.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                OverlayPermission.request(LauncherActivity.this);
            }
        });
        toggleBubble.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleBubble();
            }
        });
        findViewById(R.id.btn_add).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showAppPicker();
            }
        });
        findViewById(R.id.btn_reset).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                confirmReset();
            }
        });
        showUninstalled.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                store.setShowUninstalled(checked);
                renderList();
            }
        });
        autostart.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                store.setAutostart(checked);
            }
        });
        freeformCheck.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                store.setPreferFreeform(checked);
            }
        });
        findViewById(R.id.btn_freeform_help).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showFreeformHelp();
            }
        });

        TextView version = (TextView) findViewById(R.id.version_note);
        version.setText(getString(R.string.footer_note, versionName()));
    }

    @Override
    protected void onResume() {
        super.onResume();
        items = store.load();
        showUninstalled.setChecked(store.showUninstalled());
        autostart.setChecked(store.autostart());
        freeformCheck.setChecked(store.preferFreeform());
        refreshStatus();
        refreshFreeform();
        renderList();
    }

    // ------------------------------------------------------------------ status & tombol

    private void refreshStatus() {
        boolean granted = OverlayPermission.canDrawOverlays(this);
        boolean running = FloatingService.isRunning();
        overlayState.setText(running ? R.string.state_on : R.string.state_off);
        toggleBubble.setText(running ? R.string.action_stop : R.string.action_start);
        overlayPermission.setVisibility(granted ? View.GONE : View.VISIBLE);
        if (!granted) {
            overlayHint.setText(R.string.hint_permission_needed);
        } else {
            overlayHint.setText(R.string.hint_usage);
        }
    }

    private void refreshFreeform() {
        if (!Freeform.supported()) {
            freeformStatus.setText(R.string.freeform_unsupported);
            freeformCheck.setEnabled(false);
            return;
        }
        freeformCheck.setEnabled(true);
        String support = getString(R.string.ya);
        String secure = Freeform.hasSecureSettings(this)
                ? getString(R.string.ya) : getString(R.string.belum);
        String enabled = Freeform.isSupportEnabled(this)
                ? getString(R.string.ya) : getString(R.string.belum);
        freeformStatus.setText(getString(R.string.freeform_status, support, secure, enabled));

        // Bila izin ADB sudah ada tapi setelan belum, nyalakan otomatis.
        if (Freeform.hasSecureSettings(this) && !Freeform.isSupportEnabled(this)
                && Freeform.enableSupport(this)) {
            refreshFreeform();
        }
    }

    private void showFreeformHelp() {
        final String command = Freeform.adbCommand(getPackageName());
        new AlertDialog.Builder(this)
                .setTitle(R.string.freeform_help_title)
                .setMessage(getString(R.string.freeform_help_message, command))
                .setNeutralButton(R.string.freeform_copy, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        copyText(command);
                        Toast.makeText(LauncherActivity.this, R.string.freeform_copied,
                                Toast.LENGTH_SHORT).show();
                    }
                })
                .setPositiveButton("OK", null)
                .show();
    }

    private void copyText(String text) {
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager)
                getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("asproject", text));
        }
    }

    private void toggleBubble() {
        if (!OverlayPermission.canDrawOverlays(this)) {
            Toast.makeText(this, R.string.toast_permission_needed, Toast.LENGTH_LONG).show();
            OverlayPermission.request(this);
            return;
        }
        if (FloatingService.isRunning()) {
            FloatingService.stop(this);
            Toast.makeText(this, R.string.toast_stopped, Toast.LENGTH_SHORT).show();
        } else {
            askNotificationPermissionIfNeeded();
            FloatingService.start(this);
            Toast.makeText(this, R.string.toast_started, Toast.LENGTH_LONG).show();
        }
        refreshStatus();
    }

    /**
     * Android 13+: notifikasi layanan gelembung perlu izin notifikasi. Diminta sekali, tepat
     * sebelum gelembung dinyalakan (bukan saat aplikasi dibuka).
     */
    @TargetApi(Build.VERSION_CODES.TIRAMISU)
    private void askNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        if (checkSelfPermission(PERMISSION_POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        requestPermissions(new String[]{PERMISSION_POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
    }    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS
                && (grantResults.length == 0 || grantResults[0] != PackageManager.PERMISSION_GRANTED)) {
            Toast.makeText(this, R.string.toast_notification_denied, Toast.LENGTH_LONG).show();
        }
    }

    // ------------------------------------------------------------------ daftar aplikasi

    private void renderList() {
        listContainer.removeAllViews();
        List<Shortcut> visible = visibleItems();
        listEmpty.setVisibility(visible.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < visible.size(); i++) {
            listContainer.addView(buildRow(visible.get(i), i, visible.size()));
        }
    }

    /** Daftar yang ditampilkan: semua entri, atau hanya yang terpasang sesuai setelan. */
    private List<Shortcut> visibleItems() {
        List<Shortcut> visible = new ArrayList<Shortcut>();
        for (Shortcut item : items) {
            if (store.showUninstalled() || AppOpener.isInstalled(this, item.packages)
                    || item.packages.length == 0) {
                visible.add(item);
            }
        }
        return visible;
    }

    private View buildRow(final Shortcut item, final int position, final int total) {
        View row = LayoutInflater.from(this).inflate(R.layout.row_shortcut, listContainer, false);

        CheckBox check = (CheckBox) row.findViewById(R.id.row_enabled);
        check.setChecked(item.enabled);
        check.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                item.enabled = checked;
                persist();
            }
        });

        TextView badge = (TextView) row.findViewById(R.id.row_badge);
        badge.setText(item.initial());
        badge.setBackground(badgeDrawable(item.color));

        TextView name = (TextView) row.findViewById(R.id.row_name);
        name.setText(item.label);

        TextView detail = (TextView) row.findViewById(R.id.row_detail);
        boolean installed = AppOpener.isInstalled(this, item.packages);
        if (item.packages.length == 0) {
            detail.setText(R.string.detail_link);
        } else if (installed) {
            detail.setText(AppOpener.firstInstalled(this, item.packages));
        } else {
            detail.setText(R.string.detail_not_installed);
            detail.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    AppOpener.openStore(LauncherActivity.this, item.primaryPackage());
                }
            });
        }

        View up = row.findViewById(R.id.row_up);
        View down = row.findViewById(R.id.row_down);
        up.setVisibility(position == 0 ? View.INVISIBLE : View.VISIBLE);
        down.setVisibility(position == total - 1 ? View.INVISIBLE : View.VISIBLE);
        up.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                move(item, -1);
            }
        });
        down.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                move(item, 1);
            }
        });
        row.findViewById(R.id.row_remove).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                remove(item);
            }
        });
        return row;
    }

    /** Geser urutan. Arah dihitung pada daftar yang sedang ditampilkan. */
    private void move(Shortcut item, int direction) {
        List<Shortcut> visible = visibleItems();
        int from = visible.indexOf(item);
        int to = from + direction;
        if (from < 0 || to < 0 || to >= visible.size()) {
            return;
        }
        int realFrom = items.indexOf(item);
        int realTo = items.indexOf(visible.get(to));
        if (realFrom < 0 || realTo < 0) {
            return;
        }
        Collections.swap(items, realFrom, realTo);
        persist();
    }

    private void remove(final Shortcut item) {
        new AlertDialog.Builder(this)
                .setTitle(R.string.remove_title)
                .setMessage(getString(R.string.remove_message, item.label))
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.remove_yes, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        items.remove(item);
                        persist();
                    }
                })
                .show();
    }

    private void confirmReset() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.reset_title)
                .setMessage(R.string.reset_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.reset_yes, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        store.reset();
                        items = store.load();
                        renderList();
                        FloatingService.refresh(LauncherActivity.this);
                    }
                })
                .show();
    }

    private void persist() {
        store.save(items);
        renderList();
        FloatingService.refresh(this);
    }

    // ------------------------------------------------------------------ tambah aplikasi

    private void showAppPicker() {
        final List<String[]> choices = installedAppsNotInList();
        if (choices.isEmpty()) {
            Toast.makeText(this, R.string.picker_empty, Toast.LENGTH_LONG).show();
            return;
        }
        String[] labels = new String[choices.size()];
        for (int i = 0; i < choices.size(); i++) {
            labels[i] = choices.get(i)[0];
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.picker_title)
                .setItems(labels, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String[] choice = choices.get(which);
                        Shortcut added = Shortcut.app("app:" + choice[1], choice[0], true, choice[1]);
                        items.add(added);
                        persist();
                    }
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    /** Semua aplikasi yang punya ikon peluncur, di luar yang sudah ada di daftar. */
    private List<String[]> installedAppsNotInList() {
        PackageManager pm = getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> resolved = pm.queryIntentActivities(main, 0);
        List<String> known = new ArrayList<String>();
        known.add(getPackageName());
        for (Shortcut item : items) {
            Collections.addAll(known, item.packages);
        }
        List<String[]> choices = new ArrayList<String[]>();
        List<String> seen = new ArrayList<String>();
        for (ResolveInfo info : resolved) {
            if (info.activityInfo == null) {
                continue;
            }
            String pkg = info.activityInfo.packageName;
            if (pkg == null || known.contains(pkg) || seen.contains(pkg)) {
                continue;
            }
            seen.add(pkg);
            String label = info.loadLabel(pm) == null ? pkg : info.loadLabel(pm).toString();
            choices.add(new String[]{label, pkg});
        }
        Collections.sort(choices, new java.util.Comparator<String[]>() {
            @Override
            public int compare(String[] a, String[] b) {
                return a[0].compareToIgnoreCase(b[0]);
            }
        });
        return choices;
    }

    // ------------------------------------------------------------------ bantuan tampilan

    private GradientDrawable badgeDrawable(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(color);
        return drawable;
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }
}
