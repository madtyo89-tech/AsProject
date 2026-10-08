/* Delegated help survives Studio re-renders. Hold explains; a short tap acts. */
(() => {
 const selector='button,a[href],[role="button"],input[type="button"],input[type="submit"]';
 const holdMs=900;
 const descriptions={
  publish:'Memeriksa data acara dan menyimpan undangan. Link siap dibagikan hanya setelah penyimpanan berhasil.',
  unpublish:'Mengubah status di Studio menjadi draft. Tombol ini tidak menghapus undangan yang sudah tersimpan di server.',
  startInvitation:'Mulai editor dengan isian kosong. Jika ada draft aktif, konfirmasi diminta sebelum menggantinya.',
  editInvitation:'Kembali ke editor untuk mengubah undangan. Selesaikan lagi untuk menyimpan perubahan ke undangan live.',
  showReady:'Menampilkan link undangan yang sudah berhasil dipublish agar bisa disalin atau dibagikan.',
  openMasterMenu:'Buka menu link master privat untuk pemilik acara, bukan untuk dibagikan kepada tamu.',
  masterAction:'Salin, bagikan, atau buka dashboard master sesuai tombol yang dipilih. Link ini memberi akses pengelolaan; hanya untuk pemilik acara.',
  shareReadyLink:'Salin, bagikan melalui WhatsApp, atau buka link undangan tamu yang sudah selesai, sesuai tombol yang dipilih.',
  toggleStudioMenu:'Tampilkan atau sembunyikan pilihan jenis acara, template, dan menu Studio pada layar kecil.',
  evPick:'Pilih jenis acara. Template dan kategori doa akan menyesuaikan pilihan ini.',
  pickTpl:'Terapkan template beserta warna dan font bawaannya. Isian acara tetap dipertahankan.',
  setBorder:'Pilih bingkai untuk area pembuka undangan.',
  setAnim:'Pilih animasi pembuka atau efek muncul saat bagian undangan terlihat ketika digulir.',
  pickMusic:'Pilih musik latar dan coba putar di preview.',
  togglePlay:'Putar atau jeda musik latar undangan.',
  importCsv:'Pilih file CSV atau teks untuk mengisi daftar tamu. Daftar yang aktif akan diganti dengan isi file.',
  exportCsv:'Unduh daftar nama tamu beserta link undangannya dalam file CSV.',
  copyTxt:'Salin informasi yang ditunjukkan tombol ini ke clipboard perangkat.',
  dlQr:'Unduh gambar QR untuk tamu yang dipilih.',
  waSend:'Buka WhatsApp dengan pesan undangan untuk tamu yang dipilih. Pesan belum dikirim otomatis.',
  dlUndangan:'Unduh file HTML undangan yang berisi data acara. Font web dan layanan online tetap memerlukan internet.',
  addKat:'Tambahkan entri template baru pada katalog yang dikelola di Studio.',
  tglKatHide:'Ubah apakah template ini ditampilkan atau disembunyikan di katalog.',
  prevKat:'Lihat template katalog ini di preview undangan.',
  loadArsip:'Buka data undangan dari arsip ke editor aktif.',
  rsvpWa:'Buka WhatsApp dengan nama, konfirmasi hadir, dan pesan RSVP yang diisi.',
  rsvpSave:'Simpan pilihan kehadiran tamu: hadir atau tidak hadir, sesuai tombol yang dipilih.',
  liveRsvp:'Buka bagian konfirmasi kehadiran atau kirim RSVP sesuai pengaturan undangan.',
  setFloat:'Tampilkan atau perkecil floating preview tanpa mengubah isi undangan.',
  floatGo:'Perbesar atau perkecil floating preview. Gulir di dalam layar untuk melihat seluruh isinya.',
  copyMaster:'Salin link dashboard master privat. Bagikan hanya kepada pemilik acara.',
  copyAll:'Salin seluruh link undangan tamu dari dashboard.',
  onFilter:'Saring daftar tamu berdasarkan status yang dipilih.',
  onSelectIdx:'Pilih tamu untuk melihat pratinjau dan link personalnya.',
  copyGuestIdx:'Salin link undangan personal untuk tamu ini.',
  shareWaIdx:'Buka WhatsApp dengan undangan personal tamu ini. Periksa penerima sebelum mengirim.',
  onBankTgl:'Aktifkan atau nonaktifkan tampilan amplop digital.',
  saveBank:'Simpan informasi rekening atau dompet digital yang telah diubah.',
  load:'Coba muat ulang data dari server. Pastikan perangkat terhubung ke internet.'
 };
 const clean=text=>String(text||'').replace(/\s+/g,' ').trim();
 function helpFor(el){
  if(el.dataset.help)return el.dataset.help;
  const code=el.getAttribute('onclick')||'';
  if(el.matches('[data-copy]'))return 'Salin nomor rekening atau dompet digital pada kartu ini ke clipboard perangkat.';
  if(el.id==='musikBtn')return 'Putar atau jeda musik latar undangan. Browser mungkin meminta interaksi terlebih dahulu.';
  const action=code.match(/(?:masterAction|shareReadyLink)\('([^']+)'/);
  if(action){
   const master=code.includes('masterAction'),what=master?'link master privat':'link undangan tamu yang sudah selesai';
   const suffix=master?' Hanya bagikan kepada pemilik acara, bukan kepada tamu.':'';
   if(action[1]==='copy')return 'Salin '+what+' ke clipboard perangkat.'+suffix;
   if(action[1]==='open')return 'Buka '+what+' di tab baru.'+suffix;
   return 'Buka WhatsApp dengan '+what+'. Periksa penerima sebelum mengirim.'+suffix;
  }

  for(const [fn,description] of Object.entries(descriptions)){
   if(new RegExp('\\b'+fn+'\\s*\\(').test(code))return description;
  }
  const label=clean(el.getAttribute('aria-label')||el.title||el.textContent||el.value);
  if(/set\('tab'/.test(code))return 'Buka tab '+label+' untuk melihat dan mengubah pengaturan bagian ini.';
  if(/set\('page'/.test(code))return 'Buka menu '+label+' di Studio.';
  if(/set\('accent'/.test(code))return 'Terapkan warna aksen ini pada undangan. Lihat hasilnya di preview.';
  if(/set\('linkMode'/.test(code))return 'Pilih '+label+': link personal menampilkan nama tamu, sedangkan satu link digunakan bersama.';
  if(/set\('selGuest'/.test(code))return 'Pilih tamu ini untuk pratinjau nama dan link undangannya.';
  if(/set\(/.test(code))return 'Terapkan pilihan '+(label||'ini')+' pada undangan dan perbarui preview.';
  if(el.matches('a[href]')){
   const href=el.getAttribute('href');
   if(href.includes('wa.me/6285196755675'))return 'Hubungi layanan AsProject di WhatsApp 0851-9675-5675. Ini bukan kontak RSVP pemilik acara.';
   if(/wa.me|api.whatsapp/.test(href))return 'Buka WhatsApp dengan pesan yang disiapkan. Periksa penerima dan tekan kirim sendiri.';
   if(/maps|goo.gl/.test(href))return 'Buka lokasi acara di peta untuk melihat rute perjalanan.';
   if(href.startsWith('#'))return 'Lompat ke bagian '+(label||'tujuan')+' pada halaman ini.';
   return 'Buka '+(label||'tautan ini')+(el.target==='_blank'?' di tab baru.':'.');
  }
  if(el.title)return el.title;
  if(/buka undangan/i.test(label))return 'Buka isi undangan untuk melihat detail acara. Musik akan diputar jika tersedia dan diizinkan browser.';
  return 'Ketuk singkat untuk '+(label||'menjalankan aksi tombol ini')+'. Menahan tombol hanya menampilkan bantuan.';
 }
 let active=null,timer=null,hideTimer=null,tip=null,owner=null,previousDescription=null,blocked=null;
 function hide(){
  clearTimeout(hideTimer);
  if(owner){if(previousDescription===null)owner.removeAttribute('aria-describedby');else owner.setAttribute('aria-describedby',previousDescription)}
  tip?.remove();tip=null;owner=null;
 }
 function show(el){
  if(!el.isConnected)return;
  hide();owner=el;previousDescription=el.getAttribute('aria-describedby');
  tip=document.createElement('div');tip.id='as-button-help';tip.className='as-button-help';tip.setAttribute('role','tooltip');
  tip.textContent=helpFor(el);document.body.appendChild(tip);
  el.setAttribute('aria-describedby',[previousDescription,tip.id].filter(Boolean).join(' '));
  const box=el.getBoundingClientRect(),r=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(box.left+box.width/2-r.width/2,innerWidth-r.width-8))+'px';
  tip.style.top=Math.max(8,Math.min(box.top-r.height-10>=8?box.top-r.height-10:box.bottom+10,innerHeight-r.height-8))+'px';
 }
 function target(event){const el=event.target.closest?.(selector);return el&&!el.closest('[inert]')?el:null}
 function cancel(){clearTimeout(timer);active=null}
 document.addEventListener('pointerdown',event=>{
  cancel();hide();blocked=null;
  if(event.button!==0||!event.isPrimary)return;
  const el=target(event);if(!el)return;
  active={el,id:event.pointerId,x:event.clientX,y:event.clientY};
  timer=setTimeout(()=>{if(active&&el.isConnected){blocked=el;show(el)}},holdMs);
 },true);
 document.addEventListener('pointermove',event=>{
  if(active&&event.pointerId===active.id&&Math.hypot(event.clientX-active.x,event.clientY-active.y)>10){cancel();hide()}
 },true);
 document.addEventListener('pointerup',event=>{
  if(!active||event.pointerId!==active.id)return;
  cancel();if(tip)hideTimer=setTimeout(hide,3200);
 },true);
 document.addEventListener('pointercancel',()=>{cancel();hide()},true);
 document.addEventListener('click',event=>{
  if(blocked&&(event.target===blocked||blocked.contains(event.target))){event.preventDefault();event.stopImmediatePropagation();blocked=null}
 },true);
 document.addEventListener('contextmenu',event=>{
  const el=target(event);
  if(el&&(active?.el===el||blocked===el)){event.preventDefault();clearTimeout(timer);blocked=el;show(el)}
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){cancel();hide();return}
  if(event.key==='F1'){
   const el=target(event);if(!el)return;event.preventDefault();show(el);hideTimer=setTimeout(hide,6000);
  }
 },true);
 document.addEventListener('focusout',()=>hide());
 document.addEventListener('scroll',()=>{cancel();hide()},true);
 window.addEventListener('resize',()=>{cancel();hide()});
 window.addEventListener('blur',()=>{cancel();hide()});
})();
