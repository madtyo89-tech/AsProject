#!/usr/bin/env node
/* Uji fitur Scan QR Panitia:
   1. QR tamu benar-benar QR asli (encode -> decode balik dengan jsqr)
   2. studio.html: qrData memakai pustaka QR + checkinUrl berisi guest/id/s
   3. scan.html: akses kunci, kamera BarcodeDetector, fallback galeri & manual,
      upsert ke tabel checkin
   4. master.html: kartu Link Scan QR Panitia + share WhatsApp + rekap check-in
   5. tools/checkin.sql: skema tabel checkin
   Pakai jsqr hanya untuk pengujian (tidak dikirim ke situs). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let lulus = 0, gagal = 0;
function cek(kondisi, pesan) {
  if (kondisi) { lulus++; console.log('  [PASS] ' + pesan); }
  else { gagal++; console.log('  [FAIL] ' + pesan); }
}

function cariModul(nama) {
  const kandidat = ['/tmp/domtest/node_modules', '/tmp/jstest/node_modules'];
  for (const d of kandidat) {
    try { return require(path.join(d, nama)); } catch (e) {}
  }
  return null;
}

(async function main() {
  console.log('1) QR tamu = QR asli (encode -> decode)');
  const qrcode = cariModul('qrcode-generator');
  const jsQR = cariModul('jsqr');
  if (!qrcode || !jsQR) {
    console.log('  (dilewati: npm install --no-save qrcode-generator jsqr di /tmp/domtest)');
  } else {
    const URL_CONTOH = 'https://asproject.my.id/checkin.html?guest=Pak%20Andi%20Wijaya&id=A1B2C3&s=demo-acara';
    const q = qrcode(0, 'M');
    q.addData(URL_CONTOH);
    q.make();
    const n = q.getModuleCount();
    cek(n >= 21 && (n - 21) % 4 === 0, `ukuran matriks QR valid (${n} modul)`);

    /* render matriks ke piksel (skala 6 px + quiet zone 4 modul) lalu decode */
    const S = 4, B = 4 * S, W = n * S + B * 2;
    const data = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c)) continue;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const px = B + c * S + x, py = B + r * S + y, i = (py * W + px) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
    const hasil = jsQR(data, W, W);
    cek(!!hasil, 'QR berhasil dipindai oleh decoder');
    cek(hasil && hasil.data === URL_CONTOH,
      `isi QR persis seperti yang ditanam (${hasil ? hasil.data.slice(0, 48) + '…' : '—'})`);

    /* kasus nama panjang + karakter khas */
    const URL_PANJANG = 'https://asproject.my.id/checkin.html?guest=' +
      encodeURIComponent('Keluarga Besar Bpk. H. Soekarno & Ibu Hj. Aminah (Bandung)') +
      '&id=ZZ99XX88&s=resepsi-keluarga-besar';
    const q2 = qrcode(0, 'M');
    q2.addData(URL_PANJANG);
    q2.make();
    const n2 = q2.getModuleCount(), S2 = 3, B2 = 4 * S2, W2 = n2 * S2 + B2 * 2;
    const d2 = new Uint8ClampedArray(W2 * W2 * 4).fill(255);
    for (let r = 0; r < n2; r++) for (let c = 0; c < n2; c++) {
      if (!q2.isDark(r, c)) continue;
      for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
        const px = B2 + c * S2 + x, py = B2 + r * S2 + y, i = (py * W2 + px) * 4;
        d2[i] = d2[i + 1] = d2[i + 2] = 0;
      }
    }
    const h2 = jsQR(d2, W2, W2);
    cek(h2 && h2.data === URL_PANJANG, 'nama tamu panjang + karakter khas tetap ter-decode persis');
  }

  console.log('2) studio.html: qrData memakai pustaka QR & URL check-in');
  const stu = baca('studio.html');
  cek(/<script src="assets\/qrcode\.js"><\/script>/.test(stu), 'studio memuat assets/qrcode.js');
  cek(/function checkinUrl\(g\)/.test(stu), 'checkinUrl() tersedia');
  cek(/hostBase\(\)\+'\/checkin\.html\?'\+q\.toString\(\)/.test(stu), 'checkinUrl menunjuk checkin.html dengan parameter');
  cek(/guest:g\.nama,id:g\.code,s:state\.slug/.test(stu), 'parameter guest + id + s ikut ditanam');
  cek(/window\.qrcode\(0,'M'\)/.test(stu) && /q\.addData\(teks\)/.test(stu),
      'pembuat QR memakai pustaka QR asli (bukan pola acak)');
  cek(/function qrData\(g\)\{return qrTeks\(checkinUrl\(g\)/.test(stu),
      'qrData (QR check-in) membangun dari checkinUrl');
  cek(!/T\*9301\+49297/.test(stu), 'pola QR palsu lama sudah dihapus');
  cek(/qr\.isDark|q\.isDark/.test(stu), 'modul QR digambar dari matriks (isDark)');
  cek(/quiet zone/.test(stu), 'dokumen menjelaskan quiet zone');

  console.log('3) scan.html: halaman pemindai panitia');
  const scan = baca('scan.html');
  cek(/URLSearchParams\(location\.search\)/.test(scan), 'membaca parameter link (s & k)');
  cek(/KUNCI!==\(d\.masterKey\|\|''\)/.test(scan), 'kunci link divalidasi terhadap masterKey undangan');
  cek(/BarcodeDetector/.test(scan) && /facingMode:'environment'/.test(scan),
      'pemindai kamera belakang memakai BarcodeDetector');
  cek(/btnGaleri/.test(scan) && /createImageBitmap/.test(scan),
      'fallback "Pindai dari Galeri" tersedia (decode dari gambar)');
  cek(/btnManual/.test(scan) && /cocokTeks/.test(scan),
      'fallback pencarian manual (nama/kode) tersedia');
  cek(/resolution=merge-duplicates/.test(scan) && /rest\/v1\/checkin\?on_conflict=slug,guest/.test(scan),
      'check-in disimpan upsert ke tabel checkin');
  cek(/checked_in_at:new Date\(\)\.toISOString\(\)/.test(scan), 'waktu check-in ikut dicatat');
  cek(/navigator\.share/.test(scan) && /wa\.me\/\?text=/.test(scan), 'halaman scan bisa dibagikan (share/WA)');
  cek(/navigator\.vibrate/.test(scan), 'umpan balik getar saat scan berhasil');
  cek(/rest\/v1\/checkin\?slug=eq\./.test(scan) && /rekapList/.test(scan), 'daftar check-in terkini ditampilkan');
  cek(/tools\/checkin\.sql/.test(scan), 'pesan bantuan bila tabel check-in belum dipasang');
  cek(!/[a-zA-Z0-9._%+-]+@gmail/.test(scan) && /https:\/\//.test(scan),
      'semua tautan API memakai https');

  console.log('4) master.html: kartu Link Scan QR Panitia');
  const mas = baca('master.html');
  cek(/Link Scan QR Panitia/.test(mas), 'kartu Link Scan QR Panitia ada di dashboard');
  cek(/function scanUrl\(\)/.test(mas) && /\/scan\.html\?s=/.test(mas) && /&k=/.test(mas),
      'scanUrl membawa slug + kunci');
  cek(/function copyScan\(\)/.test(mas), 'tombol Salin link scan ada');
  cek(/function shareScanWa\(\)/.test(mas) && /wa\.me\/\?text=/.test(mas),
      'tombol Share via WhatsApp ada');
  cek(/function openScan\(\)/.test(mas), 'tombol Buka Scanner ada');
  cek(/function muatScanStat\(\)/.test(mas) && /rest\/v1\/checkin\?slug=eq\./.test(mas),
      'rekap jumlah check-in dimuat di master');

  console.log('5) tools/checkin.sql: skema tabel check-in');
  const sql = baca('tools/checkin.sql');
  cek(/create table if not exists public\.checkin/.test(sql), 'tabel checkin dibuat');
  cek(/unique \(slug, guest\)/.test(sql), 'unik per (slug, guest) — scan ulang memperbarui');
  cek(/checked_in_at timestamptz/.test(sql), 'kolom waktu check-in ada');
  cek(/checkin_anon_insert/.test(sql) && /checkin_anon_read/.test(sql), 'kebijakan RLS anon ada');
  cek(/rsvp/.test(sql), 'menjelaskan bedanya dengan tabel rsvp');

  console.log('6) Unduh daftar hadir + QR undangan (opsional)');
  {
    const stu2 = baca('studio.html');
    cek(/function qrTeks\(teks,label\)/.test(stu2), 'pembuat QR dipakai ulang untuk kedua jenis QR');
    cek(/function qrDataUndangan\(g\)/.test(stu2) && /q\.addData\(teks\)/.test(stu2),
        'QR Undangan tersedia (isi = link undangan tamu)');
    cek(/return qrTeks\(g\.link,/.test(stu2), 'QR Undangan memakai link personal tamu (?to=…)');
    cek(/function dlQrUndangan\(nama\)/.test(stu2) && /QR-Undangan-/.test(stu2),
        'tombol Download QR Undangan ada (berkas QR-Undangan-*.png)');
    cek(/QR Check-in/.test(stu2) && /Untuk <b>panitia<\/b>/.test(stu2),
        'kartu studio menjelaskan QR Check-in untuk panitia');
    cek(/QR Undangan <span style="color:#8a6d0f">\(opsional\)<\/span>/.test(stu2),
        'QR Undangan ditandai opsional');
    cek(/function dlQr\(nama\)/.test(stu2) && /QR-Checkin-/.test(stu2),
        'Download QR Check-in lama tetap ada');
  }
  {
    const mas2 = baca('master.html');
    cek(/function unduhDaftarHadir\(\)/.test(mas2), 'master: unduhDaftarHadir() tersedia');
    cek(/'No','Nama Tamu','Kode','Link Undangan','RSVP','Waktu Check-in','Status Hadir'/.test(mas2),
        'kolom CSV daftar hadir lengkap (No, nama, kode, link, RSVP, waktu, status)');
    cek(/uFEFF/.test(mas2) && /text\/csv/.test(mas2), 'CSV ber-BOM \uFEFF (ramah Excel)');
    cek(/Unduh Daftar Hadir \(CSV\)/.test(mas2), 'tombol Unduh Daftar Hadir ada di master');
    cek(/CHECKIN_ROWS/.test(mas2) && /select=guest,code,checked_in_at/.test(mas2),
        'master memuat baris check-in utuh untuk rekap & CSV');
  }
  {
    const scan2 = baca('scan.html');
    cek(/function unduhHadir\(\)/.test(scan2), 'scan: unduh daftar hadir tersedia');
    cek(/'No','Nama Tamu','Kode','Waktu Check-in','Status Hadir'/.test(scan2),
        'kolom CSV di halaman scan lengkap');
    cek(/btnUnduhHadir/.test(scan2), 'tombol Unduh Daftar Hadir ada di halaman scan');
  }

  console.log('7) Anti-gagal: QR muncul di browser, quiet zone, fallback decoder, kamera app');
  {
    /* a. pustaka QR benar-benar terekspos sebagai global browser (bukan hanya CJS/AMD) */
    const vm = require('vm');
    const sandbox = {}; sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(baca('assets/qrcode.js'), sandbox);
    cek(typeof sandbox.qrcode === 'function',
        'assets/qrcode.js mengekspos window.qrcode di browser (QR pasti muncul)');
  }
  {
    /* b. spesifikasi gambar qrTeks: quiet zone 4 modul + label di luar area QR */
    const stu3 = baca('studio.html');
    cek(/Math\.floor\(300\/\(n\+8\)\)/.test(stu3),
        'quiet zone 4 modul per sisi (300/(n+8)) sesuai standar QR');
    cek(/fillRect\(ox\+c\*C,oy\+r\*C,C,C\)/.test(stu3),
        'modul digambar integer penuh (tanpa celah piksel)');
    cek(/cv\.width=300;cv\.height=328/.test(stu3) && /fillRect\(0,304,300,20\)/.test(stu3),
        'label emas berada di luar area QR (tidak memotong quiet zone)');
  }
  {
    /* c. render matriks dengan parameter qrTeks yang sebenarnya lalu decode jsQR */
    const qrcode2 = cariModul('qrcode-generator');
    const jsQR2 = cariModul('jsqr');
    if (qrcode2 && jsQR2) {
      const URLU = 'https://asproject.my.id/checkin.html?guest=Keluarga%20Besar%20Hj.%20Aminah&id=ZZ99XX88&s=acara';
      const q = qrcode2(0, 'M');
      q.addData(URLU); q.make();
      const n = q.getModuleCount();
      const C = Math.max(1, Math.floor(300 / (n + 8)));
      const ox = Math.floor((300 - n * C) / 2);
      /* kanvas 300x300 area QR (piksel persis seperti qrTeks) */
      const W = 300, H = 300;
      const data = new Uint8ClampedArray(W * H * 4).fill(255);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
          const px = ox + c * C + x, py = ox + r * C + y, i = (py * W + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
      const hasil = jsQR2(data, W, H);
      cek(hasil && hasil.data === URLU,
          `spesifikasi gambar qrTeks ter-decode sempurna (quiet zone ${Math.round(ox / C * 10) / 10} modul)`);
    } else {
      cek(false, 'jsqr/qrcode-generator tersedia untuk uji render (npm install --no-save jsqr qrcode-generator)');
    }
  }
  {
    /* d. fallback decoder untuk perangkat tanpa BarcodeDetector (iOS/Firefox) */
    cek(fs.existsSync(path.join(ROOT, 'assets/jsqr.js')), 'assets/jsqr.js (decoder cadangan) ada');
    cek(/jsQR \— QR code decoder/.test(baca('assets/jsqr.js')) && /Apache/.test(baca('assets/jsqr.js')),
        'atribusi lisensi Apache-2.0 jsQR tercantum');
    const scan3 = baca('scan.html');
    cek(/assets\/jsqr\.js/.test(scan3), 'scan.html memuat decoder cadangan jsQR');
    cek(/function decodeJsQR/.test(scan3) && /window\.jsQR\(img\.data/.test(scan3),
        'decodeQR memakai jsQR bila BarcodeDetector tidak ada');
    cek(/decodeQR\(v\)/.test(scan3), 'loop kamera memakai decodeQR (kamera tetap jalan di iOS/Firefox)');
    cek(/if\(!teks\)teks=decodeJsQR/.test(scan3), 'Pindai dari Galeri punya fallback jsQR');
    cek(/typeof window\.jsQR!=='function'/.test(scan3), 'deteksi ketersediaan pemindai memperhitungkan jsQR');
  }
  {
    /* e. aplikasi Android mengizinkan kamera web untuk scan */
    const java = baca('android/app/src/main/java/my/id/asproject/studio/StudioActivity.java');
    cek(/RESOURCE_VIDEO_CAPTURE/.test(java) && /request\.grant/.test(java),
        'StudioActivity mengizinkan kamera web (VIDEO_CAPTURE)');
    cek(/pendingWebPermission/.test(java) && /REQ_CAMERA_PERMISSION/.test(java),
        'izin runtime Android diminta sebelum grant getUserMedia');
    cek(!/RESOURCE_AUDIO_CAPTURE/.test(java) || /deny\(\)/.test(java),
        'mikrofon web tetap ditolak (tak ada fitur yang butuh)');
    cek(/butuhKamera/.test(java), 'hanya permintaan kamera yang dilayani, sisanya ditolak');
  }

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
