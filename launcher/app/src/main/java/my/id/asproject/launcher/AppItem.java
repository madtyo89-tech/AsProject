package my.id.asproject.launcher;

import android.content.ComponentName;
import android.content.Intent;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Satu entri di kisi beranda: bisa aplikasi, bisa folder. */
public final class AppItem {

    public final String label;
    public final String packageName;
    public final String activityName;
    /** Kunci stabil untuk cache ikon & daftar dock. */
    public final String key;

    /** true bila entri ini folder (bukan aplikasi yang bisa diluncurkan). */
    public final boolean folder;
    /** Anggota folder (null bila ini aplikasi). */
    public final List<AppItem> members;

    public AppItem(String label, String packageName, String activityName) {
        this.label = label;
        this.packageName = packageName;
        this.activityName = activityName;
        this.key = packageName + "/" + activityName;
        this.folder = false;
        this.members = null;
    }

    /** Folder: kunci sintetis "folder:<nama>" supaya cache ikon & dock tetap rapi. */
    private AppItem(String name, List<AppItem> members) {
        this.label = name;
        this.packageName = "folder:" + name;
        this.activityName = "";
        this.key = "folder:" + name;
        this.folder = true;
        List<AppItem> copy = new ArrayList<AppItem>(members);
        Collections.sort(copy, new java.util.Comparator<AppItem>() {
            @Override
            public int compare(AppItem left, AppItem right) {
                return left.label.compareToIgnoreCase(right.label);
            }
        });
        this.members = Collections.unmodifiableList(copy);
    }

    /** Buat folder berisi aplikasi-aplikasi itu (anggota diurutkan menurut nama). */
    public static AppItem folder(String name, List<AppItem> members) {
        return new AppItem(name, members);
    }

    public ComponentName component() {
        return new ComponentName(packageName, activityName);
    }

    public Intent launchIntent() {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setComponent(component());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return intent;
    }

    /** Daftar kunci anggota (dipakai untuk menyimpan ke pengaturan). */
    public List<String> memberKeys() {
        List<String> keys = new ArrayList<String>();
        if (members == null) {
            return keys;
        }
        for (int i = 0; i < members.size(); i++) {
            keys.add(members.get(i).key);
        }
        return keys;
    }
}
