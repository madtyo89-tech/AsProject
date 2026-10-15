// Logika murni bot WhatsApp AsProject (tanpa I/O): parsing perintah & data,
// validasi, pembentukan baris draft Studio, dan teks balasan.
// Dipakai oleh handler.mjs (Supabase Edge Function) dan diuji oleh tools/test-wa-bot.mjs.

import { TEMA_PUBLIK } from "./tema.mjs";

export const PUBLIC_BASE_DEFAULT = "https://asproject.my.id";
export const TEMA_DEFAULT_ID = "ivory-klasik";

const EV_ALIAS = {
  pernikahan: "pernikahan", nikah: "pernikahan", nikahan: "pernikahan", wedding: "pernikahan",
  khitanan: "khitanan", khitan: "khitanan", sunatan: "khitanan", sunat: "khitanan",
  ultah: "ultah", ulangtahun: "ultah", birthday: "ultah",
  aqiqah: "aqiqah", aqiqoh: "aqiqah", akikah: "aqiqah",
};

const FIELD_ALIAS = {
  jenis: "ev", jenisacara: "ev", acara: "ev", event: "ev",
  pria: "pria", namapria: "pria", mempelaipria: "pria", pengantinpria: "pria",
  wanita: "wanita", namawanita: "wanita", mempelaiwanita: "wanita", pengantinwanita: "wanita",
  nama: "nama", namaanak: "nama", anak: "nama",
  tanggal: "tanggal", tgl: "tanggal", tanggalacara: "tanggal",
  jam: "jam", pukul: "jam", waktu: "jam", jamacara: "jam",
  lokasi: "lokasi", tempat: "lokasi", venue: "lokasi", gedung: "lokasi", alamat: "lokasi",
  slug: "slug", link: "slug",
};

const BULAN = {
  januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5,
  juni: 6, jun: 6, juli: 7, jul: 7, agustus: 8, agu: 8, agt: 8, aug: 8, september: 9, sep: 9,
  oktober: 10, okt: 10, oct: 10, november: 11, nov: 11, desember: 12, des: 12, dec: 12,
};

export const ADMIN_ONLY = new Set(["daftar", "buat", "rekap", "link", "leads", "ambil"]);

/* ---------- nomor WhatsApp ---------- */

/** "0812-3456-7890", "+62 812…", "6281234…" → "6281234…" (digit saja, awalan 62). */
export function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D+/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

