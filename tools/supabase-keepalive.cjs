#!/usr/bin/env node
/*
 * Penjaga Supabase AsProject.
 *
 * Tujuan: membuat aktivitas database sungguhan secara berkala supaya project
 * Free tidak terlihat sepi selama 7 hari. Script hanya melakukan GET/SELECT
 * ke slug sentinel yang tidak dipakai undangan asli, jadi tidak menulis data
 * dan tidak mengembalikan baris tamu. Tabel inti diquery beberapa kali per
 * run; workflow GitHub Actions menjalankannya tiap 6 jam.
 *
 * Konfigurasi:
 * - Utamakan SUPABASE_URL + SUPABASE_ANON_KEY dari environment/GitHub Secret.
 * - Bila kosong, ambil URL + anon key publik yang sudah tertanam di
 *   studio.html (sumber yang sama dengan aplikasi web).
 * - Kunci service-role/secret sengaja ditolak: keepalive cukup memakai anon.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SENTINEL_SLUG = '__asproject_keepalive__';
const DEFAULT_TABLES = Object.freeze([
  Object.freeze({ name: 'invitation_drafts', required: true }),
  Object.freeze({ name: 'rsvp', required: false }),
  Object.freeze({ name: 'checkin', required: false }),
]);

const sleepDefault = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readStudioHtml() {
  return fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
}

function extractConfig(html) {
  const urlMatch = String(html).match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = String(html).match(/SUPABASE_(?:ANON_)?KEY\s*=\s*['"]([^'"]+)['"]/);
  if (!urlMatch || !keyMatch) {
    throw new Error('SUPABASE_URL/SUPABASE_KEY tidak ditemukan di studio.html');
  }
  return { url: urlMatch[1], key: keyMatch[1], source: 'studio.html' };
}

function decodeJwtPayload(key) {
  const parts = String(key).split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function assertPublicKey(key) {
  const value = String(key || '').trim();
  if (value.length < 20) throw new Error('SUPABASE_ANON_KEY kosong/terlalu pendek');
  if (value.startsWith('sb_secret_')) {
    throw new Error('Keepalive menolak secret key; pakai anon/publishable key saja');
  }
  const payload = decodeJwtPayload(value);
  if (payload && payload.role === 'service_role') {
    throw new Error('Keepalive menolak service_role key; pakai anon key saja');
  }
  return value;
}

function normaliseBaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch (_) {
    throw new Error('SUPABASE_URL tidak valid');
  }
  if (parsed.protocol !== 'https:') throw new Error('SUPABASE_URL harus memakai https://');
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function resolveConfig({ env = process.env, readFile = readStudioHtml } = {}) {
  const envUrl = env.SUPABASE_URL || '';
  const envKey = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || '';
  let fileConfig = null;
  if (!envUrl || !envKey) fileConfig = extractConfig(readFile());

  const url = normaliseBaseUrl(envUrl || fileConfig.url);
  const key = assertPublicKey(envKey || fileConfig.key);
  const source = envUrl && envKey
    ? 'environment'
    : (envUrl || envKey ? 'environment + studio.html' : 'studio.html');

  return { url, key, source, host: new URL(url).host };
}

function buildTableUrl(baseUrl, table, slug = SENTINEL_SLUG) {
  const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, `${normaliseBaseUrl(baseUrl)}/`);
  url.searchParams.set('select', 'slug');
  url.searchParams.set('slug', `eq.${slug}`);
  url.searchParams.set('limit', '1');
  return url.toString();
}

function isMissingTable(status, payload) {
  if (status !== 404 || !payload || typeof payload !== 'object') return false;
  const text = `${payload.code || ''} ${payload.message || ''} ${payload.hint || ''}`;
  return /PGRST205|Could not find the table|schema cache/i.test(text);
}

function safeDetail(payload, text, secret) {
  let detail = '';
  if (payload && typeof payload === 'object') {
    detail = [payload.code, payload.message, payload.hint].filter(Boolean).join(' — ');
  }
  if (!detail) detail = String(text || '').trim().slice(0, 180);
  if (secret) detail = detail.split(secret).join('[redacted]');
  return detail.replace(/\s+/g, ' ').slice(0, 220);
}

class PausedProjectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PausedProjectError';
    this.code = 'SUPABASE_PAUSED';
    this.status = 540;
  }
}

async function fetchOnce(fetchImpl, url, key, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'User-Agent': 'AsProject-Supabase-Keepalive/1.0',
      },
      signal: controller ? controller.signal : undefined,
    });
    let text = '';
    if (response && typeof response.text === 'function') text = await response.text();
    else if (response && typeof response.json === 'function') text = JSON.stringify(await response.json());

    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch (_) { /* detail mentah dipakai seperlunya */ }
    }
    return {
      status: Number(response && response.status),
      ok: Boolean(response && response.ok),
      payload,
      text,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function queryTable({
  config,
  table,
  required,
  fetchImpl,
  attempts = 3,
  timeoutMs = 10000,
  sleep = sleepDefault,
  retryDelayMs = 1500,
}) {
  const url = buildTableUrl(config.url, table);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const result = await fetchOnce(fetchImpl, url, config.key, timeoutMs);
      const elapsedMs = Date.now() - started;

      if (result.status === 540) {
        throw new PausedProjectError(
          `Supabase membalas HTTP 540 (project paused) untuk tabel ${table}. ` +
          'Resume project dari Supabase Dashboard; query keepalive tidak bisa membangunkannya sendiri.'
        );
      }

      if (result.ok) {
        if (!Array.isArray(result.payload)) {
          throw new Error(`Respons tabel ${table} bukan array JSON seperti yang diharapkan PostgREST`);
        }
        return {
          table,
          required,
          status: result.status,
          rows: result.payload.length,
          attempts: attempt,
          elapsedMs,
        };
      }

      if (!required && isMissingTable(result.status, result.payload)) {
        return {
          table,
          required,
          status: result.status,
          rows: 0,
          attempts: attempt,
          elapsedMs,
          warning: `tabel opsional ${table} belum terpasang; query tabel inti tetap menjadi penjaga anti-pause`,
        };
      }

      const detail = safeDetail(result.payload, result.text, config.key);
      const error = new Error(
        `Query ${table} gagal dengan HTTP ${result.status || 'tanpa status'}${detail ? `: ${detail}` : ''}`
      );
      error.status = result.status;
      const retryable = result.status === 429 || result.status >= 500;
      if (!retryable || attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof PausedProjectError) throw error;
      lastError = error;
      const retryableNetwork = !error.status;
      if ((!retryableNetwork && error.status < 500 && error.status !== 429) || attempt === attempts) throw error;
    }

    if (attempt < attempts) await sleep(retryDelayMs * attempt);
  }

  throw lastError || new Error(`Query ${table} gagal`);
}

