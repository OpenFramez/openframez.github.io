/**
 * Pixelary — Data Layer
 * Loads photos.json, provides search, filter, paginate APIs.
 */

const Pixelary = (function () {
  let cache = null;
  let cachePromise = null;

  async function load() {
    if (cache) return cache;
    if (cachePromise) return cachePromise;
    cachePromise = fetch('./data/photos.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load photos.json: ' + r.status);
        return r.json();
      })
      .then((data) => {
        cache = data;
        // Pre-build search index
        cache._searchIndex = data.photos.map((p) => {
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
        return cache;
      })
      .catch((err) => {
        cachePromise = null;
        throw err;
      });
    return cachePromise;
  }

  function getById(id) {
    if (!cache) return null;
    return cache.photos.find((p) => p.id === id) || null;
  }

  function getCategories() {
    if (!cache) return [];
    // Count per category
    const counts = {};
    for (const p of cache.photos) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return cache.categories.map((c) => ({ ...c, count: counts[c.slug] || 0 }));
  }

  function getTotal() {
    return cache ? cache.photos.length : 0;
  }

  function filter({ category = null, query = null, sort = 'newest' } = {}) {
    if (!cache) return [];
    let list = cache.photos.slice();
    if (category && category !== 'all') {
      list = list.filter((p) => p.category === category);
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      // Score-based search
      list = list
        .map((p) => {
          const entry = cache._searchIndex.find((e) => e.id === p.id);
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
    if (!cache || !photo) return [];
    return cache.photos
      .filter((p) => p.id !== photo.id && p.category === photo.category)
      .slice(0, limit);
  }

  function getStats() {
    if (!cache) return { total: 0, categories: 0, authors: 0 };
    const authors = new Set(cache.photos.map((p) => p.author));
    return {
      total: cache.photos.length,
      categories: cache.categories.length,
      authors: authors.size,
    };
  }

  return {
    load,
    getById,
    getCategories,
    getTotal,
    filter,
    getRelated,
    getStats,
  };
})();
