// Uji bot WhatsApp AsProject (supabase/functions/wa-bot). Tanpa akun Meta/Supabase:
// fetch disimulasikan. Jalankan: node --test tools/test-wa-bot.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as L from "../supabase/functions/wa-bot/logic.mjs";
import { TEMA_PUBLIK } from "../supabase/functions/wa-bot/tema.mjs";
import { createHandler, validSignature } from "../supabase/functions/wa-bot/handler.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "app-secret-test";
const ADMIN = "628111111111"; // dari ADMIN_PHONES "08111111111"
const CUSTOMER = "6281299990000";
const BASE_ENV = {
  WA_VERIFY_TOKEN: "verif-token",
  WA_APP_SECRET: SECRET,
  WA_TOKEN: "wa-token",
  WA_PHONE_NUMBER_ID: "123456",
  ADMIN_PHONES: "08111111111",
  SUPABASE_URL: "https://proj.supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  PUBLIC_BASE: "https://asproject.my.id",
};

/* ---------- simulasi Supabase REST + WhatsApp Graph ---------- */

function makeFetch(state = {}) {
  const s = {
    drafts: {}, rsvp: [], leads: {}, claimed: true, sendFail: false, nextLeadId: 7,
    ...state,
  };
  const calls = [];
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  const fn = async (url, opts = {}) => {
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url, method, body, headers: opts.headers || {} });

    if (url.startsWith("https://graph.facebook.com/")) {
      if (s.sendFail) return new Response("boom", { status: 500 });
      return json({ messages: [{ id: "wamid.x" }] });
    }
    const u = new URL(url);
    const table = u.pathname.replace("/rest/v1/", "");

    if (table === "wa_processed") return json(s.claimed ? [body] : []);

    if (table === "invitation_drafts") {
      if (method === "POST") return new Response("", { status: 201 });
      const slug = u.searchParams.get("slug");
      if (slug) {
        const key = slug.replace(/^eq\./, "");
        return json(s.drafts[key] ? [s.drafts[key]] : []);
      }
      return json(Object.values(s.drafts));
    }

    if (table === "wa_leads") {
      if (method === "POST") return json([{ id: s.nextLeadId }], 201);
      if (method === "PATCH") { s.patched = body; return new Response(null, { status: 204 }); }
      const id = u.searchParams.get("id");
      if (id) {
        const lead = s.leads[Number(id.replace(/^eq\./, ""))];
        return json(lead ? [lead] : []);
      }
      return json(Object.values(s.leads).filter((l) => l.status === "baru"));
    }

    if (table === "rsvp") return json(s.rsvp);
    return new Response("tidak dimock: " + url, { status: 404 });
  };
  fn.calls = calls;
  fn.state = s;
  return fn;
}

function waRequest(text, from = CUSTOMER, { id = "wamid.1", name = "Budi", secret = SECRET } = {}) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      contacts: [{ wa_id: from, profile: { name } }],
      messages: [{ from, id, type: "text", text: { body: text } }],
    } }] }],
  });
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("https://x.test/functions/v1/wa-bot", {
    method: "POST", body,
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=" + sig },
  });
}

function sentTo(fetchFn) {
  return fetchFn.calls
    .filter((c) => c.url.startsWith("https://graph.facebook.com/"))
    .map((c) => ({ to: c.body.to, text: c.body.text.body }));
}

const DRAFT_BUDI = {
  slug: "budi-sari", name1: "Budi", name2: "Sari", venue: "Gedung A", event_date: "2026-12-20",
  event_time: "09:00", data: { masterKey: "abc123" },
};

/* ---------- logika murni ---------- */

test("normalizePhone: 0812…, +62…, 8… → 62…", () => {
  assert.equal(L.normalizePhone("0812-3456-7890"), "6281234567890");
  assert.equal(L.normalizePhone("+62 812 3456 7890"), "6281234567890");
  assert.equal(L.normalizePhone("8123456789"), "628123456789");
  assert.equal(L.normalizePhone("0081234"), "6281234");
});

test("parseCommand: prefix / atau !, bukan perintah → null", () => {
  assert.deepEqual(L.parseCommand("/Rekap budi-sari"), { name: "rekap", rest: "budi-sari", arg: "budi-sari" });
  assert.equal(L.parseCommand("!menu").name, "menu");
  assert.equal(L.parseCommand("halo"), null);
  assert.equal(L.parseCommand("tanya /harga"), null);
});

