# معماری پیکسلری

## نمای کلی

پیکسلری یک پلتفرم نمایش تصاویر بدون سرور (serverless) است که از معماری **JAMstack** پیروی می‌کند. تمام محتوا به‌صورت ایستا (static) ارائه می‌شود و هیچ backend, database, یا authentication server وجود ندارد.

```
┌──────────────────────────────────────────────────────────┐
│                    کاربر (Browser)                       │
│  ┌──────────────────────────────────────────────────┐    │
│  │  HTML + CSS + Vanilla JS                         │    │
│  │  ├── UI module (theme, toast, lazy load, helpers)│    │
│  │  ├── DB module (fetch photos.json + videos.json) │    │
│  │  ├── App module (photo gallery)                  │    │
│  │  ├── Photo module (photo detail page)            │    │
│  │  ├── Videos module (video gallery)        [P2]   │    │
│  │  ├── Video module (video detail page)     [P2]   │    │
│  │  └── Video Player (custom Persian player) [P2]   │    │
│  └──────────────────────────────────────────────────┘    │
│                          ↕                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Service Worker (cache, offline, range requests) │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌──────────────────────────────────────────────────────────┐
│              GitHub Pages CDN                            │
│  ├── index.html, videos.html, video.html, photo.html    │
│  ├── assets/css/style.css                                │
│  ├── assets/js/{ui,db,app,photo,videos,video,            │
│  │              video-player}.js                         │
│  ├── data/photos.json + data/videos.json                 │
│  └── uploads/photos/* (user-contributed)                 │
└──────────────────────────────────────────────────────────┘
                          ↑
                ┌─────────┴─────────┐
                │                   │
┌───────────────┴──────┐  ┌────────┴──────────────┐
│  Python Scrapers     │  │  User Pull Requests   │
│  scrape_commons.py   │  │  (uploads/photos/ +   │
│  scrape_videos.py    │  │   data/*.json)        │
│  Runs locally or CI  │  │                       │
└──────────────────────┘  └───────────────────────┘
                          ↓
                ┌────────────────────────┐
                │  Maintainer Review     │
                │  (human, future: AI)   │
                └────────────────────────┘
```

**[P2]** = Phase 2 addition (videos)

## اصول طراحی

### ۱. بدون Build Step

پیکسلری به‌عمد از هیچ ابزار build (Webpack, Rollup, Vite) استفاده نمی‌کند. این انتخاب بر اساس دلایل زیر است:

- **سادگی**: هر کسی می‌تواند بدون نصب ابزار خاصی، سورس را باز کند و اجرا کند
- **سرعت توسعه**: تغییر فایل → refresh → نتیجه فوری
- **attack surface کمتر**: بدون dependency، بدون vulnerability در supply chain
- **شفافیت**: کد در مرورگر دقیقاً همان چیزی است که در repo است
- **debug آسان**: هیچ source map یا transpile ای لازم نیست

### ۲. Vanilla JavaScript

به‌جای React, Vue, یا Svelte، از JavaScript خالص ES6+ استفاده می‌کنیم. دلایل:

- **حجم صفر**: هیچ framework runtime load نمی‌شود
- **پایداری**: APIهای vanilla JS پایدارند و هرگز breaking change ندارند
- **یادگیری آسان**: هر توسعه‌دهنده‌ای می‌تواند بدون یادگیری framework جدید مشارکت کند
- **عملکرد عالی**: برای حجم کاری ما (تا ۱۰۰۰ عکس)، vanilla JS کافی است

### ۳. Mobile-First

طراحی با اولویت موبایل:

- Breakpoints: 480px → 640px → 768px → 1024px → 1280px
- Bottom navigation (مثل اینستاگرام) برای موبایل
- FAB جستجو روی موبایل، search bar در هدر دسکتاپ
- Touch-friendly targets (حداقل 44×44 px)
- `viewport-fit=cover` برای safe area در iPhone
- `env(safe-area-inset-bottom)` برای bottom nav

### ۴. Progressive Enhancement

- محتوای اصلی (HTML) بدون JS هم قابل خواندن است
- JavaScript تجربه را بهبود می‌بخشد (lazy loading, search, etc.)
- Service Worker یک enhancement است — بدون آن هم سایت کار می‌کند
- تم تاریک با fallback به `prefers-color-scheme`

## لایه‌ها

### لایه ۱: Data Layer (`db.js`)

مسئولیت: load, cache, query داده‌ها.

```javascript
Pixelary.load()              // Promise<manifest>
Pixelary.getById(id)         // photo object
Pixelary.getCategories()     // [{slug, label, count}]
Pixelary.getTotal()          // number
Pixelary.filter({category, query, sort})  // photo[]
Pixelary.getRelated(photo, n) // photo[]
Pixelary.getStats()          // {total, categories, authors}
```

ویژگی‌ها:
- In-memory cache بعد از اولین fetch
- Pre-built search index برای جستجوی سریع
- Token-based scoring برای relevance ranking
- No external dependencies

### لایه ۲: UI Layer (`ui.js`)

مسئولیت: theme, toast, lazy loading, helpers.

- Theme management با localStorage و OS preference detection
- Toast notification system
- IntersectionObserver برای lazy loading تصاویر
- HTML escaping, URL helpers, date formatting

### لایه ۳: Page Logic (`app.js`, `photo.js`)

