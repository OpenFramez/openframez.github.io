/**
 * Pixelary — Videos Gallery (Phase 2 + 2.5)
 * Mirrors app.js (photo gallery) but for videos.
 * Loads BOTH Wikimedia Commons (videos.json) and Internet Archive (videos_ia.json)
 * sources in parallel and merges them via Pixelary.filterAllVideos().
 * Handles: category filter, search, infinite scroll, mobile search overlay.
 */

(function () {
  const PAGE_SIZE = 12;
  const state = {
    loaded: 0,
    category: 'all',
    query: '',
    sort: 'newest',
    items: [],
    rendered: 0,
  };

  const els = {
    gallery: document.getElementById('video-gallery'),
    categoryBar: document.getElementById('category-bar'),
    loading: document.getElementById('gallery-loading'),
    empty: document.getElementById('empty-state'),
    heroStats: document.getElementById('hero-stats'),
    searchInput: document.getElementById('search-input'),
    searchFab: document.getElementById('search-fab'),
    searchOverlay: document.getElementById('search-overlay'),
    searchOverlayInput: document.getElementById('search-overlay-input'),
    searchOverlayResults: document.getElementById('search-overlay-results'),
    navSearch: document.getElementById('nav-search'),
    sortSelect: document.getElementById('sort-select'),
  };

  // ---------- Render category chips ----------
  function renderCategories() {
    const cats = Pixelary.getAllVideoCategories();
    const totalAll = Pixelary.getCombinedVideoStats().total;
    const html = [
      `<button class="chip ${state.category === 'all' ? 'active' : ''}" data-cat="all">همه <span class="count">(${totalAll})</span></button>`,
      ...cats.map(
        (c) =>
          `<button class="chip ${state.category === c.slug ? 'active' : ''}" data-cat="${c.slug}">${UI.escapeHtml(c.label)} <span class="count">(${c.count})</span></button>`
      ),
    ].join('');
    els.categoryBar.innerHTML = html;
    els.categoryBar.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.category = chip.dataset.cat;
        state.rendered = 0;
        state.loaded = 0;
        renderCategories();
        renderGallery(true);
      });
    });
  }

  // ---------- Render gallery ----------
  function renderGallery(reset = false) {
    if (reset) {
      els.gallery.innerHTML = '';
      els.gallery.appendChild(els.loading);
      els.loading.classList.remove('hidden');
      els.empty.classList.add('hidden');
      state.rendered = 0;
    }

    state.items = Pixelary.filterAllVideos({
      category: state.category === 'all' ? null : state.category,
      query: state.query,
      sort: state.sort,
    });

    if (state.items.length === 0) {
      els.loading.classList.add('hidden');
      els.empty.classList.remove('hidden');
      return;
    }

    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');

    const slice = state.items.slice(state.rendered, state.rendered + PAGE_SIZE);
    const frag = document.createDocumentFragment();
    for (const v of slice) {
      frag.appendChild(createCard(v));
    }
    els.gallery.appendChild(frag);
    state.rendered += slice.length;
    UI.setupLazyImages(els.gallery);

    if (state.rendered < state.items.length) {
      setupInfiniteScroll();
    }
  }

  function createCard(v) {
    const card = document.createElement('a');
    card.href = UI.videoUrl(v.id);
    card.className = 'video-card';
    card.setAttribute('aria-label', `${v.title} — ${v.artist}`);
    const aspectClass = `aspect-${(v.aspect || '16:9').replace(':', '-')}`;
    const durationFa = UI.toPersianDigits(UI.formatDuration(v.duration));
    card.innerHTML = `
      <div class="skeleton"></div>
      <img data-src="${UI.escapeHtml(v.thumb_url)}" alt="${UI.escapeHtml(v.title)}" loading="lazy" decoding="async"
           width="${v.thumb_width || 640}" height="${v.thumb_height || 360}">
      <span class="license-badge">${UI.escapeHtml(v.license)}</span>
      <span class="duration-badge">${durationFa}</span>
      <div class="play-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
      <div class="overlay">
        <div class="overlay-content">
          <div class="overlay-title">${UI.escapeHtml(v.title)}</div>
          <div class="overlay-author">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${UI.escapeHtml(v.artist)}
          </div>
        </div>
      </div>
    `;
    return card;
  }

  // ---------- Infinite scroll ----------
  let scrollObs = null;
  function setupInfiniteScroll() {
    if (scrollObs) scrollObs.disconnect();
    if (state.rendered >= state.items.length) return;

    const sentinel = document.createElement('div');
    sentinel.className = 'load-more';
    sentinel.innerHTML = '<div class="spinner"></div><div>در حال بارگذاری…</div>';
    els.gallery.appendChild(sentinel);

    scrollObs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          scrollObs.disconnect();
          sentinel.remove();
          renderGallery(false);
        }
      },
      { rootMargin: '300px 0px' }
    );
    scrollObs.observe(sentinel);
  }

  // ---------- Hero stats ----------
  function renderStats() {
    const stats = Pixelary.getCombinedVideoStats();
    const nums = els.heroStats.querySelectorAll('.num');
    if (nums.length >= 4) {
      nums[0].textContent = UI.toPersianDigits(stats.total);
      nums[1].textContent = UI.toPersianDigits(stats.categories);
      nums[2].textContent = UI.toPersianDigits(stats.authors);
      nums[3].textContent = UI.toPersianDigits(UI.formatDuration(stats.totalDuration));
    }
  }

  // ---------- Search ----------
  let searchDebounce = null;
  function onSearch(query) {
    state.query = query;
    state.category = 'all';
    state.rendered = 0;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      renderCategories();
      renderGallery(true);
    }, 250);
  }

  // ---------- Mobile search overlay ----------
  function openSearchOverlay() {
    els.searchOverlay.classList.add('active');
    setTimeout(() => els.searchOverlayInput.focus(), 50);
    document.body.style.overflow = 'hidden';
  }
  function closeSearchOverlay() {
    els.searchOverlay.classList.remove('active');
    document.body.style.overflow = '';
    els.searchOverlayInput.value = '';
    els.searchOverlayResults.innerHTML = '';
  }
  function renderOverlayResults(query) {
    if (!query.trim()) {
      els.searchOverlayResults.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.875rem">برای جستجو تایپ کنید…</div>';
      return;
    }
    const results = Pixelary.filterAllVideos({ query, sort: 'newest' }).slice(0, 10);
    if (results.length === 0) {
      els.searchOverlayResults.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.875rem">نتیجه‌ای یافت نشد</div>';
      return;
    }
    els.searchOverlayResults.innerHTML = results
      .map(
        (v) => `
        <a class="search-result-item" href="${UI.videoUrl(v.id)}">
          <img src="${UI.escapeHtml(v.thumb_url)}" alt="" loading="lazy">
          <div class="info">
            <div class="title">${UI.escapeHtml(v.title)}</div>
            <div class="meta">${UI.escapeHtml(v.artist)} • ${UI.toPersianDigits(UI.formatDuration(v.duration))} • ${UI.escapeHtml(v.category_label || v.category)}</div>
          </div>
        </a>
      `
      )
      .join('');
  }

  // ---------- Init ----------
  async function init() {
    try {
      await Pixelary.loadAllVideos();
    } catch (err) {
      console.error(err);
      els.loading.innerHTML = '<div>خطا در بارگذاری داده‌ها. لطفاً صفحه را تازه‌سازی کنید.</div>';
      return;
    }
    renderStats();
    renderCategories();

    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      state.query = q;
      if (els.searchInput) els.searchInput.value = q;
    }
    const cat = params.get('cat');
    if (cat) state.category = cat;
    const sort = params.get('sort');
    if (sort && els.sortSelect) {
      state.sort = sort;
      els.sortSelect.value = sort;
    }

    renderCategories();
    renderGallery(true);

    if (els.searchInput) {
      els.searchInput.addEventListener('input', (e) => onSearch(e.target.value));
    }
    if (els.searchFab) els.searchFab.addEventListener('click', openSearchOverlay);
    if (els.navSearch) els.navSearch.addEventListener('click', openSearchOverlay);
    if (els.searchOverlay) {
      els.searchOverlay.addEventListener('click', (e) => {
        if (e.target === els.searchOverlay) closeSearchOverlay();
      });
    }
    if (els.searchOverlayInput) {
      els.searchOverlayInput.addEventListener('input', (e) => renderOverlayResults(e.target.value));
    }
    if (els.sortSelect) {
      els.sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        state.rendered = 0;
        renderGallery(true);
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.searchOverlay.classList.contains('active')) {
        closeSearchOverlay();
      }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (window.innerWidth <= 640) openSearchOverlay();
        else if (els.searchInput) els.searchInput.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