test("normalizeDate & normalizeTime menerima format umum dan menolak tanggal palsu", () => {
  assert.equal(L.normalizeDate("20/12/2026"), "2026-12-20");
  assert.equal(L.normalizeDate("20-12-2026"), "2026-12-20");
  assert.equal(L.normalizeDate("2026-12-20"), "2026-12-20");
  assert.equal(L.normalizeDate("20 Desember 2026"), "2026-12-20");
  assert.equal(L.normalizeDate("31/02/2026"), null);
  assert.equal(L.normalizeDate("besok"), null);
  assert.equal(L.normalizeTime("9"), "09:00");
  assert.equal(L.normalizeTime("09.30 WIB"), "09:30");
  assert.equal(L.normalizeTime("25:00"), null);
});

test("parseFields membaca format 'Kunci: nilai' dengan alias & mengabaikan baris lain", () => {
  const { fields, dikenali } = L.parseFields(
    "Jenis: Pernikahan\n- Pria: Budi\nWanita : Sari\nTanggal: 20/12/2026\nJam: 9\nLokasi: Gedung A\nbaris acak tanpa titik dua",
  );
  assert.equal(dikenali, 6);
  assert.equal(fields.ev, "Pernikahan");
  assert.equal(fields.pria, "Budi");
  assert.equal(fields.wanita, "Sari");
  assert.equal(fields.jam, "9");
});

test("validateBuat: pernikahan lengkap → ok dan ternormalisasi", () => {
  const v = L.validateBuat(L.parseFields(
    "Jenis: pernikahan\nPria: Budi\nWanita: Sari\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: Gedung A",
  ).fields);
  assert.equal(v.ok, true, v.errors.join(" | "));
  assert.deepEqual(v.value, {
    ev: "pernikahan", pria: "Budi", wanita: "Sari", tanggal: "2026-12-20", jam: "09:00", lokasi: "Gedung A",
  });
});

test("validateBuat: daftar error yang jelas untuk data kurang/salah", () => {
  const v = L.validateBuat(L.parseFields("Jenis: pernikahan\nPria: Budi\nTanggal: kemarin\nJam: 09:00").fields);
  assert.equal(v.ok, false);
  const txt = v.errors.join("\n");
  assert.match(txt, /Isi baris "Wanita: …"/);
  assert.match(txt, /Tanggal "kemarin" tidak dikenali/);
  assert.match(txt, /Isi baris "Lokasi: …"/);
});

test("validateBuat: jenis acara tidak dikenal ditolak", () => {
  const v = L.validateBuat(L.parseFields("Jenis: pesta\nNama: Budi\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: A").fields);
  assert.equal(v.ok, false);
  assert.match(v.errors.join("\n"), /Jenis acara harus salah satu/);
});

test("validateBuat: khitanan memakai Nama, bukan Pria/Wanita", () => {
  const v = L.validateBuat(L.parseFields(
    "Jenis: khitanan\nNama: Rafa\nTanggal: 2026-11-01\nJam: 08:00\nLokasi: Masjid Al Ikhlas",
  ).fields);
  assert.equal(v.ok, true, v.errors.join(" | "));
  assert.equal(v.value.nama, "Rafa");
  assert.equal(L.slugDasar(v.value), "rafa");
});

test("buildDraftRow: bentuk kompatibel dengan barisUndangan() di Studio", () => {
  const row = L.buildDraftRow(
    { ev: "pernikahan", pria: "Budi", wanita: "Sari", tanggal: "2026-12-20", jam: "09:00", lokasi: "Gedung A" },
    { slug: "budi-sari", masterKey: "k1", nowIso: "2026-10-15T00:00:00.000Z" },
  );
  assert.equal(row.slug, "budi-sari");
  assert.equal(row.name1, "Budi");
  assert.equal(row.name2, "Sari");
  assert.equal(row.event_date, "2026-12-20");
  assert.equal(row.event_time, "09:00");
  assert.equal(row.theme, 0);
  assert.equal(row.data.tpl, "ivory-klasik");
  assert.equal(row.data.event, "pernikahan");
  assert.equal(row.data.form.namaPria, "Budi");
  assert.equal(row.data.form.namaWanita, "Sari");
  assert.equal(row.data.form.jamAcara, "09:00");
  assert.equal(row.data.masterKey, "k1");
  // Kunci yang dibaca Studio (applyDraftData) harus ada di snapshot.
  for (const k of ["form", "event", "tpl", "tplCustom", "doa", "accent", "linkMode", "masterKey"]) {
    assert.ok(k in row.data, "kunci hilang: " + k);
  }
});

