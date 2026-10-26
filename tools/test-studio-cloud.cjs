// Run: npm install --no-save --package-lock=false jsdom
//      node tools/test-studio-cloud.cjs
// Cloud draft is intentionally feature-flagged off; this verifies no auth or remote writes run.
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const calls = { signOut: 0, signIn: 0, from: 0 };
const client = {
  auth: {
    onAuthStateChange() { throw new Error('auth listener must not be registered while cloud is disabled'); },
    async getSession() { throw new Error('session must not be loaded while cloud is disabled'); },
    async signInWithOtp() { calls.signIn++; return { error: null }; },
    async signOut(options) { calls.signOut++; assert.equal(options.scope, 'local'); return { error: null }; }
  },
  from() { calls.from++; throw new Error('no remote table access expected'); }
};
const dom = new JSDOM(html, { url: 'https://asproject.my.id/studio.html', runScripts: 'outside-only', pretendToBeVisual: true,
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

(async () => {
  try {
    w.startInvitation();
    w.set('tab', 'terbit');
    const card = w.document.querySelector('.cloud-card');
    assert(card && card.textContent.includes('DITUNDA'), 'Studio clearly shows that cloud sync is paused');
    assert(card.textContent.includes('Draft tetap tersimpan lokal'), 'local drafts remain available');
    assert.equal(card.querySelector('input[type="email"]'), null, 'no login form is shown while disabled');
    assert.equal(calls.signOut, 1, 'any old cloud auth session is cleared locally');
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_v1'), null, 'old auto-sync preference is removed');
    assert.equal(w.localStorage.getItem('asproject_cloud_sync_user_v1'), null, 'old sync owner preference is removed');

    await w.cloudSignIn('pemilik@example.com');
    await w.cloudUseLocal();
    await w.cloudSaveDraft(true);
    await w.cloudCheckRemote();
    w.scheduleCloudSave();
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(calls.signIn, 0, 'email OTP is not requested');
    assert.equal(calls.from, 0, 'no remote draft table is read or written');
    assert.equal(JSON.parse(w.localStorage.getItem('asproject_studio_v3')).started, true,
      'the ordinary local Studio draft still saves normally');
    console.log('Studio cloud sync is paused; stale auth/prefs are cleared and local saving stays enabled.');
  } finally {
    dom.window.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
