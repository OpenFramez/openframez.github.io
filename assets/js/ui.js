/**
 * OpenFramez — Shared utilities
 * Theme management, toast notifications, lazy loading, RTL helpers
 */

const UI = (function () {
  // ---------- Theme ----------
  function getStoredTheme() {
    try { return localStorage.getItem('openframez-theme'); } catch (e) { return null; }
  }
  function setStoredTheme(t) {
    try { localStorage.setItem('openframez-theme', t); } catch (e) {}
  }
  function getPreferredTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0a0a0f' : '#fafafa');
  }
  function initTheme() {
    applyTheme(getPreferredTheme());
    // Listen to OS preference changes if no explicit choice
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
    });
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    applyTheme(next);
  }

  // ---------- Toast ----------
  function toast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.setAttribute('role', 'status');
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      t.style.transition = 'all 0.3s';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // ---------- Lazy loading (IntersectionObserver) ----------
  function setupLazyImages(root) {
    const scope = root || document;
    const imgs = scope.querySelectorAll('img[data-src]:not([data-lazy-bound])');
    if (!imgs.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: load all
      imgs.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.setAttribute('data-lazy-bound', '1');
      });
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (!src) return;
            const tmp = new Image();
            tmp.onload = () => {
              img.src = src;
              img.removeAttribute('data-src');
              const card = img.closest('.photo-card');
              if (card) card.classList.add('loaded');
            };
            tmp.onerror = () => {
              img.removeAttribute('data-src');
              const card = img.closest('.photo-card');
              if (card) card.classList.add('loaded');
              img.alt = 'Image failed to load';
            };
            tmp.src = src;
            obs.unobserve(img);
            img.setAttribute('data-lazy-bound', '1');
          }
        });
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );
    imgs.forEach((img) => obs.observe(img));
  }

  // ---------- Escape HTML ----------
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- Initials ----------
  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join('').toUpperCase();
  }

  // ---------- Relative time ----------
  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  // ---------- License URL fallback ----------
  function licenseUrl(license) {
    if (!license) return '';
    const l = license.toLowerCase().replace(/\s+/g, '');
    const map = {
      'ccbysa4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
      'ccbysa3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
      'ccbysa2.5': 'https://creativecommons.org/licenses/by-sa/2.5/',
      'ccby4.0': 'https://creativecommons.org/licenses/by/4.0/',
      'ccby3.0': 'https://creativecommons.org/licenses/by/3.0/',
      'ccby2.5': 'https://creativecommons.org/licenses/by/2.5/',
      'cc0': 'https://creativecommons.org/publicdomain/zero/1.0/',
      'gfdl': 'https://www.gnu.org/copyleft/fdl.html',
    };
    return map[l] || '';
  }

  // ---------- URL helpers ----------
  function photoUrl(id) {
    return `photo.html?id=${encodeURIComponent(id)}`;
  }
  function videoUrl(id) {
    return `video.html?id=${encodeURIComponent(id)}`;
  }

  // ---------- Duration formatter ----------
  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const s = Math.floor(seconds % 60);
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  }

  // ---------- File size formatter ----------
  function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  // ---------- Persian digits ----------
  function toPersianDigits(s) {
    if (s == null) return '';
    return String(s).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  return {
    initTheme,
    toggleTheme,
    toast,
    setupLazyImages,
    escapeHtml,
    initials,
    formatDate,
    formatDuration,
    formatBytes,
    toPersianDigits,
    licenseUrl,
    photoUrl,
    videoUrl,
  };
})();

// Apply theme ASAP to avoid flash
UI.initTheme();

// Register Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

// Re-apply after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();
  // Bind theme toggle buttons
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', UI.toggleTheme);
  });
});
