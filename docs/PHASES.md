# نقشه راه فازهای پیکسلری

پیکسلری در ۶ فاز توسعه داده می‌شود. هر فاز یک قابلیت کلیدی جدید اضافه می‌کند و یک milestone قابل انتشار دارد.

## فاز ۱: گالری تصاویر (MVP) ✅

**هدف:** راه‌اندازی یک گالری تصاویر بدون سرور، بدون ورود، با محتوای واقعی.

**محتوا:**
- عکس‌های باکیفیت از Wikimedia Commons
- ۷+ دسته‌بندی (طبیعت، معماری، حیات وحش، غذا، ورزش، افراد، منظره)
- ۱۵۰+ عکس به‌عنوان محتوای اولیه

**قابلیت‌ها:**
- گالری grid واکنش‌گرا (mobile-first)
- صفحه جزئیات عکس با metadata کامل
- جستجوی client-side
- فیلتر دسته‌بندی
- تم تاریک/روشن
- PWA (قابل نصب، آفلاین)
- SEO بهینه (Open Graph، JSON-LD، sitemap)
- Bottom navigation موبایل
- FAB جستجو موبایل
- Lazy loading تصاویر
- Service Worker با cache هوشمند

**تکنولوژی‌ها:**
- HTML5, CSS3 (custom properties, grid, flexbox)
- Vanilla ES6+ JavaScript
- Python scraper برای Wikimedia Commons API
- PWA (manifest, service worker, icons)
- بدون build step، بدون framework

**وضعیت:** ✅ منتشرشده (نسخه ۱.۰.۰)

---

## فاز ۲: ویدیوهای کوتاه 🚧

**هدف:** افزودن پشتیبانی از ویدیوهای کوتاه (۲-۳۰ ثانیه) به گالری.

**محتوا:**
- ویدیوهای کوتاه از Internet Archive
- ویدیوهای CC-licensed از Wikimedia Commons
- ویدیوهای contribute شده توسط کاربران

**قابلیت‌های جدید:**
- Section جداگانه برای ویدیوها
- Player سفارشی با controls فارسی
- Loop, mute, autoplay on scroll (مثل اینستاگرام Reels)
- Quality selector (240p, 480p, 720p)
- Download با اعتبار کامل

**چالش‌های فنی:**
- **حجم فایل**: ویدیوها بزرگ‌تر از عکس‌ها. راه حل:
  - ذخیره روی GitHub LFS (محدودیت ۱GB 免费)
  - یا روی Internet Archive و embed کردن (مثل Wikimedia برای عکس‌ها)
  - یا استفاده از Cloudflare Stream (free tier)
- **Bandwidth**: ۱۰۰GB/month کافی نیست برای ویدیو. راه حل:
  - Cross-hosting: thumbnails روی GitHub، ویدیو روی archive.org
  - Progressive enhancement: preview با GIF، کلیک برای ویدیو کامل
- **Performance**: lazy load video, فقط زمانی که نزدیک viewport است

**نقشه راه:** Q4 2026

---

## فاز ۳: موسیقی و فایل‌های صوتی 📋

**هدف:** افزودن بخش موسیقی و podcast با محتوای آزاد.

**محتوا:**
- موسیقی از Free Music Archive (FMA)
- Podcast episodes از Internet Archive
- Field recordings از Wikimedia Commons

**قابلیت‌های جدید:**
- Audio player سفارشی با waveform visualization
- Playlist support
- Background playback (Media Session API)
- Download برای گوشی دادن آفلاین

**چالش‌های فنی:**
- **Waveform**: generate waveform image در build time یا client-side با Web Audio API
- **Background playback**: نیاز به Media Session API و Service Worker
- **Metadata**: ID3 tags parsing برای اطلاعات کامل

**نقشه راه:** Q1 2027

---

## فاز ۴: اپلیکیشن اندروید 📋

**هدف:** اپلیکیشن اندروید برای کاربران غیرفنی برای ارسال آسان محتوا.

**قابلیت‌ها:**
- انتخاب عکس/ویدیو از گالری موبایل
- Crop و edit اساسی (rotate, resize)
- افزودن metadata (title, description, category)
- OAuth با GitHub (Device Flow)
- ساخت PR به‌صورت خودکار
- مشاهده وضعیت PR
- دریافت notification وقتی PR merge شد

