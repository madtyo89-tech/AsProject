// ai-tema — Supabase Edge Function (opsional) untuk Studio Template AsProject.
//
// Tugasnya HANYA satu: meneruskan deskripsi ke LLM, lalu mengembalikan kandidat
// token tema. Kunci API tinggal di secret fungsi, tidak pernah ke browser.
// Validasi id (font/pola/border/cover) tetap dilakukan di klien lewat
// TEMA_AI.validasi(), jadi fungsi ini hanya menjaga bentuk & ukuran data.
//
// Deploy:
//   supabase functions deploy ai-tema --no-verify-jwt
//   supabase secrets set GEMINI_API_KEY=...
//
// Belum diuji di proyek Supabase sungguhan — lihat docs/ai-tema-proxy.md.

interface Token {
  nama: string; ev: string; g: [string, string, string];
  accent: string; ink: string; ft: string;
  char?: string; orn?: string; pat?: string; border: string;
  deco?: string; desc?: string; cover?: string; buka?: string; arch?: boolean;
}

const IZIN = ['nama', 'ev', 'g', 'accent', 'ink', 'ft', 'char', 'orn', 'pat', 'border', 'deco', 'desc', 'cover', 'buka', 'arch'];
const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const EV = ['pernikahan', 'khitanan', 'ultah', 'aqiqah', 'all'];

/** batas laju sederhana (per instance): 20 permintaan / jam / IP */
const jejak = new Map<string, number[]>();
function dibatasi(ip: string): boolean {
  const kini = Date.now();
  const jendela = (jejak.get(ip) || []).filter((t) => kini - t < 3600_000);
  if (jendela.length >= 20) { jejak.set(ip, jendela); return true; }
  jendela.push(kini); jejak.set(ip, jendela);
  return false;
}

function bersihkan(t: any): Token | null {
  if (!t || typeof t !== 'object') return null;
  for (const k of Object.keys(t)) if (!IZIN.includes(k)) return null;
  if (typeof t.nama !== 'string' || t.nama.trim().length < 3 || t.nama.length > 40) return null;
  if (!EV.includes(t.ev)) return null;
  if (!Array.isArray(t.g) || t.g.length !== 3 || !t.g.every(hex)) return null;
  if (!hex(t.accent) || !hex(t.ink)) return null;
  if (typeof t.ft !== 'string' || typeof t.border !== 'string') return null;
  for (const k of ['char', 'orn', 'pat', 'deco', 'desc', 'cover', 'buka']) {
    if (t[k] != null && typeof t[k] !== 'string') return null;
  }
  if (t.char && t.char.length > 12) return null;
  if (t.deco && t.deco.length > 8) return null;
  if (t.desc && t.desc.length > 180) return null;
  if (t.arch != null && typeof t.arch !== 'boolean') return null;
  return t as Token;
}

const SISTEM = `Kamu perancang tema undangan digital. Jawab HANYA JSON valid:
{"kandidat":[{"nama":"...","ev":"pernikahan|khitanan|ultah|aqiqah|all","g":["#RRGGBB","#RRGGBB","#RRGGBB"],"accent":"#RRGGBB","ink":"#RRGGBB","ft":"<id font>","char":"KAPITAL","orn":"<id ornamen>","pat":"<id pola>","border":"<id border>","deco":"glif","desc":"<=180 char","cover":"<id cover>","buka":"<id cara buka>"}]}
Aturan: warna latar terang-ke-gelap (g[0] paling terang), accent & ink harus kontras >= 4.5:1 terhadap g[0], tanpa field lain, tanpa penjelasan.`;

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('metode tidak didukung', { status: 405, headers: cors });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'tanpa-ip';
  if (dibatasi(ip)) {
    return new Response(JSON.stringify({ error: 'terlalu banyak permintaan, coba lagi nanti' }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'JSON tidak valid' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const prompt = String(body?.prompt || '').slice(0, 500).trim();
  const ev = EV.includes(body?.ev) ? body.ev : 'pernikahan';
  const jumlah = Math.max(1, Math.min(5, Number(body?.jumlah) || 3));
  if (prompt.length < 3) {
    return new Response(JSON.stringify({ error: 'prompt terlalu pendek' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const kunci = Deno.env.get('GEMINI_API_KEY');
  if (!kunci) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY belum diatur di secret fungsi' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + kunci;
  const isi = `${SISTEM}\n\nAcara: ${ev}\nJumlah kandidat: ${jumlah}\nDeskripsi pengguna: ${prompt}`;

  let teks = '';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: isi }] }],
        generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    teks = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    return new Response(JSON.stringify({ error: 'LLM gagal: ' + (e as Error).message }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let kandidat: Token[] = [];
  try {
    const data = JSON.parse(teks);
    const arr = Array.isArray(data) ? data : data?.kandidat || [];
    kandidat = arr.map(bersihkan).filter(Boolean).slice(0, jumlah) as Token[];
  } catch {
    return new Response(JSON.stringify({ error: 'balasan LLM bukan JSON' }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  if (!kandidat.length) {
    return new Response(JSON.stringify({ error: 'tidak ada kandidat yang lolos bentuk minimal' }),
      { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ kandidat }),
    { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
});
