# Salinan unduhan APK uji

`asproject-studio-1.0.0-debug.apk` — APK debug AsProject Studio (versi 1.0.0) untuk
**uji coba instalasi**, disertakan di repositori agar bisa diunduh langsung dari ponsel
tanpa perlu masuk GitHub atau memasang alat build.

- SHA-256: lihat `SHA256SUMS.txt`
- Tanda tangan: kunci **debug** Android (`CN=Android Debug`) — jangan dibagikan sebagai
  APK rilis; lihat `../docs/BUILD-APK.md` §4 untuk APK rilis dengan keystore Anda.
- Isi & hasil uji: `../docs/HASIL-TES-DAN-KETERBATASAN.md`

## Cara unduh

- Langsung: `https://github.com/madtyo89-tech/AsProject/raw/<branch>/android/releases/asproject-studio-1.0.0-debug.apk`
- Halaman berkas: buka folder ini di GitHub → pilih berkas → tombol **Download raw file**.
- Setelah folder `android/` di-merge ke `main`, berkas ini juga tersaji di
  `https://asproject.my.id/android/releases/asproject-studio-1.0.0-debug.apk`.

## Cara pasang

1. Buka tautan di atas dari ponsel, unduh berkasnya.
2. Buka berkas APK → izinkan **Pasang aplikasi tidak dikenal** bila diminta.
3. Jalankan **AsProject Studio**.

Ada dua jalur lain bila ingin APK hasil build otomatis: unduh artefak
`asproject-studio-apk` dari tab **Actions** (perlu masuk GitHub), atau push tag `v*`
supaya workflow melampirkan APK ke **GitHub Release**.

Hapus folder ini bila tidak diperlukan lagi — APK tidak wajib ada di repositori.
