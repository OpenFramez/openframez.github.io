/**
 * OpenFramez — Federated Content Layer (Phase 5)
 *
 * Reads the central registry at data/registry.json and the aggregated
 * federated.json that the GitHub Action produces hourly.
 *
 * federated.json structure:
 *   {
 *     "last_aggregated": "2026-08-12T10:00:00Z",
 *     "users": 3,
 *     "total_photos": 12,
 *     "total_videos": 5,
 *     "items": [
 *       {
 *         "id": "fu_0001",
 *         "type": "photo",
 *         "title": "...",
 *         "description": "...",
 *         "category": "nature",
 *         "author": "alice",
 *         "license": "CC BY 4.0",
 *         "source_user": "alice",
 *         "source_repo": "openframez-uploads",
 *         "source_url": "https://github.com/alice/openframez-uploads",
 *         "file_url": "https://alice.github.io/openframez-uploads/uploads/...",
 *         "thumbnail_url": "https://alice.github.io/openframez-uploads/uploads/...",
 *         "uploaded_at": "2026-08-12T10:30:00Z",
 *         "width": 1920, "height": 1080,
 *         "duration": 0,
 *         "size_bytes": 1234567
 *       },
 *       ...
 *     ]
 *   }
 *
 * The aggregator (scripts/aggregate_federation.py) is run by a GitHub Action
 * that triggers on schedule (hourly) and on changes to data/registry.json.
 *
 * @author OpenFramez Team
 */

