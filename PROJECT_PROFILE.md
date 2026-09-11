# الملف التعريفي لمشروع Skillova

> ملف توثيق شامل ودقيق لكل التفاصيل المتعلقة بالمشروع: البنية، الصفحات، الأقسام، المكوّنات، السلوك، والنشر.

---

## 1) نظرة عامة على المشروع

| العنصر | التفاصيل |
| --- | --- |
| **اسم المشروع** | Skillova (سكيلوفا) |
| **النوع** | صفحة هبوط (Landing Page) ثابتة + قمع تأهيل (Qualification Funnel) متكامل |
| **الهدف** | أكاديمية تدريب في فنون **البيع (Sales)** و**الإقناع والـClosing** و**خدمة العملاء (Customer Service)** تهدف إلى تأهيل الشباب عمليًا لسوق العمل |
| **اللغة** | عربية جزائرية (دارجة) + مصطلحات إنجليزية، اتجاه **RTL** |
| **الجمهور** | الطلبة، الخريجون، الباحثون عن عمل، موظفو الـSales/Customer Service، الـEntrepreneurs، الـFreelancers |
| **الأسلوب التصميمي** | تيبوغرافي قوي، بصريّات SVG مبنية يدويًا (بدون صور خارجية)، ألوان هادئة، خاتمة زرقاء بارزة في الأقسام التحويلية |
| **التقنيات** | HTML5 + CSS3 (Custom Properties) + JavaScript خالص (Vanilla ES5-style)، **بدون** أي build tool أو framework أو مكتبات خارجية سوى خط Google Fonts |

---

## 2) بنية الملفات (Project Structure)

```
C:\Users\pC\SKILLOVA\
│
├── index.html                            → الصفحة الرئيسية الوحيدة (كل شيء داخلها)
├── netlify.toml                          → إعدادات نشر Netlify
├── package.json                          → سكربت `dev` + netlify-cli كاعتماد تطويري
├── package-lock.json
├── dev-server.js                         → خادم تطويري محلي: ملفات ثابتة + بروكسي دوال Netlify
├── PROJECT_PROFILE.md                    → هذا الملف التعريفي
│
├── css\
│   └── style.css                         → كل الأنماط (Design System + أقسام الصفحة + القمع)
│
├── js\
│   └── main.js                           → كل التفاعلية (مغلّفة بـ IIFE)
│
├── netlify\
│   └── functions\
│       ├── _gas.js                       → مساعد مشترك: callGasApp() + jsonResponse() + السر المشترك
│       ├── check-duplicate-phone.js      → فحص تكرار الهاتف (check_duplicate_phone)
│       ├── update-lead.js                → حفظ تدريجي عبر session_id (update_lead)
│       └── confirm-booking.js            → تأكيد التسجيل النهائي (confirm_booking) — يخلف submit-lead.js المحذوف
│
├── google-apps-script\
│   └── Code.gs                           → كود Google Apps Script الكامل (يُلصق يدويًا — خارج Git)
│
├── assets\                               → مجلد يحتوي على صورة المدرب الحقيقية `instructor.jpg` + صورة بديلة `trainer-photo.png`
├── .env.example                          → نموذج متغيرات البيئة (GAS_WEBAPP_URL / GAS_SHARED_SECRET)
├── .gitignore                            → ملفات مُستبعدة من Git
└── deno.lock                             → ملف قفل Deno (غير مستخدم حاليًا — مرجعي فقط)
```

### أحجام الملفات الحالية
| الملف | الحجم |
| --- | --- |
| `index.html` | 159,544 بايت (2803 سطرًا) |
| `css/style.css` | 238,174 بايت (9098 سطرًا) |
| `js/main.js` | 133,393 بايت (3505 سطرًا) |
| `netlify/functions/_gas.js` | 2,477 بايت (64 سطرًا) |
| `netlify/functions/check-duplicate-phone.js` | 1,047 بايت (34 سطرًا) |
| `netlify/functions/update-lead.js` | 1,227 بايت (37 سطرًا) |
| `netlify/functions/confirm-booking.js` | 1,518 بايت (42 سطرًا) |
| `google-apps-script/Code.gs` | 19,779 بايت (385 سطرًا) |
| `dev-server.js` | 4,223 بايت (114 سطرًا) |
| `package.json` | 275 بايت (16 سطرًا) |
| `netlify.toml` | 58 بايت (3 أسطر) |

---

## 3) التكنولوجيا والإعدادات البرمجية

### 3.1 الصفحة (`index.html`)
- `<html lang="ar" dir="rtl">` — عربي RTL.
- شريط إعلاني علوي (announcement bar) فوق الـNavbar مع زر «احجز مكانك» `data-open-funnel`.
- وسم `<meta name="description">` بالعربية.
- خط **Cairo** من Google Fonts (أوزان 400–800) مع `preconnect`.
- سكربت واحد في آخر الصفحة: `js/main.js`.

### 3.2 التطوير المحلي (`package.json` + `dev-server.js`)
- سكربت `npm run dev` يشغّل `node dev-server.js`:
  - يخدم الملفات الثابتة (HTML/CSS/JS) مع MIME صحيح ومحاربة `../` (directory traversal).
  - يبروكسي مسارات `/.netlify/functions/*` محليًا (يحمّل الدوال من `netlify/functions` مع مسح `require.cache` لإعادة تحميل حي).
  - منفذ الإقلاع 8888 ثم 8889… عند الحجز (EADDRINUSE).
  - يقرأ `.env` يدويًا (`GAS_WEBAPP_URL` / `GAS_SHARED_SECRET`) لتجريب الدوال محليًا مقابل Web App حقيقي.
- `netlify-cli` كاعتماد تطويري فقط (النشر لا يتطلب build).

### 3.3 إعدادات Netlify (`netlify.toml`)
```toml
[build]
  publish = "."
  functions = "netlify/functions"
```

---

## 4) نظام التصميم (Design Tokens)

كل القيم متغيرة عبر CSS Custom Properties في `:root` داخل `css/style.css` (يبدأ عند السطر 24 فصاعدًا — `:root` يمتد حتى السطر 113).

### الألوان
| المتغير | القيمة | الاستخدام |
| --- | --- | --- |
| `--clr-bg` | `#FFFFFF` | الخلفية الأساسية |
| `--clr-bg-subtle` | `#F8FAFC` | خلفية ثانوية خفيفة |
| `--clr-bg-subtle-2` | `#F3F6FA` | خلفية ثالثة خفيفة |
| `--clr-brand` | `#193A6D` | الأزرق الأساسي (للتمييز فقط/التفاصيل) |
| `--clr-heading` | `#0F172A` | العناوين والنصوص القوية |
| `--clr-text` | `#64748B` | النص الثانوي |
| `--clr-border` | `#E5EAF0` | الحدود |
| `--clr-footer-bg` | `#0B1B33` | خاص بالفوتر فقط (كحلي داكن) |

