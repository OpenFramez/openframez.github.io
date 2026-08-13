/**
 * Pixelary — Upload Page Logic (Phase 5 — Federated Upload)
 *
 * Easy content upload for non-technical users via OAuth Device Flow.
 *
 * NEW Architecture (Phase 5):
 *   - User signs in with THEIR OWN GitHub account via OAuth Device Flow
 *   - On first upload, a `pixelary-uploads` repo is auto-created on their account
 *   - File is uploaded to their own repo (uploads/{timestamp}-{slug}.{ext})
 *   - File is served from https://{username}.github.io/pixelary-uploads/uploads/...
 *   - Entry is appended to their manifest.json
 *   - Central registry is updated (single API call) so aggregator picks them up
 *
 * OLD Architecture (Phase 4 — REMOVED):
 *   - Bot PAT embedded in client-side JS (SECURITY RISK)
 *   - All user content dumped into central betaversion488-oss repo (mixed ownership)
 *
 * Bot PAT is still used for ONE purpose only: appending to data/registry.json
 * when a user registers. This is the minimal scope — never used for content upload.
 *
 * @author Pixelary Team
 */

(function () {
  'use strict';

  // ---------- Configuration ----------
  var MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
  var MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB (GitHub API limit is 100MB)

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
    fileType: null,
    fileDimensions: { width: 0, height: 0 },
    duration: 0,
    currentStep: 1,
    auth: null, // { token, user }
    userRepoReady: false,
    uploadResult: null,
  };

  // ---------- DOM References ----------
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  // ---------- Initialization ----------
  function init() {
    bindEvents();
    checkAuthState();
  }

  function checkAuthState() {
    var auth = window.PixelaryOAuth.getAuth();
    if (auth) {
      state.auth = auth;
      showLoggedInState(auth.user);
    } else {
      showLoggedOutState();
    }
  }

  // ---------- Auth UI ----------
  function showLoggedOutState() {
    var authGate = $('#authGate');
    var uploadContent = $('#uploadContent');
    if (authGate) authGate.classList.remove('hidden');
    if (uploadContent) uploadContent.classList.add('hidden');

    var loginBtn = $('#loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', startLogin);
    }
  }

  function showLoggedInState(user) {
    var authGate = $('#authGate');
    var uploadContent = $('#uploadContent');
    if (authGate) authGate.classList.add('hidden');
    if (uploadContent) uploadContent.classList.remove('hidden');

    // Update user chip
    var userChip = $('#userChip');
    if (userChip) {
      userChip.classList.remove('hidden');
      var avatar = $('#userAvatar');
      var name = $('#userName');
      if (avatar && user.avatar_url) avatar.src = user.avatar_url;
      if (name) name.textContent = user.name || user.login;
    }

    var logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        window.PixelaryOAuth.logout().then(function () {
          state.auth = null;
          location.reload();
        });
      });
    }
  }

  function startLogin() {
    var loginBtn = $('#loginBtn');
    var loginStatus = $('#loginStatus');
    var deviceCodeCard = $('#deviceCodeCard');
    var userCodeDisplay = $('#userCodeDisplay');
    var verificationLink = $('#verificationLink');

    if (loginBtn) loginBtn.disabled = true;
    if (loginStatus) loginStatus.classList.remove('hidden');
    if (loginStatus) loginStatus.textContent = 'در حال دریافت کد از GitHub...';

    window.PixelaryOAuth.login(function (deviceResp) {
      // Show device code to user
      if (loginStatus) loginStatus.classList.add('hidden');
      if (deviceCodeCard) deviceCodeCard.classList.remove('hidden');

      // Format user code with hyphen for readability (XXXX-XXXX)
      var userCode = deviceResp.user_code;
      if (userCodeDisplay) userCodeDisplay.textContent = userCode;

      // Verification link
      if (verificationLink) {
        verificationLink.href = deviceResp.verification_uri || 'https://github.com/login/device';
        verificationLink.textContent = deviceResp.verification_uri || 'https://github.com/login/device';
      }

      // Auto-open GitHub device page in new tab
      window.open(deviceResp.verification_uri || 'https://github.com/login/device', '_blank');
    }).then(function (result) {
      // Login successful
      state.auth = result;
      if (deviceCodeCard) deviceCodeCard.classList.add('hidden');
      if (loginBtn) loginBtn.disabled = false;
      UI.toast('خوش آمدید، ' + (result.user.name || result.user.login) + '!', 'success', 4000);
      showLoggedInState(result.user);
    }).catch(function (err) {
      console.error('Login failed:', err);
      if (deviceCodeCard) deviceCodeCard.classList.add('hidden');
      if (loginBtn) loginBtn.disabled = false;
      if (loginStatus) loginStatus.classList.add('hidden');
      UI.toast(err.message || 'خطا در ورود به GitHub', 'error', 6000);
    });
  }

  // ---------- Event Binding ----------
  function bindEvents() {
    var dropzone = $('#dropzone');
    var fileInput = $('#fileInput');

    if (!dropzone || !fileInput) return; // Not on upload page

    // Dropzone click
    // IMPORTANT: when we call fileInput.click() programmatically, that synthetic
    // click event bubbles back up to the dropzone (fileInput is a child of dropzone).
    // We must NOT re-trigger fileInput.click() in that case, otherwise the picker
    // can be cancelled/reopened in rapid succession and the browser may block it.
    dropzone.addEventListener('click', function (e) {
      if (e.target === fileInput) return; // synthetic click from .click() — skip
      openFilePicker();
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFilePicker();
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

    // Pick buttons
    $$('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var mode = btn.getAttribute('data-pick');
        setFileInputMode(mode);
        openFilePicker();
      });
    });

    // File input change
    fileInput.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        handleFile(e.target.files[0]);
      }
      // If user cancels the picker, do nothing — value stays as-is.
      // We'll reset it the next time openFilePicker() is called.
    });

    // Change file button
    var changeFileBtn = $('#changeFileBtn');
    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', function () {
        resetFile();
        goToStep(1);
      });
    }

    // Back to step 1
    var backToStep1 = $('#backToStep1');
    if (backToStep1) {
      backToStep1.addEventListener('click', function () { goToStep(1); });
    }

    // Description char count
    var desc = $('#description');
    var descCount = $('#descCount');
    if (desc && descCount) {
      desc.addEventListener('input', function () {
        descCount.textContent = UI.toPersianDigits(String(desc.value.length));
      });
    }

    // Form submit
    var uploadForm = $('#uploadForm');
    if (uploadForm) {
      uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSubmit();
      });
    }

    // Success: upload another
    var uploadAnother = $('#uploadAnother');
    if (uploadAnother) {
      uploadAnother.addEventListener('click', function () {
        resetAll();
        goToStep(1);
      });
    }

    // Error: retry
    var retryBtn = $('#retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        hideError();
        handleSubmit();
      });
    }

    // Error: start over
    var startOverBtn = $('#startOverBtn');
    if (startOverBtn) {
      startOverBtn.addEventListener('click', function () {
        resetAll();
        goToStep(1);
      });
    }
  }

  // ---------- File Input Mode ----------
  /**
   * Open the OS file picker. We always reset the input's value first so that
   * selecting the SAME file twice in a row still fires the `change` event
   * (browsers skip the event if the value didn't change).
   *
   * This is wrapped in a try/catch because some older browsers throw on
   * `fileInput.value = ''` for security reasons — in that case we ignore
   * the error and just call .click().
   */
  function openFilePicker() {
    var fileInput = $('#fileInput');
    if (!fileInput) return;
    try { fileInput.value = ''; } catch (e) { /* ignore */ }
    fileInput.click();
  }

  function setFileInputMode(mode) {
    var fileInput = $('#fileInput');
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

    var isPhoto = ALLOWED_PHOTO_TYPES.indexOf(file.type) >= 0;
    var isVideo = ALLOWED_VIDEO_TYPES.indexOf(file.type) >= 0;

    if (!isPhoto && !isVideo) {
      UI.toast('فرمت فایل پشتیبانی نمی‌شود', 'error', 4000);
      return;
    }

    var maxSize = isPhoto ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
    var maxLabel = isPhoto ? '۵ مگابایت' : '۵۰ مگابایت';
    if (file.size > maxSize) {
      UI.toast('حجم فایل بیش از حد مجاز است (حداکثر ' + maxLabel + ')', 'error', 5000);
      return;
    }

    state.file = file;
    state.fileType = isPhoto ? 'photo' : 'video';

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
      cb({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      URL.revokeObjectURL(url);
    };
    video.onerror = function () {
      cb({ width: 0, height: 0, duration: 0 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  }

  function showPreview(file) {
    var previewMedia = $('#previewMedia');
    var previewFilename = $('#previewFilename');
    var previewMeta = $('#previewMeta');
    if (!previewMedia) return;

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
    var fileInput = $('#fileInput');
    if (fileInput) fileInput.value = '';
    var previewMedia = $('#previewMedia');
    if (previewMedia) previewMedia.innerHTML = '';
    var previewFilename = $('#previewFilename');
    if (previewFilename) previewFilename.textContent = '';
    var previewMeta = $('#previewMeta');
    if (previewMeta) previewMeta.textContent = '';
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

    if (!state.auth || !state.auth.token) {
      UI.toast('برای ارسال محتوا ابتدا باید وارد GitHub شوید', 'error', 5000);
      showLoggedOutState();
      return;
    }

    var formData = collectFormData();
    if (!formData) return;

    state.formData = formData;
    goToStep(3);
    showProgress();

    // Pipeline:
    // 1. Ensure user repo exists (create if not)
    // 2. Read file as base64
    // 3. Upload to user repo
    // 4. Append to manifest.json
    // 5. Register in central registry (first time only)
    readFileAsBase64(state.file)
      .then(function (base64) {
        updateProgressStage('upload', 'active');
        updateProgressPercent(5, 'در حال بررسی حساب کاربری...');
        return ensureUserRepo();
      })
      .then(function () {
        updateProgressPercent(15, 'در حال آماده‌سازی فایل...');
        return base64OfFile(state.file);
      })
      .then(function (base64) {
        updateProgressPercent(20, 'در حال آپلود فایل به مخزن شما...');
        return uploadToUserRepo(state.file, base64, state.formData);
      })
      .then(function (fileInfo) {
        state.uploadResult = fileInfo;
        updateProgressStage('upload', 'done');
        updateProgressStage('metadata', 'active');
        updateProgressPercent(65, 'در حال به‌روزرسانی فهرست محتوا...');
        return appendToUserManifest(state.formData, fileInfo);
      })
      .then(function (manifestEntry) {
        // Write a LICENSE.txt file alongside the uploaded content file,
        // implementing the auto-licensing policy from the strategic whitepaper (ch.6).
        // CC BY-SA 4.0 by default (viral attribution chain). User can pick CC BY or CC0.
        updateProgressPercent(80, 'در حال اعمال لایسنس روی محتوا...');
        return writeLicenseFileForEntry(manifestEntry).then(function () { return manifestEntry; });
      })
      .then(function (manifestEntry) {
        // Update NOTICE.md at repo root with the latest list of uploads
        updateProgressPercent(88, 'در حال به‌روزرسانی NOTICE...');
        return updateRepoNotice().catch(function (e) {
          console.warn('NOTICE update failed (non-fatal):', e);
        });
      })
      .then(function () {
        updateProgressStage('metadata', 'done');
        updateProgressStage('review', 'active');
        updateProgressPercent(92, 'در حال ثبت در فهرست مرکزی...');
        return registerInCentralRegistry();
      })
      .then(function () {
        updateProgressPercent(100, 'تکمیل شد!');
        setTimeout(function () {
          showSuccess(state.uploadResult);
        }, 800);
      })
      .catch(function (err) {
        console.error('Upload failed:', err);
        // Auto-report the failure to the team
        if (window.PixelaryErrors) {
          window.PixelaryErrors.capture(err, {
            flow: 'upload',
            step: state.currentStep,
            fileType: state.fileType,
            fileSize: state.file ? state.file.size : 0,
            hasAuth: !!(state.auth && state.auth.token),
            userRepoReady: state.userRepoReady,
          });
        }
        showError(err.message || 'خطای ناشناخته در ارسال محتوا');
      });
  }

  // Wrap readFileAsBase64 to return both raw result and the parsed base64
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result;
        var commaIdx = result.indexOf(',');
        if (commaIdx < 0) {
          reject(new Error('Invalid data URL'));
          return;
        }
        resolve(result.slice(commaIdx + 1));
      };
      reader.onerror = function () { reject(new Error('خطا در خواندن فایل')); };
      reader.readAsDataURL(file);
    });
  }

  // Alias — readFileAsBase64 already returns the raw base64
  function base64OfFile(file) {
    return readFileAsBase64(file);
  }

  function collectFormData() {
    var title = $('#title').value.trim();
    var description = $('#description').value.trim();
    var category = $('#category').value;
    var author = $('#author').value.trim() || state.auth.user.name || state.auth.user.login;
    var license = '';
    var licenseInputs = $$('input[name="license"]');
    for (var i = 0; i < licenseInputs.length; i++) {
      if (licenseInputs[i].checked) { license = licenseInputs[i].value; break; }
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

  // ---------- Ensure User Repo Exists ----------
  function ensureUserRepo() {
    if (state.userRepoReady) return Promise.resolve();
    var username = state.auth.user.login;
    var token = state.auth.token;

    return window.PixelaryRepo.repoExists(token, username)
      .then(function (exists) {
        if (exists) {
          state.userRepoReady = true;
          return null;
        }
        updateProgressPercent(10, 'در حال ایجاد مخزن شخصی شما... (یک‌بار برای همیشه)');
        return window.PixelaryRepo.createRepo(token, username, state.auth.user)
          .then(function () {
            state.userRepoReady = true;
          });
      });
  }

  // ---------- Upload to User Repo ----------
  function generateFilePath(file, formData) {
    var ext = ALLOWED_EXTENSIONS[file.type] || 'bin';
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var rand = Math.random().toString(36).slice(2, 8);
    var slug = (formData.title || 'upload')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30)
      .toLowerCase();
    return 'uploads/' + ts + '-' + rand + '-' + slug + '.' + ext;
  }

  function uploadToUserRepo(file, base64, formData) {
    var path = generateFilePath(file, formData);
    var message = 'Upload: ' + (formData.title || file.name);
    var username = state.auth.user.login;
    var token = state.auth.token;

    return window.PixelaryRepo.uploadFile(token, username, path, base64, message, function (pct, msg) {
      updateProgressPercent(pct, msg);
    }).then(function (info) {
      return info;
    });
  }

  function appendToUserManifest(formData, fileInfo) {
    var username = state.auth.user.login;
    var token = state.auth.token;

    // Lookup SPDX identifier + canonical license URL for the chosen license.
    // This makes the manifest entry machine-readable for crawlers, AI indexers,
    // and downstream aggregators (SPDX is the standard for license identification).
    var LICENSE_REGISTRY = {
      'CC BY-SA 4.0': {
        spdx_id: 'CC-BY-SA-4.0',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        viral: true,
      },
      'CC BY 4.0': {
        spdx_id: 'CC-BY-4.0',
        url: 'https://creativecommons.org/licenses/by/4.0/',
        viral: false,
      },
      'CC0': {
        spdx_id: 'CC0-1.0',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        viral: false,
      },
    };
    var licenseMeta = LICENSE_REGISTRY[formData.license] || LICENSE_REGISTRY['CC BY-SA 4.0'];

    var entry = {
      id: 'fu_' + Date.now(),
      type: formData.type,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      author: formData.author,
      license: formData.license,
      license_url: licenseMeta.url,
      spdx_id: licenseMeta.spdx_id,
      license_viral: licenseMeta.viral,
      license_file_path: fileInfo.path + '.LICENSE.txt',
      file_url: fileInfo.public_url,
      file_path: fileInfo.path,
      thumbnail_url: fileInfo.public_url,
      mime_type: formData.fileType,
      size_bytes: formData.fileSize,
      width: formData.width,
      height: formData.height,
      duration: formData.duration,
      uploaded_at: formData.submittedAt,
      original_filename: formData.fileName,
    };

    return window.PixelaryRepo.appendToManifest(token, username, entry)
      .then(function () { return entry; });
  }

  function registerInCentralRegistry() {
    var username = state.auth.user.login;
    var token = state.auth.token;
    // PAT-FREE: open a registration Issue with the user's own OAuth token.
    // The process-registration.yml Action rebuilds registry.json from these issues.
    return window.PixelaryRepo.registerInCentralRegistry(token, username)
      .catch(function (err) {
        // Non-fatal — the upload itself succeeded
        console.warn('Failed to open registration issue:', err);
      });
  }

  /**
   * Write a LICENSE.txt file alongside the just-uploaded content file.
   * This auto-applies the user-selected license to the content,
   * implementing the whitepaper's "viral attribution chain" policy.
   */
  function writeLicenseFileForEntry(entry) {
    var username = state.auth.user.login;
    var token = state.auth.token;
    return window.PixelaryRepo.writeLicenseFile(token, username, entry)
      .catch(function (e) {
        console.warn('LICENSE file write failed (non-fatal):', e);
      });
  }

  /**
   * Update NOTICE.md at the user's repo root with the latest list of uploads.
   * This gives any visitor (human or AI crawler) a clear license summary.
   */
  function updateRepoNotice() {
    var username = state.auth.user.login;
    var token = state.auth.token;
    return window.PixelaryRepo.getManifest(token, username)
      .then(function (manifest) {
        return window.PixelaryRepo.updateNotice(token, username, manifest.uploads || []);
      });
  }

  // ---------- Progress UI ----------
  function showProgress() {
    var progressCard = $('#progressCard');
    var successCard = $('#successCard');
    var errorCard = $('#errorCard');
    if (progressCard) progressCard.classList.remove('hidden');
    if (successCard) successCard.classList.add('hidden');
    if (errorCard) errorCard.classList.add('hidden');

    updateProgressStage('upload', 'pending');
    updateProgressStage('metadata', 'pending');
    updateProgressStage('review', 'pending');

    var progressTitle = $('#progressTitle');
    var progressMessage = $('#progressMessage');
    if (progressTitle) progressTitle.textContent = 'در حال ارسال محتوا';
    if (progressMessage) progressMessage.textContent = 'لطفاً صبر کنید و صفحه را نبندید';
  }

  function updateProgressPercent(pct, stage) {
    var progressBarFill = $('#progressBarFill');
    var progressPercent = $('#progressPercent');
    var progressStage = $('#progressStage');
    if (progressBarFill) progressBarFill.style.width = pct + '%';
    if (progressPercent) progressPercent.textContent = UI.toPersianDigits(String(pct)) + '٪';
    if (stage && progressStage) progressStage.textContent = stage;
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
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.setAttribute('data-status', status);
    }
  }

  // ---------- Success / Error ----------
  function showSuccess(fileInfo) {
    var progressCard = $('#progressCard');
    var successCard = $('#successCard');
    if (progressCard) progressCard.classList.add('hidden');
    if (successCard) successCard.classList.remove('hidden');

    // Show user's repo link
    var repoLink = $('#userRepoLink');
    if (repoLink && state.auth && state.auth.user) {
      repoLink.href = 'https://github.com/' + state.auth.user.login + '/pixelary-uploads';
    }

    // Show file URL — start with raw URL (works immediately), then poll Pages
    var fileLink = $('#userFileLink');
    if (fileLink && fileInfo) {
      // Use raw URL as the immediate fallback (always works)
      var rawUrl = window.PixelaryRepo.getRawFileUrl(state.auth.user.login, fileInfo.path);
      fileLink.href = rawUrl;
      fileLink.textContent = 'مشاهده فایل (raw)';

      // Try to upgrade to Pages URL once Pages is built (~30-60s)
      pollPagesAndUpgradeLink(fileInfo.path, fileLink);
    }

    UI.toast('محتوای شما با موفقیت در مخزن شخصی‌تان آپلود شد!', 'success', 5000);
  }

  /**
   * Poll the user's repo Pages status. Once built, upgrade the success link
   * from the raw URL to the Pages URL (cleaner, served from CDN).
   * Gives up after 6 attempts (~60 seconds).
   */
  function pollPagesAndUpgradeLink(filePath, linkEl) {
    var username = state.auth.user.login;
    var token = state.auth.token;
    var attempts = 0;
    var maxAttempts = 6;

    function check() {
      attempts++;
      fetch('https://api.github.com/repos/' + username + '/pixelary-uploads/pages', {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
      }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (data) {
        if (data && data.status === 'built') {
          // Pages is ready — upgrade link
          var pagesUrl = window.PixelaryRepo.getPublicFileUrl(username, filePath);
          linkEl.href = pagesUrl;
          linkEl.textContent = 'مشاهده فایل آپلودشده';
        } else if (attempts < maxAttempts) {
          setTimeout(check, 10000); // retry in 10s
        }
        // If still not built after maxAttempts, leave the raw URL — it works fine
      }).catch(function () {
        // Network/API error — leave raw URL in place
      });
    }

    // First check after 15s (give Pages a head start to begin building)
    setTimeout(check, 15000);
  }

  function showError(message) {
    var progressCard = $('#progressCard');
    var errorCard = $('#errorCard');
    if (progressCard) progressCard.classList.add('hidden');
    if (errorCard) errorCard.classList.remove('hidden');
    var errorMessage = $('#errorMessage');
    if (errorMessage) errorMessage.textContent = message;
  }

  function hideError() {
    var errorCard = $('#errorCard');
    var progressCard = $('#progressCard');
    if (errorCard) errorCard.classList.add('hidden');
    if (progressCard) progressCard.classList.remove('hidden');
  }

  function resetAll() {
    resetFile();
    var uploadForm = $('#uploadForm');
    if (uploadForm) uploadForm.reset();
    state.uploadResult = null;
    state.formData = null;
    var descCount = $('#descCount');
    if (descCount) descCount.textContent = '۰';
    var successCard = $('#successCard');
    var errorCard = $('#errorCard');
    var progressCard = $('#progressCard');
    if (successCard) successCard.classList.add('hidden');
    if (errorCard) errorCard.classList.add('hidden');
    if (progressCard) progressCard.classList.add('hidden');
  }

  // ---------- Boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
