package my.id.asproject.launcher;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Pengaturan beranda: tampilan, jumlah kolom, dock, dan aplikasi tersembunyi. */
public final class SettingsActivity extends Activity implements View.OnClickListener {

    private static final int REQUEST_NOTIF = 501;
    private static final int REQUEST_LOCATION = 502;
    private static final int REQUEST_OVERLAY = 503;
    private static final int STEP_NOTIF = 1;
    private static final int STEP_LOCATION = 2;
    private static final int STEP_OVERLAY = 3;

    private Prefs prefs;
    private Switch speedometerSwitch;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_settings);
        prefs = new Prefs(this);
        Accent.configure(prefs.accentStyle());
        // Font tema untuk seluruh halaman pengaturan.
        Typefaces.apply(this, findViewById(android.R.id.content));

        findViewById(R.id.backButton).setOnClickListener(this);

        bindSwitch(R.id.switchClock, prefs.showClock(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setShowClock(checked);
            }
        });
        bindSwitch(R.id.switchSearch, prefs.showSearch(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setShowSearch(checked);
            }
        });
        bindSwitch(R.id.switchLabels, prefs.showLabels(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setShowLabels(checked);
            }
        });

        bindSwitch(R.id.switchWallpaper, prefs.figureWallpaper(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setFigureWallpaper(checked);
            }
        });
        bindSwitch(R.id.switchLock, prefs.lockScreen(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setLockScreen(checked);
            }
        });
        bindSwitch(R.id.switchNeon, prefs.neonIcons(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setNeonIcons(checked);
            }
        });

        bindSwitch(R.id.switchMotion, prefs.liquidMotion(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setLiquidMotion(checked);
            }
        });
        bindSwitch(R.id.switchHud, prefs.hudAnimation(), new SwitchAction() {
            @Override
            public void onChanged(boolean checked) {
                prefs.setHudAnimation(checked);
            }
        });

        RadioGroup columns = (RadioGroup) findViewById(R.id.columnsGroup);
        columns.check(columnId(prefs.columns()));
        columns.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                prefs.setColumns(columnsFor(checkedId));
            }
        });

        final LiquidHandleView slideBarPreview = (LiquidHandleView) findViewById(R.id.slideBarPreview);

        RadioGroup accentGroup = (RadioGroup) findViewById(R.id.accentGroup);
        accentGroup.check(accentId(prefs.accentStyle()));
        accentGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                String style = accentStyleFor(checkedId);
                prefs.setAccentStyle(style);
                Accent.configure(style);
                slideBarPreview.invalidate();
                slideBarPreview.pulse();
            }
        });

        slideBarPreview.setStyle(prefs.slideBarStyle());
        slideBarPreview.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                slideBarPreview.pulse();
            }
        });

        RadioGroup slideBarGroup = (RadioGroup) findViewById(R.id.slideBarGroup);
        slideBarGroup.check(slideBarId(prefs.slideBarStyle()));
        slideBarGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                String style = slideBarStyleFor(checkedId);
                prefs.setSlideBarStyle(style);
                slideBarPreview.setStyle(style);
                slideBarPreview.pulse();
            }
        });

        RadioGroup speedUnitGroup = (RadioGroup) findViewById(R.id.speedUnitGroup);
        speedUnitGroup.check(unitId(prefs.speedUnit()));
        speedUnitGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                prefs.setSpeedUnit(unitStyleFor(checkedId));
            }
        });

        speedometerSwitch = (Switch) findViewById(R.id.switchSpeedometer);
        boolean speedometerOn = prefs.speedometerEnabled() && hasSpeedometerPermissions();
        if (speedometerOn != prefs.speedometerEnabled()) {
            // Izin dicabut dari luar aplikasi sejak terakhir dibuka — selaraskan.
            prefs.setSpeedometerEnabled(speedometerOn);
        }
        speedometerSwitch.setChecked(speedometerOn);
        speedometerSwitch.setOnCheckedChangeListener(speedometerToggleListener);

        Button resetDock = (Button) findViewById(R.id.resetDock);
        resetDock.setOnClickListener(this);
        Button pickHidden = (Button) findViewById(R.id.pickHidden);
        pickHidden.setOnClickListener(this);

        TextView version = (TextView) findViewById(R.id.versionText);
        version.setText(getString(R.string.version_format, versionName()));
    }

    @Override
    public void onClick(View view) {
        int id = view.getId();
        if (id == R.id.backButton) {
            finish();
        } else if (id == R.id.resetDock) {
            prefs.clearDock();
            toast(getString(R.string.dock_reset));
        } else if (id == R.id.pickHidden) {
            pickHiddenApps();
        }
    }

    private void pickHiddenApps() {
        final List<AppItem> apps = new AppRepository(this).loadApps();
        final String[] labels = new String[apps.size()];
        final boolean[] checked = new boolean[apps.size()];
        for (int i = 0; i < apps.size(); i++) {
            labels[i] = apps.get(i).label;
            checked[i] = prefs.isHidden(apps.get(i).packageName);
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.section_hidden)
                .setMultiChoiceItems(labels, checked, new DialogInterface.OnMultiChoiceClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which, boolean isChecked) {
                        checked[which] = isChecked;
                    }
                })
                .setPositiveButton(android.R.string.ok, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        Set<String> hidden = new HashSet<String>();
                        for (int i = 0; i < apps.size(); i++) {
                            if (checked[i]) {
                                hidden.add(apps.get(i).packageName);
                            }
                        }
                        prefs.setHidden(hidden);
                        toast(getString(R.string.hidden_saved, hidden.size()));
                    }
                })
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private interface SwitchAction {
        void onChanged(boolean checked);
    }

    private void bindSwitch(int id, boolean initial, final SwitchAction action) {
        Switch widget = (Switch) findViewById(id);
        widget.setChecked(initial);
        widget.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton button, boolean checked) {
                action.onChanged(checked);
            }
        });
    }

    // ------------------------------------------------- spidometer mengambang

    private final CompoundButton.OnCheckedChangeListener speedometerToggleListener =
            new CompoundButton.OnCheckedChangeListener() {
                @Override
                public void onCheckedChanged(CompoundButton button, boolean checked) {
                    if (checked) {
                        advanceSpeedometerFlow(STEP_NOTIF);
                    } else {
                        stopSpeedometer();
                    }
                }
            };

    /** Lanjutkan alur izin dari langkah tertentu; baru nyalakan layanan bila semuanya lengkap. */
    private void advanceSpeedometerFlow(int fromStepInclusive) {
        if (fromStepInclusive <= STEP_NOTIF
                && Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIF);
            return;
        }
        if (fromStepInclusive <= STEP_LOCATION
                && Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) {
            toast(getString(R.string.speedometer_need_location));
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQUEST_LOCATION);
            return;
        }
        if (fromStepInclusive <= STEP_OVERLAY
                && Build.VERSION.SDK_INT >= 23
                && !Settings.canDrawOverlays(this)) {
            toast(getString(R.string.speedometer_need_overlay));
            startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())), REQUEST_OVERLAY);
            return;
        }
        startSpeedometer();
    }

    private void startSpeedometer() {
        prefs.setSpeedometerEnabled(true);
        Intent serviceIntent = new Intent(this, SpeedometerService.class);
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void stopSpeedometer() {
        prefs.setSpeedometerEnabled(false);
        stopService(new Intent(this, SpeedometerService.class));
    }

    /** Matikan sakelar tanpa memicu ulang alur izin (dipakai saat izin ditolak). */
    private void revertSpeedometerSwitch() {
        prefs.setSpeedometerEnabled(false);
        speedometerSwitch.setOnCheckedChangeListener(null);
        speedometerSwitch.setChecked(false);
        speedometerSwitch.setOnCheckedChangeListener(speedometerToggleListener);
    }

    private boolean hasSpeedometerPermissions() {
        boolean location = Build.VERSION.SDK_INT < 23
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
        boolean overlay = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
        return location && overlay;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIF) {
            // Notifikasi cuma memengaruhi ikon status bar, bukan fungsi utama —
            // lanjutkan ke langkah berikutnya apa pun jawaban pengguna.
            advanceSpeedometerFlow(STEP_LOCATION);
        } else if (requestCode == REQUEST_LOCATION) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                advanceSpeedometerFlow(STEP_OVERLAY);
            } else {
                toast(getString(R.string.speedometer_need_location));
                revertSpeedometerSwitch();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_OVERLAY) {
            if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)) {
                startSpeedometer();
            } else {
                toast(getString(R.string.speedometer_need_overlay));
                revertSpeedometerSwitch();
            }
        }
    }

    private int unitId(String unit) {
        return "mph".equals(unit) ? R.id.unitMph : R.id.unitKmh;
    }

    private String unitStyleFor(int checkedId) {
        return checkedId == R.id.unitMph ? "mph" : "kmh";
    }

    private int columnId(int columns) {
        if (columns == 5) {
            return R.id.column5;
        }
        if (columns == 6) {
            return R.id.column6;
        }
        return R.id.column4;
    }

    private int columnsFor(int checkedId) {
        if (checkedId == R.id.column5) {
            return 5;
        }
        if (checkedId == R.id.column6) {
            return 6;
        }
        return 4;
    }

    private int accentId(String style) {
        if ("hijau".equals(style)) {
            return R.id.accentHijau;
        }
        if ("ungu".equals(style)) {
            return R.id.accentUngu;
        }
        if ("pink".equals(style)) {
            return R.id.accentPink;
        }
        return R.id.accentBiru;
    }

    private String accentStyleFor(int checkedId) {
        if (checkedId == R.id.accentHijau) {
            return "hijau";
        }
        if (checkedId == R.id.accentUngu) {
            return "ungu";
        }
        if (checkedId == R.id.accentPink) {
            return "pink";
        }
        return "biru";
    }

    private int slideBarId(String style) {
        if ("pil".equals(style)) {
            return R.id.stylePil;
        }
        if ("titik".equals(style)) {
            return R.id.styleTitik;
        }
        if ("sirkuit".equals(style)) {
            return R.id.styleSirkuit;
        }
        return R.id.styleOmbak;
    }

    private String slideBarStyleFor(int checkedId) {
        if (checkedId == R.id.stylePil) {
            return "pil";
        }
        if (checkedId == R.id.styleTitik) {
            return "titik";
        }
        if (checkedId == R.id.styleSirkuit) {
            return "sirkuit";
        }
        return "ombak";
    }

    private String versionName() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName;
        } catch (PackageManager.NameNotFoundException error) {
            return "1.0.0";
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