export function parseList(raw) {
  return String(raw || "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

/* ---------- slug ---------- */

/** Sama dengan slugify() di studio.html: huruf kecil, a-z0-9 dan '-', maks 32. */
export function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

/* ---------- perintah ---------- */

/**
 * "/buat\nJenis: …" → { name:"buat", rest:"Jenis: …", arg:"" }.
 * Prefix "/" atau "!" . Bukan perintah → null.
 */
export function parseCommand(text) {
  const m = String(text || "").trim().match(/^[\/!]([a-zA-Z]+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const rest = (m[2] || "").trim();
  return { name: m[1].toLowerCase(), rest, arg: (rest.split(/\s+/)[0] || "").toLowerCase() };
}

/* ---------- parsing data acara (format "Kunci: nilai" per baris) ---------- */

/** Mengubah "20/12/2026", "20-12-2026", "2026-12-20", "20 Desember 2026" → "YYYY-MM-DD". */
export function normalizeDate(raw) {
  const s = String(raw || "").trim().toLowerCase();
  let y, mo, d, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) [, d, mo, y] = m;
  else if ((m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/)) && BULAN[m[2]]) {
    d = m[1]; mo = BULAN[m[2]]; y = m[3];
  } else return null;
  y = +y; mo = +mo; d = +d;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "9", "09.00", "9:30", "09:00 WIB" → "HH:MM". */
export function normalizeTime(raw) {
  const m = String(raw || "").trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(?:wib)?$/);
  if (!m) return null;
  const h = +m[1], mi = m[2] ? +m[2] : 0;
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** Teks multi-baris → { fields:{ev,pria,…}, dikenali:number }. Baris tanpa ":" diabaikan. */
export function parseFields(text) {
  const fields = {};
  let dikenali = 0;
  for (let line of String(text || "").split(/\r?\n/)) {
    line = line.replace(/^\s*[-*•]\s*/, "");
    const m = line.match(/^\s*([^:：]{1,40}?)\s*[:：]\s*(.*)$/);
    if (!m) continue;
    const key = FIELD_ALIAS[m[1].toLowerCase().replace(/[\s_]+/g, "")];
    if (!key) continue;
    const val = m[2].trim();
    if (!val) continue;
    if (fields[key] === undefined) dikenali++;
    fields[key] = val;
  }
  return { fields, dikenali };
}

/**
 * Validasi isian. Mengembalikan { ok, errors, value } — value sudah dinormalisasi
 * (ev, pria/wanita atau nama, tanggal YYYY-MM-DD, jam HH:MM, lokasi, slug?).
 */
export function validateBuat(fields = {}) {
  const errors = [];
  const ev = EV_ALIAS[String(fields.ev || "").toLowerCase().replace(/\s+/g, "")];
  if (!ev) errors.push("Jenis acara harus salah satu: pernikahan, khitanan, ultah, aqiqah.");

  const value = { ev };
  if (ev === "pernikahan") {
    if (!fields.pria) errors.push('Isi baris "Pria: …" dengan nama mempelai pria.');
    if (!fields.wanita) errors.push('Isi baris "Wanita: …" dengan nama mempelai wanita.');
    value.pria = fields.pria || "";
    value.wanita = fields.wanita || "";
  } else if (ev) {
    if (!fields.nama) errors.push('Isi baris "Nama: …" (untuk khitanan, ultah, atau aqiqah).');
    value.nama = fields.nama || "";
  }
  for (const k of ["pria", "wanita", "nama"]) {
    if (value[k] && value[k].length > 60) errors.push(`Nama terlalu panjang (maks 60 karakter).`);
  }

  const tanggal = normalizeDate(fields.tanggal);
  if (!fields.tanggal) errors.push('Isi baris "Tanggal: …", contoh 20/12/2026.');
  else if (!tanggal) errors.push(`Tanggal "${fields.tanggal}" tidak dikenali, contoh 20/12/2026.`);
  value.tanggal = tanggal || "";

  const jam = normalizeTime(fields.jam);
  if (!fields.jam) errors.push('Isi baris "Jam: …", contoh 09:00.');
  else if (!jam) errors.push(`Jam "${fields.jam}" tidak dikenali, contoh 09:00.`);
  value.jam = jam || "";

  if (!fields.lokasi) errors.push('Isi baris "Lokasi: …".');
  else if (fields.lokasi.length > 200) errors.push("Lokasi terlalu panjang (maks 200 karakter).");
  value.lokasi = fields.lokasi || "";

  if (fields.slug) {
    const s = slugify(fields.slug);
    if (s.length < 3) errors.push("Slug minimal 3 huruf/angka.");
    else value.slug = s;
  }
  return { ok: errors.length === 0, errors, value };
}

/** Nama dasar untuk slug otomatis, mis. "budi-sari" atau "aqiqah-nama". */
export function slugDasar(value) {
  const nama = value.ev === "pernikahan" ? `${value.pria} ${value.wanita}` : value.nama;
  const s = slugify(nama);
  return s.length >= 3 ? s : slugify(value.ev) || "undangan";
}

/* ---------- baris draft Studio (invitation_drafts) ---------- */

/**
 * Baris invitation_drafts + snapshot `data` dengan bentuk yang sama seperti
 * barisUndangan() di studio.html, sehingga Studio dapat membukanya lewat
 * "Riwayat dari server" → Buka (applyDraftData mengisi field yang tidak ada dari DEF).
 */
export function buildDraftRow(value, { slug, masterKey, nowIso }) {
  const pernikahan = value.ev === "pernikahan";
  const nama = pernikahan
    ? { namaPria: value.pria, namaWanita: value.wanita }
    : { namaAnak: value.nama };
  const tema = TEMA_PUBLIK.find((t) => t.id === TEMA_DEFAULT_ID) || TEMA_PUBLIK[0];
  return {
    slug,
    name1: pernikahan ? value.pria : value.nama,
    name2: pernikahan ? value.wanita : "",
    venue: value.lokasi,
    event_date: value.tanggal,
    event_time: value.jam,
    music_url: "",
    music_name: "",
    theme: tema.index,
    updated_at: nowIso,
    data: {
      form: {
        ...nama,
        tanggalAcara: value.tanggal,
        jamAcara: value.jam,
        zona: "WIB",
        venue: value.lokasi,
      },
      event: value.ev,
      tpl: tema.id,
      tplCustom: [],
      doa: value.ev,
      accent: "#8A6E4B",
      linkMode: "personal",
      guestsRaw: "",
      guestCodes: {},
      masterKey,
      sumber: "wa-bot",
    },
  };
}

/* ---------- niat pelanggan (CS) ---------- */

/** Menentukan maksud pesan pelanggan: data | harga | demo | pesan | cs | menu. */
export function classifyCustomer({ cmd, text }) {
  const { dikenali } = parseFields(text);
  if (dikenali >= 3) return "data";
  if (cmd) {
    if (["harga", "paket"].includes(cmd.name)) return "harga";
    if (["demo", "contoh", "tema"].includes(cmd.name)) return "demo";
    if (["pesan", "order", "booking"].includes(cmd.name)) return "pesan";
    if (["admin", "cs", "operator"].includes(cmd.name)) return "cs";
    return "menu";
  }
  const t = String(text || "").toLowerCase();
  // Permintaan eksplisit ke manusia didahulukan agar tidak tertimpa kata lain (mis. "paket").
  if (/\b(admin|operator|manusia|hubungi|cs)\b/.test(t)) return "cs";
  if (/\b(harga|paket|biaya|tarif|price|berapa)\b/.test(t)) return "harga";
  if (/\b(demo|contoh|katalog|template|tema|lihat)\b/.test(t)) return "demo";
  if (/\b(pesan|order|booking|mau\s+(buat|bikin|pesan)|daftar)\b/.test(t)) return "pesan";
  if (/\b(tanya|bantuan)\b/.test(t)) return "cs";
  return "menu";
}

/* ---------- format balasan ---------- */

export function rupiah(n) {
  return "Rp" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const EV_LABEL = { pernikahan: "Pernikahan", khitanan: "Khitanan", ultah: "Ulang Tahun", aqiqah: "Aqiqah", all: "Semua acara" };

export function formatHarga() {
  const lines = ["💰 *Harga Undangan Digital AsProject*", "Harga per tema (sekali bayar):", ""];
  const dasar = TEMA_PUBLIK.filter((t) => t.ev === "all");
  for (const t of dasar) lines.push(`• *${t.nama}* (semua acara) — ${rupiah(t.harga)}`);
  for (const ev of ["pernikahan", "khitanan", "ultah", "aqiqah"]) {
    const list = TEMA_PUBLIK.filter((t) => t.ev === ev).map((t) => t.harga);
    const min = Math.min(...list), max = Math.max(...list);
    const rentang = min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`;
    lines.push(`• *${EV_LABEL[ev]}* — ${rentang} (${list.length} tema)`);
  }
  lines.push("", "Ketik *demo* untuk melihat contoh tema, atau *pesan* untuk memesan.");
  lines.push("_Harga dapat berubah sewaktu-waktu; konfirmasi final dengan admin._");
  return lines.join("\n");
}

export function formatMenuCustomer() {
  return [
    "Halo! 👋 Selamat datang di *AsProject* — studio undangan digital.",
    "",
    "Ketik salah satu:",
    "• *harga* — daftar harga tema",
    "• *demo* — lihat contoh undangan",
    "• *pesan* — cara memesan undangan",
    "• *admin* — bicara langsung dengan admin",
  ].join("\n");
}

export function formatPesan() {
  return [
    "📝 *Cara memesan undangan*",
    "Kirim data acara dengan format seperti ini (salin, lalu isi):",
    "",
    "Jenis: pernikahan / khitanan / ultah / aqiqah",
    "Pria: (nama mempelai pria)",
    "Wanita: (nama mempelai wanita)",
    "Nama: (untuk khitanan / ultah / aqiqah)",
    "Tanggal: 20/12/2026",
    "Jam: 09:00",
    "Lokasi: (nama gedung & alamat singkat)",
    "",
    "Tim kami akan menghubungi Anda untuk konfirmasi dan pembayaran.",
  ].join("\n");
}

export function formatFormatBuat() {
  return [
    "Format /buat (admin):",
    "Jenis: pernikahan / khitanan / ultah / aqiqah",
    "Pria: … | Wanita: … (pernikahan)",
    "Nama: … (acara lain)",
    "Tanggal: 20/12/2026",
    "Jam: 09:00",
    "Lokasi: …",
    "Slug: (opsional, mis. budi-sari)",
  ].join("\n");
}

export function formatHelpAdmin() {
  return [
    "🛠 *Perintah Admin Studio*",
    "/daftar — 10 undangan terbaru",
    "/buat — buat draft baru dari data WA",
    "/rekap <slug> — statistik RSVP & ucapan",
    "/link <slug> — link tamu & link master",
    "/leads — calon klien baru dari WA",
    "/ambil <id> — ubah lead jadi draft",
    "",
    formatFormatBuat(),
  ].join("\n");
}

export function formatRingkasanValue(value) {
  const nama = value.ev === "pernikahan" ? `${value.pria} & ${value.wanita}` : value.nama;
  return `${nama} · ${EV_LABEL[value.ev] || value.ev} · ${value.tanggal} ${value.jam} · ${value.lokasi}`;
}

export function formatErrors(errors) {
  return "⚠️ Data belum lengkap:\n" + errors.map((e) => `• ${e}`).join("\n");
}

export function formatLeadAdmin(id, nama, phone, value) {
  return [
    `🆕 *Lead baru #${id}* dari ${nama || "calon klien"} (+${phone})`,
    formatRingkasanValue(value),
    `Ubah jadi draft Studio: */ambil ${id}*`,
  ].join("\n");
}

export function formatLeadCustomer(id) {
  return [
    `✅ Terima kasih! Data Anda sudah kami terima dengan nomor pesanan *#${id}*.`,
    "Admin kami akan menghubungi Anda untuk konfirmasi dan pembayaran.",
  ].join("\n");
}

export function formatDraftCreated(slug, value, base) {
  return [
    `✅ Draft dibuat: *${slug}*`,
    formatRingkasanValue(value),
    `Link tamu: ${base}/u/${slug}`,
    "",
    "Buka di Studio: *Riwayat dari server* → Buka *" + slug + "*, lalu tekan *Publish* agar semua pengaturan tersimpan.",
  ].join("\n");
}

export function formatLinks(slug, masterKey, base) {
  return [
    `🔗 *${slug}*`,
    `Link tamu (umum): ${base}/u/${slug}`,
    `Contoh personal: ${base}/u/${slug}?to=Nama%20Tamu`,
    masterKey ? `Master (PRIVAT): ${base}/master.html?slug=${slug}&k=${masterKey}` : "Master: belum ada kunci — buka & publish di Studio.",
  ].join("\n");
}

export function formatRekap(slug, rows) {
  const count = { hadir: 0, ragu: 0, tidak: 0 };
  for (const r of rows) if (count[r.status] !== undefined) count[r.status]++;
  const ucapan = rows.filter((r) => r.pesan && String(r.pesan).trim()).slice(0, 5);
  const lines = [
    `📊 *Rekap RSVP ${slug}*`,
    `Total respons: ${rows.length}`,
    `✅ Hadir: ${count.hadir}`,
    `🤔 Ragu: ${count.ragu}`,
    `❌ Tidak hadir: ${count.tidak}`,
  ];
  if (ucapan.length) {
    lines.push("", "*Ucapan terbaru:*");
    for (const r of ucapan) lines.push(`• ${r.guest}: ${String(r.pesan).slice(0, 160)}`);
  }
  return lines.join("\n");
}

export function formatDaftar(rows) {
  if (!rows.length) return "Belum ada undangan.";
  return ["📚 *Undangan terbaru*", ...rows.map((r) => {
    const nama = [r.name1, r.name2].filter(Boolean).join(" & ") || "(tanpa nama)";
    return `• *${r.slug}* — ${nama} · ${r.event_date || "-"}`;
  })].join("\n");
}

export function formatLeads(rows) {
  if (!rows.length) return "Tidak ada lead baru.";
  return ["🆕 *Lead baru*", ...rows.map((r) => {
    const v = r.fields || {};
    const nama = v.ev === "pernikahan" ? `${v.pria} & ${v.wanita}` : v.nama;
    return `• *#${r.id}* ${nama || "-"} · ${v.tanggal || "-"} (+${r.phone})`;
  }), "", "Ambil: /ambil <id>"].join("\n");
}

/** Pecah teks panjang (batas WhatsApp ±4096 karakter) di batas baris. */
export function splitText(text, max = 3900) {
  const out = [];
  let rest = String(text || "");
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  out.push(rest);
  return out;
}
