// Handler webhook WhatsApp Cloud API untuk studio AsProject.
// Dijalankan sebagai Supabase Edge Function (lihat index.ts). Semua I/O (fetch)
// disuntikkan lewat createHandler() agar bisa diuji tanpa akun Meta/Supabase.

import {
  ADMIN_ONLY, PUBLIC_BASE_DEFAULT, buildDraftRow, classifyCustomer, formatDaftar,
  formatDraftCreated, formatErrors, formatFormatBuat, formatHarga, formatHelpAdmin,
  formatLeadAdmin, formatLeadCustomer, formatLeads, formatLinks, formatMenuCustomer,
  formatPesan, formatRekap, normalizePhone, parseCommand, parseFields, parseList,
  slugDasar, splitText, validateBuat,
} from "./logic.mjs";

const GRAPH_VERSION_DEFAULT = "v21.0";
const enc = new TextEncoder();

/** Kesalahan yang pesannya boleh langsung ditampilkan ke pengguna WhatsApp. */
class UserError extends Error {}

export function createHandler({ env = {}, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const cfg = {
    verifyToken: env.WA_VERIFY_TOKEN || "",
    appSecret: env.WA_APP_SECRET || "",
    waToken: env.WA_TOKEN || "",
    phoneId: env.WA_PHONE_NUMBER_ID || "",
    graphVersion: env.WA_GRAPH_VERSION || GRAPH_VERSION_DEFAULT,
    admins: new Set(parseList(env.ADMIN_PHONES).map(normalizePhone).filter(Boolean)),
    supabaseUrl: (env.SUPABASE_URL || "").replace(/\/+$/, ""),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    base: (env.PUBLIC_BASE || PUBLIC_BASE_DEFAULT).replace(/\/+$/, ""),
  };

  /* ---------- Supabase (REST, kunci service role — jangan pernah dikirim ke browser) ---------- */

  async function sb(method, path, { body, prefer } = {}) {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur");
    const headers = { apikey: cfg.supabaseKey, Authorization: `Bearer ${cfg.supabaseKey}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const res = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  /** Menandai pesan WhatsApp sebagai sudah diproses; false bila sudah pernah (retry Meta). */
  async function claimMessage(msgId) {
    if (!msgId) return true;
    try {
      const rows = await sb("POST", "wa_processed?on_conflict=msg_id", {
        body: { msg_id: msgId },
        prefer: "resolution=ignore-duplicates,return=representation",
      });
      return Array.isArray(rows) && rows.length > 0;
    } catch (e) {
      // Gagal mengklaim (mis. tabel belum dibuat) → tetap proses, tapi catat.
      console.error("claimMessage gagal, lanjut tanpa dedupe:", e.message);
      return true;
    }
  }

  async function getDraft(slug) {
    const rows = await sb("GET", `invitation_drafts?slug=eq.${encodeURIComponent(slug)}&select=slug,name1,name2,event_date,event_time,venue,data`);
    return rows && rows[0] ? rows[0] : null;
  }

  async function pickUniqueSlug(base) {
    for (let i = 1; i <= 50; i++) {
      const candidate = i === 1 ? base : `${base.slice(0, 28)}-${i}`;
      if (!(await getDraft(candidate))) return candidate;
    }
    return `${base.slice(0, 24)}-${randomHex(3)}`;
  }

  async function createDraft(value) {
    let slug;
    if (value.slug) {
      if (await getDraft(value.slug)) throw new UserError(`Slug "${value.slug}" sudah dipakai. Pakai slug lain, mis. ${value.slug}-2.`);
      slug = value.slug;
    } else {
      slug = await pickUniqueSlug(slugDasar(value));
    }
    const masterKey = randomHex(12);
    const row = buildDraftRow(value, { slug, masterKey, nowIso: now().toISOString() });
    await sb("POST", "invitation_drafts", { body: row, prefer: "return=minimal" });
    return { slug, masterKey };
  }

  /* ---------- WhatsApp Cloud API ---------- */

  async function send(to, text) {
    if (!cfg.waToken || !cfg.phoneId) throw new Error("WA_TOKEN / WA_PHONE_NUMBER_ID belum diatur");
    for (const part of splitText(text)) {
      const res = await fetchImpl(`https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: part },
        }),
      });
      if (!res.ok) throw new Error(`WhatsApp kirim ke ${to} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }

  async function notifyAdmins(text) {
    for (const admin of cfg.admins) {
      try { await send(admin, text); } catch (e) { console.error("notifikasi admin gagal:", e.message); }
    }
  }

  /* ---------- logika percakapan ---------- */

  async function adminCommand(phone, cmd) {
    switch (cmd.name) {
      case "bantuan": case "menu": case "help": case "start":
        return send(phone, formatHelpAdmin());

      case "daftar": {
        const rows = await sb("GET", "invitation_drafts?select=slug,name1,name2,event_date&order=updated_at.desc&limit=10");
        return send(phone, formatDaftar(rows || []));
      }

      case "buat": {
        const parsed = parseFields(cmd.rest);
        const v = validateBuat(parsed.fields);
        if (!v.ok) return send(phone, formatErrors(v.errors) + "\n\n" + formatFormatBuat());
        const { slug } = await createDraft(v.value);
        return send(phone, formatDraftCreated(slug, v.value, cfg.base));
      }

      case "rekap": {
        if (!cmd.arg) return send(phone, "Format: /rekap <slug>");
        const rows = await sb("GET", `rsvp?slug=eq.${encodeURIComponent(cmd.arg)}&select=guest,status,pesan,updated_at&order=updated_at.desc`);
        return send(phone, formatRekap(cmd.arg, rows || []));
      }

      case "link": {
        if (!cmd.arg) return send(phone, "Format: /link <slug>");
        const d = await getDraft(cmd.arg);
        if (!d) return send(phone, `Undangan "${cmd.arg}" tidak ditemukan.`);
        return send(phone, formatLinks(d.slug, d.data && d.data.masterKey, cfg.base));
      }

      case "leads": {
        const rows = await sb("GET", "wa_leads?status=eq.baru&select=id,phone,fields&order=created_at.desc&limit=10");
        return send(phone, formatLeads(rows || []));
      }

      case "ambil": {
        const id = Number(cmd.arg);
        if (!Number.isInteger(id) || id <= 0) return send(phone, "Format: /ambil <id lead>, mis. /ambil 12");
        const rows = await sb("GET", `wa_leads?id=eq.${id}&select=id,status,fields`);
        const lead = rows && rows[0];
        if (!lead) return send(phone, `Lead #${id} tidak ditemukan.`);
        if (lead.status !== "baru") return send(phone, `Lead #${id} sudah ${lead.status}.`);
        const v = validateBuat(lead.fields || {});
        if (!v.ok) return send(phone, `Lead #${id} tidak lengkap:\n${v.errors.join("\n")}`);
        const { slug } = await createDraft(v.value);
        await sb("PATCH", `wa_leads?id=eq.${id}`, { body: { status: "diambil", slug }, prefer: "return=minimal" });
        return send(phone, formatDraftCreated(slug, v.value, cfg.base));
      }

      default:
        return send(phone, formatHelpAdmin());
    }
  }

  async function customerMessage(phone, name, text, cmd) {
    const intent = classifyCustomer({ cmd, text });
    switch (intent) {
      case "data": {
        const v = validateBuat(parseFields(text).fields);
        if (!v.ok) return send(phone, formatErrors(v.errors) + "\n\n" + formatPesan());
        const rows = await sb("POST", "wa_leads", {
          body: { phone, nama_kontak: name || "", fields: v.value, status: "baru" },
          prefer: "return=representation",
        });
        const id = rows[0].id;
        await send(phone, formatLeadCustomer(id));
        return notifyAdmins(formatLeadAdmin(id, name, phone, v.value));
      }
      case "harga": return send(phone, formatHarga());
      case "demo":
        return send(phone, `Lihat contoh undangan dan tema kami di:\n${cfg.base}/katalog-demo/\n\nMau pesan? Ketik *pesan*.`);
      case "pesan": return send(phone, formatPesan());
      case "cs":
        await send(phone, "Baik, pesan Anda kami teruskan ke admin. Mohon tunggu balasan ya 🙏");
        return notifyAdmins(`📩 *Pesan dari ${name || "pelanggan"}* (+${phone}):\n${text}\n\nBalas: wa.me/${phone}`);
      default:
        return send(phone, formatMenuCustomer());
    }
  }

  async function handleMessage({ from, text, name }) {
    const phone = normalizePhone(from);
    const cmd = parseCommand(text);
    if (cfg.admins.has(phone)) {
      return cmd ? adminCommand(phone, cmd) : send(phone, formatHelpAdmin());
    }
    if (cmd && ADMIN_ONLY.has(cmd.name)) {
      return send(phone, "Perintah itu khusus admin studio. Ketik *menu* untuk bantuan.");
    }
    return customerMessage(phone, name, text, cmd);
  }

  /* ---------- HTTP ---------- */

  function verify(url) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && cfg.verifyToken && token === cfg.verifyToken) {
      return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  async function receive(req) {
    if (!cfg.appSecret) return new Response("WA_APP_SECRET belum diatur", { status: 500 });
    const raw = await req.text();
    if (!(await validSignature(cfg.appSecret, raw, req.headers.get("x-hub-signature-256")))) {
      return new Response("Invalid signature", { status: 401 });
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const names = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile && c.profile.name]));
        for (const msg of value.messages || []) {
          if (msg.type !== "text") continue;
          const from = msg.from;
          const body = (msg.text && msg.text.body) || "";
          try {
            if (!(await claimMessage(msg.id))) continue;
            await handleMessage({ from, text: body, name: names.get(from) || "" });
          } catch (e) {
            const phone = normalizePhone(from);
            if (e instanceof UserError) {
              // Pesan kesalahan yang aman ditampilkan (mis. slug sudah dipakai).
              try { await send(phone, "⚠️ " + e.message); } catch (err) { console.error("kirim gagal:", err.message); }
              continue;
            }
            console.error("pesan gagal diproses:", e.message);
            try { await send(phone, "Maaf, ada kendala di sistem kami. Coba lagi beberapa saat lagi 🙏"); } catch { /* abaikan */ }
          }
        }
      }
    }
    // Selalu 200 setelah signature valid, agar Meta tidak mengulang kiriman yang sudah diproses.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return async function handle(req) {
    const url = new URL(req.url);
    if (req.method === "GET") {
      return url.searchParams.has("hub.mode") ? verify(url) : new Response("wa-bot AsProject: ok", { status: 200 });
    }
    if (req.method === "POST") return receive(req);
    return new Response("Method Not Allowed", { status: 405 });
  };
}

/* ---------- util ---------- */

export async function validSignature(secret, body, header) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return timingSafeEqual(toHex(mac), header.slice(7));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(n) {
  return toHex(crypto.getRandomValues(new Uint8Array(n)));
}