### الخطوط والطباعة
- `--font-primary: 'Cairo', ...` مع سلسلة fallbacks.
- مقياس: `--fs-xs:12px` → `--fs-6xl:80px` + أوزان 400/500/600/700/800.
- وارتفاعات أسطر: `--leading-tight:1.15` … `--leading-loose:1.8`.

### المسافات (قاعدة 4px)
`--space-1:4px` → `--space-12:128px`. والتخطيط: `--container-max:75rem` (1200px)، `--container-pad:1.25rem`، `--navbar-height:4.5rem` (72px)، `--announce-bar-h:3.25rem` (52px).

### الحواف والظلال
- Radii: `--radius-sm:6px` / `--radius-md:10px` / `--radius-lg:16px` / `--radius-xl:24px` / `--radius-full:9999px`.
- Shadows: `--shadow-sm/md/lg`.

### الحركة
- Easing: `--ease-out` / `--ease-in-out` / `--ease-spring` (`cubic-bezier(0.34, 1.3, 0.42, 1)` — bounce خفيف).
- المدد: `--dur-fast:150ms` … `--dur-slower:800ms`.
- مساعد: `--nav-entrance-delay:100ms`.

### قواعد
- اللون البراندي (الأزرق) **مخصص فقط للتمييز** في معظم الأقسام، ويستعمل كخلفية كاملة في قسمي **Offer** (و**الشريط العلوي الإعلاني**).
- الإعلاء على التيبوغرافيا الكبيرة بدل الأيقونات والكروت.

---

## 5) أقسام الصفحة الرئيسية (بالترتيب من الأعلى)

