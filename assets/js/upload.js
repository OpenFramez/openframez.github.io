/**
 * Pixelary — Upload Page Logic (Phase 4)
 *
 * Easy content upload for non-technical users.
 * Flow: pick file → fill metadata → upload to GitHub repo → create Issue
 *
 * Architecture:
 *   - File is uploaded directly to the GitHub repo via the Contents API
 *     (for files ≤ 1MB) or Git Blobs API (for larger files, up to 100MB)
 *   - File is stored at uploads/user/{timestamp}-{random}.{ext}
 *   - File is served from https://betaversion488-oss.github.io/uploads/user/...
 *   - GitHub Issue is created with metadata for moderator review
 *   - GitHub Action auto-processes approved submissions
 *
 * SECURITY NOTE:
 *   The embedded GitHub PAT is for a bot account with `public_repo` scope only.
 *   Anyone can extract it from client-side JS, but the worst they can do is
 *   create files in uploads/user/ or create issues (both visible, both revertable).
 *
 *   For production use, replace this with a serverless proxy (Cloudflare Worker,
 *   Vercel function, etc.) that holds the PAT as an environment variable.
 *
 * @author Pixelary Team
 */

(function () {
  'use strict';

  // ---------- Configuration ----------
  // NOTE: This PAT is for a bot account with `public_repo` scope only.
  // Rotate regularly. Replace with a serverless proxy for production.
  // prettier-ignore
  var GITHUB_TOKEN = (function(){
    // Obfuscated to discourage casual extraction (NOT real security).
    var p = [103,104,112,95,113,114,83,55,75,112,73,99,107,90,49,49,82,102,53,109,53,74,56,54,79,87,109,119,98,84,79,106,103,57,50,98,76,81,67,101];
    var s = '';
    for (var i = 0; i < p.length; i++) s += String.fromCharCode(p[i]);
    return s;
  })();

  var REPO_OWNER = 'betaversion488-oss';
  var REPO_NAME = 'betaversion488-oss.github.io';
  var REPO_BRANCH = 'main';
  var GITHUB_API_BASE = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME;
  var GITHUB_ISSUES_API = GITHUB_API_BASE + '/issues';
  var UPLOAD_DIR = 'uploads/user';

  // Page URL used to construct the public file URL
  var PUBLIC_BASE = 'https://betaversion488-oss.github.io';

  var MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB (GitHub Contents API friendly)
  var MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB (Git Blobs API limit is 100MB)

  var ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
  var ALLOWED_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  // ---------- State ----------
  var state = {
    file: null,
    fileType: null, // 'photo' | 'video'
    fileDimensions: { width: 0, height: 0 },
    duration: 0,
    currentStep: 1,
    fileRepoPath: null,
    filePublicUrl: null,
    issueNumber: null,
    issueUrl: null,
  };

  // ---------- DOM References ----------
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var dropzone, fileInput, step1Panel, step2Panel, step3Panel;
  var previewMedia, previewFilename, previewMeta;
  var uploadForm, submitBtn;
  var progressCard, successCard, errorCard;
  var progressBarFill, progressPercent, progressStage, progressTitle, progressMessage;
  var issueLink;

  // ---------- Initialization ----------
  function init() {
    dropzone = $('#dropzone');
    fileInput = $('#fileInput');
    step1Panel = $('#step1');
    step2Panel = $('#step2');
    step3Panel = $('#step3');
    previewMedia = $('#previewMedia');
    previewFilename = $('#previewFilename');
    previewMeta = $('#previewMeta');
    uploadForm = $('#uploadForm');
    submitBtn = $('#submitBtn');
    progressCard = $('#progressCard');
    successCard = $('#successCard');
    errorCard = $('#errorCard');
    progressBarFill = $('#progressBarFill');
    progressPercent = $('#progressPercent');
    progressStage = $('#progressStage');
    progressTitle = $('#progressTitle');
    progressMessage = $('#progressMessage');
    issueLink = $('#issueLink');

    bindEvents();
  }

  function bindEvents() {
    // Dropzone click
    dropzone.addEventListener('click', function () {
      fileInput.click();
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Drag and drop
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      var files = e.dataTransfer.files;
      if (files && files.length) {
        handleFile(files[0]);
      }
    });

    // Pick buttons (gallery / camera / record-video)
    $$('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation(); // prevent dropzone click
        var mode = btn.getAttribute('data-pick');
        setFileInputMode(mode);
        fileInput.click();
      });
    });

    // File input change
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    });

    // Change file button
    $('#changeFileBtn').addEventListener('click', function () {
      resetFile();
      goToStep(1);
    });

    // Back to step 1
    $('#backToStep1').addEventListener('click', function () {
      goToStep(1);
    });

    // Description character count
    var desc = $('#description');
    var descCount = $('#descCount');
    desc.addEventListener('input', function () {
      descCount.textContent = UI.toPersianDigits(String(desc.value.length));
    });

    // Form submit
    uploadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSubmit();
    });

    // Success: upload another
    $('#uploadAnother').addEventListener('click', function () {
      resetAll();
      goToStep(1);
    });

    // Error: retry
    $('#retryBtn').addEventListener('click', function () {
      hideError();
      handleSubmit();
    });

    // Error: start over
    $('#startOverBtn').addEventListener('click', function () {
      resetAll();
      goToStep(1);
    });
  }

  // ---------- File Input Mode ----------
  function setFileInputMode(mode) {
    fileInput.removeAttribute('capture');
    fileInput.removeAttribute('accept');

    if (mode === 'gallery') {
      fileInput.setAttribute('accept', 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime');
    } else if (mode === 'camera') {
      fileInput.setAttribute('accept', 'image/jpeg,image/png,image/webp');
      fileInput.setAttribute('capture', 'environment');
    } else if (mode === 'record-video') {
      fileInput.setAttribute('accept', 'video/mp4,video/webm');
      fileInput.setAttribute('capture', 'environment');
    }
  }

  // ---------- File Handling ----------
  function handleFile(file) {
    if (!file) return;

    // Determine type
    var isPhoto = ALLOWED_PHOTO_TYPES.indexOf(file.type) >= 0;
    var isVideo = ALLOWED_VIDEO_TYPES.indexOf(file.type) >= 0;

    if (!isPhoto && !isVideo) {
      UI.toast('فرمت فایل پشتیبانی نمی‌شود', 'error', 4000);
      return;
    }

    // Size check
    var maxSize = isPhoto ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
    var maxLabel = isPhoto ? '۵ مگابایت' : '۵۰ مگابایت';
    if (file.size > maxSize) {
      UI.toast('حجم فایل بیش از حد مجاز است (حداکثر ' + maxLabel + ')', 'error', 5000);
      return;
    }

    state.file = file;
    state.fileType = isPhoto ? 'photo' : 'video';

    // Get dimensions and duration
    if (isPhoto) {
      getPhotoDimensions(file, function (dims) {
        state.fileDimensions = dims;
        showPreview(file);
        goToStep(2);
      });
    } else {
      getVideoMetadata(file, function (meta) {
        state.fileDimensions = { width: meta.width, height: meta.height };
        state.duration = meta.duration;
        showPreview(file);
        goToStep(2);
      });
    }
  }

  function getPhotoDimensions(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      cb({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = function () {
      cb({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function getVideoMetadata(file, cb) {
    var url = URL.createObjectURL(file);
    var video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = function () {
      cb({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = function () {
      cb({ width: 0, height: 0, duration: 0 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  }

  function showPreview(file) {
    previewMedia.innerHTML = '';

    var url = URL.createObjectURL(file);
    if (state.fileType === 'photo') {
      var img = document.createElement('img');
      img.src = url;
      img.alt = 'پیش‌نمایش';
      previewMedia.appendChild(img);
    } else {
      var video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      previewMedia.appendChild(video);
    }

    var name = file.name;
    if (name.length > 40) name = name.slice(0, 37) + '...';
    previewFilename.textContent = name;

    var sizeStr = UI.formatBytes(file.size);
    var dimStr = '';
    if (state.fileDimensions.width && state.fileDimensions.height) {
      dimStr = state.fileDimensions.width + '×' + state.fileDimensions.height;
    }
    var typeStr = state.fileType === 'photo' ? 'عکس' : 'ویدیو';
    var metaParts = [typeStr, sizeStr];
    if (dimStr) metaParts.push(dimStr);
    if (state.duration) {
      metaParts.push(UI.formatDuration(state.duration) + ' ثانیه');
    }
    previewMeta.textContent = metaParts.join(' • ');
  }

  function resetFile() {
    state.file = null;
    state.fileType = null;
    state.fileDimensions = { width: 0, height: 0 };
    state.duration = 0;
    fileInput.value = '';
    previewMedia.innerHTML = '';
    previewFilename.textContent = '';
    previewMeta.textContent = '';
  }

  // ---------- Step Navigation ----------
  function goToStep(n) {
    state.currentStep = n;
    $$('[data-step-panel]').forEach(function (panel) {
      var panelStep = parseInt(panel.getAttribute('data-step-panel'), 10);
      if (panelStep === n) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    $$('.step-indicator .step').forEach(function (step) {
      var stepNum = parseInt(step.getAttribute('data-step'), 10);
      step.classList.remove('active', 'done');
      if (stepNum < n) {
        step.classList.add('done');
      } else if (stepNum === n) {
        step.classList.add('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Form Submission ----------
  function handleSubmit() {
    if (!state.file) {
      UI.toast('لطفاً ابتدا یک فایل انتخاب کنید', 'error');
      goToStep(1);
      return;
    }

    var formData = collectFormData();
    if (!formData) return;

    state.formData = formData;
    goToStep(3);
    showProgress();

    // Start upload pipeline:
    // 1. Read file as base64
    // 2. Upload to GitHub repo (Contents API for ≤1MB, Git Blobs API for larger)
    // 3. Create GitHub Issue
    readFileAsBase64(state.file)
      .then(function (base64) {
        updateProgressStage('upload', 'active');
        updateProgressPercent(10, 'در حال آماده‌سازی فایل...');
        return uploadFileToRepo(state.file, base64, formData);
      })
      .then(function (fileInfo) {
        state.fileRepoPath = fileInfo.path;
        state.filePublicUrl = fileInfo.publicUrl;
        updateProgressStage('upload', 'done');
        updateProgressStage('metadata', 'active');
        updateProgressPercent(70, 'در حال ارسال متادیتا...');
        return createGitHubIssue(formData, fileInfo);
      })
      .then(function (issue) {
        state.issueNumber = issue.number;
        state.issueUrl = issue.html_url;
        updateProgressStage('metadata', 'done');
        updateProgressStage('review', 'active');
        updateProgressPercent(100, 'تکمیل شد!');
        setTimeout(function () {
          showSuccess(issue);
        }, 800);
      })
      .catch(function (err) {
        console.error('Upload failed:', err);
        showError(err.message || 'خطای ناشناخته در ارسال محتوا');
      });
  }

  function collectFormData() {
    var title = $('#title').value.trim();
    var description = $('#description').value.trim();
    var category = $('#category').value;
    var author = $('#author').value.trim() || 'کاربر ناشناس';
    var license = '';
    var licenseInputs = $$('input[name="license"]');
    for (var i = 0; i < licenseInputs.length; i++) {
      if (licenseInputs[i].checked) {
        license = licenseInputs[i].value;
        break;
      }
    }
    var ownership = $('#ownershipConfirm').checked;

    if (!title) { UI.toast('عنوان را وارد کنید', 'error'); $('#title').focus(); return null; }
    if (!category) { UI.toast('دسته‌بندی را انتخاب کنید', 'error'); $('#category').focus(); return null; }
    if (!license) { UI.toast('مجوز انتشار را انتخاب کنید', 'error'); return null; }
    if (!ownership) { UI.toast('لطفاً تأیید مالکیت محتوا را تیک بزنید', 'error'); return null; }

    return {
      title: title,
      description: description,
      category: category,
      author: author,
      license: license,
      type: state.fileType,
      fileName: state.file.name,
      fileSize: state.file.size,
      fileType: state.file.type,
      width: state.fileDimensions.width,
      height: state.fileDimensions.height,
      duration: state.duration,
      submittedAt: new Date().toISOString(),
    };
  }

  // ---------- File Reading ----------
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        // reader.result is "data:<mime>;base64,<base64data>"
        var result = reader.result;
        var commaIdx = result.indexOf(',');
        if (commaIdx < 0) {
          reject(new Error('Invalid data URL'));
          return;
        }
        resolve(result.slice(commaIdx + 1));
      };
      reader.onerror = function () {
        reject(new Error('خطا در خواندن فایل'));
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Upload to GitHub Repo ----------
  function generateFilePath(file, formData) {
    var ext = ALLOWED_EXTENSIONS[file.type] || 'bin';
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var rand = Math.random().toString(36).slice(2, 8);
    // Sanitize title for filename
    var slug = (formData.title || 'upload')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30)
      .toLowerCase();
    return UPLOAD_DIR + '/' + ts + '-' + rand + '-' + slug + '.' + ext;
  }

  function uploadFileToRepo(file, base64, formData) {
    var path = generateFilePath(file, formData);
    var publicUrl = PUBLIC_BASE + '/' + path;

    // For files ≤ 1MB, use Contents API (simpler)
    // For larger files, use Git Blobs API (handles up to 100MB)
    if (file.size <= 1024 * 1024) {
      return uploadViaContentsApi(path, base64, file, formData).then(function () {
        return { path: path, publicUrl: publicUrl };
      });
    } else {
      return uploadViaBlobsApi(path, base64, file, formData).then(function () {
        return { path: path, publicUrl: publicUrl };
      });
    }
  }

  // Method 1: Contents API (for files ≤ 1MB)
  function uploadViaContentsApi(path, base64, file, formData) {
    var message = 'Upload: ' + (formData.title || file.name) + ' (user submission)';
    var url = GITHUB_API_BASE + '/contents/' + encodeURIComponent(path);

    return fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'token ' + GITHUB_TOKEN,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        content: base64,
        branch: REPO_BRANCH,
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('GitHub upload error: ' + (err.message || res.status));
        });
      }
      return res.json();
    });
  }

  // Method 2: Git Blobs API (for files > 1MB, up to 100MB)
  // This requires: create blob → get current commit → create tree → create commit → update ref
  function uploadViaBlobsApi(path, base64, file, formData) {
    var blobSha;
    var message = 'Upload: ' + (formData.title || file.name) + ' (user submission)';

    updateProgressPercent(20, 'در حال آپلود فایل...');

    // Step 1: Create blob
    return fetch(GITHUB_API_BASE + '/git/blobs', {
      method: 'POST',
      headers: {
        Authorization: 'token ' + GITHUB_TOKEN,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: base64,
        encoding: 'base64',
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to create blob: ' + res.status);
        return res.json();
      })
      .then(function (blob) {
        blobSha = blob.sha;
        updateProgressPercent(50, 'در حال ایجاد commit...');
        // Step 2: Get the current HEAD commit
        return fetch(GITHUB_API_BASE + '/git/refs/heads/' + REPO_BRANCH, {
          headers: {
            Authorization: 'token ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github.v3+json',
          },
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to get ref: ' + res.status);
        return res.json();
      })
      .then(function (ref) {
        var commitSha = ref.object.sha;
        // Step 3: Get the commit to find its tree SHA
        return fetch(GITHUB_API_BASE + '/git/commits/' + commitSha, {
          headers: {
            Authorization: 'token ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github.v3+json',
          },
        }).then(function (res) {
          if (!res.ok) throw new Error('Failed to get commit: ' + res.status);
          return res.json();
        }).then(function (commit) {
          return { commitSha: commitSha, treeSha: commit.tree.sha };
        });
      })
      .then(function (info) {
        // Step 4: Create a new tree with the file
        updateProgressPercent(60, 'در حال ایجاد tree...');
        return fetch(GITHUB_API_BASE + '/git/trees', {
          method: 'POST',
          headers: {
            Authorization: 'token ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base_tree: info.treeSha,
            tree: [
              {
                path: path,
                mode: '100644',
                type: 'blob',
                sha: blobSha,
              },
            ],
          }),
        }).then(function (res) {
          if (!res.ok) throw new Error('Failed to create tree: ' + res.status);
          return res.json();
        }).then(function (tree) {
          return { commitSha: info.commitSha, treeSha: tree.sha };
        });
      })
      .then(function (info) {
        // Step 5: Create a new commit
        return fetch(GITHUB_API_BASE + '/git/commits', {
          method: 'POST',
          headers: {
            Authorization: 'token ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            parents: [info.commitSha],
            tree: info.treeSha,
          }),
        }).then(function (res) {
          if (!res.ok) throw new Error('Failed to create commit: ' + res.status);
          return res.json();
        }).then(function (commit) {
          return commit.sha;
        });
      })
      .then(function (newCommitSha) {
        // Step 6: Update the ref
        return fetch(GITHUB_API_BASE + '/git/refs/heads/' + REPO_BRANCH, {
          method: 'PATCH',
          headers: {
            Authorization: 'token ' + GITHUB_TOKEN,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sha: newCommitSha,
            force: false,
          }),
        }).then(function (res) {
          if (!res.ok) throw new Error('Failed to update ref: ' + res.status);
          return res.json();
        });
      });
  }

  // ---------- Create GitHub Issue ----------
  function createGitHubIssue(data, fileInfo) {
    var titlePrefix = data.type === 'photo' ? '[عکس]' : '[ویدیو]';
    var issueTitle = titlePrefix + ' ' + data.title;

    var body = buildIssueBody(data, fileInfo);

    var payload = {
      title: issueTitle,
      body: body,
      labels: ['submission', 'pending-review', 'type:' + data.type],
    };

    return fetch(GITHUB_ISSUES_API, {
      method: 'POST',
      headers: {
        Authorization: 'token ' + GITHUB_TOKEN,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('GitHub API error: ' + (err.message || res.status));
        });
      }
      return res.json();
    });
  }

  function buildIssueBody(data, fileInfo) {
    var typeLabel = data.type === 'photo' ? 'عکس' : 'ویدیو';
    var sizeStr = UI.formatBytes(data.fileSize);
    var dimStr = data.width && data.height ? data.width + '×' + data.height : 'نامشخص';
    var durationStr = data.duration ? UI.formatDuration(data.duration) + ' ثانیه' : '—';
    var licenseUrl = UI.licenseUrl(data.license);
    var fileUrl = fileInfo.publicUrl;

    var body = '## محتوای ارسالی جدید\n\n';
    body += 'این issue به‌صورت خودکار از [صفحه آپلود پیکسلری](https://betaversion488-oss.github.io/upload.html) ایجاد شده است.\n\n';

    body += '### پیش‌نمایش\n\n';
    if (data.type === 'photo') {
      body += '![' + escapeMarkdown(data.title) + '](' + fileUrl + ')\n\n';
    } else {
      body += '<video controls src="' + fileUrl + '" style="max-width: 100%; height: auto;"></video>\n\n';
    }

    body += '### اطلاعات\n\n';
    body += '| فیلد | مقدار |\n';
    body += '|------|-------|\n';
    body += '| نوع | ' + typeLabel + ' |\n';
    body += '| عنوان | ' + escapeMarkdown(data.title) + ' |\n';
    body += '| توضیحات | ' + (data.description ? escapeMarkdown(data.description) : '—') + ' |\n';
    body += '| دسته | `' + data.category + '` |\n';
    body += '| نویسنده | ' + escapeMarkdown(data.author) + ' |\n';
    body += '| مجوز | [' + data.license + '](' + (licenseUrl || '#') + ') |\n';
    body += '| تاریخ ارسال | ' + data.submittedAt + ' |\n\n';

    body += '### مشخصات فایل\n\n';
    body += '| فیلد | مقدار |\n';
    body += '|------|-------|\n';
    body += '| URL | [' + fileUrl + '](' + fileUrl + ') |\n';
    body += '| مسیر در repo | `' + fileInfo.path + '` |\n';
    body += '| نوع MIME | `' + data.fileType + '` |\n';
    body += '| حجم | ' + sizeStr + ' |\n';
    body += '| ابعاد | ' + dimStr + ' |\n';
    if (data.type === 'video') {
      body += '| مدت | ' + durationStr + ' |\n';
    }
    body += '| نام فایل اصلی | `' + escapeMarkdown(data.fileName) + '` |\n\n';

    body += '---\n\n';
    body += '### متادیتا برای پردازش خودکار\n\n';
    body += '```yaml\n';
    body += 'type: ' + data.type + '\n';
    body += 'title: ' + yamlEscape(data.title) + '\n';
    body += 'description: ' + yamlEscape(data.description) + '\n';
    body += 'category: ' + data.category + '\n';
    body += 'author: ' + yamlEscape(data.author) + '\n';
    body += 'license: ' + data.license + '\n';
    body += 'file_url: ' + fileUrl + '\n';
    body += 'file_path: ' + fileInfo.path + '\n';
    body += 'mime_type: ' + data.fileType + '\n';
    body += 'size_bytes: ' + data.fileSize + '\n';
    body += 'width: ' + data.width + '\n';
    body += 'height: ' + data.height + '\n';
    if (data.type === 'video') {
      body += 'duration: ' + (data.duration || 0).toFixed(2) + '\n';
    }
    body += 'submitted_at: ' + data.submittedAt + '\n';
    body += '```\n\n';

    body += '---\n\n';
    body += '### دستورالعمل بررسی\n\n';
    body += '1. محتوای فوق را از نظر قوانین نسخه‌برداری و محتوای نامناسب بررسی کنید.\n';
    body += '2. در صورت تأیید، label `pending-review` را حذف و label `approved` را اضافه کنید.\n';
    body += '3. GitHub Action به‌صورت خودکار محتوا را به `data/photos.json` یا `data/videos.json` اضافه کرده و این issue را می‌بندد.\n';
    body += '4. در صورت رد، label `rejected` را اضافه کنید و دلیل را کامنت کنید.\n\n';

    return body;
  }

  function escapeMarkdown(s) {
    if (!s) return '';
    return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  function yamlEscape(s) {
    if (!s) return '""';
    if (/[:#&*!|>'"%@`{}\[\],?\n]/.test(s)) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  // ---------- Progress UI ----------
  function showProgress() {
    progressCard.classList.remove('hidden');
    successCard.classList.add('hidden');
    errorCard.classList.add('hidden');

    updateProgressStage('upload', 'pending');
    updateProgressStage('metadata', 'pending');
    updateProgressStage('review', 'pending');

    progressTitle.textContent = 'در حال ارسال محتوا';
    progressMessage.textContent = 'لطفاً صبر کنید و صفحه را نبندید';
  }

  function updateProgressPercent(pct, stage) {
    progressBarFill.style.width = pct + '%';
    progressPercent.textContent = UI.toPersianDigits(String(pct)) + '٪';
    if (stage) progressStage.textContent = stage;
  }

  function updateProgressStage(stage, status) {
    var item = document.querySelector('.progress-step-item[data-stage="' + stage + '"]');
    if (!item) return;

    item.setAttribute('data-active', status === 'active' ? 'true' : 'false');
    item.setAttribute('data-done', status === 'done' ? 'true' : 'false');

    var statusEl = item.querySelector('.progress-step-status');
    var statusText = {
      pending: 'در انتظار',
      active: 'در حال انجام',
      done: 'تکمیل شد',
    }[status];
    statusEl.textContent = statusText;
    statusEl.setAttribute('data-status', status);
  }

  // ---------- Success / Error ----------
  function showSuccess(issue) {
    progressCard.classList.add('hidden');
    successCard.classList.remove('hidden');
    if (issue.html_url) {
      issueLink.href = issue.html_url;
      $('#issueLinkContainer').classList.remove('hidden');
    }
    UI.toast('محتوا با موفقیت ارسال شد!', 'success', 4000);
  }

  function showError(message) {
    progressCard.classList.add('hidden');
    errorCard.classList.remove('hidden');
    $('#errorMessage').textContent = message;
  }

  function hideError() {
    errorCard.classList.add('hidden');
    progressCard.classList.remove('hidden');
  }

  function resetAll() {
    resetFile();
    uploadForm.reset();
    state.fileRepoPath = null;
    state.filePublicUrl = null;
    state.issueNumber = null;
    state.issueUrl = null;
    state.formData = null;
    $('#descCount').textContent = '۰';
    successCard.classList.add('hidden');
    errorCard.classList.add('hidden');
    progressCard.classList.add('hidden');
  }

  // ---------- Boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
