(() => {
  'use strict';

  const form = document.getElementById('studio-demo-form');
  const eventSelect = document.getElementById('demo-event');
  const themeSelect = document.getElementById('demo-theme');
  const preview = document.getElementById('demo-preview');
  const status = document.getElementById('demo-preview-status');
  const allThemes = Array.from(themeSelect.options).map(option => option.cloneNode(true));
  const fields = Array.from(form.querySelectorAll('[data-demo-field]'));
  let updateTimer = 0;

  function refreshThemes(preferredId) {
    const allowed = allThemes.filter(option => option.dataset.event === 'all' || option.dataset.event === eventSelect.value);
    themeSelect.replaceChildren(...allowed.map(option => option.cloneNode(true)));
    if (preferredId && allowed.some(option => option.value === preferredId)) {
      themeSelect.value = preferredId;
    }
    if (!themeSelect.value && allowed.length) themeSelect.value = allowed[0].value;
  }

  function updateEventFields() {
    const wedding = eventSelect.value === 'pernikahan';
    form.querySelectorAll('[data-demo-visibility]').forEach(group => {
      group.hidden = (group.dataset.demoVisibility === 'pernikahan') !== wedding;
    });
  }

  function readValues() {
    const values = {};
    fields.forEach(field => { values[field.dataset.demoField] = field.value.trim(); });
    return values;
  }

  function sendPreview() {
    if (!preview.contentWindow) return;
    const selected = themeSelect.selectedOptions[0];
    const values = readValues();
    const event = eventSelect.value;
    const isWedding = event === 'pernikahan';
    const displayNames = isWedding
      ? [values.namaPria || 'Raka', values.namaWanita || 'Naya']
      : [values.namaAnak || (event === 'ultah' ? 'Alya' : 'Buah Hati')];
    const displayDate = values.tanggalAcara || 'Sabtu, 12 Desember 2026';
    const formData = {
      namaPria: values.namaPria || 'Raka',
      namaWanita: values.namaWanita || 'Naya',
      namaAnak: values.namaAnak || (event === 'ultah' ? 'Alya' : 'Buah Hati'),
      tanggalAcara: displayDate,
      jamAcara: values.jamAcara || '10:00',
      zona: 'WIB',
      venue: values.venue || 'Gedung Serbaguna',
      alamat: values.alamat || '',
      mapsLink: '',
      showMapsBtn: false,
      salamBuka: 'Assalamu’alaikum warahmatullahi wabarakatuh',
      salamTutup: 'Merupakan kebahagiaan bagi kami apabila Anda berkenan hadir.',
      putraPutri: '', putriDari: '', putraDari: '', usia: '', temaUltah: '', tglLahir: '', temaAqiqah: '',
      harapanPria: '', harapanWanita: '', ucapanCustom: '', liveAkad: '', liveResepsi: '',
      jamAkad: '', jamResepsi: '', sesiKedua: false, showBismillah: true
    };
    const wedding = isWedding;
    const data = {
      event,
      tpl: selected ? selected.value : 'ivory-klasik',
      themeIndex: selected ? Number(selected.dataset.themeIndex) : 0,
      form: formData,
      coverLayout: selected ? selected.dataset.cover : 'amplop',
      coverStyle: 'kotak', coverStyleExplicit: false, cover: '', fotoPria: '', fotoWanita: '',
      gallery: [], slides: [], story: { items: [] }, masterKey: '',
      names: displayNames,
      namaUtama: displayNames.join(' & '),
      titleMain: wedding ? 'Undangan Pernikahan' : (event === 'ultah' ? 'Undangan Ulang Tahun' : event === 'aqiqah' ? 'Undangan Aqiqah' : 'Undangan Khitanan'),
      titleSmall: wedding ? 'The Wedding Of' : 'Undangan',
      titleHero: displayNames.join(' & '),
      subHero: displayDate,
      dateLabel: displayDate,
      venueLabel: formData.venue,
      locationLabel: formData.alamat,
      previewSandbox: true,
      allowShare: false,
      allowPublish: false
    };
    preview.contentWindow.postMessage({ type: 'ASPROJECT_DEMO_PREVIEW', row: { theme: data.themeIndex, data } }, location.origin);
    status.textContent = 'Pratinjau diperbarui. Data ini hanya ada di halaman ini.';
  }

  function schedulePreview() {
    status.textContent = 'Memperbarui pratinjau…';
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(sendPreview, 100);
  }

  function resetDemo() {
    form.reset();
    eventSelect.value = 'pernikahan';
    refreshThemes('ivory-klasik');
    updateEventFields();
    status.textContent = 'Isi contoh acara untuk melihat pratinjau.';
    schedulePreview();
  }

  eventSelect.addEventListener('change', () => {
    refreshThemes();
    updateEventFields();
    schedulePreview();
  });
  form.addEventListener('reset', () => window.setTimeout(() => {
    eventSelect.value = 'pernikahan';
    refreshThemes('ivory-klasik');
    updateEventFields();
    status.textContent = 'Isi contoh acara untuk melihat pratinjau.';
    schedulePreview();
  }, 0));
  themeSelect.addEventListener('change', schedulePreview);
  form.addEventListener('input', schedulePreview);
  form.addEventListener('change', schedulePreview);
  preview.addEventListener('load', schedulePreview);
  window.addEventListener('pageshow', resetDemo);
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
    if (event.data && event.data.type === 'ASPROJECT_DEMO_READY') sendPreview();
  });

  refreshThemes('ivory-klasik');
  resetDemo();
})();
