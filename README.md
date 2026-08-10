# پیکسلری (Pixelary) 📸

> یک گالری تصاویر آزاد و بدون سرور — میزبانی‌شده روی GitHub Pages

[![Live Demo](https://img.shields.io/badge/live-demo-brightgreen)](https://betaversion488-oss.github.io)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Phase](https://img.shields.io/badge/phase-1%20MVP-orange)](docs/PHASES.md)

پیکسلری یک پلتفرم نمایش محتوای بصری است که کاملاً روی GitHub Pages اجرا می‌شود — بدون نیاز به سرور، پایگاه‌داده، یا حتی حساب کاربری برای مشاهده. تمام تصاویر از [Wikimedia Commons](https://commons.wikimedia.org) با مجوز Creative Commons یا Public Domain جمع‌آوری شده‌اند.

این پروژه نمونه‌ی عملی از معماری **JAMstack** است که در [whitepaper تحقیقاتی](https://github.com/betaversion488-oss/betaversion488-oss.github.io/blob/main/docs/WHITEPAPER.md) توضیح داده شده است.

## ✨ ویژگی‌ها

- 🚀 **بدون سرور**: کاملاً روی GitHub Pages رایگان
- 🔓 **بدون ورود**: مشاهده، جستجو، دانلود بدون حساب کاربری
- 📱 **موبایل‌اول**: طراحی واکنش‌گرا با bottom navigation و FAB
- 🌗 **تم تاریک/روشن**: با ذخیره تنظیمات کاربر
- ⚡ **سریع**: lazy loading، service worker، cache هوشمند
- 🔍 **جستجوی client-side**: بدون نیاز به backend
- 🏷️ **فیلتر دسته‌بندی**: ۷+ دسته موضوعی
- 📲 **PWA**: قابل نصب روی موبایل و دسکتاپ
- 🔒 **خصوصی‌محور**: بدون analytics، بدون ردیاب، بدون کوکی
- ♿ **دسترس‌پذیر**: semantic HTML، ARIA، keyboard navigation
- 🌐 **RTL**: پشتیبانی کامل از زبان فارسی

## 🏗️ معماری

```
┌─────────────────────────────────────────────────┐
│  GitHub Pages (CDN) — betaversion488-oss.github.io │
└─────────────────────────────────────────────────┘
                       ↑
        ┌──────────────┴──────────────┐
        │                             │
   Static HTML/CSS/JS            data/photos.json
   (no build step)              (scraped from Wikimedia)
        │                             │
   Vanilla JS fetches JSON,    Python scraper script
   renders gallery, handles    runs manually/CI to
   search, filter, routing     refresh data
```

**Tech Stack:**
- HTML5 semantic markup
- CSS3 with custom properties (no preprocessor)
- Vanilla ES6+ JavaScript (no framework, no bundler)
- Python scraper using Wikimedia Commons API
- PWA with Service Worker
- JSON-LD structured data for SEO

برای جزئیات کامل، به [سند معماری](docs/ARCHITECTURE.md) مراجعه کنید.

## 📁 ساختار پروژه

```
.
├── index.html              # صفحه اصلی گالری
├── photo.html              # صفحه جزئیات عکس
├── about.html              # درباره پروژه
├── submit.html             # راهنمای ارسال محتوا
├── legal.html              # مجوزها و حقوق
├── 404.html                # صفحه خطا
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── favicon.ico             # favicon
├── assets/
│   ├── css/style.css       # استایل اصلی
│   ├── js/
│   │   ├── ui.js           # تم، toast، lazy loading
│   │   ├── db.js           # data layer (load, filter, search)
│   │   ├── app.js          # gallery page logic
│   │   └── photo.js        # detail page logic
│   └── icons/              # PWA icons
├── data/
│   └── photos.json         # manifest همه عکس‌ها
├── scripts/
│   ├── scrape_commons.py   # scraper Wikimedia Commons
│   └── gen_icons.py        # generator PWA icons
└── docs/
    ├── ARCHITECTURE.md     # سند معماری
    ├── PHASES.md           # نقشه راه فازها
    ├── CONTRIBUTING.md     # راهنمای مشارکت
    ├── SEO.md              # تحلیل SEO
    ├── LEGAL.md            # مسائل قانونی
    └── API.md              # مرجع API
```

## 🚀 شروع سریع (توسعه محلی)

نیازی به build step نیست! کافیست فایل‌ها را روی یک HTTP server محلی serve کنید:

```bash
# با Python
python3 -m http.server 8080

# یا با Node
npx serve .

# سپس در مرورگر باز کنید
open http://localhost:8080
```

## 🔄 تازه‌سازی داده‌ها

برای دریافت عکس‌های جدید از Wikimedia Commons:

```bash
python3 scripts/scrape_commons.py
```

اسکریپت به‌صورت خودکار ۷ دسته‌بندی را scrape می‌کند و `data/photos.json` را به‌روزرسانی می‌کند.

## 📋 نقشه راه

پیکسلری در ۶ فاز توسعه داده می‌شود:

| فاز | محتوا | وضعیت |
|-----|--------|--------|
| ۱ | گالری تصاویر (عکس) | ✅ MVP فعال |
| ۲ | ویدیوهای کوتاه | 🚧 برنامه‌ریزی شده |
| ۳ | موسیقی و فایل‌های صوتی | 📋 در صف |
| ۴ | اپلیکیشن اندروید | 📋 در صف |
| ۵ | عوامل AI برای مرور و تأیید | 📋 در صف |
| ۶ | بازار نرم‌افزار آزاد | 📋 در صف |

برای جزئیات کامل هر فاز، به [سند نقشه راه](docs/PHASES.md) مراجعه کنید.

## 🤝 مشارکت

مشارکت‌ها welcome هستند! برای افزودن عکس‌های خود:

1. مخزن را Fork کنید
2. عکس‌ها را در `uploads/photos/` آپلود کنید
3. متادیتا را در `data/photos.json` اضافه کنید
4. Pull Request بفرستید

برای جزئیات، به [راهنمای مشارکت](docs/CONTRIBUTING.md) مراجعه کنید.

## 📄 مجوز

- **کد پروژه**: MIT License
- **تصاویر**: هر عکس مجوز خود را دارد (CC BY, CC BY-SA, CC0, Public Domain)
- **فونت Vazirmatn**: SIL Open Font License 1.1

## 📞 تماس

- [GitHub Issues](https://github.com/betaversion488-oss/betaversion488-oss.github.io/issues) — گزارش باگ، درخواست ویژگی، گزارش تخلف
- [Pull Requests](https://github.com/betaversion488-oss/betaversion488-oss.github.io/pulls) — مشارکت کد

## 🙏 اعتراف

- [Wikimedia Commons](https://commons.wikimedia.org) — منبع تمام تصاویر
- [Creative Commons](https://creativecommons.org) — مجوزها
- تمام عکاسان سخاوتمندی که کارشان را آزاد منتشر کرده‌اند

---

ساخته‌شده با ❤ روی GitHub Pages — © ۲۰۲۶ پیکسلری