test("buildDraftRow: acara non-pernikahan memakai namaAnak", () => {
  const row = L.buildDraftRow(
    { ev: "aqiqah", nama: "Aisyah", tanggal: "2026-11-02", jam: "10:00", lokasi: "Rumah" },
    { slug: "aisyah", masterKey: "k", nowIso: "x" },
  );
  assert.equal(row.name1, "Aisyah");
  assert.equal(row.name2, "");
  assert.equal(row.data.form.namaAnak, "Aisyah");
});

test("classifyCustomer: data, harga, demo, pesan, cs, menu", () => {
  assert.equal(L.classifyCustomer({ cmd: null, text: "Jenis: nikah\nPria: A\nWanita: B\nTanggal: 1/1/2027" }), "data");
  assert.equal(L.classifyCustomer({ cmd: null, text: "berapa harga undangannya?" }), "harga");
  assert.equal(L.classifyCustomer({ cmd: null, text: "boleh lihat contoh tema" }), "demo");
  assert.equal(L.classifyCustomer({ cmd: null, text: "saya mau pesan" }), "pesan");
  assert.equal(L.classifyCustomer({ cmd: null, text: "tolong hubungi admin" }), "cs");
  assert.equal(L.classifyCustomer({ cmd: null, text: "halo" }), "menu");
  assert.equal(L.classifyCustomer({ cmd: L.parseCommand("/paket"), text: "/paket" }), "harga");
});

test("TEMA_PUBLIK sama persis dengan TPL publik di studio.html (indeks, id, ev, harga)", () => {
  const s = readFileSync(join(ROOT, "studio.html"), "utf8");
  const m = s.match(/const TPL=\[([\s\S]*?)\];/);
  assert.ok(m, "TPL tidak ditemukan di studio.html");
  const tpl = eval("[" + m[1] + "]");
  const publik = tpl
    .map((t, i) => ({ index: i, id: t.id, nama: t.nama, ev: t.ev, harga: t.harga, studioOnly: !!t.studioOnly }))
    .filter((t) => !t.studioOnly)
    .map(({ index, id, nama, ev, harga }) => ({ index, id, nama, ev, harga }));
  assert.deepEqual(TEMA_PUBLIK, publik, "jalankan ulang generator tema.mjs setelah TPL berubah");
});

test("formatHarga memuat harga dasar dan rentang per acara", () => {
  const t = L.formatHarga();
  assert.match(t, /Ivory Klasik.*Rp49\.000/);
  assert.match(t, /Pernikahan\*? — Rp75\.000 – Rp99\.000/);
});

test("splitText memecah teks panjang di batas baris tanpa kehilangan isi", () => {
  const line = "x".repeat(100) + "\n";
  const source = line.repeat(80);
  const parts = L.splitText(source, 3900);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 3900);
  const strip = (s) => s.replace(/\n/g, "");
  assert.equal(strip(parts.join("")), strip(source));
  assert.deepEqual(L.splitText("pendek"), ["pendek"]);
});

test("validSignature: HMAC benar diterima, salah ditolak", async () => {
  const body = '{"a":1}';
  const good = "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(await validSignature(SECRET, body, good), true);
  assert.equal(await validSignature(SECRET, body + " ", good), false);
  assert.equal(await validSignature(SECRET, body, null), false);
});

/* ---------- handler (webhook) ---------- */

test("GET verifikasi webhook: token benar → challenge; salah → 403", async () => {
  const h = createHandler({ env: BASE_ENV, fetchImpl: makeFetch() });
  const ok = await h(new Request("https://x.test/?hub.mode=subscribe&hub.verify_token=verif-token&hub.challenge=4242"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "4242");
  const bad = await h(new Request("https://x.test/?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=1"));
  assert.equal(bad.status, 403);
});

test("POST tanpa tanda tangan valid ditolak 401 dan tidak memproses apa pun", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  const res = await h(waRequest("harga", CUSTOMER, { secret: "salah" }));
  assert.equal(res.status, 401);
  assert.equal(f.calls.length, 0);
});

test("tanpa WA_APP_SECRET semua POST ditolak (fail closed)", async () => {
  const h = createHandler({ env: { ...BASE_ENV, WA_APP_SECRET: "" }, fetchImpl: makeFetch() });
  const res = await h(waRequest("harga"));
  assert.equal(res.status, 500);
});

