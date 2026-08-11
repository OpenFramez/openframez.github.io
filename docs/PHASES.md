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

## فاز ۲: ویدیوهای کوتاه ✅

**هدف:** افزودن پشتیبانی از ویدیوهای کوتاه (۲-۳۰ ثانیه) به گالری.

**محتوا:**
- ویدیوهای کوتاه از Wikimedia Commons (با مجوز CC یا Public Domain)
- ۱۶ دسته‌بندی موضوعی (ساز موسیقی، علم، فضا، زیست‌شناسی، تلسکوپ، تایم‌لپس، طبیعت، سطح، طراحی، آزمایش، انیمیشن، تاریخ، فیزیک، هنر، منظره، موج)
- کیفیت‌های متعدد برای هر ویدیو (240p تا 2160p) — انتخاب پویا در مرورگر
- حجم متوسط ۴.۵ مگابایت به‌ازای هر ویدیو

**قابلیت‌های پیاده‌سازی‌شده:**
- ✅ Section جداگانه برای ویدیوها (`videos.html`)
- ✅ Player سفارشی با controls فارسی (Play/Pause, Mute, Loop, Fullscreen, Quality)
- ✅ Autoplay هنگام اسکرول (IntersectionObserver) — muted, looped
- ✅ Quality selector پویا (240p / 480p / 720p / 1080p / ...)
- ✅ Download با اعتبار کامل + لینک به صفحه منبع
- ✅ صفحه جزئیات با metadata کامل (ابعاد، مدت، حجم، فرمت، کیفیت‌ها)
- ✅ JSON-LD `VideoObject` برای SEO
- ✅ Lazy loading تصاویر بندانگشتی (posters)
- ✅ Service Worker با range-request awareness برای video streaming
- ✅ Loop toggle (default: فعال)
- ✅ Keyboard shortcuts (Space, M, F, L, ←/→)
- ✅ Sort: جدیدترین / قدیمی‌ترین / کوتاه‌ترین / بلندترین
- ✅ Search و filter بر اساس دسته
- ✅ Related videos در صفحه جزئیات

**تکنولوژی‌ها:**
- Python scraper (`scripts/scrape_videos.py`) با Wikimedia Commons API
- Vanilla ES6+ JavaScript (`video-player.js`, `videos.js`, `video.js`)
- استفاده از `videoinfo` API برای دریافت transcodes چندکیفیته
- `IntersectionObserver` برای autoplay هوشمند (فقط یک ویدیو همزمان)
- Service Worker با دفاع در برابر range requests

**وضعیت:** ✅ منتشرشده (نسخه ۲.۰.۰)

---

## فاز ۲.۵: ریلز + اینترنت آرکایو ✅

**هدف:** افزودن حالت «ریلز» تمام‌صفحه عمودی (مانند اینستاگرام ریلز / تیک‌تاک) و غنی‌سازی کاتالوگ ویدیوها با scrape از Internet Archive.

**محتوای جدید:**
- ۴۸ ویدیوی کوتاه (۵ تا ۶۰ ثانیه) از Internet Archive
  - ۴۲ تبلیغات قدیمی از مجموعه AdViews (Duke University Libraries) — ۱۹۵۰ تا ۱۹۸۰
  - ۵ کلیپ آرشیوی/هنری از Prelinger Archives (Amateur film, Countdown leader, Bongo Boards, etc.)
  - ۱ ویدیوی آموزشی ("Time Savers for House Makers")
- همه با مجوز Public Domain یا CC (فقط مجوزهای آزاد؛ NC/ND رد شدند)
- منبع: `https://archive.org/details/<id>` و `https://archive.org/download/<id>/<file>`

**قابلیت‌های جدید:**
- ✅ صفحه ریلز (`reels.html`) با scroll-snap عمودی (یک ریل در هر viewport)
- ✅ پخش خودکار هنگام اسکرول (IntersectionObserver، threshold 0.6)
- ✅ فقط یک ویدیو همزمان پخش می‌کند (بقیه متوقف و unload می‌شوند — مدیریت پهنای باند)
- ✅ کنترل‌های لمسی: تک‌ضربه = play/pause، دوضربه = پسندیدن (با animation قلب)
- ✅ نوار پیشرفت در بالا (قابل کلیک برای seek)
- ✅ ریل عملیات در سمت چپ (RTL): پسندیدن، صدا، اشتراک، تکرار
- ✅ Overlay پایین: عنوان، سازنده، مجوز، توضیح، لینک‌های منبع/دانلود/جزئیات
- ✅ حرکات کلیدبری: ↑/↓ یا j/k برای ناوبری، space برای play/pause، m برای mute، l برای like
- ✅ Anchor hash برای اشتراک‌گذاری موقعیت (مثلاً `reels.html#ia_0001`)
- ✅ Lazy loading: تنها ۸ ریل اول رندر می‌شوند، باقی هنگام نیاز (حدود ۳ ریل تا انتها)
- ✅ شیوه‌نامه RTL کامل با پشتیبانی safe-area (notch)، `100dvh` برای mobile URL bar
- ✅ در دسکتاپ، فید در یک ستون ۴۸۰px در مرکز صفحه (حس app-like)

**ادغام با کاتالوگ موجود:**
- ✅ گالری `videos.html` اکنون هم ویدیوهای Wikimedia و هم IA را به‌صورت interleaved نمایش می‌دهد
- ✅ صفحه جزئیات `video.html` با هر دو نوع ID کار می‌کند (`fv_*` و `ia_*`)
- ✅ ویدیوهای مرتبط از هر دو منبع پیشنهاد می‌شوند
- ✅ آمار ترکیبی (مجموع ویدیوها، دسته‌ها، سازندگان، مدت زمان)
- ✅ جستجو در هر دو منبع به‌طور همزمان
- ✅ Service Worker v2.5.0: cache برای `archive.org` (تصاویر + ویدیو)، range-request aware

**اسکریپر Python:**
- `scripts/scrape_internet_archive.py` — advancedsearch.php + metadata API
- فیلتر duration ≤ 60s، فیلتر حجم ≤ 10MB، فیلتر مجوز آزاد
- انتخاب کوچکترین derivative با کیفیت ≥ 240p
- نرمال‌سازی schema برای تطابق با `videos.json`
- Cleanup خودکار: حذف opensource_movies نامعتبر، re-categorize بر اساس عنوان

**وضعیت:** ✅ منتشرشده (نسخه ۲.۵.۰)

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
| ۲ | ویدیو | Q4 2026 | ✅ |
| ۳ | صوت | Q1 2027 | 📋 |
| ۴ | اندروید | Q2 2027 | 📋 |
| ۵ | AI | Q3 2027 | 📋 |
| ۶ | نرم‌افزار | Q4 2027 | 📋 |

**اصل راهنما:** هر فاز باید به‌صورت standalone قابل انتشار باشد. اگر فاز ۵ کنceled شد، فاز ۱-۴ همچنان کار می‌کنند.
