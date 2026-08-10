# مرجع API پیکسلری

پیکسلری یک پلتفرم static است، بنابراین API سنتی (REST/GraphQL) ندارد. اما چند رابط برنامه‌نویسی دارد:

## ۱. Data File API

### `GET /data/photos.json`

manifest کامل همه عکس‌ها.

**Response:**
```json
{
  "version": "1.0.0",
  "generated_at": "2026-08-11T12:00:00Z",
  "source": "Wikimedia Commons",
  "source_url": "https://commons.wikimedia.org",
  "license_note": "All images are CC-licensed or public domain...",
  "total": 167,
  "categories": [
    {"slug": "nature", "label": "Nature & Landscapes"},
    {"slug": "architecture", "label": "Architecture"},
    ...
  ],
  "photos": [
    {
      "id": "fi_0001",
      "title": "...",
      "description": "...",
      "category": "nature",
      "category_label": "Nature & Landscapes",
      "thumbnail": "https://upload.wikimedia.org/...",
      "full": "https://upload.wikimedia.org/...",
      "width": 5184,
      "height": 3456,
      "thumb_width": 800,
      "thumb_height": 533,
      "license": "CC BY-SA 4.0",
      "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
      "author": "Author Name",
      "author_url": "https://commons.wikimedia.org/wiki/User:...",
      "source": "https://commons.wikimedia.org/wiki/File:...",
      "uploaded_at": "2019-09-17",
      "commons_page": "File:..."
    },
    ...
  ]
}
```

**استفاده:**
```bash
curl https://betaversion488-oss.github.io/data/photos.json
```

## ۲. JavaScript Module API

### `Pixelary` (global)

دسترسی به داده‌ها در browser.

#### Methods

##### `Pixelary.load(): Promise<Manifest>`

بارگذاری manifest از سرور. cache در memory.

```javascript
const data = await Pixelary.load();
console.log(data.total); // 167
```

##### `Pixelary.getById(id: string): Photo | null`

گرفتن یک عکس با ID.

```javascript
const photo = Pixelary.getById('fi_0001');
console.log(photo.title);
```

##### `Pixelary.getCategories(): Category[]`

لیست دسته‌بندی‌ها با count.

```javascript
const cats = Pixelary.getCategories();
// [{slug: 'nature', label: 'Nature & Landscapes', count: 13}, ...]
```

##### `Pixelary.getTotal(): number`

تعداد کل عکس‌ها.

##### `Pixelary.filter(options: FilterOptions): Photo[]`

فیلتر و جستجو.

```javascript
const results = Pixelary.filter({
  category: 'nature',     // optional: category slug
  query: 'mountain',      // optional: search query
  sort: 'newest',         // 'newest' | 'oldest'
});
```

##### `Pixelary.getRelated(photo: Photo, limit: number = 6): Photo[]`

عکس‌های مرتبط (همان دسته).

##### `Pixelary.getStats(): Stats`

آمار کلی.

```javascript
const stats = Pixelary.getStats();
// {total: 167, categories: 7, authors: 92}
```

### `UI` (global)

ابزارهای رابط کاربری.

#### Methods

##### `UI.initTheme()`

اعمال تم بر اساس localStorage یا OS preference.

##### `UI.toggleTheme()`

تغییر بین تم روشن و تاریک.

##### `UI.toast(message: string, type?: 'info'|'success'|'error', duration?: number)`

نمایش toast notification.

```javascript
UI.toast('عکس کپی شد', 'success', 2000);
```

##### `UI.setupLazyImages(root?: HTMLElement)`

راه‌اندازی lazy loading برای تصاویر `[data-src]` در scope داده‌شده.

##### `UI.escapeHtml(s: string): string`

Escape کاراکترهای HTML.

##### `UI.initials(name: string): string`

گرفتن initialهای نام (max 2 char).

##### `UI.formatDate(iso: string): string`

فرمت تاریخ ISO به صورت قابل خواندن.

##### `UI.licenseUrl(license: string): string`

گرفتن URL مجوز از نام مجوز.

##### `UI.photoUrl(id: string): string`

ساختن URL صفحه جزئیات عکس.

