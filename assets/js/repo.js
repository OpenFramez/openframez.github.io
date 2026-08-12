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
          // Step 4: Write top-level LICENSE file (CC0 for repo metadata).
          // The repo metadata (README, manifest.json, NOTICE.md) is dedicated to
          // the public domain so that aggregators and crawlers can freely index it.
          // Individual uploaded files retain their own per-file license (CC BY-SA / BY / CC0)
          // declared in the accompanying `.LICENSE.txt` file.
          return updateFile(token, username, 'LICENSE', buildRepoLicenseCc0(), 'Add CC0 license for repo metadata');
        })
        .then(function () {
          // Step 5: Write top-level NOTICE.md
          return updateFile(token, username, 'NOTICE.md', buildRepoNotice(username, []), 'Initialize NOTICE');
        })
        .then(function () {
          // Step 6: Enable GitHub Pages on main branch
          return enablePages(token, username);
        })
        .then(function () {
          return repo;
        });
    });
  }

  /**
   * Build the CC0 public-domain dedication text for the repo-level LICENSE file.
   * This applies ONLY to the repo's metadata (README, manifest.json, NOTICE.md).
   * User-uploaded content files keep their own per-file licenses in `.LICENSE.txt`.
   */
  function buildRepoLicenseCc0() {
    return [
      'Creative Commons Legal Code',
      '===========================',
      '',
      'CC0 1.0 Universal',
      '',
      '    CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE',
      '    LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN',
      '    ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS',
      '    INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES',
      '    REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS',
      '    PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM',
      '    THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED',
      '    HEREUNDER.',
      '',
      'Statement of Purpose',
      '--------------------',
      '',
      'The laws of most jurisdictions throughout the world automatically confer',
      'exclusive Copyright and Related Rights (defined below) upon the creator',
      'and subsequent owner(s) (each and all, an "owner") of an original work of',
      'authorship and/or a database (each, a "Work").',
      '',
      'Certain owners wish to permanently relinquish those rights to a Work for',
      'the purpose of contributing to a commons of creative, cultural and',
      'scientific works ("Commons") that the public can reliably and without fear',
      'of later claims of infringement build upon, modify, incorporate in other',
      'works, reuse and redistribute as freely as possible in any form whatsoever',
      'and for any purposes, including without limitation commercial purposes.',
      '',
      'These owners may contribute to the Commons to promote the ideal of a free',
      'culture and the further production of creative, cultural and scientific',
      'works, or to gain reputation or greater distribution for their Work in',
      'part through the use and efforts of others.',
      '',
      'For these and/or other purposes and motivations, and without any',
      'expectation of additional consideration or compensation, the person',
      'associating CC0 with a Work (the "Affirmer"), to the extent that he or she',
      'is an owner of Copyright and Related Rights in the Work, voluntarily',
      'elects to apply CC0 to the Work and publicly distribute the Work under its',
      'terms, with knowledge of his or her Copyright and Related Rights in the',
      'Work and the meaning and intended legal effect of CC0 on those rights.',
      '',
      '1. Copyright and Related Rights.',
      '',
      '   A Work made available under CC0 may be protected by copyright and',
      '   related or neighboring rights ("Copyright and Related Rights").',
      '   Copyright and Related Rights include, but are not limited to, the',
      '   following:',
      '',
      '     i. the right to reproduce, adapt, distribute, perform, display,',
      '        communicate, and translate a Work;',
      '',
      '    ii. moral rights retained by the original author(s) and/or performer(s);',
      '',
      '   iii. publicity and privacy rights pertaining to a person\'s image or',
      '        likeness depicted in a Work;',
      '',
      '    iv. rights protecting against unfair competition in regards to a Work,',
      '        subject to the limitations in paragraph 4(a) below;',
      '',
      '     v. rights protecting the extraction, dissemination, use and reuse of',
      '        data in a Work;',
      '',
      '    vi. database rights (such as those arising under Directive 96/9/EC of',
      '        the European Parliament and of the Council of 11 March 1996 on the',
      '        legal protection of databases, and under any national',
      '        implementation thereof, including any amended or successor version',
      '        of such directive); and',
      '',
      '   vii. other similar, equivalent or corresponding rights throughout the',
      '        world based on applicable law or treaty, and any national',
      '        implementations thereof.',
      '',
      '2. Waiver.',
      '',
      '   To the greatest extent permitted by, but not in contravention of,',
      '   applicable law, Affirmer hereby overtly, fully, permanently,',
      '   irrevocably and unconditionally waives, abandons, and surrenders all of',
      '   Affirmer\'s Copyright and Related Rights and associated claims and',
      '   causes of action, whether now known or unknown (including existing as',
      '   well as future claims and causes of action), in the Work (i) in all',
      '   territories worldwide, (ii) for the maximum duration provided by',
      '   applicable law or treaty (including future time extensions), (iii) in',
      '   any current or future medium and for any number of copies, and (iv) for',
      '   any purpose whatsoever, including without limitation commercial,',
      '   advertising or promotional purposes (the "Waiver").',
      '',
      '   Affirmer makes the Waiver for the benefit of each member of the public',
      '   at large and to the detriment of Affirmer\'s heirs and successors,',
      '   fully intending that such Waiver shall not be subject to revocation,',
      '   rescission, cancellation, termination, or any other legal or equitable',
      '   action to disrupt the quiet enjoyment of the Work by the public as',
      '   contemplated by Affirmer\'s express Statement of Purpose.',
      '',
      '3. Public License Fallback.',
      '',
      '   Should any part of the Waiver for any reason be judged legally invalid',
      '   or ineffective under applicable law, then the Waiver shall be preserved',
      '   to the maximum extent permitted taking into account Affirmer\'s express',
      '   Statement of Purpose. In addition, to the extent the Waiver is so',
      '   judged Affirmer hereby grants to each affected person a royalty-free,',
      '   non transferable, non sublicensable, non exclusive, irrevocable and',
      '   unconditional license to exercise Affirmer\'s Copyright and Related',
      '   Rights in the Work (i) in all territories worldwide, (ii) for the',
      '   maximum duration provided by applicable law or treaty (including future',
      '   time extensions), (iii) in any current or future medium and for any',
      '   number of copies, and (iv) for any purpose whatsoever, including',
      '   without limitation commercial, advertising or promotional purposes',
      '   (the "License").',
      '',
      '   The License shall be deemed effective as of the date CC0 was applied by',
      '   Affirmer to the Work. Should any part of the License for any reason be',
      '   judged legally invalid or ineffective under applicable law, such partial',
      '   invalidity or ineffectiveness shall not invalidate the remainder of the',
      '   License, and in such case Affirmer hereby affirms that he or she will',
      '   not (i) exercise any of his or her remaining Copyright and Related',
      '   Rights in the Work or (ii) assert any associated claims and causes of',
      '   action with respect to the Work, in either case contrary to Affirmer\'s',
      '   express Statement of Purpose.',
      '',
      '4. Limitations and Disclaimers.',
      '',
      '   a. No trademark or patent rights held by Affirmer are waived,',
      '      abandoned, surrendered, licensed or otherwise affected by this',
      '      document.',
      '',
      '   b. Affirmer offers the Work as-is and makes no representations or',
      '      warranties of any kind concerning the Work, express, implied,',
      '      statutory or otherwise, including without limitation warranties of',
      '      title, merchantability, fitness for a particular purpose, non',
      '      infringement, or the absence of latent or other defects, accuracy,',
      '      or the present or absence of errors, whether or not discoverable,',
      '      all to the greatest extent permissible under applicable law.',
      '',
      '   c. Affirmer disclaims responsibility for clearing rights of other',
      '      persons that may apply to the Work or any use thereof, including',
      '      without limitation any person\'s Copyright and Related Rights in the',
      '      Work.',
      '',
      '   d. Affirmer understands and acknowledges that Creative Commons is not a',
      '      party to this document and has no duty or obligation with respect',
      '      to this CC0 or use of the Work.',
      '',
      'For more information, please see',
      '    http://creativecommons.org/publicdomain/zero/1.0/',
      '',
      '---',
      '',
      'SCOPE NOTE — This LICENSE file applies ONLY to the repository metadata',
      '(README.md, manifest.json, NOTICE.md, and other non-content files).',
      '',
      'Each uploaded content file in uploads/ has its OWN per-file license,',
      'declared in the accompanying uploads/{filename}.LICENSE.txt file.',
      'Those per-file licenses take precedence for the content itself.',
      '',
      'Generated by Pixelary (https://betaversion488-oss.github.io/).',
    ].join('\n');
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
      '## مجوز (License)\n\n' +
      '**دو لایه مجوز وجود دارد:**\n\n' +
      '1. **محتوای کاربر (عکس/ویدیو):** هر فایل مجوز خود را دارد که کاربر هنگام آپلود انتخاب کرده است.\n' +
      '   - فایل `uploads/{filename}.LICENSE.txt` کنار هر فایل، مجوز کامل آن را شامل می‌شود.\n' +
      '   - پیش‌فرض: `CC BY-SA 4.0` (Creative Commons Attribution-ShareAlike) — زنجیره اعتبار ویروسی.\n' +
      '   - گزینه‌های دیگر: `CC BY 4.0` (فقط ذکر نام) و `CC0` (مالکیت عمومی).\n' +
      '   - شناسه SPDX و URL مجوز در `manifest.json` ذخیره می‌شود.\n\n' +
      '2. **متادیتای مخزن (README، manifest.json، NOTICE.md):** تحت مجوز `CC0 1.0` (مالکیت عمومی) است.\n' +
      '   فایل `LICENSE` در ریشه مخزن این موضوع را اعلام می‌کند.\n' +
      '   هدف: ایندکس‌گرها و جمع‌آوری‌کننده‌ها بتوانند آزادانه متادیتای مخزن را بخوانند.\n\n' +
      '## فایل‌های سیستمی\n\n' +
      '- `README.md` — این فایل (توضیح مخزن)\n' +
      '- `LICENSE` — مجوز CC0 برای متادیتای مخزن\n' +
      '- `NOTICE.md` — خلاصه لایسنس همه محتوا (به‌روزرسانی خودکار پس از هر آپلود)\n' +
      '- `manifest.json` — فهرست کامل محتوای آپلودشده\n' +
      '- `uploads/` — فایل‌های محتوا + فایل‌های `.LICENSE.txt` کنار هر کدام\n\n' +
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
    var licenseMeta = {
      'CC BY-SA 4.0': {
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        spdx: 'CC-BY-SA-4.0',
      },
      'CC BY 4.0': {
        url: 'https://creativecommons.org/licenses/by/4.0/',
        spdx: 'CC-BY-4.0',
      },
      'CC0': {
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        spdx: 'CC0-1.0',
      },
    }[entry.license] || {
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      spdx: 'CC-BY-SA-4.0',
    };
    var licenseUrl = licenseMeta.url;
    var spdxId = entry.spdx_id || licenseMeta.spdx;

    var canonical = 'https://betaversion488-oss.github.io/photo.html?id=' + encodeURIComponent(entry.id);
    var sourceRepo = 'https://github.com/' + username + '/' + REPO_NAME + '/tree/main/' + entry.file_path;
    var uploadedAt = entry.uploaded_at || new Date().toISOString();

    var lines = [
      'PIXELARY CONTENT LICENSE',
      '========================',
      '',
      'SPDX-License-Identifier: ' + spdxId,
      '',
      'File:           ' + entry.file_path,
      'Title:          ' + entry.title,
      'Author:         ' + entry.author,
      'Uploader:       ' + username + ' (https://github.com/' + username + ')',
      'Uploaded:       ' + uploadedAt,
      'License:        ' + entry.license,
      'SPDX ID:        ' + spdxId,
      'License URL:    ' + licenseUrl,
      'Canonical URL:  ' + canonical,
      'Source repo:    ' + sourceRepo,
      'Source page:    https://betaversion488-oss.github.io/',
      '',
      'TERMS',
      '=====',
      '',
      'This content is licensed under ' + entry.license + ' (SPDX: ' + spdxId + ').',
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
      '## خلاصه لایسنس (License Summary)',
      '',
      'این مخزن از **دو لایه مجوز** استفاده می‌کند:',
      '',
      '| لایه | شامل | مجوز | فایل اعلام‌کننده |',
      '|------|------|------|------------------|',
      '| ۱. محتوای کاربر | عکس‌ها و ویدیوهای آپلودشده در `uploads/` | هر فایل مجوز خود را دارد (پیش‌فرض: CC BY-SA 4.0) | `uploads/{filename}.LICENSE.txt` کنار هر فایل |',
      '| ۲. متادیتای مخزن | README، manifest.json، NOTICE.md | CC0 1.0 (مالکیت عمومی) | `LICENSE` در ریشه مخزن |',
      '',
      '### لایسنس‌های محتوای کاربر',
      '',
      'کاربر هنگام آپلود یکی از سه لایسنس زیر را انتخاب می‌کند:',
      '',
      '| لایسنس | SPDX ID | ویژگی |',
      '|--------|---------|-------|',
      '| CC BY-SA 4.0 (پیش‌فرض) | CC-BY-SA-4.0 | ذکر نام + نسخه‌های مشتق تحت همان لایسنس (ویروسی) |',
      '| CC BY 4.0 | CC-BY-4.0 | فقط ذکر نام کافی است |',
      '| CC0 | CC0-1.0 | مالکیت عمومی — بدون هیچ محدودیتی |',
      '',
      '### سایر لایسنس‌ها',
      '',
      '| نوع | لایسنس | منبع |',
      '|------|--------|------|',
      '| کد و طراحی پلتفرم پیکسلری | AGPL-3.0 | [github.com/betaversion488-oss/betaversion488-oss.github.io](https://github.com/betaversion488-oss/betaversion488-oss.github.io) |',
      '| نام و لوگوی «پیکسلری» | Trademark | استفاده بدون اجازه ممنوع است |',
      '',
      '## فهرست محتوا (Recent Uploads)',
      '',
    ];

    if (entries && entries.length) {
      lines.push('| عنوان | نوع | لایسنس | SPDX | تاریخ |');
      lines.push('|-------|-----|--------|------|-------|');
      entries.slice(-50).forEach(function (e) { // last 50 to keep NOTICE manageable
        lines.push('| ' + (e.title || '—') +
          ' | ' + (e.type || '—') +
          ' | ' + (e.license || '—') +
          ' | ' + (e.spdx_id || '—') +
          ' | ' + (e.uploaded_at || '—') + ' |');
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
    buildRepoLicenseCc0: buildRepoLicenseCc0,
  };
})();
