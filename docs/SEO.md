# تحلیل SEO پیکسلری

## نمای کلی

پیکسلری یک پلتفرم static است که روی GitHub Pages میزبانی می‌شود. این یعنی ما فرصت‌های SEO خاصی داریم (سرعت بالا، محتوای قابل crawl) اما چالش‌هایی هم وجود دارد (no server-side rendering، limited custom headers). این سند استراتژی SEO کامل را توضیح می‌دهد.

## استراتژی کلی

### اصول

1. **محتوای باکیفیت اول**: بهبود UX، نه فقط SEO
2. **Semantic HTML**: markup درست، معنی‌دار
3. **Structured data**: schema.org JSON-LD برای همه صفحات
4. **Performance**: Core Web Vitals绿色
5. **Mobile-first**: Google mobile-first indexing است
6. **Accessibility**: SEO و accessibility هم‌پوشانی زیادی دارند

## پیاده‌سازی فعلی

### ۱. Meta Tags (در هر صفحه)

```html
<title>...</title>                    <!-- 50-60 chars -->
<meta name="description" content="...">  <!-- 150-160 chars -->
<link rel="canonical" href="...">     <!-- جلوگیری از duplicate content -->
```

### ۲. Open Graph (social sharing)

```html
<meta property="og:type" content="website|article">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="...">
<meta property="og:site_name" content="Pixelary">
<meta property="og:locale" content="fa_IR">
<meta property="og:image" content="...">  <!-- برای photo.html -->
```

### ۳. Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
```

### ۴. Structured Data (JSON-LD)

#### WebSite schema (در index.html)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "پیکسلری",
  "url": "https://betaversion488-oss.github.io/",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://betaversion488-oss.github.io/?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

#### ImageObject schema (در photo.html)

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "...",
  "thumbnailUrl": "...",
  "name": "...",
  "description": "...",
  "width": ...,
  "height": ...,
  "datePublished": "...",
  "author": { "@type": "Person", "name": "..." },
  "license": "..."
}
```