window.OpenFramezFederation = (function () {
  'use strict';

  var FEDERATED_URL = './data/federated.json';
  var REGISTRY_URL = './data/registry.json';

  var fedCache = null;
  var fedPromise = null;
  var registryCache = null;

  // ---------- Load aggregated federated content ----------
  async function load() {
    if (fedCache) return fedCache;
    if (fedPromise) return fedPromise;

    fedPromise = fetch(FEDERATED_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) {
          // 404 is OK — no federated content yet, return empty
          if (r.status === 404) {
            return { items: [], users: 0, total_photos: 0, total_videos: 0, last_aggregated: null };
          }
          throw new Error('Failed to load federated.json: ' + r.status);
        }
        return r.json();
      })
      .then(function (data) {
        fedCache = data;
        fedCache.items = fedCache.items || [];

        // Build search index
        fedCache._searchIndex = fedCache.items.map(function (item) {
          var text = (
            item.title + ' ' +
            (item.description || '') + ' ' +
            (item.author || '') + ' ' +
            item.category + ' ' +
            (item.category_label || '') + ' ' +
            (item.source_user || '') + ' ' +
            (item.tags || []).join(' ')
          ).toLowerCase();
          return { id: item.id, text: text };
        });

        return fedCache;
      })
      .catch(function (err) {
        fedPromise = null;
        console.warn('Federated content load failed (non-fatal):', err);
        // Return empty on failure so site doesn't break
        return { items: [], users: 0, total_photos: 0, total_videos: 0, last_aggregated: null, _searchIndex: [] };
      });

    return fedPromise;
  }

  // ---------- Load central registry (list of registered users) ----------
  async function loadRegistry() {
    if (registryCache) return registryCache;
    return fetch(REGISTRY_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) {
          if (r.status === 404) return { users: [], last_updated: null };
          throw new Error('Failed to load registry: ' + r.status);
        }
        return r.json();
      })
      .then(function (data) {
        registryCache = data;
        return data;
      })
      .catch(function (err) {
        console.warn('Registry load failed:', err);
        return { users: [], last_updated: null };
      });
  }

  // ---------- Getters ----------
  function getById(id) {
    if (!fedCache) return null;
    return fedCache.items.find(function (i) { return i.id === id; }) || null;
  }

  function getPhotos() {
    if (!fedCache) return [];
    return fedCache.items.filter(function (i) { return i.type === 'photo'; });
  }

  function getVideos() {
    if (!fedCache) return [];
    return fedCache.items.filter(function (i) { return i.type === 'video'; });
  }

  function getTotal() {
    return fedCache ? fedCache.items.length : 0;
  }

  function getPhotosTotal() {
    if (!fedCache) return 0;
    return fedCache.items.filter(function (i) { return i.type === 'photo'; }).length;
  }

  function getVideosTotal() {
    if (!fedCache) return 0;
    return fedCache.items.filter(function (i) { return i.type === 'video'; }).length;
  }

  function getContributorsCount() {
    if (!fedCache) return 0;
    var set = {};
    fedCache.items.forEach(function (i) { set[i.source_user] = true; });
    return Object.keys(set).length;
  }

  function getCategories() {
    if (!fedCache) return [];
    var counts = {};
    var labels = {};
    fedCache.items.forEach(function (i) {
      counts[i.category] = (counts[i.category] || 0) + 1;
      if (!labels[i.category]) labels[i.category] = i.category_label || i.category;
    });
    return Object.keys(counts).map(function (slug) {
      return { slug: slug, label: labels[slug], count: counts[slug] };
    }).sort(function (a, b) { return b.count - a.count; });
  }

  // ---------- Filter ----------
  function filter(opts) {
    opts = opts || {};
    if (!fedCache) return [];
    var list = fedCache.items.slice();

    if (opts.type) list = list.filter(function (i) { return i.type === opts.type; });

    if (opts.category && opts.category !== 'all') {
      list = list.filter(function (i) { return i.category === opts.category; });
    }

    if (opts.query && opts.query.trim()) {
      var q = opts.query.trim().toLowerCase();
      var tokens = q.split(/\s+/).filter(Boolean);
      list = list
        .map(function (i) {
          var entry = fedCache._searchIndex.find(function (e) { return e.id === i.id; });
          if (!entry) return { i: i, score: 0 };
          var score = 0;
          tokens.forEach(function (t) {
            if (entry.text.indexOf(t) >= 0) score += 1;
            if (i.title.toLowerCase().indexOf(t) >= 0) score += 2;
          });
          return { i: i, score: score };
        })
        .filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (x) { return x.i; });
    }

    if (opts.sort === 'newest') {
      list.sort(function (a, b) { return (b.uploaded_at || '').localeCompare(a.uploaded_at || ''); });
    } else if (opts.sort === 'oldest') {
      list.sort(function (a, b) { return (a.uploaded_at || '').localeCompare(b.uploaded_at || ''); });
    } else if (opts.sort === 'shortest') {
      list.sort(function (a, b) { return (a.duration || 0) - (b.duration || 0); });
    } else if (opts.sort === 'longest') {
      list.sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); });
    }

    return list;
  }

  function getRelated(item, limit) {
    limit = limit || 6;
    if (!fedCache || !item) return [];
    var same = fedCache.items.filter(function (i) {
      return i.id !== item.id && i.category === item.category;
    });
    var others = fedCache.items.filter(function (i) {
      return i.id !== item.id && i.category !== item.category;
    });
    return same.concat(others).slice(0, limit);
  }

  function getStats() {
    if (!fedCache) return { total: 0, photos: 0, videos: 0, contributors: 0, categories: 0 };
    return {
      total: fedCache.items.length,
      photos: getPhotosTotal(),
      videos: getVideosTotal(),
      contributors: getContributorsCount(),
      categories: getCategories().length,
      last_aggregated: fedCache.last_aggregated || null,
    };
  }

  return {
    load: load,
    loadRegistry: loadRegistry,
    getById: getById,
    getPhotos: getPhotos,
    getVideos: getVideos,
    getTotal: getTotal,
    getPhotosTotal: getPhotosTotal,
    getVideosTotal: getVideosTotal,
    getContributorsCount: getContributorsCount,
    getCategories: getCategories,
    filter: filter,
    getRelated: getRelated,
    getStats: getStats,
  };
})();
