// Daftar tema publik dari studio.html (const TPL). Urutan index WAJIB sama
// dengan TPL — kolom invitation_drafts.theme adalah index ke array itu.
// Dijaga oleh tools/test-wa-bot.mjs (akan gagal bila tidak sinkron dengan studio.html).
export const TEMA_PUBLIK = [
  { index: 0, id: "ivory-klasik", nama: "Ivory Klasik", ev: "all", harga: 49000 },
  { index: 1, id: "jawa-elegan", nama: "Adat Jawa Elegan", ev: "pernikahan", harga: 75000 },
  { index: 2, id: "minimalist-sage", nama: "Minimalist Sage", ev: "pernikahan", harga: 75000 },
  { index: 3, id: "luxury-gold", nama: "Luxury Gold", ev: "pernikahan", harga: 89000 },
  { index: 4, id: "floral-rustic", nama: "Floral Rustic", ev: "pernikahan", harga: 75000 },
  { index: 5, id: "biru-ceria", nama: "Biru Ceria", ev: "khitanan", harga: 75000 },
  { index: 6, id: "islamic-elegant", nama: "Islamic Elegant", ev: "khitanan", harga: 79000 },
  { index: 7, id: "kids-party", nama: "Kids Party", ev: "ultah", harga: 75000 },
  { index: 8, id: "sweet-17", nama: "Sweet 17", ev: "ultah", harga: 85000 },
  { index: 9, id: "adult-elegant", nama: "Adult Elegant", ev: "ultah", harga: 79000 },
  { index: 10, id: "baby-boy", nama: "Baby Boy", ev: "aqiqah", harga: 75000 },
  { index: 11, id: "baby-girl", nama: "Baby Girl", ev: "aqiqah", harga: 75000 },
  { index: 12, id: "islamic-neutral", nama: "Islamic Neutral", ev: "aqiqah", harga: 75000 },
  { index: 13, id: "midnight-gold", nama: "Midnight Gold", ev: "pernikahan", harga: 99000 },
  { index: 14, id: "emerald-royal", nama: "Emerald Royal", ev: "pernikahan", harga: 95000 },
  { index: 15, id: "navy-crest", nama: "Navy Crest", ev: "khitanan", harga: 85000 },
  { index: 16, id: "golden-jubilee", nama: "Golden Jubilee", ev: "ultah", harga: 89000 },
  { index: 17, id: "pearl-ivory", nama: "Pearl Ivory", ev: "aqiqah", harga: 85000 },
];
