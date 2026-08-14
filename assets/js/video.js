/**
 * OpenFramez — Video Detail Page (Phase 2)
 * Loads ?id=... and renders a custom video player with full metadata, attribution,
 * quality selector, and related videos. Mirrors photo.js structure.
 */

(function () {
  const els = {
    detail: document.getElementById('video-detail'),
    related: document.getElementById('related-gallery'),
    searchInput: document.getElementById('search-input'),
    searchOverlay: document.getElementById('search-overlay'),
    searchOverlayInput: document.getElementById('search-overlay-input'),
    searchOverlayResults: document.getElementById('search-overlay-results'),
    navSearch: document.getElementById('nav-search'),
  };

  let player = null;

  function fail(msg) {
    els.detail.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <h2>ویدیو یافت نشد</h2>
        <p>${UI.escapeHtml(msg)}</p>
        <p style="margin-top:16px"><a href="videos.html" class="btn btn-primary">بازگشت به ویدیوها</a></p>
      </div>
    `;
  }

  function formatSize(v) {
    return `${UI.formatBytes(v.size_bytes)} • ${v.width || '?'}×${v.height || '?'}`;
  }

  function renderVideo(v) {
    const licUrl = v.license_url || UI.licenseUrl(v.license);
    const authorInitials = UI.initials(v.artist);
    const date = UI.formatDate(v.uploaded_at);
    const desc = v.description || 'بدون توضیحات.';
    const durationFa = UI.toPersianDigits(UI.formatDuration(v.duration));
    const sizeStr = formatSize(v);

    // Update document title + meta tags
    document.title = `${v.title} — اُپن‌فریمز`;
    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', desc.slice(0, 160));
    setMeta('meta[property="og:title"]', 'content', v.title + ' — اُپن‌فریمز');
    setMeta('meta[property="og:description"]', 'content', desc.slice(0, 200));
    setMeta('meta[property="og:image"]', 'content', v.thumb_url);
    setMeta('meta[property="og:type"]', 'content', 'video.other');
    setMeta('meta[property="og:video"]', 'content', v.file_url);
    setMeta('meta[name="twitter:title"]', 'content', v.title);
    setMeta('meta[name="twitter:description"]', 'content', desc.slice(0, 200));
    setMeta('meta[name="twitter:image"]', 'content', v.thumb_url);
    setMeta('link[rel="canonical"]', 'href', `https://openframez.github.io/video.html?id=${encodeURIComponent(v.id)}`);

    // JSON-LD: VideoObject
    const ld = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": v.title,
      "description": desc,
      "thumbnailUrl": v.thumb_url,
      "contentUrl": v.file_url,
      "uploadDate": v.uploaded_at,
      "duration": `PT${Math.ceil(v.duration || 0)}S`,
      "width": { "@type": "QuantitativeValue", "value": v.width },
      "height": { "@type": "QuantitativeValue", "value": v.height },
      "author": { "@type": "Person", "name": v.artist, "url": v.artist_url || undefined },
      "license": licUrl || undefined,
      "creditText": v.artist,
      "copyrightNotice": `© ${v.artist}, ${v.license}`,
      "acquireLicensePage": licUrl || undefined,
    };
    let ldScript = document.querySelector('#ld-video');
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = 'ld-video';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(ld);

    els.detail.innerHTML = `
      <div class="video-detail-grid">
        <div class="video-player-wrap" id="video-player-wrap">
          <!-- player mounts here -->
        </div>
        <div class="video-info">
          <div>
            <span class="license-pill">${UI.escapeHtml(v.license)}</span>
            <span class="duration-pill">${durationFa}</span>
          </div>
          <h1>${UI.escapeHtml(v.title)}</h1>
          <div class="meta-row">
            <span class="author">
              <span class="avatar" aria-hidden="true">${UI.escapeHtml(authorInitials)}</span>
              ${v.artist_url ? `<a href="${v.artist_url}" target="_blank" rel="noopener" style="color:var(--brand-1)">${UI.escapeHtml(v.artist)}</a>` : UI.escapeHtml(v.artist)}
            </span>
            ${date ? `<span>•</span><span>${date}</span>` : ''}
            <span>•</span><span>${UI.escapeHtml(v.category_label || v.category)}</span>
          </div>
          <div class="description">${UI.escapeHtml(desc)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${v.file_url}" target="_blank" rel="noopener" class="btn btn-primary" id="download-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              دانلود ویدیو
            </a>
            <a href="${v.page_url}" target="_blank" rel="noopener" class="btn btn-secondary">
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

      <div class="video-detail-grid mt-8">
        <div></div>
        <div class="info-card">
          <h3>اطلاعات ویدیو</h3>
          <div class="info-list">
            <div class="info-row"><span class="label">دسته</span><span class="value">${UI.escapeHtml(v.category_label || v.category)}</span></div>
            <div class="info-row"><span class="label">مدت</span><span class="value">${durationFa}</span></div>
            <div class="info-row"><span class="label">ابعاد</span><span class="value">${v.width || '?'} × ${v.height || '?'}</span></div>
            <div class="info-row"><span class="label">نسبت تصویر</span><span class="value">${UI.escapeHtml(v.aspect || '—')}</span></div>
            <div class="info-row"><span class="label">حجم فایل</span><span class="value">${UI.formatBytes(v.size_bytes)}</span></div>
            <div class="info-row"><span class="label">فرمت</span><span class="value">${UI.escapeHtml(v.mime || 'video/webm')}</span></div>
            <div class="info-row"><span class="label">کیفیت‌ها</span><span class="value">${UI.escapeHtml((v.sources || []).map((s) => s.label).join('، ') || '—')}</span></div>
            <div class="info-row"><span class="label">تاریخ بارگذاری</span><span class="value">${date || '—'}</span></div>
            <div class="info-row"><span class="label">مجوز</span><span class="value">${licUrl ? `<a href="${licUrl}" target="_blank" rel="noopener">${UI.escapeHtml(v.license)}</a>` : UI.escapeHtml(v.license)}</span></div>
            <div class="info-row"><span class="label">سازنده</span><span class="value">${v.artist_url ? `<a href="${v.artist_url}" target="_blank" rel="noopener">${UI.escapeHtml(v.artist)}</a>` : UI.escapeHtml(v.artist)}</span></div>
            <div class="info-row"><span class="label">منبع</span><span class="value"><a href="${v.page_url}" target="_blank" rel="noopener">Wikimedia Commons</a></span></div>
          </div>
        </div>
      </div>
    `;

    // Mount the player
    const playerWrap = document.getElementById('video-player-wrap');
    if (playerWrap) {
      player = OpenFramezPlayer.create({
        container: playerWrap,
        video: v,
        autoplay: true,
        loop: true,
        compact: false,
      });
    }

    // Bind share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const shareData = {
          title: v.title,
          text: `${v.title} — ${v.artist} (${v.license})`,
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

  function renderRelated(video) {
    const related = OpenFramez.getAllVideoRelated(video, 10);
    if (!related.length) {
      els.related.parentElement.classList.add('hidden');
      return;
    }
    els.related.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const v of related) {
      const card = document.createElement('a');
      card.href = UI.videoUrl(v.id);
      card.className = 'video-card';
      card.setAttribute('aria-label', `${v.title} — ${v.artist}`);
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
            <div class="overlay-author">${UI.escapeHtml(v.artist)}</div>
          </div>
        </div>
      `;
      frag.appendChild(card);
    }
    els.related.appendChild(frag);
    UI.setupLazyImages(els.related);
  }

  // Mobile search overlay (shared)
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
    const results = OpenFramez.filterVideos({ query, sort: 'newest' }).slice(0, 10);
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
            <div class="meta">${UI.escapeHtml(v.artist)} • ${UI.toPersianDigits(UI.formatDuration(v.duration))}</div>
          </div>
        </a>
      `
      )
      .join('');
  }

  async function init() {
    try {
      // Load both sources in parallel — IA failure is non-fatal
      await OpenFramez.loadAllVideos();
    } catch (err) {
      console.error(err);
      fail('خطا در بارگذاری داده‌ها.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      fail('شناسه ویدیو مشخص نیست.');
      return;
    }
    // Unified lookup: handles both Wikimedia (fv_*) and Internet Archive (ia_*) IDs
    const video = OpenFramez.getAnyVideoById(id);
    if (!video) {
      fail(`ویدیو با شناسه ${id} یافت نشد.`);
      return;
    }
    renderVideo(video);
    renderRelated(video);

    if (els.searchInput) {
      els.searchInput.addEventListener('input', (e) => {
        const q = e.target.value;
        if (q.trim()) {
          window.location.href = `./videos.html?q=${encodeURIComponent(q)}`;
        }
      });
    }
    if (els.navSearch) els.navSearch.addEventListener('click', openSearchOverlay);
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
