/**
 * Pixelary OAuth CORS Proxy — Cloudflare Worker
 *
 * Why this exists:
 *   GitHub's OAuth Device Flow endpoints (/login/device/code and
 *   /login/oauth/access_token) do NOT send CORS headers, so a static site
 *   on github.io cannot call them directly — the browser blocks the request
 *   with "Failed to fetch".
 *
 *   This Worker is a transparent pass-through proxy that:
 *     1. Receives the browser's POST request
 *     2. Forwards it to GitHub with the same method, headers, and body
 *     3. Returns GitHub's response with `Access-Control-Allow-Origin: *`
 *        so the browser accepts it
 *
 *   The Worker does NOT log, store, or modify the request body. The OAuth
 *   token returned by GitHub flows directly back to the user's browser.
 *
 * Deploy:
 *   1. Sign up for a free Cloudflare account at https://dash.cloudflare.com/sign-up
 *   2. Install Wrangler CLI:  npm install -g wrangler
 *   3. Login:                  wrangler login
 *   4. Create this file as oauth-proxy.js
 *   5. Create wrangler.toml in the same directory:
 *
 *        name = "pixelary-oauth"
 *        main = "oauth-proxy.js"
 *        compatibility_date = "2024-09-01"
 *
 *   6. Deploy:  wrangler deploy
 *   7. Note the deployed URL (e.g. https://pixelary-oauth.YOUR-SUBDOMAIN.workers.dev)
 *   8. In /assets/js/oauth.js, change OAUTH_PROXY_BASE to:
 *        'https://pixelary-oauth.YOUR-SUBDOMAIN.workers.dev/?url='
 *      and update the proxied() function to URL-encode the upstream URL.
 *
 * Cost:
 *   Cloudflare Workers free tier = 100,000 requests/day. Pixelary's OAuth
 *   traffic will be a tiny fraction of that.
 *
 * Security:
 *   - No client_secret is needed (Device Flow doesn't use one).
 *   - The Worker only adds CORS headers — it never inspects or modifies the body.
 *   - Optionally restrict the `url` parameter to github.com to prevent abuse
 *     (see ALLOWED_HOSTS below).
 *
 * License: MIT
 */

const ALLOWED_HOSTS = ['github.com'];

export default {
  async fetch(request) {
    // Handle CORS preflight (OPTIONS) — must respond with 204 + CORS headers
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Only allow POST and OPTIONS
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // The upstream URL is appended to the path: /https://github.com/login/device/code
    // Or via ?url= query param. We support both.
    let upstreamUrl;
    const url = new URL(request.url);

    // Format 1: ?url=https://github.com/...
    if (url.searchParams.has('url')) {
      upstreamUrl = url.searchParams.get('url');
    } else {
      // Format 2: path starts with /https://...
      const fullPath = url.pathname.substring(1) + url.search;
      if (fullPath.startsWith('http://') || fullPath.startsWith('https://')) {
        upstreamUrl = fullPath;
      }
    }

    if (!upstreamUrl) {
      return new Response(JSON.stringify({ error: 'Missing upstream URL. Use ?url= or /<url>' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // Validate host against allowlist to prevent open-proxy abuse
    try {
      const parsed = new URL(upstreamUrl);
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        return new Response(JSON.stringify({ error: 'Host not allowed: ' + parsed.hostname }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid upstream URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // Forward the request to GitHub, preserving method, headers, and body
    const upstreamReq = new Request(upstreamUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    // Remove headers that shouldn't be forwarded to GitHub
    upstreamReq.headers.delete('host');
    upstreamReq.headers.delete('origin');
    upstreamReq.headers.delete('referer');

    try {
      const upstreamResp = await fetch(upstreamReq);

      // Clone the response and add CORS headers
      const resp = new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: upstreamResp.headers,
      });
      const corsH = corsHeaders();
      for (const [k, v] of Object.entries(corsH)) {
        resp.headers.set(k, v);
      }
      return resp;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Upstream fetch failed: ' + e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}
