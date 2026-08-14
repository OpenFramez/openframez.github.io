# راهنمای مشارکت در اُپن‌فریمز

از مشارکت شما در اُپن‌فریمز استقبال می‌کنیم! این سند راهنمای کاملی برای انواع مشارکت است.

## انواع مشارکت

### ۱. افزودن عکس جدید

محبوب‌ترین نوع مشارکت. فرآیند کامل:

#### پیش‌نیازها

- حساب GitHub (رایگان)
- عکسی که شما حق انتشار آن را دارید (عکس خودتان، یا با مجوز صریح صاحب)
- فرمت: JPEG، PNG یا WebP
- حداقل ابعاد: ۱۲۰۰px در بزرگ‌ترین ضلع
- حداکثر حجم: ۵MB (thumbnail) — فایل اصلی تا ۲۵MB

#### مراحل

۱. **Fork کنيد**: به [مخزن اصلی](https://github.com/OpenFramez/openframez.github.io) بروید و روی Fork کلیک کنید.

۲. **عکس را آپلود کنید**: در fork خود، فایل را به پوشه `uploads/photos/` اضافه کنید. نام فایل را به انگلیسی و توصیفی انتخاب کنید:
   ```
   uploads/photos/sunset-mountains-alborz-2026.jpg
   ```
   نه:
   ```
   uploads/photos/IMG_1234.jpg
   uploads/photos/عکس من.jpg
   ```

۳. **متادیتا را اضافه کنید**: فایل `data/photos.json` را باز کنید. در پایان آرایه `photos` یک entry اضافه کنید:

```json
{
  "id": "user_0001",
  "title": "غروب آفتاب در رشته‌کوه البرز",
  "description": "نمایی از غروب آفتاب روی قله‌های البرز در زمستان ۱۴۰۴.",
  "category": "nature",
  "category_label": "Nature & Landscapes",
  "thumbnail": "uploads/photos/sunset-mountains-alborz-2026.jpg",
  "full": "uploads/photos/sunset-mountains-alborz-2026.jpg",
  "width": 4000,
  "height": 2667,
  "thumb_width": 800,
  "thumb_height": 533,
  "license": "CC BY 4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "author": "Your Name",
  "author_url": "https://github.com/your-username",
  "source": "Original work",
  "uploaded_at": "2026-08-11",
  "commons_page": ""
}
```

**نکته ID**: برای عکس‌های کاربران، پیشوند `user_` با شماره ۴ رقمی استفاده کنید. به‌طور ایده‌آل، شماره‌ای که قبلاً استفاده نشده است.

۴. **Commit کنید**: با پیام واضح:
   ```
   Add: sunset-mountains-alborz-2026.jpg
   ```

۵. **Pull Request بزنید**: به fork خود بروید، روی "Compare & pull request" کلیک کنید. در توضیحات بنویسید:
   - منبع عکس (اگر کار خودتان است، ذکر کنید)
   - مجوز (CC BY 4.0 پیش‌فرض خوب است)
   - هر توضیح اضافی

۶. **منتظر بررسی باشید**: تیم بررسی در کمتر از ۷۲ ساعت PR شما را بررسی می‌کند. ممکن است بازخورد بدهیم یا تغییرات جزئی request کنیم.

### ۲. گزارش باگ

اگر باگی پیدا کردید:

۱. به [GitHub Issues](https://github.com/OpenFramez/openframez.github.io/issues) بروید
۲. روی "New Issue" کلیک کنید
۳. از template باگ استفاده کنید (یا بنویسید):
   - **خلاصه**: یک جمله describing مشکل
   - **مرورگر/OS**: مثلاً Chrome 120 روی Android 14
   - **مراحل reproduction**: شماره‌گذاری شده
   - **رفتار مورد انتظار**: چه باید اتفاق بیفتد
   - **رفتار واقعی**: چه اتفاقی افتاد
   - **اسکرین‌شات**: اگر ممکن است

### ۳. درخواست ویژگی

اگر ایده‌ای برای ویژگی جدید دارید:

۱. Issue جدید باز کنید با label "enhancement"
۲. **مشکل را توضیح دهید**: چه نیاز пользователя را برآورده می‌کند
۳. **راه‌حل پیشنهادی**: چطور فکر می‌کنید باید حل شود
۴. **جایگزین‌ها**: چه راه‌های دیگری ممکن است

### ۴. بهبود کد

اگر می‌خواهید کد را بهبود ببخشید:

۱. Issue باز کنید و توضیح دهید چه چیزی را بهبود می‌دهید و چرا
۲. صبر کنید تا discuss شود (ممکن است بخواهیم راه‌حل متفاوت پیشنهاد دهیم)
۳. Fork، branch، commit، PR
۴. مطمئن شوید code style همخوانی دارد

## Code Style

### JavaScript

- ES6+ syntax (arrow functions, destructuring, template literals)
- ۲ space indentation
- Single quotes برای strings
- Trailing commas در multiline
- JSDoc برای functions عمومی
- camelCase برای variables و functions
- PascalCase فقط برای constructors

```javascript
// ✓ Good
const renderCard = (photo) => {
  const { title, author, thumbnail } = photo;
  return `<div class="card">${escapeHtml(title)}</div>`;
};

// ✗ Bad
function renderCard(photo){
    var title = photo.title
    var author = photo.author
    return '<div class="card">'+title+'</div>'
}
```

### CSS

- Mobile-first (base styles for mobile, then min-width media queries)
- BEM-ish naming: `.block__element--modifier`
- Custom properties for theming
- ۲ space indentation
- No vendor prefixes (let GitHub Pages / browser handle)

### HTML

- Semantic HTML5 (`<header>`, `<main>`, `<nav>`, `<article>`, `<section>`, `<footer>`)
- `dir="rtl"` و `lang="fa"` روی `<html>` برای صفحات فارسی
- ARIA labels برای interactive elements
- `alt` برای همه تصاویر
- Logical tab order

## Code of Conduct

### تعهد ما

اُپن‌فریمز یک community inclusive و welcoming است. ما متعهدیم به:

- **رفتار دوستانه**: همیشه با احترام صحبت کنید
- **گشودگی**: از تازه‌واردان استقبال کنیم
- **تنوع**: همه background‌ها welcome هستند
- **صبر**: سوالات مبتدی welcome هستند

### رفتار غیرقابل قبول

- توهین، تحقیر، یا harassment
- comments sexist، racist، یا homophobic
- publishing اطلاعات شخصی دیگران بدون اجازه
- هر رفتار غیرحرفه‌ای

### اجرا

تخلفات را به [GitHub Issues](https://github.com/OpenFramez/openframez.github.io/issues) گزارش دهید. maintainers در کمتر از ۲۴ ساعت پاسخ می‌دهند.

## سوالات متداول

### س: آیا می‌توانم عکس‌های Internet را کپی کنم؟
ج: **خیر**. فقط عکس‌هایی که خودتان گرفته‌اید یا به‌صورت قانونی آزاد شده‌اند. کپی عکس‌های کپی‌رایت بدون اجازه صاحب، تخلف است.

### س: عکس من چقدر طول می‌کشد منتشر شود؟
ج: در کمتر از ۷۲ ساعت. در فاز ۵ با AI، این زمان به چند دقیقه کاهش خواهد یافت.

### س: می‌توانم چند عکس بفرستم؟
ج: بله، اما در یک PR چندتایی بفرستید تا review سریع‌تر انجام شود.

### س: عکس من رد شد، چرا؟
ج: دلایل معمول: کیفیت فنی پایین، metadata ناقص، یا مجوز نامشخص. در PR comment دلیل دقیق ذکر می‌شود.

### س: می‌توانم category جدید پیشنهاد دهم؟
ج: بله! Issue باز کنید با label "enhancement" و توضیح دهید چرا category جدید لازم است.

## تشکر

از همه مشارکت‌کنندگان سپاسگزاریم. لیست کامل در [CONTRIBUTORS.md](CONTRIBUTORS.md) (به‌زودی) آپدیت می‌شود.

---

سوال دیگری دارید؟ [Issue باز کنید](https://github.com/OpenFramez/openframez.github.io/issues/new)!