### 5.1 الشريط الإعلاني + شريط التنقل Navbar (الأسطر 21–104)
- **الشريط الإعلاني** فوق الـNavbar (الأسطر 21–38): سطر عرضي بسعر 14900 DA + رسالة ندرة + زر «احجز مكانك» `data-open-funnel`. رسالتان مخصصتان (desktop/mobile). خطوط أكبر (`--fs-base`) وحشوة أوسع (`0.5rem 1rem`) بعد التحديث الأخير.
- **الشعار**: `SKILL<em>OVA</em>` (روابط لقسم #program).
- **روابط مركزية**: البرنامج، ماذا ستتعلم، المسار المهني، الأسئلة الشائعة.
- **زر CTA**: «احجز استشارتك المجانية الآن» مع `data-open-funnel` والصنف `btn--shimmer` و`data-animate="cta"` (دخول بنبضة + توهج مقيم سباقًا).
- **قائمة هامبرغر** للجوال (أقل من 900px) مع Inset كاملة ومغلقة عبر `<div hidden>`، وزر CTA موازٍ «احجز استشارتك المجانية الآن» `btn--shimmer`.
- JS: يضيف `data-scrolled="true/false"` عند تمرير يفوق 40px، يفتح/يغلق القائمة، يقفل تحريك الخلفية عند الفتح، ويتعامل مع زر Escape والنقر خارج القائمة ومقياس matchMedia عند العودة لسطح المكتب.

### 5.2 قسم الـHero (الأسطر 106–211)
- عنوان رئيسي: «ما تتعلمش Skill باش تزيد شهادة… تعلّم Skill تقدر تخدم بيها.»
- وصف + CTA `data-open-funnel` «احجز استشارتك المجانية الآن» (صنفا `btn--hero` و`btn--shimmer`) + سطر شارة.
- **التركيبة البصرية**: فقاعة زرقاء ضبابية + إطار فيديو (`hero-video-embed` — مكان مُعلَّم للصق كود تضمين لاحقًا مثل Vimeo/Loom) مع Placeholder (زر تشغيل + «فيديو تعريفي قريبًا») + ثلاث شارات معلقة (Sales / Closing / Customer Service).
- **زر كتم/تشغيل الفيديو** (`.hero__media-mute`): يتوقف عند `is-muted`/`is-unmuted`، يُبدّل `aria-label` عربيًا، ويتلاشى تدريجيًا (1.5s fade-out) عند التشغيل. يستجيب لـ`click`/`volumechange`/`mouseenter`/`mouseleave`/`touchstart`. **إخفاء عدّاد الوقت على iOS**: كشف `detectIos()` يضيف `.is-ios` لفيديو الـHero ويُخفي عناصر الوقت (`-webkit-media-controls-current-time-display` / `-time-remaining-display` / `-time-label`) عبر `display:none !important` — مقاربة أفضل ممكنة مع iOS 16+؛ على Android يُطبَّق بدون بادئة `.is-ios`.
- JS: تأثير Parallax خفيف على المركّبة البصرية (مقارب rAF، معطل عند reduced-motion).

### 5.3 شريط الإثبات Proof Strip (الأسطر 213–257)
- **Marquee مستمر** (CSS): عناصر `Live Sessions / One-to-One Coaching / Practical Training / Career Preparation` مكررة مرتين لانزلاق سلس `translateX(0%→-50%)`، مع توقف عند hover/focus لسهولة الوصول، وتعطيل كامل عند reduced-motion.

### 5.4 لمن هذا القسم؟ Who Is This For (الأسطر 259–414)
- شبكة **Bento غير متماثلة** من 9 بطاقات بدون تخطيط منتظم:
  - خلية كبيرة مميزة: **الطلبة والخريجين** (تمتد عمودين).
  - **المبتدئين**، **الباحثين عن عمل**.
  - بطاقات صغيرة: **اللي حاب يخدم في الخارج**، **موظفي الـSales**، **موظفي Customer Service**، **Entrepreneurs**، **Freelancers**، + خلية واسعة **اللي حاب يحول Skill إلى مصدر دخل**.
- أيقونات SVG داخلية، تدرّج بالألوان الخفيفة على بعض البطاقات، وreveal جماعي ضمني بمساعدة `IntersectionObserver`.

### 5.5 قسم المشكلة Problem (الأسطر 416–477)
- تركيبة تحريرية تيبوغرافية (بدون كروت): عنوان كبير «عندك الرغبة، بصح مازال ما عندكش Skill واضحة تقدر تعتمد عليها؟»
- عمودان: بيان كبير + قائمة مرقمة من 6 مشاكل (أول وظيفة، تغيير المجال، تعلم البيع، التعامل مع الاعتراضات، Follow-up، تقديم Skill للشركات).
- عبارات ختامية عاطفية مع تأكيد «المشكلة هو أنك مازلت ما بنيتش الـSkills اللي تخليك تستغل هذي الفرص».

### 5.6 منهجية Skillova Method (الأسطر 479–549)
- شعار: «Bootcamp Closer ماشي غير برنامج تتعلم فيه وتحبس.»
- **سطر داعم** (جديد): «تتعلم، تتدرب، تطبق داخل Skillova، وتبني مهارة تستحق الأجر.» — تُعرض فيه المصطلحات اللاتينية داخل `span.method__lat` (`dir="ltr"` + `unicode-bidi: isolate`).
- وصف مرحلة **Practice**: «تطبيق حقيقي داخل Skillova مع عملاء حقيقيين وبمقابل».
- **رحلة أفقية بـ5 مراحل**: `Learn → Coach → Practice → Grow → Opportunities` مع خط اتصال مستمر يمتلئ باللون البراندي حسب التمرير + **نقطة ضوئية متحركة (pulse)** تتبع حافة التعبئة.
- يتحقق ذلك عبر الـ**Scroll-Fill Helper** المشترك في JS (يرسم التعبئة width أو height حسب وضع الأفقي/العمودي، مقاربًا بـrAF، ويديره استجابة للـscroll/resize/breakpoints/load).

### 5.7 المنهج Curriculum (قسم #program) (الأسطر 551–708)
- عنوان: «واش راح تتعلم داخل البرنامج؟»
- **شبكة 2×5 من 10 بطاقات وحدات** بأرقام خلفية كبيرة (بدون أيقونة لبعضها، وأيقونات SVG لمجموعة منها):
  1. Sales Fundamentals
  2. Sales Psychology
  3. Discovery & Qualification (أيقونة عدسة)
  4. High-Ticket Closing
  5. Objection Handling (أيقونة درع/صح)
  6. Customer Service (أيقونة سماعة)
  7. Communication Skills (أيقونة فقاعة دردشة)
  8. Follow-Up
  9. Practical Sales — الوصف المحدّث: «تطبق مهاراتك مع عملاء حقيقيين داخل Skillova،…» (بفقرة `span.curriculum__lat`)
  10. Career Skills

### 5.8 الجلسات المباشرة + الـCoaching الفردي live (الأسطر 710–944)
- شعار: «التعلم وحده ما يكفيش.»
- **الجزء 1 — الـLive Sessions**: نص + **لوحة واجهة جلسة مباشرة** (SKILLOVA LIVE مع مؤشر LIVE نابض، اعتراض عينة «غالي»، تعليمة «How would you respond?»، قائمة ميزات، وشارة «Feedback received ✓» تظهر وتختفي بطريقة قصة مصغّرة).
- **الجزء 2 — الـOne-to-One Coaching**: نص + **لوحة التوازن/الداشبورد** (ONE-TO-ONE SESSION) مع أشرطة تقدم 85%/70%/60%/75% وحلقات تغذية راجعة وحالة «Next improvement».
- سطر وصل مركزي ونهاية.

### 5.9 المسار المهني Career Path (قسم #career-path) (الأسطر 946–1133)
- **خط زمني عمودي بواقع 7 مراحل** يتناوب العرض يمين/يسار، مع تعبئة خط أزرق تُملأ بالتمرير، وخانات بحالات (قادمة/مكتملة/نشطة):
  1. DISCOVER → 2. COACH → 3. PRACTICE → 4. PROVE YOURSELF → 5. PAID PRACTICE → 6. TEAM OPPORTUNITY → 7. CAREER OPPORTUNITIES
- وصف المرحلة الثالثة **PRACTICE** (محدّث): «طبق المهارات وتدرّب على مواقف البيع الحقيقية.»
- **على الجوال (≤900px)**: يتحول إلى **شريط أفقي قابل للسحب/التمرير بنقاط تقدم** + **نافذة كروت مشتقة (Modal)** واحدة تُملأ بالـJS عند النقر على أي عمود (وتقرأ الوصف من نسخة سطح المكتب فتظل متزامنة تلقائيًا).

### 5.10 التحضير المهني Career Preparation (قسم #career-preparation) (الأسطر 1135–1334)
- شعار: «راح نعلموك كيفاش تبحث على الخدمة أيضًا.»
- **لوحة أعمال واحدة** («CAREER PREPARATION») بدل شبكة:
  - **الحالة البنائية**: قائمة الملف التعريفي (CV، LinkedIn، Job Search، Applications، Remote Opportunities) + شريط جاهزية يوصل إلى 0% ثم يتقدم (Reached rows يتحول إلى أزرق).
  - **الحالة النهائية**: «Career Ready ✓» مع تدفق SKILLS → PROFILE → APPLICATION → OPPORTUNITY.
- **نصوص مصاحبة (Notes) حقوق** تتزامن مع الصفوف (allah فعال فقط العنصر النشط).
- يظهر الصفوف وهي تتقدم بالتتابع أثناء التمرير بمساعدة `IntersectionObserver`، وعند reduced-motion تُعرض الحالة النهائية مباشرة.

### 5.11 التطبيق المدفوع Paid Practice (الأسطر 1336–1405)
- شعار كبير: «التعلم يفتح الباب… التطبيق يبني الخبرة.»
- **خط أفقى من 4 مراحل**: LEARN → PRACTICE → GET PAID → BUILD EXPERIENCE مع تعبئة أزرق تتبع التمرير.
- ملاحظة اعتراضية واضحة: «التطبيق العملي المدفوع متاح للطلاب المؤهلين فقط، وليس مضمونًا لجميع المشاركين.»

### 5.12 مجتمع Skillova المهني Career Community (الأسطر 1407–1551)
- شعار «Skillova Career Community» — **تحول بصري لدخول «منصة الوظائف»**:
  - شريط بحث زخرفي مع **كتابة آلة Typewriter** + caret نابض.
  - **تبويبات فئات** (الكل/Algeria/Remote/International) مع شريط سفلي منزلق + **دوري تصفية تجريبي للعروض** (4 عروض عمل حقيقية placeholder: Sales Representative، Customer Service، Appointment Setter، Business Development).
  - ملاحظة موضحة «نموذج توضيحي لفرص يتم مشاركتها عبر المجتمع».
  - **جسر مصغر** YOUR SKILL → Employee / Freelancer / Service Provider.

### 5.13 تحويل المهارة إلى خدمة Skill-to-Service (الأسطر 1553–1660)
- شعار: «Turn Your Skill Into a Service.»
- **خريطة مهارات (Hub-and-Spoke)**: عقدة مركزية `SKILL` + 8 خطوط SVG تتسع للخارج (Sales، Closing، Appointment Setting، Lead Qualification، Customer Service، Follow-up، Sales Support، LinkedIn/CV Services) — على الجوال تتحول إلى **خريطة متفرعة عمودية** مع جذع وخطوط zigzag.
- **إصلاح الخطوط الأفقية**: الخطّان الأفقيّان (Appointment Setting يمينٌ / Sales Support يسارٌ) قُصّر طرفاهما إلى حافة العقدة الفرعية (`stop = R - halfW - edgeGap`) بدل التمدد حتى المركز — داخل `layoutSkillMap()` في js/main.js.
- **مسار مهني**: Employee → Freelancer → Service Provider → Sales Professional (يعيد استخدام نمط Paid flow).

### 5.14 ماذا ستحصل عليه What You Get (الأسطر 1662–1740)
- شعار «واش تحصل عليه بانضمامك للبرنامج؟»
- **هيكل Hub واحد**: عنصر `SKILLOVA PROGRAM` + 4 أعمدة مميزة مفصولة فقط بشقوق عمودية رفيعة، كل عمود قائمة بنقاط زرقاء صغيرة (بدون أيقونات/كروت):
  - **Training** (5 بنود، آخرها «شهادة إتمام البرنامج 🎓»).
  - **Practice** (4 بنود من بينها «تطبيق عملي حقيقي» و«تطبيق مدفوع*»).
  - **Career** (بلا تغيير).
  - العمود الرابع أصبح **Career Opportunities** (3 بنود) بدل «Opportunities».
- ملاحظة مرجعية محدثة «* حسب معايير الأكاديمية…» بأسماء المصطلحات اللاتينية داخل `span.get__lat`.

### 5.15 لماذا Skillova؟ Why Skillova (الأسطر 1742–1810)
- شعار «علاش Skillova؟»
- **كتابة ضخمة وسطية `SKILLOVA`** (مرساة تيبوغرافية) + 5 أعمدة: LEARN / IMPROVE / PRACTICE / BUILD EXPERIENCE / FIND OPPORTUNITIES — كل عمود كلمة حرفية + سطر عربي واحد، والمصطلحات اللاتينية داخل `span.why__lat` لاتجاهها الصحيح (LTR معزول):
  - LEARN: «تتعلّم البيع والإقناع من الصفر…»
  - IMPROVE: «تحسّن أسلوبك وتتجاوز الاعتراضات…»
  - PRACTICE: «تطبّق مهاراتك على مواقف حقيقية…»
  - BUILD EXPERIENCE: «تبني خبرة عملية موثوقة…»
  - FIND OPPORTUNITIES: «تصلك فرص عمل وشراكات…»
- خاتمة: «Skillova يجمع بين…».

### 5.16 عن Skillova About (الأسطر 1812–1956)
- **انقسام 40% بصري (صورة المدرب placeholder بوضعية شهرية 4/5) / 60% نص**: شارة، عنوان، فقرة، مصطلحات تمييز (Sales • Closing • Customer Service • Communication)، سطرا بيان، وكتلة بيانات المدرب: `Al-USTADH Abdelmadjid Baki` / `[نبذة…]` مع 4 عناصر تحقق و5 وسوم خبرة.
- **الصورة الحقيقية**: `assets/instructor.jpg` — الصورة الوحيدة في الصفحة (باستثناء فيديو الـHero)، محاطة بشعارات UI فرعية (SALES, CLOSING, COACHING, PRACTICE).
- **كشف متتابع**: عناصر `.a-reveal` و`.about-reveal` بتأخيرات `--a-delay` فردية لكل ابن (شارة → عنوان → تاجلاين → lead → LEARN/PRACTICE/OPPORTUNITY).

### 5.17 شهادات الطلاب Testimonials (الأسطر 1958–2043)
- **3 بطاقات متناظرة** (صغير | مميز | صغير) بترجمات placeholder حقيقية (محمد ب./سارة ك./ياسين م.) مع صور رمزية SVG وحواف Five-star — **بدون تقييمات نجوم حقيقية، كلمات فقط**.
- **على الجوال (≤900px)**: يتحول إلى **كروسل يدوي بسيط** (بطاقة واحدة في كل مرة، بدون auto-advance) مع أزرار prev/next + نقاط dots + سحب أساسي.

### 5.18 العرض Offer (الأسطر 2045–2104)
- **لحظة التحويل الرئيسية** — القسم الوحيد تقريبًا الذي يستخدم الأزرق كخلفية كاملة:
  - شعار أبيض فوق `SKILLOVA PROGRAM` (على خلفية زرقاء).
  - **لوحة بيضاء عائمة** تكشف مرة واحدة: قائمة فحص قصيرة، سعر `XXXX DA` placeholder + سعر قديم، CTA «أريد الانضمام إلى Skillova 🚀» (`data-open-funnel` — بدون shimmer)، وملاحظة ندرة.

### 5.19 الأسئلة الشائعة FAQ (الأسطر 2106–2293)
- عنوان «الأسئلة الشائعة» — **أكورديون احترافي وبدون كروت** (صفوف على حدود سفلية فقط).
- **11 سؤالًا** (خبرة سابقة، مقتصر على الـClosers؟، تطبيق عملي، مدفوع؟، توظيف مضمون؟، Coaching فردي، Live Sessions، CV، LinkedIn، فرص عمل، ضمان وظيفة).
- أكورديون قابل للوصول بلوحة مفاتيح مع `aria-expanded/aria-controls`، إجابة عبر `grid-template-rows 0fr→1fr`، رمز زائد مرسوم بـCSS يدور 45° ليصبح ×.

### 5.20 الختام Final CTA (الأسطر 2295–2344)
- جملة إعراض كبيرة + سلسلة أسطر إنجليزية منفصلة «Learn Sales. Improve Closing. … Find Opportunities.» + `🚀 جاهز تبدأ؟` مع CTA `data-open-funnel` **«احجز استشارتك المجانية الآن»** (صنف `btn--shimmer` + `finalcta-reveal` `data-delay="9"`) + سطر لاتيني `Skillova — Learn. Practice. Grow.`.
- Reveal مرتب: `--delay` × 90ms، line 0→8، kick+CTA(9)، tagline(10).

### 5.22 زر CTA الجوال العائم Floating Mobile CTA (الأسطر 2390–2402)
- **زر ثابت (FAB)** يظهر فقط على الجوال أثناء التمرير، مخفي تلقائيًا عند فتح القمع (`is-hidden`).
- يُستعاد تلقائيًا عند إغلاق القمع عبر `closeFunnel()`.

### 5.23 الفوتر Footer (الأسطر 2347–2388)
- داكن (كحلي) ومستقر (لا رسوم): شعار `SKILL<em>OVA</em>` + تاجلاين LTR + روابط تذييل (البرنامج، المسار المهني، FAQ، تواصل معنا) + سطر حقوق `© <span id="footer-year">2026</span>` — **تملأ السنة ديناميكيًا** عبر JS لتبقى محدّثة.

---

## 6) القمع — استبيان التأهيل (Qualification Funnel)

**التعريف**: نافذة Overlay كاملة الشاشة (`#funnel`، HTML الأسطر 2404–2961) تُفتح عند النقر على أي عنصر يحمل `[data-open-funnel]`. تُغلق بزر الإغلاق `funnel-close` أو Escape أو قفل تمرير الخلفية (`document.body.style.overflow`).

**مواضع الأزرار** `[data-open-funnel]`:
- «احجز مكانك» — الشريط الإعلاني (سطر 35).
- «احجز استشارتك المجانية الآن» — الـNavbar (سطر 70، `btn--shimmer`)، درج الجوال (سطر 98، `btn--shimmer`)، الـHero (سطر 138، `btn--hero btn--shimmer`)، الختام (سطر ~2308، `btn--shimmer`).
- «أريد الانضمام إلى Skillova 🚀» — الـOffer (سطر ~2067).
- زر الجوال العائم (سطر ~2395) — FAB يُخفي عند فتح القمع.

**عناصر الهيكل**:
- شريط علوي: شعار + عدّاد الخطوات `funnel-step-count` (صيغة «08 / 08»).
- شريط تقدم `funnel-progress-fill` (دالت من 0→100%).
- حاوية `funnel__body` تحوي 12 عنصر `.funnel__step` (8 أسئلة تأهيل + شاشة انتقال + تقويم + اتصال + نجاح).

### 6.1 خريطة الخطوات (DOM → رقم `goToStep()`)
**الاتفاقية**: `goToStep(n)` يعرض العنصر ذا الفهرس `n-1` في قائمة `.funnel__step` (ترتيب DOM). خاصية `data-step` على العنصر هي وسم منطقي، وليست بالضرورة الرقم نفسها.

| عنصر DOM (`data-step`) | `goToStep()` | الوصف |
| --- | --- | --- |
| `1` | 1 | الوضعية الحالية |
| `2` | 2 | الهدف الرئيسي |
| `3` | 3 | المستوى الحالي في Sales |
| `4` | 4 | أي Skill تريد تطويرها (**الاختيار المتعدد**) |
| `5` | 5 | أكبر تحدي |
| `6` | 6 | وقتك الأسبوعي |
| `7` | 7 | **الجاهزية للبدء** (جديد — مستعد/يحتاج توجيه/لاحق/يحتاج فهم/غير مستعد) |
| `8` | 8 | الجاهزية للاستثمار (كانت الخطوة 7 سابقًا) |
| `done` | **9** | شاشة الانتقال («ممتاز، بقيت خطوة أخيرة 🚀») |
| `9` — التقويم | **10** | اختيار الموعد |
| `10` — الاتصال | **11** | معلومات الاتصال + الإرسال |
| `11` — النجاح | **12** | شاشة نجاح الحجز |

### 6.2 محرك `goToStep(stepNumber)` (js/main.js:2531)
- يستقبل رقم خطوة **1-based** ويحوله إلى فهرس `stepNumber - 1` في `querySelectorAll('.funnel__step')`.
- يخزن `funnelState.current = stepNumber`.
- شريط التقدم: `pct = (min(stepNumber,8)/8)*100` → **يثبت عند 100% ابتداءً من الشاشة الانتقالية (9)**.
- العدّاد: `counter = min(stepNumber,8)` → **يثبت عند «08 / 08»** (لا يُعرض سوى أرقام أسئلة التأهيل الثمانية).
- روابط «السابق» `[data-funnel-back]`: تُخفى على الخطوة 1 وتظهر في غيرها، وتدعم هدفًا صريحًا عبر `data-back-step`.
- عند دخول خطوة التقويم (10): يُستدعى `ensureAvailabilityAll()` لجلب خريطة التوفر مرة واحدة.
- عند خطوة النجاح (12): يُضاف `funnel--complete` وتُملأ شاشة النجاح عبر `populateSuccess()`.

### 6.3 جلسة واحدة — `session_id`
- عند فتح القمع يُولَّد `sessionId` (عبر `generateSessionId()`) ويُحفظ في `funnelState.sessionId` (أسطر 2397–2410).
- كل اتصال بـ`update-lead` أو `confirm-booking` يحمل `{ session_id, data }` (أسطر 2440/3337).

### 6.4 اختيار الخيار الواحد (js/main.js:2567)
- النقر على `.funnel__option` يزيل التحديد من الأشقاء ثم يضيف `is-selected`.
- يخزن القيمة في `funnelState.answers['step_' + stepNum]` مع console.log.
- **حفظ تدريجي (Progressive save)**: بعد كل إجابة تأهيل (1–8) يُستدعى `queueProgressiveSave(buildLeadPayload())` → `POST /.netlify/functions/update-lead`.
- **خطوة 4**: سؤال اختيار واحد عادي (مثل باقي الخطوات) بـ 4 خيارات (Sales، Closing، Customer Service، Appointment Setting) تخزَّن في `step_4` مع حفظ تدريجي وقفز تلقائي.
- **فرع خطوة الاتصال (data-step≈9)**: اختيار «طريقة التواصل المفضلة» يحدّث الحالة ولا يقفز تلقائيًا.
- بقية الخطوات: انقر فوق تلقائي إلى `stepNumber + 1` بعد **250ms**.

### 6.5 التنقل الرجعي (js/main.js:2676)
- الافتراضي `prevStep = funnelState.current - 1`.
- يدعم `data-back-step` لهدف صريح (رابط «اختار موعد آخر» من فشل الحجز يعود إلى خطوة التقويم 10).
- إذا `prevStep ≤ 8` يُستعاد التحديد البصري السابق من `answers` — لا تُستعاد الشاشة الانتقالية/التقويم/الاتصال.

---

## 7) خطوة التقويم — محذوفة

**أُزيلت نهائيًا**. كانت تسمح باختيار موعد («الوقت المتاح») قبل معلومات الاتصال. بعد الحذف:
- القمع أصبح: تأهيل 1–8 → شاشة انتقال → معلومات الاتصال → شاشة النجاح.
- حُذفت معها صفحة **«الأوقات المتاحة»** في Google Sheets، ودوال `getAvailability()` / `checkSlot()` / `generateAvailability()` / `setupDailyTrigger()` في `Code.gs`، وNetlify Functions `get-availability.js` / `check-slot.js`.
- القمع لا يرسل `appointmentDate` / `appointmentTime`؛ `confirm_booking` يكتفي بتأكيد التسجيل (حالة «مؤكد»).

---

## 8) الواجهة الخلفية — دوال Netlify (`netlify/functions/`)

**الدور**: وسيط Server-side بين الصفحة و Google Apps Script — يبقي رابط الـGAS **والـShared Secret** سرّيين بعيدًا عن العميل، ويمرّر payload الفرونت-إند كما هو (بدون ترجمة).

### 8.0 المساعد المشترك `_gas.js`
- `callGasApp(action, payload)`:
  - يتطلب المتغيرين `GAS_WEBAPP_URL` و `GAS_SHARED_SECRET` (يعيد 500 إن غاب أحدهما).
  - يبني الجسم `{ action, shared_secret, session_id?, data? }` ويرسله `POST` إلى Web App.
  - مهلة 10 ثوانٍ عبر `AbortController`؛ بودي/هيدر غير 2xx أو timeout → `{ ok:false, statusCode:502 }`.
  - **لا يسجّل ولا يعيد قيمة السر أبدًا.**
- `jsonResponse(statusCode, body)` → JSON مع `Cache-Control: no-store`.

### 8.1 الدوال الحالية (خلف `_gas.js`)
| الدالة | الأسلوب | الإدخال ← الإخراج | action داخل GAS |
| --- | --- | --- | --- |
| `check-duplicate-phone` | POST | `{ data:{ phone } }` ← `{ success:true, isDuplicate:bool }` | `check_duplicate_phone` |
| `update-lead` | POST | `{ session_id, data }` ← `{ success:true }` (حفظ تدريجي) | `update_lead` |
| `confirm-booking` | POST | `{ session_id, data }` ← `{ success:true }` أو `{ success:false, error:… }` | `confirm_booking` |

- قيود عامة: غير-الطريقة المتوقعة → 405؛ JSON غير صالح → 400؛ `check-duplicate-phone` يتطلب `data.*`؛ `update-lead`/`confirm-booking` يتطلبان `session_id` (و`data`).
- **`confirm-booking` يحل محل `submit-lead.js` (حُذف من المستودع)** — نفس الدور ضد الواجهة الجديدة المعتمدة على الأكشنات.
- **حُذفا**: `get-availability.js` و`check-slot.js` (مع صفحة «الأوقات المتاحة» في Google Sheets — لم تعد الواجهة تستخدمهما).

### 8.2 كود Google Apps Script — `google-apps-script/Code.gs`
- الكود الكامل (385 سطرًا) موجود في المستودع، **يُلصق يدويًا** في محرر Apps Script (لا يوجد إعداد clasp — التطبيق لا يمكنه النشر بنفسه).
- **البنية**: نقطة دخول وحيدة `doPost(e)` تتحقق من `body.shared_secret` مقابل خاصية البرنامج `GAS_SHARED_SECRET` («Unauthorized» إن لم يطابق) ثم توجّه حسب `body.action`؛ `doGet` مجرد فحص صحة.
- **الأوراق**: «العملاء المحتملون» (14 عمودًا عربيًا + عمودا تتبع داخليان: `معرف الجلسة` و`حالة التسجيل` — 16 عمودًا إجمالًا). **حُذفت**: صفحة «الأوقات المتاحة»، وأعمدة `المصدر` و`تفاصيل UTM` و`حالة العميل` و`تاريخ الموعد` و`وقت الموعد` نهائيًا (المصدر/UTM يندمجان الآن في «الملاحظة»). الترتيب النهائي: من `أكبر تحدي` فصاعدًا → `الوقت الأسبوعي المتاح` → `الجاهزية للبدء الفوري` → `جاهزية الاستثمار` → `الملاحظة` → `معرف الجلسة` → `حالة التسجيل`.
- **`FIELD_MAP`**: يربط أسماء خصائص `funnelState` (camelCase) بأسماء أعمدة الورقة العربية — والواجهة تمرّرها كما هي. **يحتوي على حقل `readinessToStart`** (الجاهزية للبدء الفوري) وحقل `investmentReadiness` (جاهزية الاستثمار). **الربط بالعمود يتم بالاسم فقط** عبر `getPayloadKeyForHeader()` الذي يتعامل مع الأسماء القديمة (مثلاً `الجاهزية للاستثمار` القديمة و`ملاحظة` القديمة) — فلا تكسر الورقة القديمة بعد إعادة الهيكلة.
- **الأكشنات**:
  - `update_lead` — حفظ تدريجي/استرجاع (upsert عبر `session_id`)، مع honeypot (`data.website_url` غير فارغ = يتجاهل)، `sanitizeValue` ضد حقن صيغ الجداول (`=+-@...` → يُسبق بـ`'`)، حالة «جزئي»، وعمود «التاريخ» من توقيت الخادم.
  - `check_duplicate_phone` — تكرار فقط مقابل العملاء ذوي الحالة «مؤكد» (+`0[567]XXXXXXXX` هي قاعدة رقم الهاتف).
  - `confirm_booking` — `updateLead` + تأكيد الـLead (حالة «مؤكد»)، ورفض `رقم الهاتف غير صالح`.
  - غير المعروف → «إجراء غير معروف».
- **Meta Conversions API**: جاهز لكن **معطّل مؤقتًا** (SHA-256 للهاتف/البريد، `META_API_VERSION = 'v21.0'`، مع `META_PIXEL_ID` placeholder) — يُفعَّل بإعداد البيانات الخاصة ثم إلغاء تعليق `sendLeadToMetaCAPI(...)` في `confirmBooking`.

> **الطريقة اليدوية المطلوبة**:
> 1. لصق `google-apps-script/Code.gs` كاملًا في المحرر **مكان أي كود سابق**.
> 2. ضبط خاصية البرنامج `GAS_SHARED_SECRET` على القيمة المختارة.
> 3. إعادة نشر Web App (تنفيذ «أي شخص») **بنفس الـURL الحالي** (أو تحديث `GAS_WEBAPP_URL` في Netlify عند تغييره).
> 4. **مرة واحدة**: شغّل `runSheetDiagnostics()` من المحرر (لو الكتابة تُظهر تبادلًا في أعمدة الجاهزية/الاستثمار أو كانت الورقة قديمة)، ثم `migrateSheet()` ليعيد هيكلة الورقة الحية وفق `LEADS_HEADERS` الجديدة مع الحفاظ على كل الصفوف (انقل القيم بالاسم، حرفيًا — بيانات الكهنة القديمة تُحفظ؛ الأعمدة الملغاة لا تُنقل).

---

## 9) متغيرات البيئة والنشر (Deployment)

| المتغير | القيمة المطلوبة |
| --- | --- |
| `GAS_WEBAPP_URL` | رابط Google Apps Script Web App المنشور (إلزامي — يُقرأ فقط في `_gas.js`) |
| `GAS_SHARED_SECRET` | السرّ المشترك — يجب أن يطابق بالضبط خاصية البرنامج `GAS_SHARED_SECRET` في Apps Script (إلزامي) |
| `META_ACCESS_TOKEN` | (اختياري — خاصية Apps Script) مطلوب فقط عند تفعيل Meta CAPI |
| `PORT` | (اختياري — dev-server محلي، الافتراضي 8888) |

- `netlify.toml` ينشر جذر المشروع (لاحظ `publish = "."`) مع الـFunctions في `netlify/functions`.
- **مؤخرًا أُضيف `package.json`**: سكربت `dev` + `netlify-cli` كاعتماد تطويري فقط — النشر بلا خطوة build.
- التطوير المحلي: `npm run dev` → `dev-server.js` (ثابت + بروكسي `/.netlify/functions/*`، يقرأ `.env`، منفذ 8888 ثم 8889 عند حجز).
- الخطوات اليدوية حتى يعمل إرسال التسجيل كليًا:
  1. لصق `google-apps-script/Code.gs` كاملًا في محرر Apps Script مكان أي كود سابق.
  2. ضبط خاصية البرنامج `GAS_SHARED_SECRET` على القيمة المختارة.
  3. إعادة نشر Web App (تنفيذ «أي شخص») بنفس الـURL.
  4. إضافة `GAS_WEBAPP_URL` + `GAS_SHARED_SECRET` في Netlify (Environment Variables) وإعادة النشر.

---

## 10) مكتبة JS الكاملة (جميع الأقسام في `js/main.js`)

| السطر | القسم | المهام |
| --- | --- | --- |
| 1–112 | NAVBAR IA Router | scroll-state (40px)، toggle الجوال، إغلاق خارجي/Escape/breakpoint |
| 128–155 | HERO | parallax خفيف على المركّبة البصرية |
| 157–217 | HERO VIDEO MUTE CONTROL | زر كتم/تشغيل الفيديو، `syncHeroMuteState()`، تلاشي 1.5s، `aria-label` عربي |
| 218–238 | HERO iOS VIDEO FIX | `detectIos()` يضيف `.is-ios` + إخفاء عناصر الوقت عبر `-webkit-media-controls` |
| 235–267 | PROBLEM | IntersectionObserver reveal موقّت |
| 283–339 | SHARED SCROLL-FILL HELPER | «الخط يمتلئ أثناء التمرير» مولد؛ rAF + scroll/resize/breakpoints/load؛ تقارير تقدم per-section |
| 358–436 | SKILLOVA METHOD | تعبئة الخط الأفقية + حالات المراحل + تحريك النّبض الضوئي مع حافة التعبئة |
| 451–486 | CURRICULUM | wave-card reveals |
| 502–571 | LIVE SESSIONS + COACHING | reveals نص/لوحة |
| 589–635 | ONE-TO-ONE COACHING DASHBOARD | أشرطة التقدم/الشفافيات تحديث بعد reveal |
| 656–868 | LIVE PANEL MICRO-DEMO | دورة أكتباك جلسة: quote → prompt → features → badge «Feedback received ✓» ثم fade |
| 878–902 | LIVE TEXT REVEAL | توقيت reveal عمود النص |
| 916–1000 | CAREER PATH | تعبئة خط زمني عمودي + حالات المراحل (desktop) |
| 1019–1171 | CAREER MOBILE STRIP + MODAL | شريط منزلق أفقي، dots، نافذة محتوى واحدة، اختيار عمود (وصف مقروء من نسخة desktop) |
| 1193–1366 | CAREER PREPARATION | fall-indexes + `IntersectionObserver`: صفوف → Readiness % → CAREER READY؛ مراقبة الوضع المتناظر |
| 1382–1443 | PAID PRACTICE | تعبئة خط التدفق + الحالات |
| 1466–1679 | CAREER COMMUNITY | Typewriter، دورية demo للتبويبات (underline منزلق)، دورة دوائر العمل؛ مع reduced-motion تعطّل الدومو |
| 1703–1831 | SKILL TO SERVICE | multi-step reveal: core scale → الخطوط تتسع → 8 فروع pop → career path (+ **إصلاح الخطوط الأفقية** i=2/i=6 في `layoutSkillMap`) |
| 1844–1878 | WHO IS THIS FOR | bento network reveal |
| 1896–1946 | WHAT YOU GET | hub + 4 clusters reveal |
| 1967–2023 | WHY SKILLOVA | wordmark scale + 5 principles + closing |
| 2041–2073 | ABOUT SKILLOVA | per-child stagger reveal (`.a-reveal` + `.about-reveal`) — **مُعاد تصميمه** |
| 2093–2219 | TESTIMONIALS | desktop 3-col، موبايل manual carousel (prev/next/dots/swipe) — no auto-advance |
| 2234–2266 | OFFER | لوحة entrance |
| 2287–2337 | FAQ | accordion toggle + focus trapping بسيط |
| 2351–2383 | FINAL CTA | reveal بترتيب `--delay × 90ms` |
| 2392–2395 | FOOTER | `footer-year` سنة الجاري |
| 2397–2490 | QUALIFICATION FUNNEL | session_id، open/close (مع إخفاء Floating Mobile CTA)، goToStep، options، multiselect، back، **حفظ تدريجي عبر update-lead** |
| 2531–2582 | goToStep() | محرك التنقل الداخلي: شريط تقدم 8/8، عدّاد 08/08، شاشة إكمال عند الخطوة 12 |
| 2724–2989 | CALENDAR STEP | date pills (Intl ar-DZ)، جلب خريطة التوفر كاملة مرة واحدة، time slots (09:00–23:00)، confirm → `goToStep(11)` |
| 2991–3396 | CONTACT STEP + SUBMIT FLOW | تحقق (اسم/هاتف جزائري/بريد/تفضيل) + `buildLeadPayload` + `ARABIC_LABELS` + حفظ تدريجي؛ سلسلة الإرسال: duplicate-phone guard → confirm-booking؛ `resetFunnelForNewRound` |
| 3398–3505 | SUCCESS STEP (12) + INIT | تعبئة شاشة النجاح (التاريخ/الوقت/الوسيلة) + إغلاق + `buildDateScroller()` + `goToStep(1)` |

كلها داخل **IIFE** (`(function(){ 'use strict'; … })()`) بحيث لا توجد متغيرات عالمية.

---

## 11) قواعد عدم التجاوز (Constraints) السارية حاليًا

1. **خطوات القمع ومحتواها لا تُعدَّل في المستقبل بدون طلب** — الترقيم الحالي: 1–8 تأهيل (8 أسئلة)، **9** شاشة انتقال، **10** التقويم، **11** الاتصال، **12** النجاح (خواص `data-step`: `done`/`9`/`10`/`11`).
2. **لا تُرسَل بيانات إحصائية/تحليلات** خارجية — بيانات الحجز تُرسل فقط عبر `confirm-booking` (إيصال المنتج). حفظ `update-lead` التدريجي وسيط لحفظ الجلسة. **Meta CAPI جاهز لكنه معطّل** ولا يُفعَّل إلا بطلب وضبط `META_PIXEL_ID`/`META_ACCESS_TOKEN`.
3. **لا يجوز** إضافة مكتبات خارجية أو Frameworks.
4. **لا يجوز** كشف رابط GAS أو `GAS_SHARED_SECRET` في الجانب العميل — يمرّان فقط عبر دوال Netlify من متغيرات البيئة.
5. صياغة المحتوى بحذر: التطبيق المدفوع/فرص العمل **غير مضمونة** (تُستخدم صيغ مشروطة).
6. الحقوق التنسيقية placeholder (`[…]`) تبقى حتى تُستبدل بمحتوى حقيقي (المدرب، السعر، فيديو الـHero، رمز البكسل). **ملاحظة**: صورة المدرب `assets/instructor.jpg` موجودة فعلًا (وليست placeholder).
7. **المصطلحات اللاتينية داخل العربية** توضع دائمًا في عنصر بـ`dir="ltr"` + `unicode-bidi: isolate` (أنماط `method__lat`, `curriculum__lat`, `get__lat`, `why__lat`).
8. `submit-lead.js` لم يعد موجودًا — سلسلة الإرسال الحالية: `check-duplicate-phone` → `confirm-booking`.

---

## 12) الحالة الحالية والتوافق / خطوات قادمة معتادة

| الخطوة | الحالة |
| --- | --- |
| قمع Steps 1–8 (8 أسئلة تأهيل) + شاشة الانتقال | ✔ منجز |
| خطوة الاتصال (تحقق + duplicate-phone) | ✔ منجز |
| شاشة النجاح + إعادة فتح نظيفة (`resetFunnelForNewRound`) | ✔ منجز |
| **تحكم كتم/تشغيل فيديو الـHero** | ✔ منجز |
| **زر الجوال العائم (Floating Mobile CTA)** | ✔ منجز |
| **إعادة تصميم قسم About (صورة المدرب الفعلية + كشف متتابع)** | ✔ منجز |
| **التحقق من الهاتف الجزائري (`0[567]\d{8}`) + عرض أخطاء الخادم** | ✔ منجز |
| **إخفاء عدّاد الوقت على iOS (WebKit video controls)** | ✔ منجز |
| **خطوة «الجاهزية للبدء» الجديدة (خطوة 7)** | ✔ منجز |
| دوال Netlify: `_gas.js` + `check-duplicate-phone` / `update-lead` / `confirm-booking` | ✔ منجز (تُختبر عبر dev-server و`npm run dev`) |
| `google-apps-script/Code.gs` (16 عمودًا + أدوات `runSheetDiagnostics`/`migrateSheet`) | ✔ مكتوب في المستودع — ⏳ إلصاق يدوي في Apps Script + إعادة نشر + تشغيل `migrateSheet` مرة واحدة |
| خاصية `GAS_SHARED_SECRET` في Apps Script + متغيرا `GAS_WEBAPP_URL`/`GAS_SHARED_SECRET` في Netlify | ⏳ إضافة |
| Meta Conversions API | ⏳ معطّل بانتظار بيانات Skillova |
| معلومات المدرب (نبذة كاملة)، السعر النهائي، فيديو الـHero | ⏳ محتوى placeholder / قيد التجهيز |

---

## 13) ملاحظات تقنية مهمة

- **اللغة العربية للتقويم**: أسماء أيام/أشهر تأتي من `Intl.DateTimeFormat('ar-DZ', …)` — لا تُغيَّر بأي حال إلى مصفوفات مكتوبة يدويًا (سبب أخطاء التوجيه السابقة؛ وكانت الحاوية بحاجة إلى `direction: rtl; unicode-bidi: plaintext;` على النصوص المولّدة ديناميكيًا).
- **الاتجاه في الأجزاء اللاتينية**: `.skill__path`, `.why__wordmark`, `.finalcta__lines`, وكل `…__lat` (`method__lat`, `curriculum__lat`, `get__lat`, `why__lat`) تستخدم `direction: ltr` / `unicode-bidi: isolate` لقراءة إنجليزية سليمة داخل صفحة RTL.
- **زر CTA المتحرك `btn--shimmer`** (css/style.css ~249–335): يشمل 4 أزرار (Navbar، درج الجوال، Hero، Final CTA) — شريط لمعان منزلق عبر `::before` (`translateX(-150%→150%)`) + توهج مقيم `btnAttention` (يقترض `--cta-rest-shadow`: `shadow-sm` افتراضيًا، `shadow-md` لـ`.btn--hero`)؛ **معطّل كليًا عند `prefers-reduced-motion`**. أزرار الشريط الإعلاني والـOffer بلا shimmer.
- **الفواصل**: شعار تكسير الجوال عند 900px (56.25rem)، وأيضًا بقية نقاط بيكسل الحالية: 992px، 480px (30rem). الفاصل الرئيسي للجوال ≤900px.
- **السرعة/المقاربات**: تُستخدم rAF + scroll listeners سلبية؛ عند تفعيل `prefers-reduced-motion` تُلغى حركات التكرار/الـmarquee/اللمعان/الدوران وتُعرض الحالات النهائية الساكنة.
- **إمكانية الوصول**: `aria-expanded/controls`، أدوار `role="tablist/tab"`، `role="dialog" aria-modal`، `aria-hidden` للمحتوى المتكرر في الـmarquee، ووصف نصي لجميع الأزرار الأيقونية.
- **تطوير محلي**: `npm run dev` لا يتطلب نشرًا؛ الدوال تُختبر عبر `/.netlify/functions/*` مع `.env` (المتغيران الإلزاميان).
- **زر الجوال العائم**: `btn--float-mobile` في `index.html` (سطر ~2390) — FAB ثابت على الجوال فقط، يُخفي تلقائيًا عند فتح القمع ويُعاد عند إغلاقه (المنطق في `js/main.js` lines 2479–2490).
- **إخفاء عدّاد الوقت على iOS**: كشف `detectIos()` يضيف `.is-ios` لفيديو الـHero ويُخفي عناصر الوقت (`-webkit-media-controls-current-time-display` / `-time-remaining-display` / `-time-label`) عبر `display:none !important`. مقاربة أفضل ممكنة مع iOS 16+ بسبب قيود shadow tree لعناصر الوسائط الحديثة؛ على Android يُطبَّق بدون بادئة `.is-ios`. ملاحظة: هذا أفضل ما يمكن — لا ضمان 100% مع تحديثات iOS المستقبلية.
- **تحقق الهاتف الجزائري**: regex `^0[567]\d{8}$` (10 أرقام تبدأ بـ05/06/07) بدلاً من التحقق العام. التنظيف: `v.replace(/[\s\-\(\)\+]/g, '')`. حقل الهاتف يحصل على صنف `is-valid` (حدود خضراء) عند صحة التحقق.
- **عرض أخطاء الخادم في القمع**: أخطاء `confirm-booking` تُعرض الآن مباشرة كـ`'الخطأ: ' + data.error` بدلاً من رسالة عامة.
- **8 أسئلة تأهيل**: أُضيفت خطوة «الجاهزية للبدء» (خطوة 7) بـ5 خيارات قبل خطوة «الجاهزية للاستثمار» (أصبحت خطوة 8). العدّاد: `08 / 08`، شريط التقدم: `min(step,8)/8`، شاشة الإكمال: الخطوة 12.