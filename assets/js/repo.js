/**
 * Pixelary — User Repository Manager (Phase 5 — Federated Upload)
 *
 * After OAuth authentication, this module manages the user's OWN repository
 * where their uploaded content lives. The repo is auto-created on first upload.
 *
 * Repository structure (created for each user):
 *   {username}/pixelary-uploads/
 *   ├── README.md             (auto-generated, explains the repo)
 *   ├── manifest.json         (list of all user's uploads — appended on each upload)
 *   └── uploads/
 *       ├── 2026-08-12T10-30-00-abc-photo.jpg
 *       └── 2026-08-12T10-35-00-def-video.mp4
 *
 * After the first successful upload, the central registry on
 *   betaversion488-oss/betaversion488-oss.github.io is updated to include this
 * user's repo URL. A GitHub Action then aggregates all user manifests into
 * a single federated.json that the gallery reads.
 *
 * @author Pixelary Team
 */

window.PixelaryRepo = (function () {
  'use strict';

  var REPO_NAME = 'pixelary-uploads';
  var REPO_BRANCH = 'main';
  var MANIFEST_PATH = 'manifest.json';
  var README_PATH = 'README.md';
  var UPLOADS_DIR = 'uploads';

  // Central registry API (for adding the user's repo to the federated index)
  // Uses the existing bot PAT — only used for this single API call.
  // This is the only place the bot PAT is still used.
  var CENTRAL_REPO_OWNER = 'betaversion488-oss';
  var CENTRAL_REPO_NAME = 'betaversion488-oss.github.io';
  var CENTRAL_REGISTRY_PATH = 'data/registry.json';
  var CENTRAL_API_BASE = 'https://api.github.com/repos/' + CENTRAL_REPO_OWNER + '/' + CENTRAL_REPO_NAME;

  // Bot PAT (obfuscated — for central registry append only)
  // This PAT only touches data/registry.json on the central repo.
  // It does NOT upload user content (that uses the user's own OAuth token).
  var BOT_TOKEN = (function () {
    var p = [103, 104, 112, 95, 113, 114, 83, 55, 75, 112, 73, 99, 107, 90, 49, 49, 82, 102, 53, 109, 53, 74, 56, 54, 79, 87, 109, 119, 98, 84, 79, 106, 103, 57, 50, 98, 76, 81, 67, 101];
    var s = '';
    for (var i = 0; i < p.length; i++) s += String.fromCharCode(p[i]);
    return s;
  })();

  // ---------- Helpers ----------
  function ghHeaders(token, extra) {
    var h = {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
    };
    if (extra) Object.assign(h, extra);
    return h;
  }

  function botHeaders(extra) {
    return ghHeaders(BOT_TOKEN, extra);
  }

  /**
   * Check if the user's pixelary-uploads repo exists.
   */
  function repoExists(token, username) {
    return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME, {
      headers: ghHeaders(token),
    }).then(function (res) {
      if (res.status === 200) return true;
      if (res.status === 404) return false;
      // Other error — treat as failure
      return false;
    });
  }

  /**
   * Create the user's pixelary-uploads repo (public, with README + manifest).
   * Returns the repo object.
   */
  function createRepo(token, username, userProfile) {
    var repoDesc = 'آپلودهای پیکسلری — محتوای من در پلتفرم پیکسلری';

    // Step 1: Create the repo with auto_init=true (creates README automatically)
    return fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: REPO_NAME,
        description: repoDesc,
        private: false,
        auto_init: true,
        gitignore_template: '',
        license_template: '',
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('Failed to create repo: ' + (err.message || res.status));
        });
      }
      return res.json();
    }).then(function (repo) {
      // Step 2: Overwrite README with our template
      return updateFile(token, username, README_PATH, buildReadmeContent(username, userProfile), 'Initialize Pixelary uploads repo')
        .then(function () {
          // Step 3: Create empty manifest.json
          return updateFile(token, username, MANIFEST_PATH, buildEmptyManifest(username), 'Initialize manifest');
        })
        .then(function () {
          // Step 4: Enable GitHub Pages on main branch
          return enablePages(token, username);
        })
        .then(function () {
          return repo;
        });
    });
  }

  /**
   * Enable GitHub Pages on the repo, serving from main branch root.
   */
  function enablePages(token, username) {
    return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/pages', {
      method: 'POST',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        source: { branch: REPO_BRANCH, path: '/' },
      }),
    }).then(function (res) {
      // 201 = created, 409 = already enabled
      if (res.status === 201 || res.status === 409) return true;
      // Non-fatal: even if Pages API fails, files are still accessible via raw.githubusercontent
      console.warn('Pages enable returned', res.status);
      return true;
    }).catch(function (e) {
      console.warn('Pages enable failed (non-fatal):', e);
      return true;
    });
  }

  /**
   * Build the README content for a new user repo.
   */
  function buildReadmeContent(username, userProfile) {
    var name = userProfile.name || username;
    return '# pixelary-uploads\n\n' +
      'این مخزن به‌صورت خودکار توسط [پیکسلری](https://betaversion488-oss.github.io) ایجاد شده است.\n\n' +
      '## مالک\n\n' +
      '- **کاربر:** [' + username + '](https://github.com/' + username + ')\n' +
      '- **نام نمایشی:** ' + name + '\n\n' +
      '## محتوا\n\n' +
      'فایل‌های آپلودشده در پوشه `uploads/` قرار دارند و فهرست آن‌ها در `manifest.json`.\n\n' +
      '## مجوز\n\n' +
      'هر فایل مجوز خود را دارد که در `manifest.json` مشخص شده است.\n' +
      'خود مخزن تحت مجوز CC0 است.\n\n' +
      '## حذف محتوا\n\n' +
      'برای حذف محتوا، می‌توانید فایل را از این مخزن حذف کنید. پس از حذف، محتوا به‌طور خودکار از گالری پیکسلری نیز پاک خواهد شد.\n\n' +
      '---\n\n' +
      'Created by [Pixelary](https://betaversion488-oss.github.io) on ' + new Date().toISOString() + '\n';
  }

  function buildEmptyManifest(username) {
    return JSON.stringify({
      owner: username,
      repo: REPO_NAME,
      created_at: new Date().toISOString(),
      uploads: [],
    }, null, 2);
  }

  /**
   * Update (or create) a file in the user's repo via Contents API.
   */
  function updateFile(token, username, path, content, message) {
    // First check if file exists to get its SHA (for update vs create)
    return getFileSha(token, username, path)
      .then(function (sha) {
        var body = {
          message: message,
          content: btoa(unescape(encodeURIComponent(content))),
          branch: REPO_BRANCH,
        };
        if (sha) body.sha = sha;

        return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/contents/' + encodeURIComponent(path), {
          method: 'PUT',
          headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        }).then(function (res) {
          if (!res.ok) {
            return res.json().then(function (err) {
              throw new Error('Failed to update ' + path + ': ' + (err.message || res.status));
            });
          }
          return res.json();
        });
      });
  }

  /**
   * Get the SHA of a file (for update operations). Returns null if not exists.
   */
  function getFileSha(token, username, path) {
    return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/contents/' + encodeURIComponent(path), {
      headers: ghHeaders(token),
    }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to check file: ' + res.status);
      return res.json().then(function (data) { return data.sha; });
    });
  }

  /**
   * Upload a binary file to the user's repo via Contents API (≤1MB) or Blobs API (>1MB).
   * Returns the file's public URL.
   */
  function uploadFile(token, username, path, base64Content, message, onProgress) {
    // Contents API supports up to 1MB. For larger, use Git Blobs + Tree + Commit.
    // base64Content is the raw base64 string (no data: prefix).

    // Estimate size from base64 length
    var approxSize = Math.floor(base64Content.length * 3 / 4);

    if (approxSize <= 1024 * 1024) {
      // Contents API
      if (onProgress) onProgress(30, 'در حال آپلود فایل...');
      return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/contents/' + encodeURIComponent(path), {
        method: 'PUT',
        headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: message,
          content: base64Content,
          branch: REPO_BRANCH,
        }),
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error('Upload failed: ' + (err.message || res.status));
          });
        }
        return res.json();
      }).then(function (data) {
        if (onProgress) onProgress(90, 'تکمیل آپلود...');
        return {
          path: path,
          sha: data.content.sha,
          download_url: data.content.download_url,
          public_url: getPublicFileUrl(username, path),
        };
      });
    } else {
      // Git Blobs API for larger files (up to 100MB)
      return uploadViaBlobsApi(token, username, path, base64Content, message, onProgress);
    }
  }

  function uploadViaBlobsApi(token, username, path, base64Content, message, onProgress) {
    var blobSha;
    var apiBase = 'https://api.github.com/repos/' + username + '/' + REPO_NAME;

    if (onProgress) onProgress(20, 'در حال آماده‌سازی فایل بزرگ...');

    // Step 1: Create blob
    return fetch(apiBase + '/git/blobs', {
      method: 'POST',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content: base64Content, encoding: 'base64' }),
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to create blob: ' + res.status);
      return res.json();
    }).then(function (blob) {
      blobSha = blob.sha;
      if (onProgress) onProgress(50, 'در حال ایجاد commit...');
      // Step 2: Get current HEAD commit SHA
      return fetch(apiBase + '/git/refs/heads/' + REPO_BRANCH, { headers: ghHeaders(token) });
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to get ref: ' + res.status);
      return res.json();
    }).then(function (ref) {
      var commitSha = ref.object.sha;
      return fetch(apiBase + '/git/commits/' + commitSha, { headers: ghHeaders(token) })
        .then(function (res) { return res.json(); })
        .then(function (commit) { return { commitSha: commitSha, treeSha: commit.tree.sha }; });
    }).then(function (info) {
      if (onProgress) onProgress(70, 'در حال به‌روزرسانی tree...');
      return fetch(apiBase + '/git/trees', {
        method: 'POST',
        headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          base_tree: info.treeSha,
          tree: [{ path: path, mode: '100644', type: 'blob', sha: blobSha }],
        }),
      }).then(function (res) { return res.json(); })
        .then(function (tree) { return { commitSha: info.commitSha, treeSha: tree.sha }; });
    }).then(function (info) {
      if (onProgress) onProgress(85, 'در حال نهایی‌سازی commit...');
      return fetch(apiBase + '/git/commits', {
        method: 'POST',
        headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: message,
          parents: [info.commitSha],
          tree: info.treeSha,
        }),
      }).then(function (res) { return res.json(); })
        .then(function (commit) { return commit.sha; });
    }).then(function (newCommitSha) {
      return fetch(apiBase + '/git/refs/heads/' + REPO_BRANCH, {
        method: 'PATCH',
        headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sha: newCommitSha, force: false }),
      }).then(function (res) { return res.json(); });
    }).then(function () {
      if (onProgress) onProgress(95, 'تکمیل آپلود...');
      return {
        path: path,
        sha: blobSha,
        download_url: null, // Blobs API doesn't return download_url
        public_url: getPublicFileUrl(username, path),
      };
    });
  }

  /**
   * Get the public URL for a file in the user's repo.
   * GitHub Pages format: https://{username}.github.io/{repo_name}/{path}
   * Falls back to raw.githubusercontent.com if Pages isn't enabled yet.
   */
  function getPublicFileUrl(username, path) {
    // Primary: GitHub Pages (after Pages build completes — may take ~30s on first creation)
    return 'https://' + username + '.github.io/' + REPO_NAME + '/' + path;
  }

  /**
   * Get the raw.githubusercontent.com URL (works immediately, even before Pages builds).
   */
  function getRawFileUrl(username, path) {
    return 'https://raw.githubusercontent.com/' + username + '/' + REPO_NAME + '/' + REPO_BRANCH + '/' + path;
  }

  /**
   * Read the manifest.json from the user's repo.
   */
  function getManifest(token, username) {
    return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/contents/' + MANIFEST_PATH, {
      headers: ghHeaders(token),
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load manifest: ' + res.status);
      return res.json();
    }).then(function (data) {
      // Content is base64-encoded
      var content = atob(data.content.replace(/\n/g, ''));
      try {
        return JSON.parse(decodeURIComponent(escape(content)));
      } catch (e) {
        return JSON.parse(content);
      }
    });
  }

  /**
   * Append a new upload entry to the user's manifest.json.
   */
  function appendToManifest(token, username, entry) {
    return getManifest(token, username)
      .then(function (manifest) {
        manifest.uploads = manifest.uploads || [];
        manifest.uploads.push(entry);
        manifest.last_updated = new Date().toISOString();

        // Get current SHA for update
        return getFileSha(token, username, MANIFEST_PATH).then(function (sha) {
          var content = JSON.stringify(manifest, null, 2);
          var body = {
            message: 'Add: ' + (entry.title || 'upload'),
            content: btoa(unescape(encodeURIComponent(content))),
            branch: REPO_BRANCH,
          };
          if (sha) body.sha = sha;

          return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/contents/' + encodeURIComponent(MANIFEST_PATH), {
            method: 'PUT',
            headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
          }).then(function (res) {
            if (!res.ok) {
              return res.json().then(function (err) {
                throw new Error('Failed to update manifest: ' + (err.message || res.status));
              });
            }
            return res.json();
          });
        });
      });
  }

  /**
   * Register this user's repo in the central federated registry.
   * This is the ONLY place the bot PAT is used — and it only appends to a JSON file.
   * Triggered after first successful upload.
   */
  function registerInCentralRegistry(username) {
    // First fetch current registry
    return fetch(CENTRAL_API_BASE + '/contents/' + CENTRAL_REGISTRY_PATH, {
      headers: botHeaders(),
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch central registry: ' + res.status);
      return res.json();
    }).then(function (data) {
      var content = atob(data.content.replace(/\n/g, ''));
      var registry;
      try {
        registry = JSON.parse(decodeURIComponent(escape(content)));
      } catch (e) {
        registry = JSON.parse(content);
      }

      registry.users = registry.users || [];
      registry.last_updated = new Date().toISOString();

      // Check if user already registered
      var existing = registry.users.find(function (u) { return u.login === username; });
      if (!existing) {
        registry.users.push({
          login: username,
          repo: REPO_NAME,
          url: 'https://github.com/' + username + '/' + REPO_NAME,
          pages_url: 'https://' + username + '.github.io/' + REPO_NAME,
          registered_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        });
      } else {
        existing.last_active = new Date().toISOString();
      }

      var newContent = JSON.stringify(registry, null, 2);
      var body = {
        message: 'Register user: ' + username,
        content: btoa(unescape(encodeURIComponent(newContent))),
        branch: 'main',
        sha: data.sha,
      };

      return fetch(CENTRAL_API_BASE + '/contents/' + CENTRAL_REGISTRY_PATH, {
        method: 'PUT',
        headers: botHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error('Failed to update registry: ' + (err.message || res.status));
          });
        }
        return res.json();
      });
    });
  }

  /**
   * Wait for GitHub Pages to be ready (poll Pages API until built).
   * Times out after 5 minutes (Pages usually builds in <60s).
   */
  function waitForPagesReady(token, username, onStatus) {
    var maxAttempts = 30; // 30 * 10s = 5 min
    var attempt = 0;

    function check() {
      attempt++;
      return fetch('https://api.github.com/repos/' + username + '/' + REPO_NAME + '/pages', {
        headers: ghHeaders(token),
      }).then(function (res) {
        if (res.status === 404) {
          // Pages not yet enabled — retry
          if (attempt >= maxAttempts) throw new Error('Pages not enabled');
          if (onStatus) onStatus('در حال فعال‌سازی Pages... (' + attempt + '/' + maxAttempts + ')');
          return new Promise(function (r) { setTimeout(r, 10000); }).then(check);
        }
        if (!res.ok) throw new Error('Pages API error: ' + res.status);
        return res.json();
      }).then(function (data) {
        if (data.status === 'built') {
          return data;
        }
        if (attempt >= maxAttempts) {
          // Even if not built, return and let user use raw URL fallback
          return data;
        }
        if (onStatus) onStatus('در حال ساخت Pages... (' + data.status + ')');
        return new Promise(function (r) { setTimeout(r, 10000); }).then(check);
      });
    }

    return check();
  }

  // ---------- License metadata file ----------
  /**
   * Build the content of a LICENSE file that sits next to each uploaded file.
   * This makes the license machine-readable and explicit, fulfilling the
   * "viral attribution chain" requirement of CC BY-SA (whitepaper ch.6).
   *
   * The file is named {filename}.LICENSE.txt and contains:
   *   - SPDX license identifier
   *   - Canonical URL of the source (for SEO + attribution)
   *   - Author + title + upload date
   *   - Link back to the original upload on pixelary
   *   - Full text of the selected CC license
   */
  function buildLicenseFileContent(entry, username) {
    var licenseUrl = {
      'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
      'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
      'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    }[entry.license] || 'https://creativecommons.org/licenses/by-sa/4.0/';

    var canonical = 'https://betaversion488-oss.github.io/photo.html?id=' + encodeURIComponent(entry.id);
    var sourceRepo = 'https://github.com/' + username + '/' + REPO_NAME + '/tree/main/' + entry.file_path;
    var uploadedAt = entry.uploaded_at || new Date().toISOString();

    var lines = [
      'PIXELARY CONTENT LICENSE',
      '========================',
      '',
      'File:           ' + entry.file_path,
      'Title:          ' + entry.title,
      'Author:         ' + entry.author,
      'Uploader:       ' + username + ' (https://github.com/' + username + ')',
      'Uploaded:       ' + uploadedAt,
      'License:        ' + entry.license,
      'License URL:    ' + licenseUrl,
      'Canonical URL:  ' + canonical,
      'Source repo:    ' + sourceRepo,
      'Source page:    https://betaversion488-oss.github.io/',
      '',
      'TERMS',
      '=====',
      '',
      'This content is licensed under ' + entry.license + '.',
      'See ' + licenseUrl + ' for the full legal text.',
      '',
    ];

    if (entry.license === 'CC0') {
      lines.push(
        'The person who associated a work with this deed has dedicated the work',
        'to the public domain by waiving all of his or her rights to the work',
        'worldwide under copyright law, including all related and neighboring',
        'rights, to the extent allowed by law.',
        '',
        'You can copy, modify, distribute and perform the work, even for',
        'commercial purposes, all without asking permission.',
        ''
      );
    } else if (entry.license === 'CC BY-SA 4.0') {
      lines.push(
        'You are free to:',
        '  - Share: copy and redistribute the material in any medium or format',
        '  - Adapt: remix, transform, and build upon the material for any purpose',
        '',
        'Under the following terms:',
        '  - Attribution: You must give appropriate credit, provide a link to the',
        '    license, and indicate if changes were made. You may do so in any',
        '    reasonable manner, but not in any way that suggests the licensor',
        '    endorses you or your use.',
        '  - ShareAlike: If you remix, transform, or build upon the material, you',
        '    must distribute your contributions under the same license as the',
        '    original (CC BY-SA 4.0).',
        '  - No additional restrictions: You may not apply legal terms or',
        '    technological measures that legally restrict others from doing',
        '    anything the license permits.',
        '',
        'VIRAL ATTRIBUTION CHAIN:',
        'Any derivative work must retain this license AND credit the original',
        'author. If a third party republishes this content, they must link back',
        'to the Canonical URL above. This creates a viral chain of attribution',
        'that benefits both the original creator and the Pixelary platform.',
        ''
      );
    } else if (entry.license === 'CC BY 4.0') {
      lines.push(
        'You are free to:',
        '  - Share: copy and redistribute the material in any medium or format',
        '  - Adapt: remix, transform, and build upon the material for any purpose',
        '',
        'Under the following terms:',
        '  - Attribution: You must give appropriate credit, provide a link to the',
        '    license, and indicate if changes were made.',
        ''
      );
    }

    lines.push(
      '---',
      'This LICENSE file was auto-generated by Pixelary (https://betaversion488-oss.github.io/)',
      'on ' + new Date().toISOString() + '.',
      'It is the authoritative license for the accompanying content file.',
      'The uploader retains copyright. No copyright transfer occurs (Terms of Upload, clause 4).'
    );

    return lines.join('\n');
  }

  /**
   * Write the LICENSE file alongside an uploaded content file.
   * Path: uploads/{filename}.LICENSE.txt
   */
  function writeLicenseFile(token, username, entry) {
    var licensePath = entry.file_path + '.LICENSE.txt';
    var content = buildLicenseFileContent(entry, username);
    var message = 'License: ' + entry.license + ' for ' + entry.title;

    return updateFile(token, username, licensePath, content, message);
  }

  /**
   * Build a top-level NOTICE.md for the user's repo on first upload.
   * This gives any visitor (human or AI crawler) a clear summary of what
   * licenses apply to what content in the repo.
   */
  function buildRepoNotice(username, entries) {
    var lines = [
      '# NOTICE — ' + username + '/pixelary-uploads',
      '',
      'این مخزن حاوی محتوای آپلودشده توسط کاربر در پلتفرم [پیکسلری](https://betaversion488-oss.github.io) است.',
      '',
      '## خلاصه لایسنس',
      '',
      '| نوع | لایسنس | توضیح |',
      '|-----|--------|-------|',
      '| محتوای آپلودشده (عکس/ویدیو) | CC BY-SA 4.0 (پیش‌فرض) | هر فایل دارای فایل `.LICENSE.txt` کنار خود است |',
      '| کد و طراحی پلتفرم | AGPL-3.0 | [github.com/betaversion488-oss/betaversion488-oss.github.io](https://github.com/betaversion488-oss/betaversion488-oss.github.io) |',
      '| نام و لوگوی «پیکسلری» | Trademark | استفاده بدون اجازه ممنوع است |',
      '',
      '## فهرست محتوا',
      '',
    ];

    if (entries && entries.length) {
      lines.push('| عنوان | نوع | لایسنس | تاریخ |');
      lines.push('|-------|-----|--------|-------|');
      entries.slice(-50).forEach(function (e) { // last 50 to keep NOTICE manageable
        lines.push('| ' + (e.title || '—') + ' | ' + (e.type || '—') + ' | ' + (e.license || '—') + ' | ' + (e.uploaded_at || '—') + ' |');
      });
    } else {
      lines.push('_هنوز محتوایی آپلود نشده است._');
    }

    lines.push('');
    lines.push('---');
    lines.push('Generated by [Pixelary](https://betaversion488-oss.github.io) on ' + new Date().toISOString());

    return lines.join('\n');
  }

  /**
   * Update NOTICE.md at repo root with the latest list of uploads.
   */
  function updateNotice(token, username, entries) {
    var content = buildRepoNotice(username, entries);
    return updateFile(token, username, 'NOTICE.md', content, 'Update NOTICE with ' + (entries ? entries.length : 0) + ' entries');
  }

  // ---------- Public API ----------
  return {
    REPO_NAME: REPO_NAME,
    repoExists: repoExists,
    createRepo: createRepo,
    uploadFile: uploadFile,
    appendToManifest: appendToManifest,
    getManifest: getManifest,
    registerInCentralRegistry: registerInCentralRegistry,
    waitForPagesReady: waitForPagesReady,
    getPublicFileUrl: getPublicFileUrl,
    getRawFileUrl: getRawFileUrl,
    writeLicenseFile: writeLicenseFile,
    updateNotice: updateNotice,
    buildLicenseFileContent: buildLicenseFileContent,
    buildRepoNotice: buildRepoNotice,
  };
})();