مسئولیت: rendering, event handling, routing per page.

- `app.js`: gallery home (category filter, search, infinite scroll)
- `photo.js`: detail page (metadata, related, share)

### لایه ۴: Service Worker (`sw.js`)

مسئولیت: caching, offline support.

استراتژی‌های caching:
- **Static assets**: cache-first (HTML, CSS, JS)
- **Data**: network-first (photos.json)
- **Images**: stale-while-revalidate (Wikimedia thumbnails)
- **Fonts**: cache-first (Google Fonts)

## جریان داده

### ۱. بارگذاری اولیه

```
User opens betaversion488-oss.github.io
  ↓
Browser fetches index.html (cache-first via SW)
  ↓
index.html loads CSS, ui.js, db.js, app.js (parallel, cache-first)
  ↓
app.js calls Pixelary.load() → fetches data/photos.json (network-first)
  ↓
DB module builds search index in-memory
  ↓
app.js renders category chips + first 24 photo cards
  ↓
IntersectionObserver triggers lazy-loading for visible thumbnails
  ↓
Thumbnails loaded from Wikimedia CDN (stale-while-revalidate)
```

### ۲. جستجو

```
User types "mountain" in search box
  ↓
Debounced 250ms
  ↓
Pixelary.filter({query: "mountain"})
  ↓
Tokenize query → ["mountain"]
  ↓
For each photo, score = sum of token matches in title/description/author/category
  ↓
Sort by score descending
  ↓
Re-render gallery with results
```

### ۳. مشاهده جزئیات عکس

```
User clicks photo card
  ↓
Browser navigates to photo.html?id=fi_0001
  ↓
photo.html loads (cache-first)
  ↓
photo.js reads ?id from URL
  ↓
Pixelary.getById("fi_0001") → photo object (from cache)
  ↓
Render: image, title, author, license, description, metadata
  ↓
Pixelary.getRelated(photo, 10) → render related grid
  ↓
Update document.title, meta tags, JSON-LD for SEO
```

## محدودیت‌های GitHub Pages

| محدودیت | مقدار | استراتژی ما |
|---------|-------|-------------|
| Repository size | ۱ GB | تصاویر در Wikimedia، فقط metadata در repo |
| File size | ۱۰۰ MB | photos.json ≈ ۲۰۰ KB، خیلی کمتر از حد |
| Bandwidth | ۱۰۰ GB/month | Thumbnails از Wikimedia CDN، نه از GitHub |
| Build time | ۱۰ min | بدون build، فوری |
| Custom domains | ✓ | در آینده قابل اضافه کردن |

## نکات عملکرد

### اولویت‌های Core Web Vitals

- **LCP (Largest Contentful Paint)**: < ۲.۵ ثانیه
  - HTML سبک (~۱۲ KB)
  - CSS سبک (~۲۰ KB)
  - First photo thumbnail در viewport برای LCP
- **FID (First Input Delay)**: < ۱۰۰ ms
  - JS کم حجم، تقسیم به ماژول‌های کوچک
  - Debounce روی event handlers
- **CLS (Cumulative Layout Shift)**: < ۰.۱
  - `aspect-ratio` روی photo cards
  - `width` و `height` روی images
  - Skeleton loaders

### بهینه‌سازی‌ها

- **Lazy loading**: تصاویر با IntersectionObserver
- **Code splitting**: page-specific JS (app.js, photo.js)
- **Preconnect**: برای Google Fonts و Wikimedia
- **Cache headers**: GitHub Pages به‌صورت پیش‌فرض cache مناسب تنظیم می‌کند
- **Service Worker**: offline support و cache هوشمند
- **Image format**: JPEG از Wikimedia با width=800px (بهینه برای gallery)

## انتخاب‌های طراحی قابل بحث

### چون هیچ build step نداریم:

❌ نمی‌توانیم TypeScript استفاده کنیم
❌ نمی‌توانیم PostCSS یا SCSS استفاده کنیم
❌ نمی‌توانیم tree-shake یا minify کنیم
✅ کد ساده، خوانا، و قابل debug است

### چون هیچ backend نداریم:

❌ نمی‌توانیم search server-side انجام دهیم (در عوض: client-side)
❌ نمی‌توانیم analytics جمع‌آوری کنیم (و این عمداً است)
❌ نمی‌توانیم user-generated content را به‌صورت real-time پذیرش کنیم (در عوض: PR-based)
✅ هیچ هزینه سرور، هیچ نگهداری، هیچ scaling concern

### چون از GitHub Pages استفاده می‌کنیم:

❌ Rate limit: ۱۰۰GB/month bandwidth
❌ نمی‌توانیم SSR یا edge functions داشته باشیم
❌ Custom headers (CSP, HSTS) قابل تنظیم نیست
✅ کاملاً رایگان، با HTTPS رایگان، با CDN جهانی

## مسیر ارتقا (Future Scaling)

اگر روزی از GitHub Pages فراتر برویم:

1. **Cloudflare Pages**: همان static hosting، اما با custom headers و Workers
2. **Netlify/Vercel**: با Edge Functions برای server-side search
3. **Self-hosted on VPS**: برای کنترل کامل، با Nginx + CDN

اما تا زمانی که زیر ۱۰۰GB/month bandwidth هستیم، GitHub Pages کافی است.
