/**
 * Pixelary — Data Layer (Phase 1 + Phase 2)
 * Loads photos.json (Phase 1) and videos.json (Phase 2).
 * Provides search, filter, paginate, related-content APIs for both.
 */

const Pixelary = (function () {
  // ---------- Photos cache (Phase 1) ----------
  let photoCache = null;
  let photoPromise = null;

  async function load() {
    if (photoCache) return photoCache;
    if (photoPromise) return photoPromise;
    photoPromise = fetch('./data/photos.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load photos.json: ' + r.status);
        return r.json();
      })
      .then((data) => {
        photoCache = data;
        photoCache._searchIndex = data.photos.map((p) => {
          const text = (
            p.title + ' ' +
            p.description + ' ' +
            p.author + ' ' +
            p.category + ' ' +
            p.category_label + ' ' +
            (p.tags || []).join(' ')
          ).toLowerCase();
          return { id: p.id, text };
        });
        return photoCache;
      })
      .catch((err) => {
        photoPromise = null;
        throw err;
      });
    return photoPromise;
  }

  function getById(id) {
    if (!photoCache) return null;
    return photoCache.photos.find((p) => p.id === id) || null;
  }

  function getCategories() {
    if (!photoCache) return [];
    const counts = {};
    for (const p of photoCache.photos) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return photoCache.categories.map((c) => ({ ...c, count: counts[c.slug] || 0 }));
  }

  function getTotal() {
    return photoCache ? photoCache.photos.length : 0;
  }

  function filter({ category = null, query = null, sort = 'newest' } = {}) {
    if (!photoCache) return [];
    let list = photoCache.photos.slice();
    if (category && category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list
        .map((p) => {
          const entry = photoCache._searchIndex.find((e) => e.id === p.id);
          if (!entry) return { p, score: 0 };
          let score = 0;
          for (const t of tokens) {
            if (entry.text.includes(t)) score += 1;
            if (p.title.toLowerCase().includes(t)) score += 2;
          }
          return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.p);
    }
    if (sort === 'newest') {
      list.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));
    } else if (sort === 'oldest') {
      list.sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
    }
    return list;
  }

  function getRelated(photo, limit = 6) {
    if (!photoCache || !photo) return [];
    return photoCache.photos
      .filter((p) => p.id !== photo.id && p.category === photo.category)
      .slice(0, limit);
  }

  function getStats() {
    if (!photoCache) return { total: 0, categories: 0, authors: 0 };
    const authors = new Set(photoCache.photos.map((p) => p.author));
    return {
      total: photoCache.photos.length,
      categories: photoCache.categories.length,
      authors: authors.size,
    };
  }

  // ---------- Videos cache (Phase 2) ----------
  let videoCache = null;
  let videoPromise = null;

  async function loadVideos() {
    if (videoCache) return videoCache;
    if (videoPromise) return videoPromise;
    videoPromise = fetch('./data/videos.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load videos.json: ' + r.status);
        return r.json();
      })
      .then((data) => {
        videoCache = data;
        videoCache._searchIndex = data.videos.map((v) => {
          const text = (
            v.title + ' ' +
            (v.description || '') + ' ' +
            (v.artist || '') + ' ' +
            v.category + ' ' +
            (v.category_label || '') + ' ' +
            (v.credit || '')
          ).toLowerCase();
          return { id: v.id, text };
        });
        return videoCache;
      })
      .catch((err) => {
        videoPromise = null;
        throw err;
      });
    return videoPromise;
  }

  function getVideoById(id) {
    if (!videoCache) return null;
    return videoCache.videos.find((v) => v.id === id) || null;
  }

  function getVideoCategories() {
    if (!videoCache) return [];
    const counts = {};
    for (const v of videoCache.videos) {
      counts[v.category] = (counts[v.category] || 0) + 1;
    }
    return videoCache.categories
      .map((c) => ({ ...c, count: counts[c.slug] || 0 }))
      .filter((c) => c.count > 0); // hide empty categories
  }

  function getVideoTotal() {
    return videoCache ? videoCache.videos.length : 0;
  }

  function filterVideos({ category = null, query = null, sort = 'newest' } = {}) {
    if (!videoCache) return [];
    let list = videoCache.videos.slice();
    if (category && category !== 'all') {
      list = list.filter((v) => v.category === category);
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list
        .map((v) => {
          const entry = videoCache._searchIndex.find((e) => e.id === v.id);
          if (!entry) return { v, score: 0 };
          let score = 0;
          for (const t of tokens) {
            if (entry.text.includes(t)) score += 1;
            if (v.title.toLowerCase().includes(t)) score += 2;
          }
          return { v, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.v);
    }
    if (sort === 'newest') {
      list.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));
    } else if (sort === 'oldest') {
      list.sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
    } else if (sort === 'shortest') {
      list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    } else if (sort === 'longest') {
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return list;
  }

  function getVideoRelated(video, limit = 6) {
    if (!videoCache || !video) return [];
    // Prefer same category, fall back to others
    const sameCat = videoCache.videos.filter(
      (v) => v.id !== video.id && v.category === video.category
    );
    const others = videoCache.videos.filter(
      (v) => v.id !== video.id && v.category !== video.category
    );
    return sameCat.concat(others).slice(0, limit);
  }

  function getVideoStats() {
    if (!videoCache) return { total: 0, categories: 0, authors: 0, totalDuration: 0 };
    const authors = new Set(videoCache.videos.map((v) => v.artist));
    const totalDuration = videoCache.videos.reduce((s, v) => s + (v.duration || 0), 0);
    const usedCategories = new Set(videoCache.videos.map((v) => v.category));
    return {
      total: videoCache.videos.length,
      categories: usedCategories.size,
      authors: authors.size,
      totalDuration: Math.round(totalDuration),
    };
  }

  return {
    // Photos (Phase 1)
    load,
    getById,
    getCategories,
    getTotal,
    filter,
    getRelated,
    getStats,
    // Videos (Phase 2)
    loadVideos,
    getVideoById,
    getVideoCategories,
    getVideoTotal,
    filterVideos,
    getVideoRelated,
    getVideoStats,
  };
})();
