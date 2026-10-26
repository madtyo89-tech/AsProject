/* Interactive catalog controls; all template cards remain server-rendered for SEO and no-JS users. */
(() => {
  const controls = document.querySelector('[data-catalog-controls]');
  const grid = document.querySelector('[data-catalog-grid]');
  if (!controls || !grid) return;

  const cards = Array.from(grid.querySelectorAll('[data-template-card]'));
  const search = controls.querySelector('[data-catalog-search]');
  const sort = controls.querySelector('[data-catalog-sort]');
  const count = controls.querySelector('[data-catalog-count]');
  const empty = document.querySelector('[data-catalog-empty]');
  const favoritesToggle = controls.querySelector('[data-favorites-toggle]');
  const favoritesCount = controls.querySelector('[data-favorite-count]');
  const clearButtons = document.querySelectorAll('[data-clear-filters]');
  const categoryButtons = Array.from(controls.querySelectorAll('[data-category-filter]'));
  const toast = document.querySelector('[data-catalog-toast]');
  let toastTimer = null;
  let toastHideTimer = null;
  const storageKey = 'asproject_katalog_favorit_v1';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').trim();
  let category = 'all';
  let favoritesOnly = false;
  let favorites = new Set();

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved.filter(id => typeof id === 'string' && /^[a-z0-9-]+$/i.test(id) && cards.some(card => card.querySelector(`[data-favorite="${id}"]`))));
  } catch (_) { favorites = new Set(); }

  function syncFavorites() {
    cards.forEach(card => {
      const button = card.querySelector('[data-favorite]');
      if (!button) return;
      const active = favorites.has(button.dataset.favorite);
      button.classList.toggle('is-saved', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? 'Hapus' : 'Simpan'} ${card.querySelector('h3')?.textContent.trim() || 'tema'} ${active ? 'dari' : 'ke'} favorit`);
      button.title = active ? 'Hapus dari favorit' : 'Simpan ke favorit';
      button.textContent = active ? '♥' : '♡';
    });
    if (favoritesCount) favoritesCount.textContent = String(favorites.size);
  }

  function sortedCards() {
    const mode = sort?.value || 'name-asc';
    return cards.slice().sort((a, b) => {
      const nameA = norm(a.querySelector('h3')?.textContent);
      const nameB = norm(b.querySelector('h3')?.textContent);
      const priceA = Number(a.dataset.price) || 0;
      const priceB = Number(b.dataset.price) || 0;
      if (mode === 'name-desc') return nameB.localeCompare(nameA, 'id');
      if (mode === 'price-asc') return priceA - priceB || nameA.localeCompare(nameB, 'id');
      if (mode === 'price-desc') return priceB - priceA || nameA.localeCompare(nameB, 'id');
      return nameA.localeCompare(nameB, 'id');
    });
  }

  function applyFilters() {
    const query = norm(search?.value);
    const ordered = sortedCards();
    let shown = 0;
    ordered.forEach(card => {
      const favoriteId = card.querySelector('[data-favorite]')?.dataset.favorite;
      const matches = (category === 'all' || card.dataset.category === category)
        && (!query || norm(card.dataset.search).includes(query))
        && (!favoritesOnly || favorites.has(favoriteId));
      card.hidden = !matches;
      if (matches) shown++;
      grid.appendChild(card);
    });
    if (count) count.textContent = `${shown} ${shown === 1 ? 'tema' : 'tema'} ditampilkan`;
    if (empty) empty.hidden = shown !== 0;
    if (favoritesToggle) {
      favoritesToggle.classList.toggle('is-active', favoritesOnly);
      favoritesToggle.setAttribute('aria-pressed', String(favoritesOnly));
    }
    const filtering = Boolean(query || category !== 'all' || favoritesOnly);
    clearButtons.forEach(button => { button.hidden = !filtering; });
  }

  function showToast(message) {
    if (!toast) return;
    if (toastTimer) window.clearTimeout(toastTimer);
    if (toastHideTimer) window.clearTimeout(toastHideTimer);
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toastHideTimer = window.setTimeout(() => { toast.hidden = true; }, 220);
    }, 2500);
  }

  function clearFilters() {
    if (search) search.value = '';
    if (sort) sort.value = 'name-asc';
    category = 'all';
    favoritesOnly = false;
    categoryButtons.forEach(button => {
      const active = button.dataset.categoryFilter === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
    search?.focus();
  }

  categoryButtons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.categoryFilter || 'all';
    categoryButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
  }));

  search?.addEventListener('input', applyFilters);
  search?.addEventListener('compositionend', applyFilters);
  sort?.addEventListener('change', applyFilters);
  favoritesToggle?.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    applyFilters();
  });
  clearButtons.forEach(button => button.addEventListener('click', clearFilters));
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]');
    if (!button) return;
    const id = button.dataset.favorite;
    const name = button.closest('[data-template-card]')?.querySelector('h3')?.textContent.trim() || 'Tema';
    const isSaved = !favorites.has(id);
    if (isSaved) favorites.add(id);
    else favorites.delete(id);
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(favorites))); } catch (_) { /* Favorite still works for this page session. */ }
    syncFavorites();
    applyFilters();
    showToast(isSaved ? `${name} ditambahkan ke favorit` : `${name} dihapus dari favorit`);
  });

  syncFavorites();
  controls.hidden = false;
  applyFilters();
})();
