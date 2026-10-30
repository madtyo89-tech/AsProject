# Storyboard Promo AsProject — 30 Detik

| File | Isi |
|------|-----|
| `asproject-promo-storyboard-30s.mp4` | **Video storyboard** 1080×1920 (9:16), 30,0 detik, H.264 + AAC, dengan label SCENE per panel |
| `asproject-promo-clean-30s.mp4` | **Video versi clean** (tanpa label SCENE & progress) — file inilah yang diupload ke Reels/TikTok |
| `index.html` | Halaman storyboard interaktif (video + 10 panel, klik panel = lompat scene) |
| `STORYBOARD.md` | Naskah produksi lengkap per scene (visual, teks layar, VO, audio, transisi) |
| `storyboard-contact-sheet.jpg` | Semua panel dalam satu gambar (5×2) |
| `frames/scene-01.jpg` … `scene-10.jpg` | Panel storyboard per scene (540×960) |
| `audio/vo-01.mp3` … `vo-10.mp3` | Voice over per scene (sumber) |
| `render_storyboard.py` | Generator panel & video (Pillow + ffmpeg via imageio-ffmpeg) |

## Render ulang

```bash
pip install Pillow imageio imageio-ffmpeg numpy
python3 storyboard/render_storyboard.py keyframes
python3 storyboard/render_storyboard.py video storyboard/audio/scene-durations.json storyboard/video-silent.mp4
python3 storyboard/audio/trim_vo.py     # rapikan jeda VO
python3 storyboard/audio/mix_final.py   # gabung VO + music/backsound-asproject.mp3
```

Ganti teks/harga/foto cukup dari daftar `SCENES` di `render_storyboard.py`, lalu render ulang.
Font Poppins (OFL) ada di `assets-fonts/`.
