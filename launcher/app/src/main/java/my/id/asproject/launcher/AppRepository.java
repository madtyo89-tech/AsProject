package my.id.asproject.launcher;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Membaca daftar aplikasi yang punya ikon di peluncur (satu ikon per paket). */
public final class AppRepository {

    private final Context context;

    public AppRepository(Context context) {
        this.context = context.getApplicationContext();
    }

    public List<AppItem> loadApps() {
        PackageManager manager = context.getPackageManager();
        Intent query = new Intent(Intent.ACTION_MAIN, null);
        query.addCategory(Intent.CATEGORY_LAUNCHER);

        List<ResolveInfo> resolved;
        try {
            resolved = manager.queryIntentActivities(query, 0);
        } catch (RuntimeException error) {
            resolved = new ArrayList<ResolveInfo>();
        }

        String self = context.getPackageName();
        Map<String, AppItem> byPackage = new LinkedHashMap<String, AppItem>();
        for (int i = 0; i < resolved.size(); i++) {
            ResolveInfo info = resolved.get(i);
            ActivityInfo activity = info.activityInfo;
            if (activity == null || activity.packageName == null || activity.name == null) {
                continue;
            }
            if (self.equals(activity.packageName) || byPackage.containsKey(activity.packageName)) {
                continue;
            }
            String label = label(manager, info, activity.packageName);
            byPackage.put(activity.packageName,
                    new AppItem(label, activity.packageName, activity.name));
        }

        List<AppItem> apps = new ArrayList<AppItem>(byPackage.values());
        final Collator collator = Collator.getInstance(new Locale("id", "ID"));
        Collections.sort(apps, new Comparator<AppItem>() {
            @Override
            public int compare(AppItem left, AppItem right) {
                int byLabel = collator.compare(left.label, right.label);
                return byLabel != 0 ? byLabel : left.packageName.compareTo(right.packageName);
            }
        });
        return apps;
    }

    /**
     * Tebakan isi dock bawaan: telepon, pesan, peramban, kamera, galeri —
     * hanya yang benar-benar terpasang dan bisa dibuka dari beranda.
     */
    public List<String> suggestDockPackages(int limit) {
        PackageManager manager = context.getPackageManager();
        List<String> found = new ArrayList<String>();

        addResolved(manager, new Intent(Intent.ACTION_DIAL), found);
        addResolved(manager, new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MESSAGING), found);
        addResolved(manager, new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_BROWSER), found);
        // Android tidak punya CATEGORY_APP_CAMERA; aksi MediaStore ini yang dipakai.
        addResolved(manager, new Intent("android.media.action.STILL_IMAGE_CAMERA"), found);
        addResolved(manager, new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_GALLERY), found);

        if (found.size() > limit) {
            return new ArrayList<String>(found.subList(0, limit));
        }
        return found;
    }

    private void addResolved(PackageManager manager, Intent intent, List<String> out) {
        ResolveInfo info;
        try {
            info = manager.resolveActivity(intent, 0);
        } catch (RuntimeException error) {
            return;
        }
        if (info == null || info.activityInfo == null) {
            return;
        }
        String packageName = info.activityInfo.packageName;
        if (packageName == null || packageName.equals(context.getPackageName())
                || out.contains(packageName)) {
            return;
        }
        if (manager.getLaunchIntentForPackage(packageName) == null) {
            return;
        }
        out.add(packageName);
    }

    private static String label(PackageManager manager, ResolveInfo info, String fallback) {
        CharSequence text = null;
        try {
            text = info.loadLabel(manager);
        } catch (RuntimeException ignored) {
            // nama tidak terbaca — pakai nama paket
        }
        if (text == null) {
            return fallback;
        }
        String label = text.toString().trim();
        return label.length() == 0 ? fallback : label;
    }
}