**تکنولوژی‌ها:**
- **React Native** (cross-platform) یا **Kotlin** (native Android)
- **GitHub OAuth Device Flow** برای authentication بدون WebView
- **Expo** برای build و distribution آسان

**چالش‌ها:**
- **OAuth Security**: Device Flow مناسب‌ترین برای اپ‌های موبایل
- **File Upload**: GitHub API محدودیت ۱۰۰MB/file دارد
- **User Experience**: باید ساده‌تر از Instagram باشد

**نقشه راه:** Q2 2027

---

## فاز ۵: عوامل هوش مصنوعی 📋

**هدف:** خودکارسازی فرآیندهای مرور، تأیید و مدیریت محتوا با AI.

**عوامل هوشمند:**

### ۵.۱. Content Approval Agent
- بررسی خودکار PRهای جدید
- تشخیص محتوای NSFW با تصویربرداری کامپیوتری
- بررسی کیفیت فنی (وضوح، composition)
- تطبیق metadata با محتوا
- پیشنهاد بهبود برای submitter

### ۵.۲. Legal Compliance Agent
- بررسی خودکار مجوزها
- تشخیص محتوای کپی‌رایت متقلبانه (reverse image search)
- اعتبارسنجی attribution
- flag کردن محتوای مشکوک

### ۵.۳. Content Discovery Agent
- Scrape منابع آزاد جدید (موزیم‌های دیجیتال، NASA، Europeana)
- پیشنهاد موضوعات trending
- categorize خودکار عکس‌های بدون دسته

### ۵.۴. Moderation Agent
- پایش Issues برای گزارش‌های تخلف
- triage خودکار (اولویت‌بندی)
- حذف سریع محتوای غیرقانونی
- گزارش ماهانه برای maintainers

**تکنولوژی‌ها:**
- **LangGraph** برای orchestration
- **LangChain** برای tool integration
- **OpenAI CLIP** برای image understanding
- **Google Vision API** برای NSFW detection (یا مدار local)
- **GitHub Actions** برای CI/CD خودکار

**چالش‌ها:**
- **هزینه**: APIهای AI پولی هستند. راه حل:
  - Use open-source models روی free tier (HuggingFace)
  - Local inference با Ollama
  - Hybrid: cheap model برای first pass، expensive برای borderline
- **False positives**: مدل‌ها اشتباه می‌کنند. راه حل:
  - Human-in-the-loop برای موارد حساس
  - Appeal process برای submitters
  - Logging کامل برای audit

**نقشه راه:** Q3 2027

---

## فاز ۶: بازار نرم‌افزار آزاد 📋

**هدف:** ایجاد یک marketplace برای نرم‌افزارهای آزاد و open-source.

**محتوا:**
- پروژه‌های کوچک open-source (CLI tools, libraries)
- تم‌ها و plugins
- Educational resources (tutorials, ebooks)
- Software categories: development, design, productivity, education

**قابلیت‌ها:**
- Browse by category, language, license
- Search با فیلترهای پیشرفته
- Detail page با README rendering (Markdown)
- Download با checksum verification
- Version history
- "Mirror from GitHub" feature

**چالش‌ها:**
- **Software Security**: malware detection برای هر upload
  - VirusTotal API برای scan
  - Sandboxed test execution
  - Community review برای releases
- **File size**: نرم‌افزار می‌تواند بزرگ باشد
  - Git LFS برای فایل‌های بزرگ
  - External mirrors (SourceForge, FossHub)
- **License Compliance**: بررسی خودکار SPDX license identifiers

**نقشه راه:** Q4 2027

---

## جمع‌بندی

| فاز | محتوا | زمان‌بندی | وضعیت |
|-----|--------|-----------|--------|
| ۱ | عکس | Q3 2026 | ✅ |
| ۲ | ویدیو | Q4 2026 | 🚧 |
| ۳ | صوت | Q1 2027 | 📋 |
| ۴ | اندروید | Q2 2027 | 📋 |
| ۵ | AI | Q3 2027 | 📋 |
| ۶ | نرم‌افزار | Q4 2027 | 📋 |

**اصل راهنما:** هر فاز باید به‌صورت standalone قابل انتشار باشد. اگر فاز ۵ کنceled شد، فاز ۱-۴ همچنان کار می‌کنند.
