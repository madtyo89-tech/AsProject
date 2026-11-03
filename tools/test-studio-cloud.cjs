// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-studio-cloud.cjs
// Draft Cloud is enabled; this verifies login, owner-scoped table access,
// stale-preference cleanup, payload sanitation, and local fallback.
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const calls = { signOut: 0, otp: [], from: 0, selects: [], upserts: [] };
let authCallback = null;
let remoteDraft = null;

const query = {
  select(...args) { calls.selects.push(args); return this; },
  eq(...args) { calls.selects.push(args); return this; },
  async maybeSingle() { return { data: remoteDraft, error: null }; },
  async upsert(payload, options) {
    calls.upserts.push({ payload, options });
    remoteDraft = { draft: payload.draft, updated_at: payload.updated_at };
    return { error: null };
  }
};
const client = {
  auth: {
    onAuthStateChange(callback) {
      authCallback = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async getSession() { return { data: { session: null }, error: null }; },
    async signInWithOtp(options) { calls.otp.push(options); return { error: null }; },
    async signOut() { calls.signOut++; return { error: null }; }
  },
  from(table) {
    calls.from++;
    assert.equal(table, 'studio_cloud_drafts', 'only the private cloud-draft table is used');
    return query;
  }
};

const dom = new JSDOM(html, {
  url: 'https://asproject.my.id/studio.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('asproject_cloud_sync_v1', '1');
    window.localStorage.setItem('asproject_cloud_sync_user_v1', 'stale-user');
    window.supabase = { createClient: () => client };
    window.scrollTo = () => {};
    window.HTMLMediaElement.prototype.pause = () => {};
  }
});
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname, '../assets/scroll-effects.js'), 'utf8'));
for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);

const tick = () => new Promise(resolve => setTimeout(resolve, 10));

(async () => {
  try {
    await tick();
    assert.equal(typeof authCallback, 'function', 'Auth state listener is registered when cloud is enabled');
    assert.equal(calls.signOut, 0, 'enabling cloud does not clear an existing session');
    assert.equal(calls.from, 0, 'no draft table access happens before a user signs in');

    w.startInvitation();
    w.set('tab', 'terbit');
    let card = w.document.querySelector('.cloud-card');
    assert(card, 'the cloud card is rendered on the publish tab');
    assert(!card.textContent.includes('DITUNDA'), 'cloud sync is no longer paused');
    assert(card.querySelector('input[type="email"]'), 'email OTP login is offered');
    assert.equal(calls.otp.length, 0, 'no OTP is requested automatically');

    await w.cloudSignIn('pemilik@example.com');
    assert.equal(calls.otp.length, 1, 'submitting the form requests one magic link');
    assert.equal(calls.otp[0].email, 'pemilik@example.com');
    assert.equal(calls.otp[0].options.emailRedirectTo, 'https://asproject.my.id/studio.html',
      'the magic link returns to the production Studio URL');
    assert.equal(calls.otp[0].options.shouldCreateUser, true);

    const user = { id: 'owner-123', email: 'pemilik@example.com' };
    authCallback('SIGNED_IN', { user, access_token: 'test-token' });
    await tick();
    assert.equal(calls.from, 1, 'signing in checks the owner-scoped draft table');
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_v1'), null,
      'an auto-sync preference belonging to another user is discarded');
    card = w.document.querySelector('.cloud-card');
    assert(card.textContent.includes('Masuk sebagai'), 'the signed-in card replaces the login form');
    assert(card.textContent.includes('pemilik@example.com'));

    // `state` is a top-level `let`; use the app's own setter instead of window.state.
    w.set('music', { name: 'Lokal', url: 'blob:local-only', local: true });
    w.set('musicDb', [
      { name: 'Lokal', url: 'blob:local-only', local: true },
      { name: 'Cloud', url: 'https://example.test/music.mp3', local: false }
    ]);
    await w.cloudUseLocal();
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_v1'), '1', 'auto-sync is enabled after the owner chooses it');
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_user_v1'), user.id);
    assert.equal(calls.upserts.length, 1, 'the local draft is written to the cloud once');
    const saved = calls.upserts[0];
    assert.equal(saved.payload.user_id, user.id, 'the row is keyed to the signed-in owner');
    assert.equal(saved.options.onConflict, 'user_id');
    assert.equal(saved.payload.draft.music, null, 'local-only music is not synced');
    assert.equal(saved.payload.draft.musicDb.length, 1, 'local music entries are filtered out');
    assert.equal(saved.payload.draft.musicDb[0].name, 'Cloud');
    assert(saved.payload.draft.form, 'the invitation form is included in the snapshot');
    assert(w.document.querySelector('.cloud-card').textContent.includes('AKTIF'), 'the card reports active sync');

    const readsBefore = calls.selects.length;
    await w.cloudCheckRemote();
    assert.equal(calls.selects.length, readsBefore + 2, 'manual remote check reads the same table');
    assert(!w.document.querySelector('.cloud-card').textContent.includes('Draft cloud tersedia'),
      'a freshly saved draft does not demand a redundant restore choice');

    await w.cloudSignOut();
    assert.equal(calls.signOut, 1, 'explicit logout reaches Supabase Auth');
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_v1'), null, 'auto-sync is turned off on logout');
    assert(w.document.querySelector('.cloud-card').querySelector('input[type="email"]'), 'login form returns after logout');
    assert.equal(JSON.parse(w.localStorage.getItem('asproject_studio_v3')).started, true,
      'the ordinary local Studio draft still saves normally');

    console.log('Draft Cloud is active: OTP login, owner-scoped sync, payload cleanup, and local saving all pass.');
  } finally {
    dom.window.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
