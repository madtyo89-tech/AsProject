# Storyboard — Video Promosi AsProject (Reels/TikTok)

**Format:** Vertikal 9:16 · 1080×1920 · ±30 detik · 10 scene  
**Gaya:** Ceria & Playful — warna pop cerah, teks besar, sticker melompat, confetti  
**Tujuan:** Iklan AsProject — studio undangan digital online (pernikahan, khitanan, ulang tahun, aqiqah)  
**Output:** `asproject-promo-storyboard-30s.mp4` (animatic final + VO + backsound)  
**Domain CTA:** asproject.my.id · **Harga yang disebut:** katalog Rp49.000/tema (ketentuan dikonfirmasi sebelum membayar)

> Tokoh demo yang dipakai konsisten di seluruh video: **Rangga Pratama & Alya Zahra — Senin, 28 Desember 2026** (mengikuti contoh yang sudah ada di repo).

## Naskah per Scene

| # | Timecode | Visual / Aksi | Gerakan Kamera / Animasi | Teks di Layar (On-Screen) | Voice Over (VO) | Audio / SFX | Transisi |
|---|----------|---------------|--------------------------|---------------------------|------------------|-------------|----------|
| 1 | 00:00–00:02,8 | HOOK — undangan kertas di mockup HP miring, dicoret badge "X" merah besar | Teks pop-in nge-zoom, HP goyang, sticker muncul berurutan | **Masih Cetak Undangan Kertas?** · sticker: MAHAL / RIBET / LAMA | "Masih cetak undangan kertas? Ribet banget!" | Backsound mulai (fade-in), pop di tiap sticker | Hard cut nge-beat |
| 2 | 00:03–00:06 | SOLUSI — foto mempelai luxury gold masuk HP, logo AsProject muncul | HP slide-up + Ken Burns zoom pelan, confetti jatuh | **Kenalin, AsProject!** Undangan Digital Online | "Kenalin AsProject! Undangan digital online!" | Backsound naik, whoosh | Hard cut |
| 3 | 00:06–00:09 | PILIH TEMA — grid 2×2 kategori: Pernikahan, Khitanan, Ulang Tahun, Aqiqah | Kartu pop-in satu-satu (stagger) | **34 Tema Cantik Siap Pakai!** | "Tiga puluh empat tema cantik siap pakai!" | Pop-pop tiap kartu | Hard cut |
| 4 | 00:09–00:12 | ISI DATA — foto pasangan di HP + kartu form melayang: nama, tanggal, foto | Kartu form meluncur dari samping, centang OK | **Isi Nama, Tanggal & Foto — Langsung Jadi!** | "Isi nama, tanggal, foto. Langsung jadi!" | Klik-klik ringan | Hard cut |
| 5 | 00:12–00:15 | FITUR SERU — tampilan undangan live + pill fitur mengelilingi HP | Pill COUNTDOWN / GALERI / MUSIK bounce bergantian | **Fiturnya Seru-Seru!** | "Ada countdown, galeri, dan musik!" | Pop tiap pill | Hard cut |
| 6 | 00:15–00:18 | BUKA UNDANGAN — cover undangan dengan amplop "Buka Undangan" | Ring berdenyut di tombol amplop, sticker KETUK! | **Tamu Buka… Langsung WOW!** | "Tamu buka undangan, langsung wow!" | Ding + whoosh amplop | Hard cut |
| 7 | 00:18–00:21 | FITUR TAMU — 3 kartu besar: Amplop Digital, RSVP Online, Peta Lokasi | Kartu slide-up berurutan | **Amplop Digital + RSVP + Peta** | "Amplop digital, RSVP, plus peta lokasi!" | Pop tiap kartu | Hard cut |
| 8 | 00:21–00:24 | SEBAR LINK — link undangan besar di pill, HP foto lamaran | Pill link nge-glow, sticker SEBAR VIA WA | **Publish! Sebar Satu Link Saja** · asproject.my.id/u/rangga-Alya | "Publish! Sebar satu link lewat WhatsApp!" | Send/whoosh | Hard cut |
| 9 | 00:24–00:27 | HARGA — kartu harga raksasa di tengah layar amber | Harga nge-zoom bounce, badge DEMO GRATIS berputar | **Mulai Rp49.000 / tema** · Coba demo gratis dulu* | "Mulai empat puluh sembilan ribu per tema!" | Cash/pop di harga | Hard cut |
| 10 | 00:27–00:30 | CTA — layar gelap elegan, logo AS emas, tombol CTA, hujan confetti | Logo scale-in, tombol berdenyut, confetti burst | **Yuk, Buat Sekarang!** asproject.my.id · Cepat · Cantik · Praktis | "Yuk buat sekarang di AsProject dot my dot id!" | Backsound puncak lalu fade-out | Fade out |

\*Ketentuan harga dikonfirmasi sebelum membayar (teks kecil di scene 9).

## Catatan Produksi

- **Subtitle selalu tampil** (caption bar bawah) karena mayoritas penonton Reels/TikTok menonton tanpa suara.
- **Safe area TikTok/Reels:** teks penting dijauhkan dari 250px bawah (area caption platform) dan 120px atas.
- **Aset:** semua foto & screenshot diambil dari repo ini sendiri (`assets/demo/`, `.preview-shots/`, `assets/og-asproject.png`) — tidak ada stok luar.
- **Musik:** `music/backsound-asproject.mp3` milik project, dipotong 30 detik, diturunkan di bawah VO.
- **Render ulang:** `python3 storyboard/render_storyboard.py keyframes` untuk panel PNG, lalu `... video` untuk MP4 senyap; VO digabung dengan ffmpeg (lihat `storyboard/README.md` bila ada).
- **Alternatif hook (A/B test):** Scene 1 bisa diganti "Undangan Nikah Kok Masih Antar-Amantar?" tanpa mengubah scene lain.
