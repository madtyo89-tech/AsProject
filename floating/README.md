# AsProject Floating — gelembung melayang pembuka aplikasi

Aplikasi Android mandiri yang menampilkan **gelembung melayang (floating bubble)** di atas
aplikasi lain. Ketuk gelembung untuk membuka panel berisi jalan pintas: **inDrive**,
**Google Maps**, WhatsApp, Grab, Gojek, dan lainnya — plus aplikasi apa pun yang Anda
tambahkan sendiri.

- Paket: `my.id.asproject.floating` · Nama: **AsProject Floating**
- `minSdk 21` (Android 5.0) → `targetSdk 34` (Android 14)
- **Tanpa AndroidX, tanpa pustaka pihak ketiga** — hanya API framework Android.
- **Offline penuh**: tidak ada izin INTERNET; tidak ada data yang dikirim ke luar perangkat.

## Memasang APK uji

```
floating/releases/asproject-floating-1.0.0-debug.apk
```

Salin ke ponsel → buka → izinkan "Pasang aplikasi tidak dikenal". APK bertanda tangan kunci
debug Android, jadi hanya untuk uji coba.

## Cara memakai

1. Buka **AsProject Floating**.
2. Tekan **Izinkan tampil di atas aplikasi lain** dan nyalakan izinnya di Pengaturan.
3. Tekan **Nyalakan gelembung** → gelembung muncul di atas semua aplikasi.
4. **Geser** gelembung untuk memindah (otomatis menempel ke tepi), **ketuk** untuk membuka
   panel aplikasi, **ketuk aplikasi** untuk membukanya.
5. Di layar utama Anda bisa **mencentang / mengurutkan / menambah / menghapus** aplikasi yang
   tampil di gelembung.

Aplikasi yang belum terpasang tetap bisa ditampilkan; mengetuknya akan membuka halaman
aplikasi di toko (Play Store) agar bisa dipasang.

## Izin yang diminta

| Izin | Mengapa |
|------|---------|
| `SYSTEM_ALERT_WINDOW` | Menampilkan gelembung di atas aplikasi lain (dinyalakan manual di Pengaturan). |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | Menahan gelembung tetap hidup saat aplikasi ditutup. |
| `POST_NOTIFICATIONS` | Notifikasi wajib layanan foreground (Android 13+). |
| `RECEIVE_BOOT_COMPLETED` | Opsional: nyalakan gelembung lagi setelah HP dinyalakan. |

Tidak ada izin internet, lokasi, kontak, penyimpanan, atau mikrofon.

## Daftar aplikasi bawaan

`ShortcutCatalog` (murni Java) menyimpan nama paket yang benar, termasuk varian:

| Entri | Paket |
|-------|-------|
| inDrive | `sinet.startup.inDriver` |
| Google Maps | `com.google.android.apps.maps` (dan `.go`) |
| WhatsApp | `com.whatsapp` / `com.whatsapp.w4b` |
| Grab | `com.grabtaxi.passenger` |
| Gojek | `com.gojek.app` |
| Maxim | `com.taxsee.taxsee` |
| Telegram | `org.telegram.messenger` |
| Browser | Chrome / Brave / Firefox / Opera / Samsung |

Aktif bawaan: inDrive, Google Maps, WhatsApp, Grab, Gojek. Sisanya tersedia untuk dicentang.
Bila sebuah aplikasi mengubah nama paketnya, cukup tambahkan varian di `ShortcutCatalog` —
`AppOpener` mencoba semua varian berurutan.

## Struktur folder

```
floating/
├── app/src/main/
│   ├── java/my/id/asproject/floating/
│   │   ├── LauncherActivity.java   layar pengaturan: izin, daftar, setelan
│   │   ├── FloatingService.java    layanan foreground + gelembung + panel
│   │   ├── BootReceiver.java       nyalakan lagi setelah reboot (opsional)
│   │   ├── OverlayPermission.java  pembantu izin overlay
│   │   ├── AppOpener.java          buka aplikasi / tautan / toko
│   │   ├── Shortcut.java           model entri (murni Java)
│   │   ├── ShortcutCatalog.java    daftar bawaan (murni Java)
│   │   ├── ShortcutCodec.java      simpan/muat daftar (murni Java)
│   │   └── ShortcutStore.java      SharedPreferences
│   └── res/                        tata letak, ikon (dibuat tools/make_icons.py)
├── buildkit/build-apk.sh           build tanpa Gradle (aapt2 → ecj → d8 → apksigner)
├── tools/                          make_icons.py (ikon), verify_apk.py (pemeriksa APK)
├── tests/jvm/FloatingCatalogTest.java   uji logika murni di JVM
├── releases/                       APK debug untuk unduhan
└── docs/                           BUILD-APK.md & cara pakai
```

Skrip Python generik (`prepare_manifest.py`, `apk_pack.py`, `fetch_tools.py`) dipakai
bersama dari `../android/tools` supaya tidak ada dua salinan yang bisa berbeda.

## Uji

```bash
cd floating

# 1) Siapkan alat sekali (JDK, aapt2, android.jar, d8, apksigner — hash dipatok):
ANDROID_TOOLS_DIR="$PWD/.tools" python3 ../android/tools/fetch_tools.py --dest "$PWD/.tools"
export JAVA_BIN="$PWD/.tools/jdk/java-runtime/bin/java"

# 2) Uji logika murni (tanpa Android):
"$JAVA_BIN" -jar .tools/tools/ecj.jar -1.8 -nowarn -d /tmp/float \
  app/src/main/java/my/id/asproject/floating/Shortcut.java \
  app/src/main/java/my/id/asproject/floating/ShortcutCatalog.java \
  app/src/main/java/my/id/asproject/floating/ShortcutCodec.java \
  tests/jvm/FloatingCatalogTest.java
"$JAVA_BIN" -cp /tmp/float FloatingCatalogTest

# 3) Build + verifikasi APK:
ANDROID_TOOLS_DIR="$PWD/.tools" bash buildkit/build-apk.sh
python3 tools/verify_apk.py out/asproject-floating-1.0.0-debug.apk
```

(CI menjalankan ketiganya otomatis — lihat [docs/BUILD-APK.md](docs/BUILD-APK.md).)