test("pelanggan bertanya harga → dibalas daftar harga", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  const res = await h(waRequest("berapa harga?"));
  assert.equal(res.status, 200);
  const out = sentTo(f);
  assert.equal(out.length, 1);
  assert.equal(out[0].to, CUSTOMER);
  assert.match(out[0].text, /Harga Undangan Digital/);
});

test("pesan yang sudah pernah diproses (retry Meta) diabaikan", async () => {
  const f = makeFetch({ claimed: false });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  const res = await h(waRequest("harga", CUSTOMER, { id: "wamid.dup" }));
  assert.equal(res.status, 200);
  assert.equal(sentTo(f).length, 0);
});

test("pelanggan mengirim data acara lengkap → lead tersimpan, pelanggan & admin dibalas", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  const data = "Jenis: pernikahan\nPria: Budi\nWanita: Sari\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: Gedung A";
  await h(waRequest(data, CUSTOMER, { name: "Budi" }));

  const insert = f.calls.find((c) => c.method === "POST" && c.url.includes("/wa_leads"));
  assert.ok(insert, "lead tidak disimpan");
  assert.equal(insert.body.phone, CUSTOMER);
  assert.equal(insert.body.fields.tanggal, "2026-12-20");
  assert.equal(insert.body.status, "baru");

  const out = sentTo(f);
  assert.equal(out.length, 2);
  assert.equal(out[0].to, CUSTOMER);
  assert.match(out[0].text, /#7/);
  assert.equal(out[1].to, ADMIN);
  assert.match(out[1].text, /Lead baru #7/);
  assert.match(out[1].text, /\/ambil 7/);
});

test("pelanggan mengirim data kurang → balasan berisi daftar kekurangan, tidak ada lead", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("Jenis: pernikahan\nPria: Budi\nTanggal: 20/12/2026"));
  assert.equal(f.calls.some((c) => c.url.includes("/wa_leads") && c.method === "POST"), false);
  const out = sentTo(f);
  assert.equal(out.length, 1);
  assert.match(out[0].text, /Data belum lengkap/);
});

test("pelanggan memakai perintah admin → ditolak dengan pesan khusus admin", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/daftar"));
  assert.match(sentTo(f)[0].text, /khusus admin/);
  assert.equal(f.calls.some((c) => c.url.includes("invitation_drafts")), false);
});

test("pelanggan minta admin (cs) → admin menerima pesan teruskan", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("mau tanya paket dong, hubungi admin", CUSTOMER, { name: "Ani" }));
  const out = sentTo(f);
  assert.equal(out[0].to, CUSTOMER);
  const toAdmin = out.find((o) => o.to === ADMIN);
  assert.ok(toAdmin, "admin tidak diberi tahu");
  assert.match(toAdmin.text, /Pesan dari Ani/);
});

test("admin /buat → draft dibuat di Supabase dan link dibalas", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/buat\nJenis: pernikahan\nPria: Budi\nWanita: Sari\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: Gedung A", ADMIN));
  const ins = f.calls.find((c) => c.method === "POST" && c.url.endsWith("/invitation_drafts"));
  assert.ok(ins, "draft tidak dibuat");
  assert.equal(ins.body.slug, "budi-sari");
  assert.equal(ins.body.data.form.namaWanita, "Sari");
  assert.ok(ins.body.data.masterKey.length === 24);
  const out = sentTo(f);
  assert.equal(out[0].to, ADMIN);
  assert.match(out[0].text, /Draft dibuat: \*budi-sari\*/);
  assert.match(out[0].text, /https:\/\/asproject\.my\.id\/u\/budi-sari/);
});

test("admin /buat dengan slug yang sudah ada → diminta slug lain, draft tidak ditimpa", async () => {
  const f = makeFetch({ drafts: { "budi-sari": DRAFT_BUDI } });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/buat\nJenis: pernikahan\nPria: Budi\nWanita: Sari\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: A\nSlug: budi-sari", ADMIN));
  assert.equal(f.calls.some((c) => c.method === "POST" && c.url.endsWith("/invitation_drafts")), false);
  const t = sentTo(f)[0].text;
  assert.match(t, /sudah dipakai/);
  assert.doesNotMatch(t, /kendala/);
});

