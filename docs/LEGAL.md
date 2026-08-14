# مسائل قانونی اُپن‌فریمز

## نمای کلی

اُپن‌فریمز یک پلتفرم نمایش محتوای آزاد است. این سند سیاست‌های قانونی پروژه را به‌طور کامل توضیح می‌دهد. توجه: این سند مشاوره حقوقی نیست؛ برای موارد خاص با وکیل مشورت کنید.

## ۱. مجوز تصاویر

### منبع محتوا

تمام تصاویر در نسخه فعلی (فاز ۱) از [Wikimedia Commons](https://commons.wikimedia.org) جمع‌آوری شده‌اند. Wikimedia Commons یک مخزن محتوای آزاد است که فقط فایل‌های با مجوز آزاد (CC، Public Domain، GFDL) را می‌پذیرد.

### مجوزهای پشتیبانی‌شده

| مجوز | توضیح | استفاده تجاری | تغییر | Attribution |
|------|--------|---------------|-------|-------------|
| CC BY 4.0 | Attribution | ✓ | ✓ | الزامی |
| CC BY-SA 4.0 | Attribution-ShareAlike | ✓ | ✓ (تحت همان مجوز) | الزامی |
| CC BY-ND 4.0 | Attribution-NoDerivs | ✓ | ✗ | الزامی |
| CC BY-NC 4.0 | Attribution-NonCommercial | ✗ | ✓ | الزامی |
| CC BY-NC-SA 4.0 | NonCommercial-ShareAlike | ✗ | ✓ (تحت همان مجوز) | الزامی |
| CC BY-NC-ND 4.0 | NonCommercial-NoDerivs | ✗ | ✗ | الزامی |
| CC0 1.0 | Public Domain Dedication | ✓ | ✓ | اختیاری |
| Public Domain | بدون حقوق | ✓ | ✓ | اختیاری |
| GFDL | GNU Free Documentation License | ✓ | ✓ (تحت GFDL) | الزامی |

### سیاست اُپن‌فریمز

اُپن‌فریمز **فقط** تصاویری را نمایش می‌دهد که:
- مجوز CC BY، CC BY-SA، CC0، Public Domain، یا GFDL داشته باشند
- مجوزهای NonCommercial (NC) یا NoDerivs (ND) پذیرفته **نمی‌شوند** (چون محدودیت‌هایی برای کاربران ایجاد می‌کنند)
- اطلاعات attribution کامل (عکاس، منبع، لینک مجوز) نمایش داده شود

### نمایش Attribution

برای هر عکس، اُپن‌فریمز اطلاعات زیر را نمایش می‌دهد:
- نام عکس (title)
- نام عکاس (با لینک به صفحه او در Wikimedia اگر موجود باشد)
- مجوز (با لینک به متن کامل)
- لینک به صفحه اصلی عکس در Wikimedia Commons
- تاریخ بارگذاری
- ابعاد

این اطلاعات در:
- صفحه جزئیات عکس (photo.html)
- overlay کارت عکس (در hover)
- JSON-LD structured data (для search engines)

## ۲. DMCA — Digital Millennium Copyright Act

### Safe Harbor

اُپن‌فریمز تحت DMCA Safe Harbor (17 U.S.C. § 512) اجرا می‌شود. این یعنی:
- ما میزبان محتوا هستیم، نه ناشر
- مسئولیتی در قبال محتوای کاربران نداریم، **به شرطی که** به گزارش‌های DMCA به‌موقع پاسخ دهیم
- باید سیاست termination برای متخلفان تکراری داشته باشیم

### پروسه DMCA Takedown

اگر فکر می‌کنید حق کپی‌رایت شما نقض شده است:

۱. **گزارش ارسال کنید**: [GitHub Issue جدید](https://github.com/OpenFramez/openframez.github.io/issues/new?title=DMCA%20Report) با عنوان "DMCA Report"

۲. **اطلاعات مورد نیاز**:
   - نام، آدرس، تلفن، ایمیل شما
   - شناسایی اثر اصلی (URL یا توصیف)
   - شناسایی محتوای متخلفانه (URL در اُپن‌فریمز)
   - بیانیه حسن نیت: "I have a good faith belief that use of the copyrighted materials described above as allegedly infringing is not authorized by the copyright owner, its agent, or the law."
   - بیانیه درستی: "I swear, under penalty of perjury, that the information in the notification is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."
   - امضای فیزیکی یا الکترونیکی

۳. **بررسی**: ما در کمتر از ۴۸ ساعت گزارش را بررسی می‌کنیم و اگر معتبر باشد، محتوا را حذف می‌کنیم.

۴. **Counter-Notification**: اگر submitter اصلی معتقد است که محتوا اشتباهاً حذف شده، می‌تواند counter-notice بفرستد. در این صورت، محتوا ممکن است در ۱۰-۱۴ روز برگردانده شود (مگر اینکه صاحب حق اقدام قضایی کند).

### Repeat Infringer Policy

کاربرانی که ۳ بار محتوای متخلفانه ارسال کنند، از مشارکت در آینده block می‌شوند. ما اطلاعات مربوط به این کاربران را به‌صورت internal نگه می‌داریم (در قالب GitHub usernames).

## ۳. GDPR — General Data Protection Regulation

### جمع‌آوری داده

اُپن‌فریمز **هیچ داده شخصی کاربران را جمع‌آوری نمی‌کند**:
- ❌ هیچ analytics (Google Analytics، Matomo، Plausible، etc.)
- ❌ هیچ ردیاب یا pixel
- ❌ هیچ کوکی بازاریابی یا تبلیغاتی
- ❌ هیچ فرم ورود یا ثبت‌نام
- ❌ هیچ آدرس IP log (در سرورهای ما — GitHub ممکن است logs operational نگه دارد، اما ما به آن‌ها دسترسی نداریم)
- ❌ هیچ fingerprint مرورگر

### داده‌های ذخیره‌شده

تنها داده‌ای که در دستگاه کاربر ذخیره می‌شود:
- `openframez-theme`: تنظیمات تم (`light` یا `dark`) در `localStorage`
- **Service Worker cache**: فایل‌های static برای استفاده آفلاین
- **HTTP cache**: مرورگر به‌صورت خودکار فایل‌ها را cache می‌کند

این داده‌ها هرگز به سرور ارسال نمی‌شوند و تحت کنترل کامل کاربر هستند (می‌تواند با clear browser data پاک شوند).

### حقوق GDPR

از آنجا که ما داده شخصی جمع‌آوری نمی‌کنیم:
- حق **دسترسی**: هیچ داده‌ای برای دسترسی وجود ندارد
- حق **حذف**: هیچ داده‌ای برای حذف وجود ندارد (cache browser خودکار پاک می‌شود)
- حق **اصلاح**: داده‌ای برای اصلاح وجود ندارد
- حق **انتقال**: قابل اعمال نیست

### داده‌های Public

اگر شما PR ارسال کنید:
- نام کاربری GitHub شما به‌صورت عمومی در صفحه contributors نمایش داده می‌شود (این یک ویژگی ذاتی GitHub است)
- اگر در metadata عکس نام خود را قرار دهید، آن نام به‌صورت عمومی نمایش داده می‌شود

این داده‌ها توسط شما voluntarily ارائه شده و under GDPR می‌تواند "personal data" در نظر گرفته شود. اگر می‌خواهید این داده‌ها را حذف کنیم، می‌توانید PR بزنید یا issue باز کنید.

## ۴. Creative Commons Best Practices

### Attribution صحیح

برای استفاده از عکس‌های اُپن‌فریمز، attribution به این شکل توصیه می‌شود:

```
"غروب آفتاب در البرز" توسط [نام عکاس]
from Wikimedia Commons, licensed under CC BY-SA 4.0
https://creativecommons.org/licenses/by-sa/4.0/
```

یا در قالب HTML:

```html
<a href="https://openframez.github.io/photo.html?id=fi_0001">"غروب آفتاب"</a>
by <a href="[author_url]">[نام عکاس]</a>,
licensed under <a href="[license_url]">CC BY-SA 4.0</a>
```

### استفاده تجاری

اگر عکسی مجوز CC BY یا CC BY-SA دارد، می‌توانید آن را به‌صورت تجاری استفاده کنید (با attribution). اما:
- بررسی کنید که استفاده خاص شما با مجوز سازگار است
- اگر نمی‌دانید، با وکیل مشورت کنید
- ما مسئولیتی در قبال استفاده نادرست نمی‌پذیریم

### Share-Alike الزام

اگر عکسی با CC BY-SA دارید و آن را تغییر می‌دهید، اثر مشتق‌شده باید تحت همان مجوز CC BY-SA منتشر شود.

## ۵. حریم خصوصی

### سیاست no-tracking

اُپن‌فریمز متعهد است که:
- هیچ ردیابی از رفتار کاربران انجام ندهد
- هیچ profile از کاربران نسازد
- هیچ داده‌ای به third-party ارسال نکند (به جز درخواست‌های ضروری به Wikimedia CDN برای thumbnails و Google Fonts برای fonts)
- هیچ تبلیغی نمایش ندهد

### Third-Party Resources

اُپن‌فریمز از منابع third-party زیر استفاده می‌کند:
- **Wikimedia CDN** (`upload.wikimedia.org`): thumbnails عکس‌ها
- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`): فونت Vazirmatn

این منابع ممکن است logs خود را نگه دارند، اما ما کنترلی روی آن‌ها نداریم. اگر این برای شما نگران‌کننده است، می‌توانید از اضافه‌های مرورگر مثل uBlock Origin استفاده کنید.

### آینده: Self-Hosting

در فاز ۲، قصد داریم:
- فونت Vazirmatn را self-host کنیم (در حال حاضر از Google Fonts CDN استفاده می‌شود)
- thumbnails را به‌صورت local cache در repository نگه داریم (با احترام به license Wikimedia)

## ۶. مسئولیت کاربران

کاربرانی که محتوا ارسال می‌کنند مسئولیت کامل آن محتوا را بر عهده دارند:

### تعهدات submitter

با ارسال PR، شما تأیید می‌کنید که:
1. شما صاحب حقوق محتوایی هستید که ارسال می‌کنید، یا مجوز کافی برای انتشار آن دارید
2. محتوا حقوق دیگران (کپی‌رایت، حریم خصوصی، علائم تجاری) را نقض نمی‌کند
3. اطلاعات metadata (عکاس، مجوز، توضیحات) دقیق است
4. محتوا شامل مواد غیرقانونی، توهین‌آمیز، یا NSFW نیست
5. با [Code of Conduct](CONTRIBUTING.md#code-of-conduct) موافقت می‌کنید

### محتوای ممنوع

انواع محتوای زیر ممنوع است:
- ❌ کپی‌رایت متقلبانه (بدون اجازه صاحب)
- ❌ NSFW (نمایه‌های جنسی صریح)
- ❌ محتوای غیرقانونی (ترویج خشونت، تروریسم، مواد مخدر)
- ❌ تصاویر افراد بدون رضایت آن‌ها (در مواردی که رضایت لازم است)
- ❌ hatred یا discrimination علیه گروه‌های محافظت‌شده
- ❌ spam یا تبلیغات

### عواقب تخلف

- حذف محتوا
- در موارد تکراری: block از مشارکت
- در موارد جدی (مثل مواد غیرقانونی): گزارش به GitHub و مقامات ذی‌صلاح

## ۷. محدودیت مسئولیت

اُپن‌فریمز "as is" ارائه می‌شود، بدون هیچ ضمانتی. ما مسئولیتی در قبال:
- دقیق بودن metadata نداریم
- در دسترس بودن مداوم سایت نداریم
- خسارات ناشی از استفاده یا ناتوانی در استفاده نداریم
- محتوای کاربران نداریم

## ۸. تغییرات سیاست

این سند ممکن است به‌روز شود. تغییرات مهم در [GitHub Issues](https://github.com/OpenFramez/openframez.github.io/issues) اعلام می‌شود. ادامه استفاده از سایت پس از تغییرات به‌معنای پذیرش سیاست جدید است.

## ۹. تماس

برای سوالات قانونی:
- [GitHub Issues](https://github.com/OpenFramez/openframez.github.io/issues) — برای سوالات عمومی
- برای مسائل حساس، به maintainer مخزن پیام خصوصی دهید

---

**تاریخ آخرین به‌روزرسانی:** August 2026
**نسخه سند:** 1.0
