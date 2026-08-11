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

## فاز ۴: آپلود راحت محتوا (PWA) ✅

**هدف:** امکان آپلود راحت محتوا توسط کاربران غیرفنی — بدون نیاز به حساب GitHub یا دانش فنی.

**رویکرد:**

به جای ساخت APK اندروید بومی، یک **PWA (Progressive Web App)** قابل نصب روی اندروید ساخته شد. این رویکرد مزایای زیر را دارد:
- روی همه دستگاه‌ها (اندروید، iOS، دسکتاپ) کار می‌کند
- با "Add to Home Screen" مثل اپ بومی نصب می‌شود
- به دوربین و گالری دسترسی دارد (Web APIs)
- نیازی به نصب APK (و فعال‌سازی "منابع ناشناخته") ندارد
- به‌روزرسانی آن فوری و بی‌دردسر است

**قابلیت‌های پیاده‌سازی‌شده:**
- ✅ صفحه آپلود فارسی RTL (`upload.html`) با UX سه مرحله‌ای:
  1. انتخاب فایل (drag-and-drop، گالری، دوربین، یا ضبط ویدیو)
  2. تکمیل فرم متادیتا (عنوان، توضیحات، دسته، نویسنده، مجوز)
  3. ارسال با نوار پیشرفت و بازخورد زنده
- ✅ پیش‌نمایش فایل قبل از ارسال (عکس یا ویدیو)
- ✅ اعتبارسنجی فایل (نوع، حجم، ابعاد)
- ✅ آپلود فایل به catbox.moe (هاست رایگان، بدون ثبت‌نام، تا ۲۰۰MB)
- ✅ ساخت GitHub Issue به‌صورت خودکار با:
  - پیش‌نمایش محتوا (تصویر/ویدیو)
  - جدول اطلاعات کامل
  - بلوک YAML برای پردازش خودکار
  - labels: `submission`, `pending-review`, `type:photo|video`
- ✅ نوار پیشرفت با درصد و مرحله (آپلود → متادیتا → در صف بررسی)
- ✅ صفحه موفقیت با لینک به Issue برای پیگیری
- ✅ صفحه خطا با امکان تلاش مجدد
- ✅ Service Worker v4.0.0: cache برای upload.html، upload.css، upload.js + پشتیبانی از catbox.moe
- ✅ GitHub Action (`process-submission.yml`) برای پردازش خودکار Issues:
  - Trigger: وقتی label `approved` به Issue اضافه می‌شود
  - Parse YAML metadata از بدنه Issue
  - اعتبارسنجی فیلدها و مجوز
  - افزودن entry به `data/photos.json` یا `data/videos.json`
  - Comment با نتیجه و بستن Issue
- ✅ بنر تبلیغاتی روی صفحه اصلی (سبز برای تمایز)
- ✅ آیکون "ارسال" در bottom navigation (جایگزین submit.html)
- ✅ `submit.html` اکنون به‌صورت خودکار به `upload.html` redirect می‌شود

**فرآیند کار کاربر:**
```
کاربر → upload.html → انتخاب فایل → تکمیل فرم → کلیک ارسال
  ↓
آپلود به catbox.moe (با نوار پیشرفت)
  ↓
ساخت GitHub Issue (با embedded bot PAT)
  ↓
مدیر Issues را بررسی می‌کند → افزودن label "approved"
  ↓
GitHub Action → افزودن به data/photos.json یا videos.json → commit → close Issue
  ↓
محتوا در گالری نمایش داده می‌شود
```

**امنیت:**
- PAT استفاده‌شده در client-side JS متعلق به یک **bot account جداگانه** با اسکوپ `public_repo` است
- بدترین حالت: ایجاد Issueهای اسپم (که قابل حذف هستند)
- توصیه برای production: استفاده از serverless proxy (Cloudflare Worker، Vercel function)
- چرخش منظم PAT توصیه می‌شود

**تکنولوژی‌ها:**
- Web APIs: File, FileReader, URL.createObjectURL, MediaDevices (camera capture)
- XHR برای upload progress tracking
- fetch API برای GitHub Issues API
- catbox.moe API (هاست رایگان فایل)
- GitHub Actions + Python برای پردازش خودکار
- YAML metadata block برای parsing ساده

**وضعیت:** ✅ منتشرشده (نسخه ۴.۰.۰)

---

## فاز ۴: آپلود راحت محتوا (PWA) ✅ → بازنویسی شد در فاز ۵

**توجه:** معماری فاز ۴ (استفاده از bot PAT در client-side JS و آپلود همه محتوا به مخزن مرکزی) در فاز ۵ به‌طور کامل بازنویسی شد. دلیل: محتوای همه کاربران روی یک اکانت متمرکز می‌شد و PAT ربات در معرض خطر بود. توضیحات فاز ۵ زیر را ببینید.

---

## فاز ۵: معماری Federated — آپلود به مخزن شخصی کاربر ✅

**هدف:** هر کاربر محتوای خود را در **مخزن GitHub شخصی خودش** آپلود کند. مالکیت کاملاً واضح، حذف آسان، فضای نامحدود، بدون نشت PAT.