test("admin /buat tanpa slug yang bentrok → memakai akhiran -2", async () => {
  const f = makeFetch({ drafts: { "budi-sari": DRAFT_BUDI } });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/buat\nJenis: pernikahan\nPria: Budi\nWanita: Sari\nTanggal: 20/12/2026\nJam: 09:00\nLokasi: A", ADMIN));
  const ins = f.calls.find((c) => c.method === "POST" && c.url.endsWith("/invitation_drafts"));
  assert.equal(ins.body.slug, "budi-sari-2");
});

test("admin /link → link tamu dan link master dengan kunci dari draft", async () => {
  const f = makeFetch({ drafts: { "budi-sari": DRAFT_BUDI } });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/link budi-sari", ADMIN));
  const t = sentTo(f)[0].text;
  assert.match(t, /https:\/\/asproject\.my\.id\/u\/budi-sari/);
  assert.match(t, /master\.html\?slug=budi-sari&k=abc123/);
});

test("admin /rekap → hitung hadir/ragu/tidak dan tampilkan ucapan", async () => {
  const f = makeFetch({ rsvp: [
    { guest: "Ani", status: "hadir", pesan: "Selamat!" },
    { guest: "Budi", status: "hadir", pesan: "" },
    { guest: "Cici", status: "ragu", pesan: "" },
    { guest: "Dedi", status: "tidak", pesan: "Maaf ya" },
  ] });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/rekap budi-sari", ADMIN));
  const t = sentTo(f)[0].text;
  assert.match(t, /Total respons: 4/);
  assert.match(t, /Hadir: 2/);
  assert.match(t, /Ragu: 1/);
  assert.match(t, /Tidak hadir: 1/);
  assert.match(t, /Ani: Selamat!/);
  assert.doesNotMatch(t, /Budi: /);
});

test("admin /ambil <id> → lead diubah jadi draft dan statusnya 'diambil'", async () => {
  const leads = { 7: { id: 7, status: "baru", fields: { ev: "khitanan", nama: "Rafa", tanggal: "2026-11-01", jam: "08:00", lokasi: "Masjid Al Ikhlas" } } };
  const f = makeFetch({ leads });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/ambil 7", ADMIN));
  const ins = f.calls.find((c) => c.method === "POST" && c.url.endsWith("/invitation_drafts"));
  assert.equal(ins.body.slug, "rafa");
  assert.equal(ins.body.data.event, "khitanan");
  assert.deepEqual(f.state.patched, { status: "diambil", slug: "rafa" });
  assert.match(sentTo(f)[0].text, /Draft dibuat: \*rafa\*/);
});

test("admin /ambil lead yang sudah diambil → ditolak tanpa membuat draft", async () => {
  const leads = { 7: { id: 7, status: "diambil", fields: {} } };
  const f = makeFetch({ leads });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/ambil 7", ADMIN));
  assert.equal(f.calls.some((c) => c.method === "POST" && c.url.endsWith("/invitation_drafts")), false);
  assert.match(sentTo(f)[0].text, /sudah diambil/);
});

test("admin /leads dan /daftar menampilkan daftar", async () => {
  const f = makeFetch({
    drafts: { "budi-sari": DRAFT_BUDI },
    leads: { 7: { id: 7, status: "baru", phone: CUSTOMER, fields: { ev: "pernikahan", pria: "Budi", wanita: "Sari", tanggal: "2026-12-20" } } },
  });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("/leads", ADMIN, { id: "a1" }));
  assert.match(sentTo(f)[0].text, /#7\* Budi & Sari/);
  await h(waRequest("/daftar", ADMIN, { id: "a2" }));
  assert.match(sentTo(f)[1].text, /budi-sari/);
});

test("admin mengirim teks biasa → menu admin", async () => {
  const f = makeFetch();
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  await h(waRequest("halo", ADMIN));
  assert.match(sentTo(f)[0].text, /Perintah Admin Studio/);
});

test("kegagalan kirim WhatsApp tidak membuat webhook gagal (tetap 200)", async () => {
  const f = makeFetch({ sendFail: true });
  const h = createHandler({ env: BASE_ENV, fetchImpl: f });
  const res = await h(waRequest("harga"));
  assert.equal(res.status, 200);
});

test("tanpa WA_TOKEN balasan tidak terkirim dan error dicatat (webhook tetap 200)", async () => {
  const f = makeFetch();
  const h = createHandler({ env: { ...BASE_ENV, WA_TOKEN: "" }, fetchImpl: f });
  const res = await h(waRequest("harga"));
  assert.equal(res.status, 200);
  assert.equal(f.calls.some((c) => c.url.startsWith("https://graph.facebook.com/")), false);
});
