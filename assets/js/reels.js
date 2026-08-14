/**
 * OpenFramez — Reels Mode (Phase 2.5)
 * =================================
 * Fullscreen vertical video feed with snap-scroll, autoplay-on-scroll,
 * like/comment/share side-action-bar, and keyboard navigation.
 *
 * Modeled on Instagram Reels / TikTok feed UX:
 *   - One video per "screen" (vertical)
 *   - Snap scrolling between reels
 *   - Only the in-view video plays (others paused)
 *   - Right-side action rail: like, mute, share, info, download
 *   - Bottom-left overlay: title, author, license, description
 *   - Progress bar at the top
 *   - Tap to play/pause; double-tap to "like" with animation
 *   - Keyboard: ↑/↓ or j/k to navigate, space to play/pause, m to mute, l to like
 *
 * Reel sources:
 *   - videos.json (Wikimedia)  — filtered to vertical/square-ish first, then landscape
 *   - videos_ia.json (Internet Archive) — short vintage ads & archival clips
 *
 * Both sources are merged and sorted to interleave Wikimedia and IA content
 * so the feed feels varied.
 */

(function () {
  // ---------- State ----------
  const state = {
    reels: [],          // merged + filtered video list
    currentIndex: 0,    // active reel index
    liked: new Set(),   // liked reel IDs (session-only)
    muted: true,        // global mute (required for autoplay)
    loaded: false,
    players: new Map(), // index -> { videoEl, playBtn, progressEl, ... }
    observer: null,     // IntersectionObserver for snap autoplay
    appendMarker: null, // sentinel element for "load more"
    itemsPerBatch: 8,   // render N reels at a time, then append on scroll
    renderedCount: 0,
    userPaused: new Set(), // indices the user has explicitly paused (don't auto-resume)
  };

  const els = {
    feed: document.getElementById('reels-feed'),
    loading: document.getElementById('reels-loading'),
    empty: document.getElementById('reels-empty'),
  };

  // ---------- Helpers ----------
  function isVerticalish(v) {
    // Reels mode prefers vertical or square videos. Landscape videos
    // (16:9, 4:3) will be cropped/pillarboxed to fill.
    const aspect = v.aspect || '';
    return aspect === '9:16' || aspect === '3:4' || aspect === '1:1' || aspect === '2:3';
  }

  function pickBestSource(v) {
    // For Reels, prefer the lowest quality that's ≥ 360p (mobile bandwidth friendly)
    const sources = v.sources || [];
    if (!sources.length) {
      return { src: v.file_url, type: v.mime || 'video/mp4', label: 'auto' };
    }
    // Sort by height ascending
    const sorted = sources.slice().sort((a, b) => (a.height || 0) - (b.height || 0));
    // Prefer 360p-480p range; fall back to first
    let target = sorted.find((s) => s.height >= 360 && s.height <= 480);
    if (!target) target = sorted.find((s) => s.height >= 240) || sorted[0];
    return target;
  }

  function mergeSources(wikimediaVideos, iaVideos) {
    // Mix: prefer vertical/square videos first, then landscape, alternating sources
    const wmVert = wikimediaVideos.filter(isVerticalish);
    const wmLand = wikimediaVideos.filter((v) => !isVerticalish(v));
    const iaVert = iaVideos.filter(isVerticalish);
    const iaLand = iaVideos.filter((v) => !isVerticalish(v));

    // Interleave: 1 IA, 1 WM-vertical, 1 WM-landscape, repeat
    const merged = [];
    const maxLen = Math.max(wmVert.length, wmLand.length, iaVert.length, iaLand.length);
    for (let i = 0; i < maxLen; i++) {
      if (iaVert[i]) merged.push(iaVert[i]);
      if (wmVert[i]) merged.push(wmVert[i]);
      if (iaLand[i]) merged.push(iaLand[i]);
      if (wmLand[i]) merged.push(wmLand[i]);
    }
    return merged;
  }

  function formatReelDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${m}:${pad(s)}`;
  }

  // ---------- Reel rendering ----------
  function createReelElement(v, index) {
    const reel = document.createElement('section');
    reel.className = 'reel';
    reel.dataset.index = String(index);
    reel.dataset.id = v.id;
    reel.setAttribute('aria-label', `ریل ${index + 1}: ${v.title}`);

    const source = pickBestSource(v);
    const durationFa = UI.toPersianDigits(formatReelDuration(v.duration));
    const authorInitials = UI.initials(v.artist || '؟');
    const licUrl = v.license_url || UI.licenseUrl(v.license);
    const isLiked = state.liked.has(v.id);

    // Resolve display source label (for the "info" line)
    const sourceLabel = v.source === 'Internet Archive' ? 'Internet Archive' : 'Wikimedia Commons';

    // Build description (truncate for overlay)
    let desc = v.description || '';
    if (desc.length > 180) {
      // Truncate at word boundary, trim trailing punctuation
      const sliced = desc.slice(0, 180);
      const lastSpace = sliced.lastIndexOf(' ');
      desc = (lastSpace > 100 ? sliced.slice(0, lastSpace) : sliced).replace(/[,.;:\s]+$/, '') + '…';
    }

    reel.innerHTML = `
      <div class="reel-video-wrap">
        <video class="reel-video"
               playsinline
               preload="metadata"
               loop
               muted
               poster="${UI.escapeHtml(v.thumb_url || '')}"
               data-src="${UI.escapeHtml(source.src)}"
               data-type="${UI.escapeHtml(source.type || 'video/mp4')}">
        </video>
        <div class="reel-loading-spinner">
          <div class="spinner"></div>
        </div>
        <div class="reel-tap-target" data-action="toggle-play" aria-label="پخش/توقف">
          <div class="reel-play-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="reel-like-burst" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </div>
      </div>

      <div class="reel-progress" role="progressbar" aria-label="پیشرفت ویدیو" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="reel-progress-bar"></div>
      </div>

      <div class="reel-overlay">
        <div class="reel-info">
          <div class="reel-meta-top">
            <span class="reel-source-pill">${UI.escapeHtml(sourceLabel)}</span>
            <span class="reel-duration">${durationFa}</span>
            <span class="reel-license-pill">${UI.escapeHtml(v.license || '')}</span>
          </div>
          <div class="reel-author">
            <span class="reel-avatar" aria-hidden="true">${UI.escapeHtml(authorInitials)}</span>
            <span class="reel-author-name">${UI.escapeHtml(v.artist || 'ناشناس')}</span>
            ${v.artist_url ? `<a href="${UI.escapeHtml(v.artist_url)}" target="_blank" rel="noopener" class="reel-author-link" aria-label="صفحه سازنده">↗</a>` : ''}
          </div>
          <h2 class="reel-h2">${UI.escapeHtml(v.title)}</h2>
          ${desc ? `<p class="reel-desc">${UI.escapeHtml(desc)}</p>` : ''}
          <div class="reel-actions-bottom">
            <a href="${UI.escapeHtml(v.page_url)}" target="_blank" rel="noopener" class="reel-link-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>منبع</span>
            </a>
            <a href="${UI.escapeHtml(v.file_url)}" target="_blank" rel="noopener" class="reel-link-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>دانلود</span>
            </a>
            <a href="${UI.videoUrl(v.id)}" class="reel-link-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span>جزئیات</span>
            </a>
          </div>
        </div>
      </div>

      <aside class="reel-actions" aria-label="عملیات">
        <button class="reel-action-btn ${isLiked ? 'liked' : ''}" data-action="like" aria-label="پسندیدن" aria-pressed="${isLiked}">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="reel-action-label">پسندیدن</span>
        </button>
        <button class="reel-action-btn" data-action="toggle-mute" aria-label="صدا">
          <svg class="icon-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z" opacity="0.5"/>
            <path d="M3 9v6h4l5 5V4L7 9H3z"/>
            <line x1="2" y1="22" x2="22" y2="2" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg class="icon-unmuted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z"/>
          </svg>
          <span class="reel-action-label">صدا</span>
        </button>
        <button class="reel-action-btn" data-action="share" aria-label="اشتراک‌گذاری">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span class="reel-action-label">اشتراک</span>
        </button>
        <button class="reel-action-btn" data-action="loop" aria-label="تکرار" aria-pressed="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span class="reel-action-label">تکرار</span>
        </button>
      </aside>
    `;

    return reel;
  }

  // ---------- Player wiring (per-reel) ----------
  function wireReel(reel, index) {
    const videoEl = reel.querySelector('.reel-video');
    const playIcon = reel.querySelector('.reel-play-icon');
    const spinner = reel.querySelector('.reel-loading-spinner');
    const progressBar = reel.querySelector('.reel-progress-bar');
    const progressTrack = reel.querySelector('.reel-progress');
    const tapTarget = reel.querySelector('.reel-tap-target');
    const likeBurst = reel.querySelector('.reel-like-burst');

    // Don't actually set src until this reel is near the viewport (lazy load)
    // We use the IntersectionObserver to trigger load.

    // Video events
    videoEl.addEventListener('loadedmetadata', () => {
      spinner.style.display = 'none';
    });
    videoEl.addEventListener('waiting', () => { spinner.style.display = 'flex'; });
    videoEl.addEventListener('canplay', () => { spinner.style.display = 'none'; });
    videoEl.addEventListener('playing', () => {
      spinner.style.display = 'none';
      playIcon.parentElement.classList.add('hidden');
      reel.classList.add('has-played');
    });
    videoEl.addEventListener('pause', () => {
      playIcon.parentElement.classList.remove('hidden');
    });
    videoEl.addEventListener('timeupdate', () => {
      if (!videoEl.duration) return;
      const pct = (videoEl.currentTime / videoEl.duration) * 100;
      progressBar.style.width = pct + '%';
      progressTrack.setAttribute('aria-valuenow', Math.round(pct));
    });

    // Tap to play/pause + double-tap to like
    let lastTap = 0;
    tapTarget.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 280) {
        // double-tap → like
        e.preventDefault();
        e.stopPropagation();
        triggerLike(reel, index);
      } else {
        // single tap → toggle play (after small delay so double-tap can override)
        setTimeout(() => {
          if (Date.now() - lastTap >= 280) {
            togglePlay(reel, index);
          }
        }, 280);
      }
      lastTap = now;
    });

    // Action buttons
    reel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      // Don't process if it's the tap target (already handled)
      if (btn === tapTarget) return;
      e.stopPropagation();
      switch (action) {
        case 'toggle-play': togglePlay(reel, index); break;
        case 'like': triggerLike(reel, index); break;
        case 'toggle-mute': toggleMute(); break;
        case 'share': shareReel(state.reels[index]); break;
        case 'loop': toggleLoop(reel, index); break;
      }
    });

    // Progress bar seek
    let dragSeek = false;
    progressTrack.addEventListener('pointerdown', (e) => {
      dragSeek = true;
      progressTrack.setPointerCapture(e.pointerId);
      seekToRatio(e);
    });
    progressTrack.addEventListener('pointermove', (e) => {
      if (dragSeek) seekToRatio(e);
    });
    progressTrack.addEventListener('pointerup', (e) => {
      if (dragSeek) {
        dragSeek = false;
        try { progressTrack.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });
    function seekToRatio(e) {
      if (!videoEl.duration) return;
      const rect = progressTrack.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      videoEl.currentTime = ratio * videoEl.duration;
    }

    // Save reference for global control
    state.players.set(index, {
      reel,
      videoEl,
      playIcon,
      spinner,
      progressBar,
      progressTrack,
      loaded: false,
    });
  }

  function loadVideoSource(player) {
    if (player.loaded) return;
    const src = player.videoEl.dataset.src;
    const type = player.videoEl.dataset.type;
    if (!src) return;
    player.videoEl.src = src;
    if (type) player.videoEl.type = type;
    player.loaded = true;
  }

  function unloadVideoSource(player) {
    if (!player.loaded) return;
    player.videoEl.pause();
    player.videoEl.removeAttribute('src');
    player.videoEl.load();
    player.loaded = false;
    player.spinner.style.display = 'flex';
  }

  // ---------- Playback control ----------
  function playReel(index) {
    const player = state.players.get(index);
    if (!player) return;
    loadVideoSource(player);
    player.videoEl.muted = state.muted;
    const p = player.videoEl.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err.name === 'NotAllowedError') {
          // Show play icon prominently
          player.playIcon.parentElement.classList.remove('hidden');
        }
      });
    }
    updateMuteUI();
  }

  function pauseReel(index, unload = false) {
    const player = state.players.get(index);
    if (!player) return;
    player.videoEl.pause();
    if (unload) unloadVideoSource(player);
  }

  function togglePlay(reel, index) {
    const player = state.players.get(index);
    if (!player) return;
    loadVideoSource(player);
    if (player.videoEl.paused) {
      player.videoEl.muted = state.muted;
      player.videoEl.play().catch(() => {});
      // User explicitly resumed — clear the pause flag
      state.userPaused.delete(index);
    } else {
      player.videoEl.pause();
      // User explicitly paused — prevent observer from auto-resuming
      state.userPaused.add(index);
    }
  }

  function toggleMute() {
    state.muted = !state.muted;
    state.players.forEach((p) => { p.videoEl.muted = state.muted; });
    updateMuteUI();
    UI.toast(state.muted ? 'صدا قطع شد' : 'صدا وصل شد', 'info', 1200);
  }

  function updateMuteUI() {
    state.players.forEach((p) => {
      const mutedIcon = p.reel.querySelector('.icon-muted');
      const unmutedIcon = p.reel.querySelector('.icon-unmuted');
      if (!mutedIcon || !unmutedIcon) return;
      mutedIcon.style.display = state.muted ? '' : 'none';
      unmutedIcon.style.display = state.muted ? 'none' : '';
    });
  }

  function toggleLoop(reel, index) {
    const player = state.players.get(index);
    if (!player) return;
    const videoEl = player.videoEl;
    videoEl.loop = !videoEl.loop;
    const btn = reel.querySelector('[data-action="loop"]');
    if (btn) {
      btn.classList.toggle('active', videoEl.loop);
      btn.setAttribute('aria-pressed', videoEl.loop);
    }
    UI.toast(videoEl.loop ? 'تکرار فعال شد' : 'تکرار غیرفعال شد', 'info', 1200);
  }

  function triggerLike(reel, index) {
    const v = state.reels[index];
    if (!v) return;
    const btn = reel.querySelector('[data-action="like"]');
    const burst = reel.querySelector('.reel-like-burst');
    if (state.liked.has(v.id)) {
      // Already liked — just re-trigger animation but don't unlike (matches Instagram)
    } else {
      state.liked.add(v.id);
      if (btn) {
        btn.classList.add('liked');
        btn.setAttribute('aria-pressed', 'true');
      }
    }
    // Burst animation
    if (burst) {
      burst.classList.remove('animate');
      void burst.offsetWidth; // restart animation
      burst.classList.add('animate');
    }
  }

  async function shareReel(v) {
    if (!v) return;
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
        UI.toast('لینک کپی شد', 'success', 1500);
      } catch (e) {
        UI.toast('خطا در کپی لینک', 'error', 1500);
      }
    }
  }

  // ---------- IntersectionObserver: snap autoplay ----------
  function setupAutoplayObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = new IntersectionObserver(
      (entries) => {
        // Find the most-visible reel
        let bestEntry = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestEntry = entry;
          }
        }
        if (!bestEntry || bestRatio < 0.6) return;

        const reel = bestEntry.target;
        const newIndex = parseInt(reel.dataset.index, 10);
        if (isNaN(newIndex)) return;

        if (newIndex !== state.currentIndex) {
          // Pause previous
          pauseReel(state.currentIndex);
          state.currentIndex = newIndex;
          // Clear user-paused flag for the new reel (new reel = fresh autoplay)
          state.userPaused.delete(newIndex);
          // Update URL hash for shareable position
          const v = state.reels[newIndex];
          if (v && history.replaceState) {
            history.replaceState(null, '', `#${v.id}`);
          }
          // Load more if near end
          if (newIndex >= state.renderedCount - 3) {
            renderMore();
          }
        }
        // Play the current one — unless the user has explicitly paused it
        if (!state.userPaused.has(newIndex)) {
          playReel(newIndex);
        }
      },
      { threshold: [0, 0.3, 0.6, 0.9], root: null }
    );
  }

  // ---------- Render reels in batches ----------
  function renderBatch(count) {
    const start = state.renderedCount;
    const end = Math.min(start + count, state.reels.length);
    if (start >= end) return;

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const reel = createReelElement(state.reels[i], i);
      frag.appendChild(reel);
    }
    els.feed.appendChild(frag);

    // Wire each new reel
    for (let i = start; i < end; i++) {
      const reel = els.feed.querySelector(`.reel[data-index="${i}"]`);
      if (reel) {
        wireReel(reel, i);
        if (state.observer) state.observer.observe(reel);
      }
    }
    state.renderedCount = end;
  }

  function renderMore() {
    if (state.renderedCount >= state.reels.length) return;
    renderBatch(state.itemsPerBatch);
  }

  // ---------- Init ----------
  async function init() {
    // Load both data sources in parallel
    const promises = [OpenFramez.loadVideos()];
    // Try loading IA videos; if it fails, continue with just Wikimedia
    if (OpenFramez.loadIAVideos) {
      promises.push(
        OpenFramez.loadIAVideos().catch((err) => {
          console.warn('IA videos failed to load, continuing with Wikimedia only:', err);
          return null;
        })
      );
    }
    const [wmData, iaData] = await Promise.all(promises);

    const wmVideos = (wmData && wmData.videos) || [];
    const iaVideos = (iaData && iaData.videos) || [];
    console.log(`Reels: ${wmVideos.length} Wikimedia + ${iaVideos.length} Internet Archive videos`);

    if (wmVideos.length === 0 && iaVideos.length === 0) {
      els.loading.classList.add('hidden');
      els.empty.classList.remove('hidden');
      return;
    }

    state.reels = mergeSources(wmVideos, iaVideos);

    if (state.reels.length === 0) {
      els.loading.classList.add('hidden');
      els.empty.classList.remove('hidden');
      return;
    }

    els.loading.classList.add('hidden');
    setupAutoplayObserver();
    renderBatch(state.itemsPerBatch);

    // If URL has a hash pointing to a specific reel ID, scroll to it
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const idx = state.reels.findIndex((v) => v.id === targetId);
      if (idx >= 0 && idx < state.renderedCount) {
        const targetReel = els.feed.querySelector(`.reel[data-index="${idx}"]`);
        if (targetReel) {
          targetReel.scrollIntoView({ behavior: 'instant' });
        }
      }
    }

    // ---------- Keyboard navigation ----------
    document.addEventListener('keydown', (e) => {
      // Ignore if focus is in an input
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          navigateReel(1);
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          navigateReel(-1);
          break;
        case ' ':
          e.preventDefault();
          togglePlay(null, state.currentIndex);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'l':
          e.preventDefault();
          triggerLike(
            els.feed.querySelector(`.reel[data-index="${state.currentIndex}"]`),
            state.currentIndex
          );
          break;
      }
    });
  }

  function navigateReel(delta) {
    const newIndex = Math.max(0, Math.min(state.renderedCount - 1, state.currentIndex + delta));
    if (newIndex === state.currentIndex) return;
    const target = els.feed.querySelector(`.reel[data-index="${newIndex}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
