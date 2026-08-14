/**
 * OpenFramez — Gallery App (home page)
 * Handles: category filter, search, infinite scroll, mobile search overlay
 */

(function () {
  const PAGE_SIZE = 24;
  let state = {
    loaded: 0,
    category: 'all',
    query: '',
    sort: 'newest',
    items: [],
    rendered: 0,
  };

  const els = {
    gallery: document.getElementById('gallery'),
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
  };

  // ---------- Merge categories from multiple sources ----------
  function mergeCategories(wmCats, fedCats) {
    const counts = {};
    const labels = {};
    for (const c of wmCats) {
      counts[c.slug] = (counts[c.slug] || 0) + c.count;
      if (!labels[c.slug]) labels[c.slug] = c.label;
    }
    for (const c of fedCats) {
      counts[c.slug] = (counts[c.slug] || 0) + c.count;
      if (!labels[c.slug]) labels[c.slug] = c.label;
    }
    const seen = new Set();
    const merged = [];
    for (const c of wmCats) {
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      merged.push({ slug: c.slug, label: c.label, count: counts[c.slug] || 0 });
    }
    for (const c of fedCats) {
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      merged.push({ slug: c.slug, label: c.label, count: counts[c.slug] || 0 });
    }
    return merged.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }

  // ---------- Render category chips ----------
  function renderCategories() {
    // Merge Wikimedia categories with federated user-submitted categories
    const wmCats = OpenFramez.getCategories();
    const fedCats = window.OpenFramezFederation ? OpenFramezFederation.getCategories() : [];
    const merged = mergeCategories(wmCats, fedCats);
    const total = OpenFramez.getTotal() + (window.OpenFramezFederation ? OpenFramezFederation.getPhotosTotal() : 0);

    const html = [
      `<button class="chip ${state.category === 'all' ? 'active' : ''}" data-cat="all">همه <span class="count">(${total})</span></button>`,
      ...merged.map(
        (c) =>
          `<button class="chip ${state.category === c.slug ? 'active' : ''}" data-cat="${c.slug}">${c.label} <span class="count">(${c.count})</span></button>`
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

    state.items = OpenFramez.filter({
      category: state.category === 'all' ? null : state.category,
      query: state.query,
      sort: state.sort,
    });

    // Merge federated (user-submitted) photos
    if (window.OpenFramezFederation) {
      const fedItems = OpenFramezFederation.filter({
        type: 'photo',
        category: state.category === 'all' ? null : state.category,
        query: state.query,
        sort: state.sort,
      }).map((item) => ({
        id: item.id,
        title: item.title,
        author: item.author,
        category: item.category,
        category_label: item.category_label,
        license: item.license,
        description: item.description || '',
        thumbnail: item.thumbnail_url || item.file_url,
        thumb_width: item.width,
        thumb_height: item.height,
        uploaded_at: item.uploaded_at,
        source: 'federated',
        source_user: item.source_user,
        source_url: item.source_url,
      }));
      state.items = state.items.concat(fedItems);
      // Re-sort the merged list
      if (state.sort === 'newest') {
        state.items.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));
      } else if (state.sort === 'oldest') {
        state.items.sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
      }
    }

    if (state.items.length === 0) {
      els.loading.classList.add('hidden');
      els.empty.classList.remove('hidden');
      return;
    }

    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');

    const slice = state.items.slice(state.rendered, state.rendered + PAGE_SIZE);
    const frag = document.createDocumentFragment();
    for (const p of slice) {
      frag.appendChild(createCard(p));
    }
    els.gallery.appendChild(frag);
    state.rendered += slice.length;
    UI.setupLazyImages(els.gallery);

    // If more available, set up sentinel observer
    if (state.rendered < state.items.length) {
      setupInfiniteScroll();
    }
  }

  function createCard(p) {
    const card = document.createElement('a');
    card.href = UI.photoUrl(p.id);
    card.className = 'photo-card';
    card.setAttribute('aria-label', `${p.title} — ${p.author}`);
    card.innerHTML = `
      <div class="skeleton"></div>
      <img data-src="${p.thumbnail}" alt="${UI.escapeHtml(p.title)}" loading="lazy" decoding="async" width="${p.thumb_width || 800}" height="${p.thumb_height || 600}">
      <span class="license-badge">${UI.escapeHtml(p.license)}</span>
      <div class="overlay">
        <div class="overlay-content">
          <div class="overlay-title">${UI.escapeHtml(p.title)}</div>
          <div class="overlay-author">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${UI.escapeHtml(p.author)}
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
    const stats = OpenFramez.getStats();
    const fedStats = window.OpenFramezFederation ? OpenFramezFederation.getStats() : { total: 0, contributors: 0, categories: 0 };
    const nums = els.heroStats.querySelectorAll('.num');
    if (nums.length >= 3) {
      nums[0].textContent = (stats.total + fedStats.total).toLocaleString('fa-IR');
      nums[1].textContent = (stats.categories + fedStats.categories).toLocaleString('fa-IR');
      nums[2].textContent = (stats.authors + fedStats.contributors).toLocaleString('fa-IR');
    }
  }

  // ---------- Search (desktop header) ----------
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
    const results = OpenFramez.filter({ query, sort: 'newest' }).slice(0, 10);
    if (results.length === 0) {
      els.searchOverlayResults.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.875rem">نتیجه‌ای یافت نشد</div>';
      return;
    }
    els.searchOverlayResults.innerHTML = results
      .map(
        (p) => `
        <a class="search-result-item" href="${UI.photoUrl(p.id)}">
          <img src="${p.thumbnail}" alt="" loading="lazy">
          <div class="info">
            <div class="title">${UI.escapeHtml(p.title)}</div>
            <div class="meta">${UI.escapeHtml(p.author)} • ${UI.escapeHtml(p.category_label)}</div>
          </div>
        </a>
      `
      )
      .join('');
  }

  // ---------- Init ----------
  async function init() {
    try {
      await OpenFramez.load();
      // Load federated content in parallel (non-fatal on failure)
      if (window.OpenFramezFederation) {
        try {
          await OpenFramezFederation.load();
        } catch (e) {
          console.warn('Federated content load failed (non-fatal):', e);
        }
      }
    } catch (err) {
      console.error(err);
      els.loading.innerHTML = '<div>خطا در بارگذاری داده‌ها. لطفاً صفحه را تازه‌سازی کنید.</div>';
      return;
    }
    renderStats();
    renderCategories();

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      state.query = q;
      if (els.searchInput) els.searchInput.value = q;
    }
    const cat = params.get('cat');
    if (cat) {
      state.category = cat;
    }

    renderCategories();
    renderGallery(true);

    // Bind events
    if (els.searchInput) {
      els.searchInput.addEventListener('input', (e) => onSearch(e.target.value));
    }
    if (els.searchFab) {
      els.searchFab.addEventListener('click', openSearchOverlay);
    }
    if (els.navSearch) {
      els.navSearch.addEventListener('click', openSearchOverlay);
    }
    if (els.searchOverlay) {
      els.searchOverlay.addEventListener('click', (e) => {
        if (e.target === els.searchOverlay) closeSearchOverlay();
      });
    }
    if (els.searchOverlayInput) {
      els.searchOverlayInput.addEventListener('input', (e) => renderOverlayResults(e.target.value));
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.searchOverlay.classList.contains('active')) {
        closeSearchOverlay();
      }
      // "/" to focus search
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (window.innerWidth <= 640) {
          openSearchOverlay();
        } else if (els.searchInput) {
          els.searchInput.focus();
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
