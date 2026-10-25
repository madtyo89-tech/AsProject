package my.id.asproject.launcher;

import android.content.ComponentName;
import android.content.Intent;

/** Satu entri aplikasi yang bisa dibuka dari beranda. */
public final class AppItem {

    public final String label;
    public final String packageName;
    public final String activityName;
    /** Kunci stabil untuk cache ikon & daftar dock. */
    public final String key;

    public AppItem(String label, String packageName, String activityName) {
        this.label = label;
        this.packageName = packageName;
        this.activityName = activityName;
        this.key = packageName + "/" + activityName;
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
}
