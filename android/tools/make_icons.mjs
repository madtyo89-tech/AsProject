#!/usr/bin/env node
/*
 * make_icons.mjs — buat seluruh ikon aplikasi dari logo AsProject di repositori.
 *
 * Sumber gambar: assets/logo-asproject.svg (satu-satunya berkas logo yang dipakai;
 * tidak ada gambar lain yang disalin dari internet).
 *
 * Hasil (di android/app/src/main/res/):
 *   mipmap-<kepadatan>/ic_launcher.png            48…192 px, kotak hitam membulat
 *   mipmap-<kepadatan>/ic_launcher_round.png      48…192 px, lingkaran hitam
 *   mipmap-<kepadatan>/ic_launcher_foreground.png 108…432 px, latar transparan
 *                                                 (untuk adaptive-icon Android 8+)
 *   mipmap-<kepadatan>/ic_brand_mark.png          96 dp, dipakai layar pemuatan
 *
 * Cara pakai (sharp dijalankan sekali, tidak di-commit):
 *   npm install --no-save --package-lock=false sharp
 *   node android/tools/make_icons.mjs
 *
 * Catatan: ikon sudah ikut di-commit sebagai PNG, jadi skrip ini hanya perlu dijalankan
 * bila assets/logo-asproject.svg berubah.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');            // android/
const REPO = path.resolve(ROOT, '..');            // akar repositori
const SVG = fs.readFileSync(path.join(REPO, 'assets', 'logo-asproject.svg'));
const OUT = path.join(ROOT, 'app', 'src', 'main', 'res');

const INK = '#0A0A0A';   // sama dengan @color/brand_ink

const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const BRAND_MARK = { mdpi: 96, hdpi: 144, xhdpi: 192, xxhdpi: 288, xxxhdpi: 384 };

async function logoBuffer(size) {
  return sharp(SVG, { density: 1600 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Ikon peluncur gaya lama: latar hitam (kotak membulat / lingkaran) + logo di tengah. */
async function legacyIcon(size, round) {
  const pad = Math.round(size * 0.16);
  const inner = size - pad * 2;
  const logo = await logoBuffer(inner);
  const background = round
    ? `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${INK}"/></svg>`
    : `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${INK}"/></svg>`;
  return sharp(Buffer.from(background))
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toBuffer();
}

/** Lapisan depan adaptive-icon: kanvas 108 dp, gambar di dalam zona aman 66 dp. */
async function adaptiveForeground(size) {
  const inner = Math.round(size * 0.58);
  const offset = Math.round((size - inner) / 2);
  const logo = await logoBuffer(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toBuffer();
}

async function main() {
  for (const [density, size] of Object.entries(LEGACY)) {
    const dir = path.join(OUT, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await legacyIcon(size, false));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await legacyIcon(size, true));
  }
  for (const [density, size] of Object.entries(ADAPTIVE)) {
    const dir = path.join(OUT, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await adaptiveForeground(size));
  }
  for (const [density, size] of Object.entries(BRAND_MARK)) {
    const dir = path.join(OUT, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_brand_mark.png'), await legacyIcon(size, false));
  }
  console.log(`ikon ditulis ke ${path.relative(REPO, OUT)}/mipmap-*`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