async function runKeepalive({
  env = process.env,
  readFile = readStudioHtml,
  fetchImpl = globalThis.fetch,
  logger = console,
  sleep = sleepDefault,
  tables = DEFAULT_TABLES,
  repeatCore = 3,
  attempts = 3,
  timeoutMs = 10000,
  retryDelayMs = 1500,
  betweenQueriesMs = 250,
  dryRun = false,
} = {}) {
  const config = resolveConfig({ env, readFile });
  const planned = [];

  for (const entry of tables) {
    const count = entry.required ? Math.max(1, repeatCore) : 1;
    for (let i = 0; i < count; i += 1) {
      planned.push({ table: entry.name, required: entry.required, url: buildTableUrl(config.url, entry.name) });
    }
  }

  if (dryRun) {
    return { ok: true, dryRun: true, host: config.host, source: config.source, planned, results: [], warnings: [] };
  }
  if (typeof fetchImpl !== 'function') throw new Error('Runtime Node tidak menyediakan fetch; pakai Node 18+');

  const results = [];
  const warnings = [];
  for (let i = 0; i < planned.length; i += 1) {
    const plan = planned[i];
    const result = await queryTable({
      config,
      table: plan.table,
      required: plan.required,
      fetchImpl,
      attempts,
      timeoutMs,
      sleep,
      retryDelayMs,
    });
    results.push(result);
    if (result.warning) warnings.push(result.warning);
    if (logger && typeof logger.log === 'function') {
      logger.log(
        `ok ${result.table}: HTTP ${result.status}, ${result.rows} baris sentinel, ${result.elapsedMs} ms` +
        (result.attempts > 1 ? `, percobaan ke-${result.attempts}` : '')
      );
    }
    if (i < planned.length - 1 && betweenQueriesMs > 0) await sleep(betweenQueriesMs);
  }

  return { ok: true, dryRun: false, host: config.host, source: config.source, planned, results, warnings };
}

function parseArgs(argv) {
  const out = { dryRun: false, repeatCore: 3 };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--repeat-core=')) {
      const n = Number(arg.split('=')[1]);
      if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('--repeat-core harus bilangan 1..10');
      out.repeatCore = n;
    } else {
      throw new Error(`Argumen tidak dikenal: ${arg}`);
    }
  }
  return out;
}

function formatSummary(result) {
  const rows = result.results.map((r) => `| ${r.table} | ${r.status} | ${r.rows} | ${r.elapsedMs} |`).join('\n');
  const warnings = result.warnings.length
    ? `\n\nPeringatan:\n${result.warnings.map((w) => `- ${w}`).join('\n')}`
    : '';
  return [
    '## Penjaga Supabase AsProject',
    '',
    `Project: \`${result.host}\`  `,
    `Sumber konfigurasi: \`${result.source}\`  `,
    `Query baca berhasil: **${result.results.length}**`,
    '',
    '| Tabel | HTTP | Baris sentinel | ms |',
    '|---|---:|---:|---:|',
    rows,
    warnings,
    '',
  ].join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Pakai: node tools/supabase-keepalive.cjs [--dry-run] [--repeat-core=3]');
    return;
  }

  const result = await runKeepalive({ dryRun: args.dryRun, repeatCore: args.repeatCore });
  if (args.dryRun) {
    console.log(`Dry-run untuk ${result.host} (konfigurasi: ${result.source}); tidak ada request jaringan.`);
    for (const plan of result.planned) console.log(`- GET ${plan.url}`);
    return;
  }

  for (const warning of result.warnings) {
    if (process.env.GITHUB_ACTIONS === 'true') console.log(`::warning::${warning}`);
    else console.warn(`Peringatan: ${warning}`);
  }
  console.log(`Supabase keepalive OK — ${result.results.length} query baca ke ${result.host}.`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result));
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error && error.message ? error.message : String(error);
    if (process.env.GITHUB_ACTIONS === 'true') console.error(`::error::${message}`);
    else console.error(`Supabase keepalive GAGAL: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_TABLES,
  PausedProjectError,
  SENTINEL_SLUG,
  assertPublicKey,
  buildTableUrl,
  extractConfig,
  formatSummary,
  isMissingTable,
  parseArgs,
  queryTable,
  resolveConfig,
  runKeepalive,
};