## ۳. URL Parameters

### Index page (`/`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | جستجوی اولیه |
| `cat` | string | دسته‌بندی اولیه |

مثال: `/?q=mountain&cat=nature`

### Photo page (`/photo.html`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (required) | ID عکس |

مثال: `/photo.html?id=fi_0001`

## ۴. Webhook (آینده)

در فاز ۵، GitHub Webhook برای PR events فعال خواهد شد. این به AI agents اجازه می‌دهد PRهای جدید را به‌صورت خودکار بررسی کنند.

## ۵. Embedding

### Embed یک عکس در سایت دیگر

```html
<a href="https://betaversion488-oss.github.io/photo.html?id=fi_0001">
  <img src="https://upload.wikimedia.org/..." alt="...">
</a>
```

**نکته**: thumbnail از Wikimedia CDN لود می‌شود، نه از پیکسلری. لطفاً [TOU Wikimedia](https://commons.wikimedia.org/wiki/Commons:Terms_of_Use) را رعایت کنید.

### RSS Feed (آینده)

در فاز ۲، RSS feed در `/feed.xml` فعال خواهد شد:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>پیکسلری — آخرین عکس‌ها</title>
    <link>https://betaversion488-oss.github.io/</link>
    <description>...</description>
    <item>
      <title>...</title>
      <link>https://betaversion488-oss.github.io/photo.html?id=...</link>
      <pubDate>...</pubDate>
    </item>
  </channel>
</rss>
```

## ۶. Schema.org Structured Data

### WebSite schema (در index.html)

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

### ImageObject schema (در photo.html)

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "contentUrl": "...",
  "thumbnailUrl": "...",
  "name": "...",
  "description": "...",
  "width": {"@type": "QuantitativeValue", "value": 5184},
  "height": {"@type": "QuantitativeValue", "value": 3456},
  "datePublished": "2019-09-17",
  "author": {"@type": "Person", "name": "...", "url": "..."},
  "license": "https://creativecommons.org/licenses/by-sa/4.0/",
  "creditText": "...",
  "copyrightNotice": "© ..., CC BY-SA 4.0"
}
```

## ۷. Service Worker API

### Caching Strategies

| Resource Type | Strategy | Cache Name |
|---------------|----------|------------|
| Static (HTML, CSS, JS) | Cache-first | `pixelary-v1.0.0-static` |
| Data (photos.json) | Network-first | `pixelary-v1.0.0-data` |
| Images (Wikimedia) | Stale-while-revalidate | `pixelary-v1.0.0-images` |
| Fonts (Google) | Cache-first | `pixelary-v1.0.0-static` |

### Manual Cache Control

```javascript
// در browser console:
caches.keys().then(keys => console.log(keys));
caches.delete('pixelary-v1.0.0-static');
```

## ۸. Scraper API (داخلی)

اسکریپت Python برای تازه‌سازی داده‌ها.

### Usage

```bash
python3 scripts/scrape_commons.py
```

### Configuration

ویرایش `scripts/scrape_commons.py`:

```python
CATEGORIES = [
    ("slug", "Label", "Category:Wikimedia_Category_Name"),
    ...
]
PER_CATEGORY = 30      # تعداد عکس در هر دسته
THUMB_WIDTH = 800      # عرض thumbnail
```

### Output

- `data/photos.json`: manifest کامل

## ۹. Rate Limits

### GitHub Pages

- ۱۰۰ GB/month bandwidth
- ۱ GB repository size
- ۱۰ minutes build time (در صورت استفاده از Actions)

### Wikimedia Commons API

- بدون rate limit صریح، اما User-Agent الزامی است
- درخواست‌های سریع ممکن است throttle شوند
- توصیه: ۱ درخواست در ۰.۳ ثانیه

## ۱۰. Versioning

- **API version**: در `data/photos.json` فیلد `version`
- **Schema changes**: backward-compatible، فقط افزودنی
- **Breaking changes**: حذف فیلدها، تغییر ساختار — با major version

---

برای سوالات بیشتر، [GitHub Issue](https://github.com/betaversion488-oss/betaversion488-oss.github.io/issues) باز کنید.
