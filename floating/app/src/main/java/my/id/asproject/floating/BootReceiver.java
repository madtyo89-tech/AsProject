package my.id.asproject.floating;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Menyalakan gelembung lagi setelah perangkat dinyalakan ulang — hanya bila pengguna
 * mengaktifkan setelan "Nyalakan otomatis" dan izin overlay masih diberikan.
 */
public final class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                && !"android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())
                && !"com.htc.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            return;
        }
        ShortcutStore store = new ShortcutStore(context);
        if (!store.autostart() || !OverlayPermission.canDrawOverlays(context)) {
            return;
        }
        FloatingService.start(context);
    }
}
