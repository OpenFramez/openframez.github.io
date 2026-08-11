/**
 * Pixelary — OAuth Device Flow (Phase 5 — Federated Upload)
 *
 * Lets non-technical users authenticate with their OWN GitHub account
 * directly from a static GitHub Pages site — no backend, no PAT leak.
 *
 * Flow:
 *   1. Browser POSTs to github.com/login/device/code with our OAuth client_id
 *      → receives { device_code, user_code, verification_uri, expires_in, interval }
 *   2. User opens github.com/login/device in a browser, enters the 8-char user_code
 *   3. Browser polls github.com/login/oauth/access_token every `interval` seconds
 *      → on success receives { access_token, scope, token_type }
 *   4. Token is stored in localStorage (NOT sessionStorage — survives reload)
 *
 * Security notes:
 *   - Token has scope `public_repo` (or `repo` for private). Can only touch user's own repos.
 *   - Token never leaves the user's browser. Our site never sees it server-side.
 *   - localStorage is XSS-readable. Since this is a static site with no third-party JS,
 *     the attack surface is minimal. For higher security, use a serverless proxy.
 *   - Device Flow is the recommended OAuth flow for static sites / mobile apps / CLI tools.
 *
 * @author Pixelary Team
 */

window.PixelaryOAuth = (function () {
  'use strict';

  // ---------- Configuration ----------
  // OAuth App registered by org owner at https://github.com/settings/applications/new
  // (or under https://github.com/organizations/betaversion488-oss/settings/applications/new)
  // Required scopes: `public_repo` (or `repo` for private user repos).
  // "Enable Device Flow" checkbox MUST be enabled during app creation.
  // Client ID format: starts with "Ov23li" (20 chars) for OAuth Apps (not GitHub Apps).
  var CLIENT_ID = 'Ov23liW4P7BP1Ovixftr';

  // Token scopes requested from user
  // - public_repo: read/write to user's public repos (sufficient for our use case)
  // - read:user:   read user profile (login, avatar) to display in UI
  var SCOPES = 'public_repo,read:user';

  // Polling config (GitHub defaults: 5 sec interval, 15 min expiry)
  var DEFAULT_INTERVAL = 5; // seconds
  var DEFAULT_EXPIRY = 900; // 15 minutes

  // Storage keys
  var TOKEN_KEY = 'pixelary_oauth_token';
  var USER_KEY = 'pixelary_oauth_user';
  var TOKEN_EXPIRY_KEY = 'pixelary_oauth_token_expiry';

  // Token TTL — refresh after 7 days (GitHub tokens don't expire by default,
  // but we rotate to be safe). User can also revoke at any time.
  var TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // ---------- State ----------
  var pollTimer = null;
  var pollAbort = null;

  // ---------- Storage helpers ----------
  function saveToken(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
    } catch (e) {
      console.warn('Cannot save token to localStorage:', e);
    }
  }

  function getToken() {
    try {
      var token = localStorage.getItem(TOKEN_KEY);
      var expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
      if (!token) return null;
      if (Date.now() > expiry) {
        // Token expired (our local TTL) — clear it
        clearToken();
        return null;
      }
      return token;
    } catch (e) {
      return null;
    }
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (e) {}
  }

  // ---------- OAuth Device Flow ----------
  /**
   * Step 1: Request a device code from GitHub.
   * Returns { device_code, user_code, verification_uri, expires_in, interval }
   */
  function requestDeviceCode() {
    return fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: SCOPES,
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.error_description || err.error || 'Failed to start OAuth flow');
        });
      }
      return res.json();
    });
  }

  /**
   * Step 2: Poll the token endpoint until user authorizes or denies.
   * Resolves with { access_token, scope, token_type } on success.
   * Rejects on: denied, expired, slow_down, network error.
   */
  function pollForToken(deviceCode, interval) {
    return new Promise(function (resolve, reject) {
      var currentInterval = (interval || DEFAULT_INTERVAL) * 1000;
      pollAbort = false;

      function poll() {
        if (pollAbort) {
          reject(new Error('Polling aborted'));
          return;
        }

        fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.access_token) {
              resolve(data);
              return;
            }
            // Handle error responses
            var err = data.error;
            if (err === 'authorization_pending') {
              // User hasn't entered the code yet — keep polling
              pollTimer = setTimeout(poll, currentInterval);
            } else if (err === 'slow_down') {
              // GitHub asked us to slow down — increase interval by 5s
              currentInterval += 5000;
              pollTimer = setTimeout(poll, currentInterval);
            } else if (err === 'expired_token') {
              reject(new Error('کد منقضی شد. لطفاً دوباره تلاش کنید.'));
            } else if (err === 'access_denied') {
              reject(new Error('دسترسی رد شد. شما اجازه دسترسی به GitHub خود را لغو کردید.'));
            } else if (err === 'incorrect_device_code') {
              reject(new Error('کد دستگاه نادرست است.'));
            } else {
              reject(new Error('خطای OAuth: ' + (err || 'ناشناخته')));
            }
          })
          .catch(function (e) {
            // Network error — retry once after delay
            pollTimer = setTimeout(poll, currentInterval * 2);
          });
      }

      // Start polling after initial interval
      pollTimer = setTimeout(poll, currentInterval);
    });
  }

  /**
   * Step 3: Fetch the authenticated user's profile.
   * GET /user with the token.
   */
  function fetchUserProfile(token) {
    return fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
      },
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to fetch user profile: ' + res.status);
      return res.json();
    }).then(function (u) {
      return {
        login: u.login,
        id: u.id,
        name: u.name || u.login,
        avatar_url: u.avatar_url,
        html_url: u.html_url,
        public_repos: u.public_repos,
      };
    });
  }

  /**
   * Step 4: Revoke the token server-side (calls GitHub's revoke endpoint).
   * Best-effort — clearToken() is still called locally regardless.
   */
  function revokeToken(token) {
    // Note: revocation endpoint requires the client_secret, which we don't have client-side.
    // So we just clear local storage — the token remains valid until expiry (7 days),
    // but the user can revoke it from their GitHub settings at:
    // https://github.com/settings/applications
    return Promise.resolve();
  }

  // ---------- Public API ----------
  /**
   * Initiate the OAuth Device Flow.
   * Calls onStart with the device code + user code (so UI can display them),
   * then resolves with the final token + user profile.
   */
  function login(onStart) {
    return requestDeviceCode()
      .then(function (deviceResp) {
        // Notify UI to display the user_code
        if (onStart) onStart(deviceResp);

        // Begin polling
        return pollForToken(deviceResp.device_code, deviceResp.interval);
      })
      .then(function (tokenResp) {
        // Fetch user profile
        return fetchUserProfile(tokenResp.access_token).then(function (user) {
          saveToken(tokenResp.access_token, user);
          return { token: tokenResp.access_token, user: user };
        });
      });
  }

  function logout() {
    var token = getToken();
    clearToken();
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    pollAbort = true;
    if (token) {
      return revokeToken(token);
    }
    return Promise.resolve();
  }

  function isAuthenticated() {
    return !!getToken();
  }

  /**
   * Returns { token, user } if authenticated, otherwise null.
   */
  function getAuth() {
    var token = getToken();
    var user = getUser();
    if (token && user) return { token: token, user: user };
    return null;
  }

  /**
   * Update the OAuth Client ID at runtime (development convenience only).
   * In production, the Client ID is hardcoded above and this is a no-op override.
   * Disabled localStorage auto-load to prevent stale overrides on production.
   */
  function setClientId(clientId) {
    CLIENT_ID = clientId;
  }

  return {
    login: login,
    logout: logout,
    isAuthenticated: isAuthenticated,
    getAuth: getAuth,
    setClientId: setClientId,
    getClientId: function () { return CLIENT_ID; },
  };
})();
