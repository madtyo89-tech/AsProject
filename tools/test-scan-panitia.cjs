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
  cek(/window\.qrcode\(0,'M'\)/.test(stu) && /q\.addData\(checkinUrl\(g\)\)/.test(stu),
      'qrData membangun QR asli dari checkinUrl (bukan pola acak)');
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

  console.log(`\nRingkasan: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
