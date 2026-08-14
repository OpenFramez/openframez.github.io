/**
 * OpenFramez — Data Layer (Phase 1 + Phase 2)
 * Loads photos.json (Phase 1) and videos.json (Phase 2).
 * Provides search, filter, paginate, related-content APIs for both.
 */

const OpenFramez = (function () {
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

  // ---------- Internet Archive videos cache (Phase 2.5) ----------
  let iaCache = null;
  let iaPromise = null;

  async function loadIAVideos() {
    if (iaCache) return iaCache;
    if (iaPromise) return iaPromise;
    iaPromise = fetch('./data/videos_ia.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load videos_ia.json: ' + r.status);
        return r.json();
      })
      .then((data) => {
        iaCache = data;
        iaCache._searchIndex = data.videos.map((v) => {
          const text = (
            v.title + ' ' +
            (v.description || '') + ' ' +
            (v.artist || '') + ' ' +
            v.category + ' ' +
            (v.category_label || '') + ' ' +
            (v.credit || '') + ' ' +
            (v.collection || '')
          ).toLowerCase();
          return { id: v.id, text };
        });
        return iaCache;
      })
      .catch((err) => {
        iaPromise = null;
        throw err;
      });
    return iaPromise;
  }

  function getIAVideoById(id) {
    if (!iaCache) return null;
    return iaCache.videos.find((v) => v.id === id) || null;
  }

  function getIAVideoCategories() {
    if (!iaCache) return [];
    const counts = {};
    for (const v of iaCache.videos) {
      counts[v.category] = (counts[v.category] || 0) + 1;
    }
    return (iaCache.categories || [])
      .map((c) => ({ ...c, count: counts[c.slug] || 0 }))
      .filter((c) => c.count > 0);
  }

  function getIAVideoTotal() {
    return iaCache ? iaCache.videos.length : 0;
  }

  function filterIAVideos({ category = null, query = null, sort = 'newest' } = {}) {
    if (!iaCache) return [];
    let list = iaCache.videos.slice();
    if (category && category !== 'all') {
      list = list.filter((v) => v.category === category);
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list
        .map((v) => {
          const entry = iaCache._searchIndex.find((e) => e.id === v.id);
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

  /**
   * Unified lookup: search both Wikimedia and IA video caches.
   * Used by video.html so detail page works for both sources.
   */
  function getAnyVideoById(id) {
    if (!id) return null;
    // IA IDs start with "ia_"
    if (id.startsWith('ia_')) return getIAVideoById(id);
    return getVideoById(id);
  }

  /**
   * Combined filter across both caches — useful for unified galleries.
   */
  function filterAllVideos({ category = null, query = null, sort = 'newest' } = {}) {
    const wm = filterVideos({ category, query, sort });
    const ia = filterIAVideos({ category, query, sort });
    // Interleave: 1 from each, alternating
    const merged = [];
    const maxLen = Math.max(wm.length, ia.length);
    for (let i = 0; i < maxLen; i++) {
      if (ia[i]) merged.push(ia[i]);
      if (wm[i]) merged.push(wm[i]);
    }
    // Re-sort the merged list by upload date if requested
    if (sort === 'newest') {
      merged.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));
    } else if (sort === 'oldest') {
      merged.sort((a, b) => (a.uploaded_at || '').localeCompare(b.uploaded_at || ''));
    } else if (sort === 'shortest') {
      merged.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    } else if (sort === 'longest') {
      merged.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return merged;
  }

  function getCombinedVideoStats() {
    const wmStats = getVideoStats();
    const iaStats = iaCache ? {
      total: iaCache.videos.length,
      authors: new Set(iaCache.videos.map((v) => v.artist)).size,
      totalDuration: iaCache.videos.reduce((s, v) => s + (v.duration || 0), 0),
    } : { total: 0, authors: 0, totalDuration: 0 };
    return {
      total: wmStats.total + iaStats.total,
      authors: wmStats.authors + iaStats.authors,
      totalDuration: wmStats.totalDuration + iaStats.totalDuration,
      // For category count, deduplicate by slug since both sources may share slugs
      categories: new Set([
        ...((videoCache && videoCache.categories.map((c) => c.slug)) || []),
        ...((iaCache && iaCache.categories.map((c) => c.slug)) || []),
      ]).size,
    };
  }

  /**
   * Combined categories across Wikimedia + Internet Archive video caches.
   * Merges counts for shared slugs, preserves label from whichever source
   * defines it first (Wikimedia preferred since it has more categories).
   */
  function getAllVideoCategories() {
    const counts = {};
    const labels = {};
    if (videoCache) {
      for (const v of videoCache.videos) {
        counts[v.category] = (counts[v.category] || 0) + 1;
        if (!labels[v.category]) labels[v.category] = v.category_label || v.category;
      }
    }
    if (iaCache) {
      for (const v of iaCache.videos) {
        counts[v.category] = (counts[v.category] || 0) + 1;
        if (!labels[v.category]) labels[v.category] = v.category_label || v.category;
      }
    }
    // Merge with category metadata from both sources
    const seen = new Set();
    const merged = [];
    if (videoCache) {
      for (const c of videoCache.categories) {
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        merged.push({ slug: c.slug, label: c.label, count: counts[c.slug] || 0 });
      }
    }
    if (iaCache) {
      for (const c of iaCache.categories) {
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        merged.push({ slug: c.slug, label: c.label, count: counts[c.slug] || 0 });
      }
    }
    // Add any stragglers (categories that appear in videos but not in metadata)
    for (const [slug, label] of Object.entries(labels)) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      merged.push({ slug, label, count: counts[slug] || 0 });
    }
    return merged.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }

  /**
   * Load both Wikimedia and IA video caches in parallel.
   * Returns once both are loaded (or failed). IA failure is non-fatal.
   */
  async function loadAllVideos() {
    const promises = [loadVideos()];
    promises.push(
      loadIAVideos().catch((err) => {
        console.warn('IA videos failed to load, continuing with Wikimedia only:', err);
        return null;
      })
    );
    await Promise.all(promises);
    return {
      wikimedia: videoCache,
      internetArchive: iaCache,
    };
  }

  /**
   * Combined related-videos lookup across both caches.
   * Prefers same-category from the same source, then cross-source, then any.
   */
  function getAllVideoRelated(video, limit = 10) {
    if (!video) return [];
    const same = [];
    const sameCatOtherSource = [];
    const others = [];

    const isIa = video.source === 'Internet Archive';

    if (videoCache) {
      for (const v of videoCache.videos) {
        if (v.id === video.id) continue;
        if (v.category === video.category) {
          if (!isIa) same.push(v);
          else sameCatOtherSource.push(v);
        } else {
          others.push(v);
        }
      }
    }
    if (iaCache) {
      for (const v of iaCache.videos) {
        if (v.id === video.id) continue;
        if (v.category === video.category) {
          if (isIa) same.push(v);
          else sameCatOtherSource.push(v);
        } else {
          others.push(v);
        }
      }
    }

    // Interleave same-cat (same source) with same-cat (other source), then others
    const merged = [];
    const maxSame = Math.max(same.length, sameCatOtherSource.length);
    for (let i = 0; i < maxSame; i++) {
      if (same[i]) merged.push(same[i]);
      if (sameCatOtherSource[i]) merged.push(sameCatOtherSource[i]);
    }
    for (const v of others) merged.push(v);
    return merged.slice(0, limit);
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
    // Videos (Phase 2 — Wikimedia)
    loadVideos,
    getVideoById,
    getVideoCategories,
    getVideoTotal,
    filterVideos,
    getVideoRelated,
    getVideoStats,
    // Internet Archive Videos (Phase 2.5)
    loadIAVideos,
    getIAVideoById,
    getIAVideoCategories,
    getIAVideoTotal,
    filterIAVideos,
    // Combined (Wikimedia + IA)
    loadAllVideos,
    getAnyVideoById,
    filterAllVideos,
    getCombinedVideoStats,
    getAllVideoCategories,
    getAllVideoRelated,
  };
})();
