// Uji offline penjaga Supabase: fetch selalu di-mock, tidak ada request produksi.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SENTINEL_SLUG,
  assertPublicKey,
  buildTableUrl,
  extractConfig,
  formatSummary,
  parseArgs,
  resolveConfig,
  runKeepalive,
} = require('./supabase-keepalive.cjs');

const ROOT = path.join(__dirname, '..');
const publishable = 'sb_publishable_test_1234567890';
const fixtureHtml = `
  const SUPABASE_URL='https://fixture.supabase.co/';
  const SUPABASE_KEY='${publishable}';
`;
const noSleep = async () => {};
const logger = { log() {}, warn() {} };

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

function jwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

(async () => {
  // 1) Ekstraksi konfigurasi dari pola yang dipakai aplikasi web.
  const extracted = extractConfig(fixtureHtml);
  assert.equal(extracted.url, 'https://fixture.supabase.co/');
  assert.equal(extracted.key, publishable);

  const fromFixture = resolveConfig({ env: {}, readFile: () => fixtureHtml });
  assert.equal(fromFixture.url, 'https://fixture.supabase.co');
  assert.equal(fromFixture.host, 'fixture.supabase.co');
  assert.equal(fromFixture.source, 'studio.html');

  const fromEnv = resolveConfig({
    env: { SUPABASE_URL: 'https://env.supabase.co/', SUPABASE_ANON_KEY: publishable },
    readFile: () => { throw new Error('studio.html tidak perlu dibaca'); },
  });
  assert.equal(fromEnv.host, 'env.supabase.co');
  assert.equal(fromEnv.source, 'environment');

  const actualFallback = resolveConfig({ env: {} });
  assert.equal(actualFallback.host, 'aalrhvirqwjtbbxmteeg.supabase.co');
  assert.equal(actualFallback.source, 'studio.html');

  assert.throws(() => resolveConfig({ env: {}, readFile: () => '<html></html>' }), /tidak ditemukan/);
  assert.throws(() => assertPublicKey('sb_secret_test_1234567890'), /menolak secret key/);
  assert.throws(() => assertPublicKey(jwt('service_role')), /menolak service_role/);
  assert.equal(assertPublicKey(jwt('anon')), jwt('anon'));

  // 2) URL hanya SELECT slug sentinel dengan limit 1; key tidak masuk URL.
  const tableUrl = buildTableUrl('https://example.supabase.co', 'invitation_drafts');
  const parsed = new URL(tableUrl);
  assert.equal(parsed.pathname, '/rest/v1/invitation_drafts');
  assert.equal(parsed.searchParams.get('select'), 'slug');
  assert.equal(parsed.searchParams.get('slug'), `eq.${SENTINEL_SLUG}`);
  assert.equal(parsed.searchParams.get('limit'), '1');
  assert.equal(tableUrl.includes(publishable), false);

  // 3) Dry-run menyusun rencana tanpa menyentuh jaringan.
  const dry = await runKeepalive({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
    fetchImpl: async () => { throw new Error('dry-run tidak boleh fetch'); },
    dryRun: true,
    repeatCore: 2,
    logger,
  });
  assert.equal(dry.planned.length, 4);
  assert.deepEqual(dry.planned.map((p) => p.table), [
    'invitation_drafts', 'invitation_drafts', 'rsvp', 'checkin',
  ]);

  // 4) Run sukses: semua GET, header anon benar, tidak ada body/tulis data.
  const calls = [];
  const okRun = await runKeepalive({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(200, []);
    },
    repeatCore: 2,
    sleep: noSleep,
    betweenQueriesMs: 0,
    logger,
  });
  assert.equal(okRun.results.length, 4);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((c) => c.options.method === 'GET'));
  assert.ok(calls.every((c) => c.options.body === undefined));
  assert.ok(calls.every((c) => c.options.headers.apikey === publishable));
  assert.ok(calls.every((c) => c.options.headers.Authorization === `Bearer ${publishable}`));
  assert.ok(calls.every((c) => c.url.includes(encodeURIComponent(`eq.${SENTINEL_SLUG}`)) || c.url.includes(`eq.${SENTINEL_SLUG}`)));
  assert.equal(formatSummary(okRun).includes(publishable), false);

  // 5) HTTP 540 dikenali sebagai paused dan tidak di-retry tanpa guna.
  let pausedCalls = 0;
  await assert.rejects(
    runKeepalive({
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
      fetchImpl: async () => { pausedCalls += 1; return response(540, 'paused'); },
      tables: [{ name: 'invitation_drafts', required: true }],
      repeatCore: 1,
      attempts: 3,
      sleep: noSleep,
      logger,
    }),
    /HTTP 540 \(project paused\)/
  );
  assert.equal(pausedCalls, 1);

  // 6) Error sementara 503 dicoba lagi sampai berhasil.
  let transientCalls = 0;
  const transient = await runKeepalive({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
    fetchImpl: async () => {
      transientCalls += 1;
      return transientCalls === 1 ? response(503, { message: 'sementara' }) : response(200, []);
    },
    tables: [{ name: 'invitation_drafts', required: true }],
    repeatCore: 1,
    attempts: 2,
    retryDelayMs: 1,
    sleep: noSleep,
    betweenQueriesMs: 0,
    logger,
  });
  assert.equal(transient.results[0].attempts, 2);
  assert.equal(transientCalls, 2);

  // 7) Tabel opsional yang belum terpasang menjadi peringatan, bukan mematikan
  // aktivitas tabel inti. Tabel inti yang hilang tetap gagal.
  const optionalMissing = await runKeepalive({
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
    fetchImpl: async (url) => String(url).includes('/checkin?')
      ? response(404, { code: 'PGRST205', message: "Could not find the table 'public.checkin' in the schema cache" })
      : response(200, []),
    tables: [
      { name: 'invitation_drafts', required: true },
      { name: 'checkin', required: false },
    ],
    repeatCore: 1,
    sleep: noSleep,
    betweenQueriesMs: 0,
    logger,
  });
  assert.equal(optionalMissing.ok, true);
  assert.equal(optionalMissing.warnings.length, 1);

  await assert.rejects(
    runKeepalive({
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
      fetchImpl: async () => response(404, { code: 'PGRST205', message: 'Could not find the table' }),
      tables: [{ name: 'invitation_drafts', required: true }],
      repeatCore: 1,
      attempts: 1,
      sleep: noSleep,
      logger,
    }),
    /HTTP 404/
  );

  // 8) HTTP 200 dengan bentuk tak terduga tidak dianggap sehat.
  await assert.rejects(
    runKeepalive({
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: publishable },
      fetchImpl: async () => response(200, { message: 'bukan array' }),
      tables: [{ name: 'invitation_drafts', required: true }],
      repeatCore: 1,
      attempts: 1,
      sleep: noSleep,
      logger,
    }),
    /bukan array JSON/
  );

  // 9) Kontrak workflow: jadwal 6 jam, manual dispatch, script yang sama,
  // izin read-only, dan tidak ada secret service-role.
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/supabase-keepalive.yml'), 'utf8');
  assert.match(workflow, /cron:\s+'23 \*\/6 \* \* \*'/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node tools\/supabase-keepalive\.cjs/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE|SERVICE_ROLE_KEY|secrets\.SUPABASE_SECRET/);

  assert.deepEqual(parseArgs(['--dry-run', '--repeat-core=4']), { dryRun: true, repeatCore: 4 });
  assert.throws(() => parseArgs(['--repeat-core=99']), /1\.\.10/);

  console.log('PASS: Supabase keepalive offline — konfigurasi, query baca, 540, retry, dan workflow terkunci.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
