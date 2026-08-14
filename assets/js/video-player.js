/**
 * OpenFramez — Custom Video Player (Phase 2)
 * Persian RTL video player with:
 *   - Custom controls (play/pause, mute, progress, time, quality, loop, download, fullscreen)
 *   - Autoplay on scroll (IntersectionObserver) — muted, looped
 *   - Quality selector (240p/480p/720p/...) switching sources on the fly
 *   - Keyboard shortcuts (space/m/f/l/arrow keys)
 *   - Mobile-friendly: tap to play/pause, swipe-friendly controls
 *
 * Usage:
 *   const player = OpenFramezPlayer.create({
 *     container: HTMLElement,        // where to mount
 *     video: videoObject,            // entry from videos.json
 *     autoplay: true,                // autoplay when scrolled into view (default true)
 *     loop: true,                    // loop by default (default true)
 *     compact: false,                // compact mode for cards (no quality menu)
 *   });
 */

const OpenFramezPlayer = (function () {
  // Active player registry (for autoplay management — only one plays at a time)
  const activePlayers = new Set();
  let autoplayObserver = null;

  function ensureAutoplayObserver() {
    if (autoplayObserver) return autoplayObserver;
    autoplayObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const player = entry.target._openframezPlayer;
          if (!player) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // Pause all other players, then play this one
            for (const other of activePlayers) {
              if (other !== player && !other._locked) other.pause(true);
            }
            player.playAutoplay();
          } else if (!entry.isIntersecting) {
            player.pause(true);
          }
        }
      },
      { threshold: [0, 0.6, 1.0], rootMargin: '0px' }
    );
    return autoplayObserver;
  }

  function registerActive(player) {
    activePlayers.add(player);
  }
  function unregisterActive(player) {
    activePlayers.delete(player);
  }

  function create({ container, video, autoplay = true, loop = true, compact = false }) {
    if (!container || !video) throw new Error('container and video required');
    const state = {
      video,
      autoplay,
      loop,
      compact,
      currentQuality: null,   // label like '480p'
      wasPlaying: false,
      _locked: false,         // when locked, autoplay observer won't pause
      seeking: false,
      duration: video.duration || 0,
      currentTime: 0,
      buffered: 0,
      isMuted: true,           // start muted (required for autoplay)
      isPlaying: false,
      isFullscreen: false,
      showControls: true,
      hideTimer: null,
    };

    // ---------- DOM ----------
    container.classList.add('video-player');
    if (compact) container.classList.add('video-player--compact');
    container.innerHTML = `
      <video class="video-el" playsinline preload="metadata" ${loop ? 'loop' : ''} muted
             poster="${UI.escapeHtml(video.thumb_url || '')}"
             ${autoplay ? 'data-autoplay="1"' : ''}>
      </video>
      <div class="video-overlay">
        <button class="video-center-btn" type="button" aria-label="پخش/توقف" data-action="toggle-play">
          <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
          </svg>
          <span class="video-loading-spinner" style="display:none"></span>
        </button>
      </div>
      <div class="video-controls">
        <div class="video-progress" role="slider" aria-label="پیشرفت ویدیو" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <div class="video-buffered"></div>
          <div class="video-played"></div>
          <div class="video-thumb"></div>
        </div>
        <div class="video-controls-row">
          <div class="video-controls-left">
            <button class="video-btn" type="button" data-action="toggle-play" aria-label="پخش/توقف">
              <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
              </svg>
            </button>
            <button class="video-btn" type="button" data-action="toggle-mute" aria-label="صدا">
              <svg class="icon-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z" opacity="0.4"/>
                <path d="M3 9v6h4l5 5V4L7 9H3z"/>
              </svg>
              <svg class="icon-unmuted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z"/>
              </svg>
            </button>
            <div class="video-time">
              <span class="video-time-current">0:00</span>
              <span class="video-time-sep">/</span>
              <span class="video-time-duration">${UI.formatDuration(state.duration)}</span>
            </div>
          </div>
          <div class="video-controls-right">
            ${compact ? '' : `
              <div class="video-quality-wrap">
                <button class="video-btn video-quality-btn" type="button" data-action="toggle-quality" aria-label="کیفیت" aria-haspopup="true" aria-expanded="false">
                  <span class="quality-label">—</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <div class="video-quality-menu" role="menu" aria-hidden="true"></div>
              </div>
            `}
            <button class="video-btn ${loop ? 'active' : ''}" type="button" data-action="toggle-loop" aria-label="تکرار" aria-pressed="${loop}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="17 1 21 5 17 9"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
            <button class="video-btn" type="button" data-action="toggle-fullscreen" aria-label="تمام صفحه">
              <svg class="icon-enter-fs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
              <svg class="icon-exit-fs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    const videoEl = container.querySelector('.video-el');
    const overlay = container.querySelector('.video-overlay');
    const centerBtn = container.querySelector('.video-center-btn');
    const controls = container.querySelector('.video-controls');
    const progress = container.querySelector('.video-progress');
    const playedBar = container.querySelector('.video-played');
    const bufferedBar = container.querySelector('.video-buffered');
    const progressThumb = container.querySelector('.video-thumb');
    const timeCurrent = container.querySelector('.video-time-current');
    const timeDuration = container.querySelector('.video-time-duration');
    const loadingSpinner = container.querySelector('.video-loading-spinner');

    // ---------- Sources & Quality ----------
    function setSource(label) {
      const sources = video.sources || [];
      if (!sources.length) return;
      let target = label ? sources.find((s) => s.label === label) : null;
      // Default: pick the lowest quality above 240p if available (balance quality vs bandwidth)
      if (!target) {
        // Prefer 480p if available, else first
        target = sources.find((s) => s.label === '480p') || sources[0];
      }
      // Don't reset if same source
      if (state.currentQuality === target.label && videoEl.src === target.src) return;
      // Preserve playback position when switching quality
      const wasTime = videoEl.currentTime || 0;
      const wasPlaying = state.isPlaying;
      videoEl.src = target.src;
      videoEl.type = target.type;
      state.currentQuality = target.label;
      // Update quality menu active state
      const menuItems = container.querySelectorAll('.video-quality-item');
      menuItems.forEach((el) => {
        const active = el.dataset.label === target.label;
        el.classList.toggle('active', active);
        el.setAttribute('aria-checked', active);
      });
      const qlabel = container.querySelector('.quality-label');
      if (qlabel) qlabel.textContent = target.label;
      // Restore position once metadata loads
      const onLoaded = () => {
        videoEl.currentTime = wasTime;
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        if (wasPlaying) {
          videoEl.play().catch(() => {});
        }
      };
      videoEl.addEventListener('loadedmetadata', onLoaded);
    }

    function buildQualityMenu() {
      if (compact) return;
      const menu = container.querySelector('.video-quality-menu');
      if (!menu) return;
      const sources = (video.sources || []).slice().sort((a, b) => (b.height || 0) - (a.height || 0)); // high to low
      menu.innerHTML = sources
        .map((s) => `
          <button class="video-quality-item" role="menuitemradio" type="button"
                  data-label="${UI.escapeHtml(s.label)}" aria-checked="false">
            <span>${UI.escapeHtml(s.label)}</span>
            <span class="dim">${s.width || '?'}×${s.height || '?'}</span>
          </button>
        `)
        .join('');
      menu.querySelectorAll('.video-quality-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          setSource(btn.dataset.label);
          closeQualityMenu();
        });
      });
    }

    function openQualityMenu() {
      const menu = container.querySelector('.video-quality-menu');
      const btn = container.querySelector('.video-quality-btn');
      if (!menu || !btn) return;
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
    }
    function closeQualityMenu() {
      const menu = container.querySelector('.video-quality-menu');
      const btn = container.querySelector('.video-quality-btn');
      if (!menu || !btn) return;
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggleQualityMenu() {
      const menu = container.querySelector('.video-quality-menu');
      if (!menu) return;
      if (menu.classList.contains('open')) closeQualityMenu();
      else openQualityMenu();
    }

    // ---------- Playback ----------
    function play() {
      const p = videoEl.play();
      if (p && p.catch) {
        loadingSpinner.style.display = 'inline-block';
        p.then(() => {
          loadingSpinner.style.display = 'none';
        }).catch((err) => {
          loadingSpinner.style.display = 'none';
          // Autoplay was blocked — show center play button
          if (err.name === 'NotAllowedError') {
            state.isPlaying = false;
            updatePlayPauseUI();
          }
        });
      }
    }
    function pause(silent = false) {
      videoEl.pause();
      if (!silent) {
        // user-initiated pause
      }
    }
    function playAutoplay() {
      // Only autoplay if user hasn't explicitly paused
      if (state._locked) return;
      if (state.autoplay) play();
    }
    function togglePlay() {
      if (videoEl.paused) play();
      else pause();
    }
    function toggleMute() {
      videoEl.muted = !videoEl.muted;
      state.isMuted = videoEl.muted;
      updateMuteUI();
    }
    function toggleLoop() {
      state.loop = !state.loop;
      videoEl.loop = state.loop;
      const btn = container.querySelector('[data-action="toggle-loop"]');
      if (btn) {
        btn.classList.toggle('active', state.loop);
        btn.setAttribute('aria-pressed', state.loop);
      }
    }
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        const target = container.closest('.video-player-wrap') || container;
        if (target.requestFullscreen) target.requestFullscreen();
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    }

    function updatePlayPauseUI() {
      const playing = !videoEl.paused && !videoEl.ended;
      state.isPlaying = playing;
      container.querySelectorAll('.icon-play').forEach((el) => el.style.display = playing ? 'none' : '');
      container.querySelectorAll('.icon-pause').forEach((el) => el.style.display = playing ? '' : 'none');
      centerBtn.classList.toggle('playing', playing);
    }
    function updateMuteUI() {
      const muted = videoEl.muted;
      container.querySelectorAll('.icon-muted').forEach((el) => el.style.display = muted ? '' : 'none');
      container.querySelectorAll('.icon-unmuted').forEach((el) => el.style.display = muted ? 'none' : '');
    }
    function updateProgress() {
      const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
      playedBar.style.width = pct + '%';
      // RTL: position thumb from the right edge if document is RTL
      // We use LTR convention for video progress (left-to-right) regardless of UI direction
      progressThumb.style.left = pct + '%';
      progress.setAttribute('aria-valuenow', Math.round(pct));
      timeCurrent.textContent = UI.formatDuration(state.currentTime);
    }
    function updateBuffered() {
      if (!videoEl.buffered || !videoEl.buffered.length) return;
      const end = videoEl.buffered.end(videoEl.buffered.length - 1);
      const pct = state.duration > 0 ? (end / state.duration) * 100 : 0;
      bufferedBar.style.width = pct + '%';
    }

    // ---------- Seek ----------
    function seekToRatio(ratio) {
      if (state.duration <= 0) return;
      ratio = Math.max(0, Math.min(1, ratio));
      state.currentTime = ratio * state.duration;
      videoEl.currentTime = state.currentTime;
      updateProgress();
    }

    function getRatioFromEvent(e) {
      const rect = progress.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return x / rect.width;
    }

    let dragSeek = false;
    progress.addEventListener('pointerdown', (e) => {
      dragSeek = true;
      state._locked = true;
      progress.setPointerCapture(e.pointerId);
      seekToRatio(getRatioFromEvent(e));
    });
    progress.addEventListener('pointermove', (e) => {
      if (!dragSeek) return;
      seekToRatio(getRatioFromEvent(e));
    });
    progress.addEventListener('pointerup', (e) => {
      if (!dragSeek) return;
      dragSeek = false;
      try { progress.releasePointerCapture(e.pointerId); } catch (_) {}
      setTimeout(() => { state._locked = false; }, 500);
    });
    progress.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        seekToRatio(((videoEl.currentTime || 0) - 5) / state.duration);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        seekToRatio(((videoEl.currentTime || 0) + 5) / state.duration);
      }
    });

    // ---------- Video events ----------
    videoEl.addEventListener('loadedmetadata', () => {
      state.duration = videoEl.duration || state.duration;
      timeDuration.textContent = UI.formatDuration(state.duration);
      updateProgress();
    });
    videoEl.addEventListener('timeupdate', () => {
      if (dragSeek) return;
      state.currentTime = videoEl.currentTime || 0;
      updateProgress();
    });
    videoEl.addEventListener('progress', updateBuffered);
    videoEl.addEventListener('play', () => { updatePlayPauseUI(); registerActive(state); });
    videoEl.addEventListener('pause', () => { updatePlayPauseUI(); unregisterActive(state); });
    videoEl.addEventListener('ended', () => { updatePlayPauseUI(); });
    videoEl.addEventListener('waiting', () => { loadingSpinner.style.display = 'inline-block'; });
    videoEl.addEventListener('canplay', () => { loadingSpinner.style.display = 'none'; });
    videoEl.addEventListener('volumechange', updateMuteUI);

    // ---------- Controls visibility (auto-hide) ----------
    function showControls() {
      controls.classList.add('visible');
      overlay.classList.add('controls-visible');
      state.showControls = true;
      clearTimeout(state.hideTimer);
      state.hideTimer = setTimeout(() => {
        if (state.isPlaying && !dragSeek) {
          hideControls();
        }
      }, 2500);
    }
    function hideControls() {
      if (dragSeek) return;
      controls.classList.remove('visible');
      overlay.classList.remove('controls-visible');
      state.showControls = false;
      closeQualityMenu();
    }
    container.addEventListener('pointermove', showControls);
    container.addEventListener('pointerleave', () => { if (state.isPlaying) hideControls(); });
    container.addEventListener('focusin', showControls);

    // ---------- Tap to play/pause (mobile) ----------
    let lastTap = 0;
    videoEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - lastTap < 300) {
        // double-tap → fullscreen
        toggleFullscreen();
      } else {
        // single tap → play/pause
        togglePlay();
        showControls();
      }
      lastTap = now;
    });

    // ---------- Action wiring ----------
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      switch (action) {
        case 'toggle-play': togglePlay(); showControls(); break;
        case 'toggle-mute': toggleMute(); break;
        case 'toggle-loop': toggleLoop(); break;
        case 'toggle-quality': toggleQualityMenu(); break;
        case 'toggle-fullscreen': toggleFullscreen(); break;
      }
    });

    // Close quality menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) closeQualityMenu();
    });

    // ---------- Fullscreen change ----------
    function onFsChange() {
      const isFs = document.fullscreenElement && container.contains(document.fullscreenElement);
      state.isFullscreen = isFs;
      container.classList.toggle('is-fullscreen', isFs);
      container.querySelectorAll('.icon-enter-fs').forEach((el) => el.style.display = isFs ? 'none' : '');
      container.querySelectorAll('.icon-exit-fs').forEach((el) => el.style.display = isFs ? '' : 'none');
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // ---------- Keyboard ----------
    container.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          showControls();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'l':
          e.preventDefault();
          toggleLoop();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          seekToRatio(((videoEl.currentTime || 0) - 5) / state.duration);
          showControls();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekToRatio(((videoEl.currentTime || 0) + 5) / state.duration);
          showControls();
          break;
      }
    });

    // ---------- Initialize ----------
    buildQualityMenu();
    setSource(null); // picks default (480p or first)
    updateMuteUI();
    updatePlayPauseUI();

    // Wire autoplay observer
    state.playAutoplay = playAutoplay;
    state.pause = pause;
    state.play = play;
    state.togglePlay = togglePlay;
    state.toggleMute = toggleMute;
    state.setSource = setSource;
    state.destroy = () => {
      unregisterActive(state);
      if (autoplayObserver) autoplayObserver.unobserve(container);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      videoEl.pause();
      videoEl.src = '';
    };
    container._openframezPlayer = state;
    container.tabIndex = 0;

    if (autoplay) {
      ensureAutoplayObserver();
      autoplayObserver.observe(container);
    }

    return state;
  }

  return { create };
})();