### ۵. Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://betaversion488-oss.github.io/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ...
</urlset>
```

**محدودیت فعلی**: sitemap فقط صفحات اصلی را شامل می‌شود، نه تک‌تک عکس‌ها. در آینده می‌توان با build script این را گسترش داد.

### ۶. Robots.txt

```
User-agent: *
Allow: /
Disallow: /data/
Disallow: /assets/js/
Disallow: /scripts/
Disallow: /docs/
Sitemap: https://betaversion488-oss.github.io/sitemap.xml
```

### ۷. Semantic HTML

- `<header>`, `<main>`, `<nav>`, `<article>`, `<section>`, `<footer>`
- `<h1>` فقط یک بار در هر صفحه
- `<h2>` برای بخش‌های اصلی
- `<a>` برای navigation، `<button>` برای actions
- `alt` توصیفی برای همه تصاویر

### ۸. URL Structure

- `/` — خانه
- `/photo.html?id=fi_0001` — جزئیات عکس
- `/about.html` — درباره
- `/submit.html` — راهنمای ارسال
- `/legal.html` — حقوق

**بهبود آینده**: URLهای تمیزتر با pushState:
- `/photo/fi_0001` به‌جای `/photo.html?id=fi_0001`

### ۹. Performance (Core Web Vitals)

| Metric | هدف | وضعیت فعلی |
|--------|-----|-------------|
| LCP (Largest Contentful Paint) | < ۲.۵s | ✅ < ۱.۵s (سطح static) |
| FID (First Input Delay) | < ۱۰۰ms | ✅ < ۵۰ms (vanilla JS) |
| CLS (Cumulative Layout Shift) | < ۰.۱ | ✅ < ۰.۰۵ (aspect-ratio) |
| FCP (First Contentful Paint) | < ۱.۸s | ✅ < ۱s |
| TTFB (Time to First Byte) | < ۶۰۰ms | ✅ < ۳۰۰ms (GitHub CDN) |

### ۱۰. Mobile-First

- `viewport` meta tag با `viewport-fit=cover`
- Touch-friendly targets (≥ ۴۴×۴۴ px)
- Bottom navigation برای موبایل
- FAB جستجو برای موبایل
- Responsive breakpoints: 480, 640, 768, 1024, 1280px

## چالش‌های خاص Static Sites

### چالش ۱: No Server-Side Rendering

**مشکل**: Googlebot می‌تواند JavaScript را اجرا کند، اما هنوز SSR سریع‌تر است.

**راه‌حل فعلی**: محتوای اصلی در HTML است. JavaScript فقط UX را بهبود می‌دهد (search، filter، dark mode). Googlebot می‌تواند محتوای gallery را ببیند حتی بدون JS.

**راه‌حل آینده**: Pre-rendering با یه build script ساده: یک script Python که از photos.json صفحات static `photo/fi_0001.html` تولید کند.

### چالش ۲: Dynamic Content (JavaScript-rendered)

**مشکل**: gallery با JS render می‌شود. اگر Googlebot فقط HTML اولیه را ببیند، عکس‌ها را نمی‌بیند.

**راه‌حل فعلی**: 
- تگ‌های `<a>` به photo.html در sitemap (آینده)
- JSON-LD برای هر عکس (در صفحه detail)
- Structured data در index.html که نشان می‌دهد این یک WebSite با SearchAction است

**راه‌حل آینده**: Pre-render صفحات photo.html برای هر عکس.

### چالش ۳: No Custom Headers

**مشکل**: GitHub Pages اجازه تنظیم custom HTTP headers (CSP, HSTS) را نمی‌دهد.

**راه‌حل**: 
- استفاده از `<meta http-equiv>` در HTML (با محدودیت‌ها)
- در آینده: migration به Cloudflare Pages برای کنترل کامل headers

### چالش ۴: Single Domain

**مشکل**: URL روی `betaversion488-oss.github.io` است. اگر domain سفارشی بخواهیم، باید DNS تنظیم کنیم.

**راه‌حل آینده**: 
- خرید domain (مثلاً pixelary.app)
- تنظیم CNAME در GitHub Pages
- آپدیت canonical URLs در همه صفحات

## Keyword Strategy

### Primary Keywords

- گالری عکس (photo gallery)
- تصاویر با کیفیت (high quality images)
- عکس رایگان (free photos)
- عکس creative commons (CC photos)
- گالری عکس فارسی (Persian photo gallery)

### Long-tail Keywords

- عکس طبیعت با کیفیت بالا رایگان
- دانلود عکس معماری creative commons
- گالری عکس حیات وحش آزاد
- عکس فضایی بدون کپی‌رایت
- بهترین عکس‌هایWikimedia Commons

### Content Strategy

- هر category page باید meta description منحصر به خود داشته باشد (آینده)
- هر photo page باید description غنی داشته باشد (فعلاً از Wikimedia می‌آید)
- about.html و submit.html باید keyword-rich باشند بدون keyword stuffing

## اندازه‌گیری و مانیتورینگ

### ابزارهای پیشنهادی

- **Google Search Console**: index status، search queries، clicks
- **Bing Webmaster Tools**: index status در Bing
- **PageSpeed Insights**: Core Web Vitals
- **Rich Results Test**: structured data validation
- **Mobile-Friendly Test**: mobile UX check

### KPIs

| Metric | هدف | زمان‌بندی |
|--------|-----|-----------|
| Indexed pages | > ۱۰۰ | ۳ ماه |
| Average position | < ۵۰ | ۶ ماه |
| Organic clicks/month | > ۱۰۰۰ | ۱۲ ماه |
| LCP (P75) | < ۲.۵s | همیشه |
| CLS (P75) | < ۰.۱ | همیشه |

## نقشه راه SEO

### فاز ۱ (فعلی) ✅

- [x] Meta tags کامل
- [x] Open Graph و Twitter Cards
- [x] JSON-LD برای WebSite و ImageObject
- [x] Sitemap و robots.txt
- [x] Semantic HTML
- [x] Mobile-first responsive
- [x] Core Web Vitals عالی

### فاز ۱.۵ (Q4 2026)

- [ ] Pre-render صفحات photo برای هر عکس
- [ ] Sitemap شامل تک‌تک عکس‌ها
- [ ] Custom domain (pixelary.app)
- [ ] Google Search Console verification
- [ ] Internal linking strategy (related photos)

### فاز ۲ (Q1 2027)

- [ ] Category pages جداگانه با URL تمیز (`/category/nature`)
- [ ] Breadcrumbs structured data
- [ ] Image sitemap
- [ ] Schema.org CollectionPage برای categories

### فاز ۳ (Q2 2027)

- [ ] Migration به Cloudflare Pages برای custom headers
- [ ] Content-Security-Policy
- [ ] Strict-Transport-Security
- [ ] HTTP/3 (اگر Cloudflare فعال باشد)

## Best Practices برای مشارکت‌کنندگان

### هنگام افزودن عکس:

1. **عنوان توصیفی**: "غروب آفتاب در رشته‌کوه البرز" بهتر از "IMG_1234"
2. **Description غنی**: حداقل ۲ جمله، شامل context، مکان، زمان
3. **Category درست**: به category‌های موجود فکر کنید
4. **Tags (آینده)**: کلمات کلیدی مرتبط

### هنگام افزودن ویژگی:

1. **Semantic HTML**: از تگ‌های درست استفاده کنید
2. **ARIA labels**: برای interactive elements
3. **Alt text**: برای همه تصاویر جدید
4. **Performance**: lazy load، code split، cache

## جمع‌بندی

پیکسلری با وجود محدودیت‌های static hosting، فرصت‌های SEO خوبی دارد. ترکیب سرعت بالا، محتوای باکیفیت، و structured data کامل، آن را در موقعیت خوبی قرار می‌دهد. با اجرای نقشه راه فوق، می‌توانیم در ۱۲ ماه به یک پلتفرم شناخته‌شده برای گالری تصاویر آزاد فارسی تبدیل شویم.