**مشکل فاز ۴ که حل شد:**
- ❌ همه محتوا در یک مخزن مرکزی انباشته می‌شد → محدودیت 5GB سریع پر می‌شد
- ❌ PAT ربات در client-side JS قابل استخراج بود (حتی با obfuscation)
- ❌ مالکیت محتوا مختلط می‌شد
- ❌ کاربر نمی‌توانست محتوای خود را مستقلاً حذف کند

**معماری جدید (Federated):**
```
کاربر ← OAuth Device Flow ← GitHub خودش
  ↓
بررسی: آیا {username}/pixelary-uploads وجود دارد؟
  ↓ NO
ایجاد خودکار مخزن (با README + manifest.json + GitHub Pages)
  ↓
آپلود فایل به uploads/{timestamp}-{slug}.{ext}
  ↓
به‌روزرسانی manifest.json (لیست محتواهای کاربر)
  ↓
ثبت در registry.json مرکزی (یک API call با bot PAT)
  ↓
GitHub Action ساعتانه ← manifest.json همه کاربران را merge می‌کند → data/federated.json
  ↓
گالری پیکسلری federated.json را می‌خواند و محتوای همه کاربران را نمایش می‌دهد
```

**قابلیت‌های پیاده‌سازی‌شده:**
- ✅ **OAuth Device Flow** برای ورود امن کاربران غیرفنی (`assets/js/oauth.js`)
  - کاربر کد ۸ کاراکتری را در github.com/login/device وارد می‌کند
  - توکن در localStorage ذخیره می‌شود (7 روز TTL)
  - اسکوپ: `public_repo,read:user` — فقط دسترسی به مخازن عمومی کاربر
- ✅ **ساخت خودکار مخزن شخصی** (`assets/js/repo.js`)
  - مخزن `{username}/pixelary-uploads` به‌صورت خودکار ساخته می‌شود
  - GitHub Pages به‌صورت خودکار فعال می‌شود
  - README و manifest.json اولیه ایجاد می‌شوند
- ✅ **آپلود به مخزن کاربر** (نه مخزن مرکزی)
  - فایل‌های ≤1MB: GitHub Contents API
  - فایل‌های >1MB: Git Blobs API (تا 100MB)
  - مسیر: `uploads/{timestamp}-{rand}-{slug}.{ext}`
- ✅ **manifest.json به‌روزرسانی می‌شود** با هر آپلود
- ✅ **ثبت در registry.json مرکزی** (تنها استفاده باقی‌مانده از bot PAT — فقط append به یک JSON)
- ✅ **GitHub Action ساعتانه** (`aggregate-federation.yml`) همه manifestها را تجمیع می‌کند
- ✅ **federated.json** برای گالری — شامل تمام محتوای همه کاربران ثبت‌شده
- ✅ **Service Worker v5.0.0** با پشتیبانی از `*.github.io` و `raw.githubusercontent.com`
- ✅ **UI احراز هویت**: auth gate، user chip، device code display، logout
- ✅ گالری اصلی (index.html) محتوای فدرال‌شده را با محتوای Wikimedia ادغام می‌کند

**مزایا:**
- ✓ مالکیت کاملاً واضح — هر کاربر محتوای خودش
- ✓ فضای ذخیره‌سازی نامحدود (هر کاربر 5GB جداگانه)
- ✓ حذف آسان — کاربر فقط فایل را از مخزن خود حذف می‌کند
- ✓ نشت PAT ربات فقط روی registry.json تأثیر دارد (یک فایل JSON)
- ✓ مقیاس‌پذیر — هزاران کاربر بدون فشار روی مخزن مرکزی

**نصب OAuth App (یک‌بار، توسط مدیر):**
1. به https://github.com/settings/applications/new بروید
2. Application name: `Pixelary Uploader`
3. Homepage URL: `https://betaversion488-oss.github.io`
4. Authorization callback URL: `https://betaversion488-oss.github.io/upload.html` (برای Device Flow لازم نیست ولی GitHub آن را می‌خواهد)
5. **Enable Device Flow** checkbox را تیک بزنید
6. Client ID را کپی کنید و در `assets/js/oauth.js` جایگزین `Ov23liPLACEHOLDER1234` کنید

**وضعیت:** ✅ منتشرشده (نسخه ۵.۰.۰) — OAuth App هنوز باید توسط مدیر ساخته شود

---

## فاز ۶: عوامل هوش مصنوعی 📋

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
| ۲.۵ | ریلز + IA | Q4 2026 | ✅ |
| ۳ | صوت | Q1 2027 | 📋 |
| ۴ | آپلود راحت (PWA) | Q4 2026 | ✅ |
| ۵ | AI | Q3 2027 | 📋 |
| ۶ | نرم‌افزار | Q4 2027 | 📋 |

**اصل راهنما:** هر فاز باید به‌صورت standalone قابل انتشار باشد. اگر فاز ۵ کنceled شد، فاز ۱-۴ همچنان کار می‌کنند.
