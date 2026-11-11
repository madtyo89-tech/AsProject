package my.id.asproject.launcher;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Menyusun isi beranda: aplikasi yang tidak disembunyikan, digabung dengan
 * folder buatan pengguna.
 *
 * Folder disimpan di {@link Prefs} sebagai peta nama → kunci aplikasi. Anggota
 * yang sudah dicopot atau disembunyikan otomatis terbuang, dan folder yang
 * akhirnya kosong ikut hilang (lalu disimpan kembali supaya pengaturan tidak
 * menumpuk sampah).
 */
public final class HomeModel {

    private HomeModel() {
    }

    /**
     * @param apps   seluruh aplikasi dari {@link AppRepository}
     * @param prefs  preferensi (daftar sembunyi & folder)
     * @return entri beranda: folder + aplikasi lepas, aplikasi lebih dulu lalu
     *         folder, masing-masing terurut menurut nama
     */
    public static List<AppItem> build(List<AppItem> apps, Prefs prefs) {
        LinkedHashMap<String, List<String>> folders = prefs.folders();
        Set<String> hidden = prefs.hidden();

        // Petakan kunci aplikasi → objeknya, buang yang disembunyikan.
        LinkedHashMap<String, AppItem> byKey = new LinkedHashMap<String, AppItem>();
        for (int i = 0; i < apps.size(); i++) {
            AppItem item = apps.get(i);
            if (hidden.contains(item.packageName)) {
                continue;
            }
            byKey.put(item.key, item);
        }

        // Kunci yang menjadi anggota folder tidak boleh muncul sendiri di beranda.
        List<String> grouped = new ArrayList<String>();
        LinkedHashMap<String, List<AppItem>> resolved =
                new LinkedHashMap<String, List<AppItem>>();
        for (Map.Entry<String, List<String>> entry : folders.entrySet()) {
            List<AppItem> members = new ArrayList<AppItem>();
            for (int i = 0; i < entry.getValue().size(); i++) {
                AppItem member = byKey.get(entry.getValue().get(i));
                if (member != null && !grouped.contains(member.key)) {
                    members.add(member);
                    grouped.add(member.key);
                }
            }
            if (!members.isEmpty()) {
                resolved.put(entry.getKey(), members);
            }
        }

        List<AppItem> out = new ArrayList<AppItem>();
        for (AppItem item : byKey.values()) {
            if (!grouped.contains(item.key)) {
                out.add(item);
            }
        }
        for (Map.Entry<String, List<AppItem>> entry : resolved.entrySet()) {
            out.add(AppItem.folder(entry.getKey(), entry.getValue()));
        }

        // Bersihkan folder yang sudah kosong / anggotanya hilang.
        if (resolved.size() != folders.size()) {
            LinkedHashMap<String, List<String>> cleaned =
                    new LinkedHashMap<String, List<String>>();
            for (Map.Entry<String, List<AppItem>> entry : resolved.entrySet()) {
                cleaned.put(entry.getKey(), new ArrayList<String>());
                List<AppItem> members = entry.getValue();
                for (int i = 0; i < members.size(); i++) {
                    cleaned.get(entry.getKey()).add(members.get(i).key);
                }
            }
            prefs.saveFolders(cleaned);
        }
        return out;
    }
}
