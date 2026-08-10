/**
 * Pixelary — Photo Detail Page
 * Loads ?id=... and renders photo with metadata
 */

(function () {
  const els = {
    detail: document.getElementById('photo-detail'),
    related: document.getElementById('related-gallery'),
    searchInput: document.getElementById('search-input'),
    searchOverlay: document.getElementById('search-overlay'),
    searchOverlayInput: document.getElementById('search-overlay-input'),
    searchOverlayResults: document.getElementById('search-overlay-results'),
    navSearch: document.getElementById('nav-search'),
  };

  function fail(msg) {
    els.detail.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <h2>عکس یافت نشد</h2>
        <p>${UI.escapeHtml(msg)}</p>
        <p style="margin-top:16px"><a href="./" class="btn btn-primary">بازگشت به خانه</a></p>
      </div>
    `;
  }

  function renderPhoto(p) {
    const licUrl = p.license_url || UI.licenseUrl(p.license);
    const authorInitials = UI.initials(p.author);
    const date = UI.formatDate(p.uploaded_at);
    const desc = p.description || 'بدون توضیحات.';

    // Update document title and meta tags (with null checks for safety)
    document.title = `${p.title} — پیکسلری`;
    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', desc.slice(0, 160));
    setMeta('meta[property="og:title"]', 'content', p.title + ' — پیکسلری');
    setMeta('meta[property="og:description"]', 'content', desc.slice(0, 200));
    setMeta('meta[property="og:image"]', 'content', p.thumbnail);
    setMeta('meta[name="twitter:title"]', 'content', p.title);
    setMeta('meta[name="twitter:description"]', 'content', desc.slice(0, 200));
    setMeta('meta[name="twitter:image"]', 'content', p.thumbnail);
    setMeta('link[rel="canonical"]', 'href', `https://betaversion488-oss.github.io/photo.html?id=${encodeURIComponent(p.id)}`);

    // JSON-LD
    const ld = {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "contentUrl": p.full,
      "thumbnailUrl": p.thumbnail,
      "name": p.title,
      "description": desc,
      "width": { "@type": "QuantitativeValue", "value": p.width },
      "height": { "@type": "QuantitativeValue", "value": p.height },
      "datePublished": p.uploaded_at,
      "author": { "@type": "Person", "name": p.author, "url": p.author_url || undefined },
      "license": licUrl || undefined,
      "creditText": p.author,
      "copyrightNotice": `© ${p.author}, ${p.license}`,
      "acquireLicensePage": licUrl || undefined,
    };
    let ldScript = document.querySelector('#ld-image');
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'ld-image';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(ld);

    els.detail.innerHTML = `
      <div class="photo-detail-grid">
        <div class="photo-image-wrap">
          <img src="${p.thumbnail}" alt="${UI.escapeHtml(p.title)}" decoding="async" loading="eager">
        </div>
        <div class="photo-info">
          <div>
            <span class="license-pill">${UI.escapeHtml(p.license)}</span>
          </div>
          <h1>${UI.escapeHtml(p.title)}</h1>
          <div class="meta-row">
            <span class="author">
              <span class="avatar" aria-hidden="true">${UI.escapeHtml(authorInitials)}</span>
              ${p.author_url ? `<a href="${p.author_url}" target="_blank" rel="noopener" style="color:var(--brand-1)">${UI.escapeHtml(p.author)}</a>` : UI.escapeHtml(p.author)}
            </span>
            ${date ? `<span>•</span><span>${date}</span>` : ''}
          </div>
          <div class="description">${UI.escapeHtml(desc)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${p.full}" target="_blank" rel="noopener" class="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              دانلود اصل
            </a>
            <a href="${p.source}" target="_blank" rel="noopener" class="btn btn-secondary">
              مشاهده در Wikimedia
            </a>
            <button class="btn btn-ghost" id="share-btn" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              اشتراک‌گذاری
            </button>
          </div>
        </div>
      </div>

      <div class="photo-detail-grid mt-8">
        <div></div>
        <div class="info-card">
          <h3>اطلاعات تصویر</h3>
          <div class="info-list">
            <div class="info-row"><span class="label">دسته</span><span class="value">${UI.escapeHtml(p.category_label)}</span></div>
            <div class="info-row"><span class="label">ابعاد اصلی</span><span class="value">${p.width} × ${p.height}</span></div>
            <div class="info-row"><span class="label">تاریخ بارگذاری</span><span class="value">${date || '—'}</span></div>
            <div class="info-row"><span class="label">مجوز</span><span class="value">${licUrl ? `<a href="${licUrl}" target="_blank" rel="noopener">${UI.escapeHtml(p.license)}</a>` : UI.escapeHtml(p.license)}</span></div>
            <div class="info-row"><span class="label">عکاس</span><span class="value">${p.author_url ? `<a href="${p.author_url}" target="_blank" rel="noopener">${UI.escapeHtml(p.author)}</a>` : UI.escapeHtml(p.author)}</span></div>
            <div class="info-row"><span class="label">منبع</span><span class="value"><a href="${p.source}" target="_blank" rel="noopener">Wikimedia Commons</a></span></div>
          </div>
        </div>
      </div>
    `;

    // Bind share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const shareData = {
          title: p.title,
          text: `${p.title} — ${p.author} (${p.license})`,
          url: window.location.href,
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (e) { /* cancelled */ }
        } else {
          try {
            await navigator.clipboard.writeText(window.location.href);
            UI.toast('لینک کپی شد', 'success');
          } catch (e) {
            UI.toast('خطا در کپی لینک', 'error');
          }
        }
      });
    }
  }

  function renderRelated(photo) {
    const related = Pixelary.getRelated(photo, 10);
    if (!related.length) {
      els.related.parentElement.classList.add('hidden');
      return;
    }
    els.related.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const p of related) {
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
            <div class="overlay-author">${UI.escapeHtml(p.author)}</div>
          </div>
        </div>
      `;
      frag.appendChild(card);
    }
    els.related.appendChild(frag);
    UI.setupLazyImages(els.related);
  }

  // Mobile search overlay (shared logic)
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
    const results = Pixelary.filter({ query, sort: 'newest' }).slice(0, 10);
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

  async function init() {
    try {
      await Pixelary.load();
    } catch (err) {
      console.error(err);
      fail('خطا در بارگذاری داده‌ها.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      fail('شناسه عکس مشخص نیست.');
      return;
    }
    const photo = Pixelary.getById(id);
    if (!photo) {
      fail(`عکس با شناسه ${id} یافت نشد.`);
      return;
    }
    renderPhoto(photo);
    renderRelated(photo);

    // Bind search (shared)
    if (els.searchInput) {
      els.searchInput.addEventListener('input', (e) => {
        const q = e.target.value;
        if (q.trim()) {
          window.location.href = `./?q=${encodeURIComponent(q)}`;
        }
      });
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
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
