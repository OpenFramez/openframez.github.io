# OpenFramez OAuth CORS Proxy — Cloudflare Worker

## Why this exists

GitHub's OAuth Device Flow endpoints (`/login/device/code` and `/login/oauth/access_token`) **do not send CORS headers**. They were designed for CLI tools and mobile apps, not browser apps.

This means a static site on `github.io` **cannot call these endpoints directly** — the browser blocks the request with the cryptic error `Failed to fetch`.

This Worker is a transparent pass-through proxy that:
1. Receives the browser's POST request
2. Forwards it to GitHub with the same method, headers, and body
3. Returns GitHub's response with `Access-Control-Allow-Origin: *` so the browser accepts it

The Worker does **not** log, store, or modify the request body. The OAuth token returned by GitHub flows directly back to the user's browser.

## Deploy (5 minutes, free)

### 1. Sign up for Cloudflare
- Go to https://dash.cloudflare.com/sign-up
- Free tier: 100,000 requests/day (more than enough)

### 2. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 3. Deploy the Worker
From this directory:
```bash
cd cloudflare-worker
wrangler deploy
```

You'll see output like:
```
Published openframez-oauth (1.23 sec)
  https://openframez-oauth.<your-subdomain>.workers.dev
```

### 4. Update the site to use your Worker

Open `/assets/js/oauth.js` and change:

```js
var OAUTH_PROXY_BASE = 'https://proxy.cors.sh/';

function proxied(url) {
  return OAUTH_PROXY_BASE + url;
}
```

to:

```js
var OAUTH_PROXY_BASE = 'https://openframez-oauth.<your-subdomain>.workers.dev/?url=';

function proxied(url) {
  return OAUTH_PROXY_BASE + encodeURIComponent(url);
}
```

Replace `<your-subdomain>` with the subdomain Cloudflare assigned you.

### 5. Commit and push
```bash
git add assets/js/oauth.js
git commit -m "feat(oauth): use own Cloudflare Worker as CORS proxy"
git push origin main
```

After GitHub Pages rebuilds (~1 minute), the upload page will use your own Worker.

## Security notes

- **No `client_secret` is needed** — Device Flow doesn't use one. The Worker only forwards the public `client_id`.
- The Worker only adds CORS headers — it never inspects or modifies the body.
- The Worker is restricted to forwarding requests to `github.com` only (see `ALLOWED_HOSTS` in `oauth-proxy.js`), preventing it from being used as an open proxy.
- The OAuth token returned by GitHub flows directly back to the user's browser — the Worker doesn't log it.

## Cost

Cloudflare Workers free tier:
- 100,000 requests/day
- 10 ms CPU per request (more than enough for a pass-through)
- Always free, no credit card required

For OpenFramez's use case (each upload = ~3 OAuth requests), you'd need 33,000 uploads per day to hit the limit.
