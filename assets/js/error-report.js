/**
 * Pixelary — Error Reporter
 *
 * Automatically captures client-side errors and lets users send manual
 * feedback. Reports are filed as GitHub Issues on the central repo with
 * the `user-report` label, so the team can triage them in the same place
 * as content submissions.
 *
 * Captured events:
 *   - window.onerror (uncaught JS errors)
 *   - unhandledrejection (unhandled promise rejections)
 *   - PixelaryAPI errors during upload (manual call)
 *   - Manual user feedback via UI.toast with type='report'
 *
 * Privacy:
 *   - URL (path only, no query string with tokens)
 *   - User agent, viewport, theme
 *   - Stack trace + message
 *   - If logged in via OAuth: GitHub username (NOT token)
 *   - NO file contents, NO tokens, NO IP addresses (GitHub adds IP, we don't)
 *
 * Rate-limited client-side: max 1 auto-report per 30 seconds.
 *
 * @author Pixelary Team
 */

window.PixelaryErrors = (function () {
  'use strict';

  // Central repo where issues are filed
  var REPO_OWNER = 'betaversion488-oss';
  var REPO_NAME = 'betaversion488-oss.github.io';

  // PAT-FREE architecture: we use the user's own OAuth token (from localStorage)
  // to open Issues. The `public_repo` scope is enough to open issues on a
  // public repo. If the user is NOT logged in, we fall back to opening the
  // GitHub Issue creation URL in a new tab so they can file it manually.
  //
  // This eliminates the security disaster of shipping a bot PAT in client JS.

  // Rate limit: don't flood the issue tracker
  var MIN_INTERVAL_MS = 30 * 1000; // 30 sec between auto-reports
  var lastReportAt = 0;
  var recentSignatures = []; // dedupe identical errors within session

  // ---------- Public: Manual feedback ----------
  /**
   * Send a manual feedback report from the user.
   * @param {Object} opts
   *   - message: user's text
   *   - category: 'bug' | 'feedback' | 'question'
   *   - includeScreenshot: (future) capture via html2canvas
   */
  function send(opts) {
    opts = opts || {};
    var payload = buildPayload({
      type: 'manual',
      category: opts.category || 'feedback',
      message: opts.message || '(no message)',
      page: location.pathname,
    });
    return postIssue(payload);
  }

  // ---------- Public: Capture JS error from upload flow ----------
  /**
   * Capture a structured error from app logic (not uncaught).
   * Useful for upload failures, OAuth failures, etc.
   */
  function capture(err, context) {
    context = context || {};
    var sig = (err && err.message ? err.message : String(err)) + '|' + (context.flow || '');
    if (recentSignatures.indexOf(sig) >= 0) return Promise.resolve(null);
    recentSignatures.push(sig);
    if (recentSignatures.length > 20) recentSignatures.shift();

    var payload = buildPayload({
      type: 'captured',
      category: 'bug',
      message: (err && err.message) ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      context: context,
      page: location.pathname,
    });
    return postIssue(payload);
  }

  // ---------- Internal: build issue body ----------
  function buildPayload(data) {
    var ua = navigator.userAgent;
    var viewport = window.innerWidth + 'x' + window.innerHeight;
    var theme = (document.documentElement.getAttribute('data-theme') || 'light');
    var online = navigator.onLine ? 'yes' : 'no';
    var login = null;
    try {
      var u = JSON.parse(localStorage.getItem('pixelary_oauth_user') || 'null');
      if (u && u.login) login = u.login;
    } catch (e) {}

    var title = '[' + (data.category || 'bug') + '] ';
    if (data.type === 'manual') {
      title += (data.message || '').slice(0, 60);
    } else if (data.context && data.context.flow) {
      title += '[' + data.context.flow + '] ' + (data.message || '').slice(0, 60);
    } else {
      title += (data.message || 'Unknown error').slice(0, 60);
    }

    var body = [];
    body.push('## گزارش کاربر');
    body.push('');
    if (data.type === 'manual') {
      body.push('**نوع:** ' + (data.category || 'feedback'));
      body.push('');
      body.push('### پیام');
      body.push('');
      body.push(data.message);
    } else {
      body.push('**خطای ثبت‌شده خودکار**');
      body.push('');
      body.push('### پیام خطا');
      body.push('');
      body.push('```');
      body.push(data.message || 'No message');
      body.push('```');
      if (data.stack) {
        body.push('');
        body.push('### Stack trace');
        body.push('');
        body.push('```');
        body.push(data.stack);
        body.push('```');
      }
      if (data.context && Object.keys(data.context).length) {
        body.push('');
        body.push('### Context');
        body.push('');
        body.push('```json');
        body.push(JSON.stringify(data.context, null, 2));
        body.push('```');
      }
    }
    body.push('');
    body.push('### محیط');
    body.push('');
    body.push('| فیلد | مقدار |');
    body.push('|------|-------|');
    body.push('| صفحه | `' + (data.page || location.pathname) + '` |');
    body.push('| مرورگر | `' + ua + '` |');
    body.push('| viewport | `' + viewport + '` |');
    body.push('| تم | `' + theme + '` |');
    body.push('| آنلاین | `' + online + '` |');
    body.push('| زمان | `' + new Date().toISOString() + '` |');
    if (login) {
      body.push('| کاربر GitHub | `' + login + '` |');
    } else {
      body.push('| کاربر GitHub | _مهمان_ |');
    }
    body.push('');
    body.push('---');
    body.push('این گزارش توسط Pixelary Errors به‌صورت خودکار تولید شده است.');

    return {
      title: title,
      body: body.join('\n'),
      labels: ['user-report', data.category || 'bug'],
    };
  }

  // ---------- Internal: get user's OAuth token from localStorage ----------
  function getUserToken() {
    try {
      // oauth.js stores token as a plain string at 'pixelary_oauth_token'
      return localStorage.getItem('pixelary_oauth_token');
    } catch (e) {
      return null;
    }
  }

  // ---------- Internal: post to GitHub Issues API ----------
  function postIssue(payload) {
    var now = Date.now();
    if (now - lastReportAt < MIN_INTERVAL_MS) {
      return Promise.resolve({ skipped: true, reason: 'rate-limited' });
    }
    lastReportAt = now;

    var token = getUserToken();
    if (!token) {
      // User not logged in — fall back to opening the issue form in a new tab.
      // This is a degraded experience but better than failing silently.
      console.warn('PixelaryErrors: user not logged in, falling back to manual issue creation');
      var url = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME +
        '/issues/new?title=' + encodeURIComponent(payload.title) +
        '&body=' + encodeURIComponent(payload.body) +
        '&labels=' + encodeURIComponent((payload.labels || []).join(','));
      window.open(url, '_blank');
      return Promise.resolve({ skipped: true, reason: 'not-logged-in', fallback: 'manual' });
    }

    return fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/issues', {
      method: 'POST',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) {
        // Silent failure — never block UX for error reporting
        console.warn('PixelaryErrors: failed to post issue, HTTP', res.status);
        return null;
      }
      return res.json();
    }).catch(function (e) {
      console.warn('PixelaryErrors: network error', e);
      return null;
    });
  }

  // ---------- Auto-install global error handlers ----------
  function installGlobalHandlers() {
    window.addEventListener('error', function (e) {
      // Skip cross-origin script errors (we can't get the message anyway)
      if (!e.message && !e.error) return;
      capture(e.error || new Error(e.message || 'window.onerror'), {
        flow: 'global',
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });

    window.addEventListener('unhandledrejection', function (e) {
      var err = e.reason;
      if (!(err instanceof Error)) {
        err = new Error(typeof err === 'string' ? err : JSON.stringify(err));
      }
      capture(err, { flow: 'unhandled-promise' });
    });
  }

  // Auto-install on script load
  installGlobalHandlers();

  return {
    send: send,
    capture: capture,
  };
})();
