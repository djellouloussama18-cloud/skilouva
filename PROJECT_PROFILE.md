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
│       └── get-availability.js           → دالة الوسيط لجلب المواعيد المحجوزة
│
└── assets\                               → مجلد فارغ (لا توجد أصول خارجية)
```

### أحجام الملفات الحالية
| الملف | الحجم |
| --- | --- |
| `index.html` | 139,445 بايت (2649 سطرًا) |
| `css/style.css` | 196,815 بايت (7665 سطرًا) |
| `js/main.js` | 103,596 بايت (2765 سطرًا) |
| `netlify/functions/get-availability.js` | 2,470 بايت (88 سطرًا) |
| `netlify.toml` | 58 بايت (3 أسطر) |

---

## 3) التكنولوجيا والإعدادات البرمجية

### 3.1 الصفحة (`index.html`)
- `<html lang="ar" dir="rtl">` — عربي RTL.
- وسم `<meta name="description">` بالعربية.
- خط **Cairo** من Google Fonts (أوزان 400–800) مع `preconnect`.
- سكربت واحد في آخر الصفحة: `js/main.js`.

### 3.2 إعدادات Netlify (`netlify.toml`)
```toml
[build]
  publish = "."
  functions = "netlify/functions"
```

---

## 4) نظام التصميم (Design Tokens)

كل القيم متغيرة عبر CSS Custom Properties في `:root` داخل `css/style.css` (الأسطر 21–112).

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
`--space-1:4px` → `--space-12:128px`. والتخطيط: `--container-max:75rem` (1200px)، `--container-pad:1.25rem`، `--navbar-height:72px`.

### الحواف والظلال
- Radii: `--radius-sm:6px` / `--radius-md:10px` / `--radius-lg:16px` / `--radius-xl:24px` / `--radius-full:9999px`.
- Shadows: `--shadow-sm/md/lg`.

### الحركة
- Easing: `--ease-out` / `--ease-in-out` / `--ease-spring`.
- المدد: `--dur-fast:150ms` … `--dur-slower:800ms`.

### قواعد
- اللون البراندي (الأزرق) **مخصص فقط للتمييز** في معظم الأقسام، ويستعمل كخلفية كاملة في قسمي **Offer** (و**الشريط العلوي الإعلاني**).
- الإعلاء على التيبوغرافيا الكبيرة بدل الأيقونات والكروت.

---

## 5) أقسام الصفحة الرئيسية (بالترتيب من الأعلى)

### 5.1 شريط التنقل Navbar (الأسطر 28–98)
- **الشعار**: `SKILL<em>OVA</em>` (روابط لقسم #program).
- **روابط مركزية**: البرنامج، ماذا ستتعلم، المسار المهني، الأسئلة الشائعة.
- **زر CTA**: «انضم للدفعة الحالية» مع الخاصية `data-open-funnel`.
- **قائمة هامبرغر** للجوال (أقل من 900px) مع Inset كاملة ومغلقة عبر `<div hidden>`.
- JS: يضيف `data-scrolled="true/false"` عند تمرير يفوق 40px، يفتح/يغلق القائمة، يقفل تحريك الخلفية عند الفتح، ويتعامل مع زر Escape والنقر خارج القائمة ومقياس matchMedia عند العودة لسطح المكتب.

### 5.2 قسم الـHero (الأسطر 104–188)
- عنوان رئيسي: «ما تتعلمش Skill باش تزيد شهادة… تعلّم Skill تقدر تخدم بيها.»
- وصف + CTA `data-open-funnel` + سطر شارة.
- **التركيبة البصرية**: فقاعة زرقاء ضبابية + إطار فيديو (`hero-video-embed` — مكان مُعلَّم للصق كود تضمين لاحقًا مثل Vimeo/Loom) مع Placeholder (زر تشغيل + «فيديو تعريفي قريبًا») + ثلاث شارات معلقة (Sales / Closing / Customer Service).
- JS: تأثير Parallax خفيف على المركّبة البصرية (مقارب rAF، معطل عند reduced-motion).

### 5.3 شريط الإثبات Proof Strip (الأسطر 190–234)
- **Marquee مستمر** (CSS): عناصر `Live Sessions / One-to-One Coaching / Practical Training / Career Preparation` مكررة مرتين لانزلاق سلس `translateX(0%→-50%)`، مع توقف عند hover/focus لسهولة الوصول، وتعطيل كامل عند reduced-motion.

### 5.4 لمن هذا القسم؟ Who Is This For (الأسطر 236–339)
- شبكة **Bento غير متماثلة** من 9 بطاقات بدون تخطيط منتظم:
  - خلية كبيرة مميزة: **الطلبة والخريجين** (تمتد عمودين).
  - **المبتدئين**، **الباحثين عن عمل**.
  - بطاقات صغيرة: **اللي حاب يخدم في الخارج**، **موظفي الـSales**، **موظفي Customer Service**، **Entrepreneurs**، **Freelancers**، + خلية واسعة **اللي حاب يحول Skill إلى مصدر دخل**.
- أيقونات SVG داخلية، تدرّج بالألوان الخفيفة على بعض البطاقات، وreveal جماعي ضمني بمساعدة `IntersectionObserver`.

### 5.5 قسم المشكلة Problem (الأسطر 341–402)
- تركيبة تحريرية تيبوغرافية (بدون كروت): عنوان كبير «عندك الرغبة، بصح مازال ما عندكش Skill واضحة تقدر تعتمد عليها؟»
- عمودان: بيان كبير + قائمة مرقمة من 6 مشاكل (أول وظيفة، تغيير المجال، تعلم البيع، التعامل مع الاعتراضات، Follow-up، تقديم Skill للشركات).
- عبارات ختامية عاطفية مع تأكيد «المشكلة هو أنك مازلت ما بنيتش الـSkills اللي تخليك تستغل هذي الفرص».

### 5.6 منهجية Skillova Method (الأسطر 404–471)
- شعار: «Skillova ماشي مجرد دورة.»
- **رحلة أفقية بـ5 مراحل**: `Learn → Coach → Practice → Grow → Opportunities` مع خط اتصال مستمر يمتلئ باللون البراندي حسب التمرير + **نقطة ضوئية متحركة (pulse)** تتبع حافة التعبئة.
- يتحقق ذلك عبر الـ**Scroll-Fill Helper** المشترك في JS (يرسم التعبئة width أو height حسب وضع الأفقي/العمودي، مقاربًا بـrAF، ويديره استجابة للـscroll/resize/breakpoints/load).

### 5.7 المنهج Curriculum (قسم #program) (الأسطر 473–662)
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
  9. Practical Sales
  10. Career Skills

### 5.8 الجلسات المباشرة + الـCoaching الفردي live (الأسطر 664–883+)
- شعار: «التعلم وحده ما يكفيش.»
- **الجزء 1 — الـLive Sessions**: نص + **لوحة واجهة جلسة مباشرة** (SKILLOVA LIVE مع مؤشر LIVE نابض، اعتراض عينة «غالي»، تعليمة «How would you respond?»، قائمة ميزات، وشارة «Feedback received ✓» تظهر وتختفي بطريقة قصة مصغّرة).
- **الجزء 2 — الـOne-to-One Coaching**: نص + **لوحة لوحة التوازن/الداشبورد** (ONE-TO-ONE SESSION) مع أشرطة تقدم 85%/70%/60%/75% وحلقات تغذية راجعة وحالة «Next improvement».
- سطر وصل مركزي ونهاية.

### 5.9 المسار المهني Career Path (قسم #career-path) (الأسطر 895–1078)
- **خط زمني عمودي بواقع 7 مراحل** يتناوب العرض يمين/يسار، مع تعبئة خط أزرق تُملأ بالتمرير، وخانات بحالات (قادمة/مكتملة/نشطة):
  1. DISCOVER → 2. COACH → 3. PRACTICE → 4. PROVE YOURSELF → 5. PAID PRACTICE → 6. TEAM OPPORTUNITY → 7. CAREER OPPORTUNITIES
- **على الجوال (≤900px)**: يتحول إلى **شريط أفقي قابل للسحب/التمرير بنقاط تقدم** + **نافذة كروت مشتقة (Modal)** واحدة تُملأ بالـJS عند النقر على أي عمود.

### 5.10 التحضير المهني Career Preparation (قسم #career-preparation) (الأسطر 1080–1261)
- شعار: «راح نعلموك كيفاش تبحث على الخدمة أيضًا.»
- **لوحة أعمال واحدة** («CAREER PREPARATION») بدل شبكة:
  - **الحالة البنائية**: قائمة الملف التعريفي (CV، LinkedIn، Job Search، Applications، Remote Opportunities) + شريط جاهزية يوصل إلى 0% ثم يتقدم (Reached rows يتحول إلى أزرق).
  - **الحالة النهائية**: «Career Ready ✓» مع تدفق SKILLS → PROFILE → APPLICATION → OPPORTUNITY.
- **نصوص مصاحبة (Notes) حقوق** تتزامن مع الصفوف (allah فعال فقط العنصر النشط).
- يظهر الصفوف وهي تتقدم بالتتابع أثناء التمرير بمساعدة `IntersectionObserver`، وعند reduced-motion تُعرض الحالة النهائية مباشرة.

### 5.11 التطبيق المدفوع Paid Practice (الأسطر 1263–1320)
- شعار كبير: «التعلم يفتح الباب… التطبيق يبني الخبرة.»
- **خط أفقى من 4 مراحل**: LEARN → PRACTICE → GET PAID → BUILD EXPERIENCE مع تعبئة أزرق تتبع التمرير.
- ملاحظة اعتراضية واضحة: «التطبيق العملي المدفوع متاح للطلاب المؤهلين فقط، وليس مضمونًا لجميع المشاركين.»

### 5.12 مجتمع Skillova المهني Career Community (الأسطر 1322–1454)
- شعار «Skillova Career Community» — **تحول بصري لدخول «منصة الوظائف»**:
  - شريط بحث زخرفي مع **كتابة آلة Typewriter** + caret نابض.
  - **تبويبات فئات** (الكل/Algeria/Remote/International) مع شريط سفلي منزلق + **دوري تصفية تجريبي للعروض** (4 عروض عمل حقيقية placeholder: Sales Representative، Customer Service، Appointment Setter، Business Development).
  - ملاحظة موضحة «نموذج توضيحي لفرص يتم مشاركتها عبر المجتمع».
  - **جسر مصغر** YOUR SKILL → Employee / Freelancer / Service Provider.

### 5.13 تحويل المهارة إلى خدمة Skill-to-Service (الأسطر 1456–1554)
- شعار: «Turn Your Skill Into a Service.»
- **خريطة مهارات (Hub-and-Spoke)**: عقدة مركزية `SKILL` + 8 خطوط SVG تتسع للخارج (Sales، Closing، Appointment Setting، Lead Qualification، Customer Service، Follow-up، Sales Support، LinkedIn/CV Services) — على الجوال تتحول إلى **خريطة متفرعة عمودية** مع جذع وخطوط zigzag.
- **مسار مهني**: Employee → Freelancer → Service Provider → Sales Professional (يعيد استخدام نمط Paid flow).

### 5.14 ماذا ستحصل عليه What You Get (الأسطر 1556–1632)
- شعار «واش تحصل عليه بانضمامك للبرنامج؟»
- **هيكل Hub واحد**: عنصر `SKILLOVA PROGRAM` + 4 أعمدة مميزة (Training / Practice / Career / Opportunities) مفصولة فقط بشقوق عمودية رفيعة، كل عمود قائمة بنقاط زرقاء صغيرة (بدون أيقونات/كروت) + ملاحظة مرجعية «* حسب معايير الأكاديمية…».

### 5.15 لماذا Skillova؟ Why Skillova (الأسطر 1634–1702)
- شعار «علاش Skillova؟»
- **كتابة ضخمة وسطية `SKILLOVA`** (مرساة تيبوغرافية) + 5 أعمدة: LEARN / IMPROVE / PRACTICE / BUILD EXPERIENCE / FIND OPPORTUNITIES، كل عمود كلمة حرفية + سطر عربي واحد + خاتمة «Skillova يجمع بين…».

### 5.16 عن Skillova About (الأسطر 1704–1777)
- **انقسام 40% بصري (صورة المدرب placeholder بوضعية شهرية 4/5) / 60% نص**: شارة، عنوان، فقرة، مصطلحات تمييز (Sales • Closing • Customer Service • Communication)، سطرا بيان، وكتلة بيانات المدرب placeholder (`[اسم المدرب]` / `[نبذة…]`).

### 5.17 شهادات الطلاب Testimonials (الأسطر 1779–1855)
- **3 بطاقات متناظرة** (صغير | مميز | صغير) بترجمات placeholder حقيقية (محمد ب./سارة ك./ياسين م.) مع صور رمزية SVG وحواف Five-star — **بدون تقييمات نجوم حقيقية، كلمات فقط**.
- **على الجوال (≤900px)**: يتحول إلى **كروسل يدوي بسيط** (بطاقة واحدة في كل مرة، بدون auto-advance) مع أزرار prev/next + نقاط dots + سحب أساسي.

### 5.18 العرض Offer (الأسطر 1857–1918)
- **لحظة التحويل الرئيسية** — القسم الوحيد تقريبًا الذي يستخدم الأزرق كخلفية كاملة:
  - شعار أبيض فوق `SKILLOVA PROGRAM` (على خلفية زرقاء).
  - **لوحة بيضاء عائمة** تكشف مرة واحدة: قائمة فحص قصيرة، سعر `XXXX DA` placeholder + سعر قديم، CTA «أريد الانضمام إلى Skillova 🚀» (`data-open-funnel`)، وملاحظة ندرة.

### 5.19 الأسئلة الشائعة FAQ (الأسطر 1920–2098)
- عنوان «الأسئلة الشائعة» — **أكورديون احترافي وبدون كروت** (صفوف على حدود سفلية فقط).
- **11 سؤالًا** (خبرة سابقة، مقتصر على الـClosers؟، تطبيق عملي، مدفوع؟، توظيف مضمون؟، Coaching فردي، Live Sessions، CV، LinkedIn، فرص عمل، ضمان وظيفة).
- أكورديون قابل للوصول بلوحة مفاتيح مع `aria-expanded/aria-controls`، إجابة عبر `grid-template-rows 0fr→1fr`، رمز زائد مرسوم بـCSS يدور 45° ليصبح ×.

### 5.20 الختام Final CTA (الأسطر 2100–2147)
- جملة إعراض كبيرة + سلسلة أسطر إنجليزية منفصلة «Learn Sales. Improve Closing. … Find Opportunities.» + `🚀 جاهز تبدأ؟` مع CTA `data-open-funnel` «انضم إلى الدفعة الحالية» + سطر لاتيني `Skillova — Learn. Practice. Grow.`.
- Reveal مرتب: `--delay` × 90ms، line 0→8، kick+CTA(9)، tagline(10).

### 5.21 الفوتر Footer (الأسطر 2150–2191)
- داكن (كحلي) ومستقر (لا رسوم): شعار `SKILL<em>OVA</em>` + تاجلاين LTR + روابط تذييل (البرنامج، المسار المهني، FAQ، تواصل معنا) + سطر حقوق `© <span id="footer-year">2026</span>` — **تملأ السنة ديناميكيًا** عبر JS لتبقى محدّثة.

---

## 6) القمع — استبيان التأهيل (Qualification Funnel)

**التعريف**: نافذة Overlay كاملة الشاشة تُفتح عند النقر على أي عنصر يحمل `[data-open-funnel]` (نجد منها في: شريط التنقل، الهاتف المتحرك، Hero، Offer، Final CTA).

**عناصر الهيكل** (الأسطر 2193–2644):
- شريط علوي: شعار + عدّاد الخطوات `funnel-step-count` (صيغة «07 / 07»).
- شريط تقدم `funnel-progress-fill` (دالت من 0→100%).
- زر إغلاق `funnel-close` + Escape key + قفل تمرير الخلفية (`document.body.style.overflow`).
- حاوية `funnel__body` تحوي **9 خطوات DOM** (9 عناصر `.funnel__step`).

### 6.1 خريطة الخطوات (DOM → فهرس)
| عنصر DOM | `data-step` | الكتابة في `goToStep()` |
| --- | --- | --- |
| الأسطر 2220–2275 | `1` الوضعية الحالية | — |
| 2278–2333 | `2` الهدف الرئيسي | — |
| 2336–2373 | `3` المستوى الحالي في Sales | — |
| 2376–2463 | `4` أي Skill تريد تطويرها (**الاختيار المتعدد**) | — |
| 2466–2523 | `5` أكبر تحدي | — |
| 2526–2558 | `6` وقتك الأسبوعي | — |
| 2561–2592 | `7` الجاهزية للاستثمار | — |
| 2595–2603 | `done` **شاشة الانتقال** («ممتاز، بقيت خطوة أخيرة 🚀») | `goToStep(8)` |
| 2606–2639 | `8` **اختيار الموعد (التقويم)** | `goToStep(9)` |

### 6.2 محرك `goToStep(stepNumber)` (js/main.js:2377)
- يستقبل رقم خطوة **1-based**، ويحول إلى فهرس `stepNumber - 1` في `querySelectorAll('.funnel__step')`.
- يخزن `funnelState.current = stepNumber` (النمط 1-based).
- شريط التقدم: `pct = (min(stepNumber,7)/7)*100` → **يثبت عند 100% لخطوات ≥7**.
- العدّاد: `counter = min(stepNumber,7)` → **يثبت عند «07 / 07»** (لا يُعرض سوى أرقام خطوات التأهيل).
- روابط «السابق»: تُخفى على الخطوة 1 (`is-first-step`) وتظهر في غيرها.
- يُمرّر `funnel__body` إلى الأعلى عند كل انتقال.

### 6.3 اختيار الخيار الواحد (الأسطر 2416–2466)
- النقر على `.funnel__option` يزيل التحديد من الأشقاء ثم يضيف `is-selected`.
- يخزن القيمة في `funnelState.answers['step_N']` + console.log.
- **فرع خطوة 4**: إذا اختار `multi-skill` تُظهر `.funnel__multiselect` ويتم إعادة ضبط الخانات؛ وإلا تُخفى اللوحة.
- انقر فوق تلقائي إلى `stepNumber + 1` بعد **250ms**.

### 6.4 الاختيار المتعدد لخطوة 4 (الأسطر 2468–2506)
- 6 صناديق Checkbox (Sales، Closing، Customer Service، Communication، Appointment Setting، Lead Qualification) بعلامات `input[name="skills"]`.
- زر «متابعة» يظل `disabled` حتى يختار ≥1 (`updateContinueBtn`).
- عند النقر: يجمع القيم في مصفوفة `funnelState.answers.step_4_multi` ثم ينتقل إلى 5.

### 6.5 التنقل الرجعي (الأسطر 2508–2545)
- الافتراضي `prevStep = funnelState.current - 1`.
- يدعم `data-back-step` لهدف صريح (مثال: رابط رجوع التقويم يحمل `data-back-step="8"` ليعود **إلى الشاشة الانتقالية** بدل خطوة 7).
- إذا `prevStep ≤ 7` يستعيد التحديد البصري السابق من `answers` (الإجابة المحفوظة) — لا تتم الاستعادة للشاشة الانتقالية/التقويم.

### 6.6 زر الانتقال إلى التقويم (الأسطر 2547–2554)
- `[data-funnel-action="calendar"]` → `goToStep(9)`.

---

## 7) خطوة التقويم — Step 8 (اختيار الموعد)

**الموقع**: HTML الأسطر 2606–2639؛ التنسيق `funnel__step--calendar` في CSS (يبدأ ~7399)؛ المنطقفي JS (الأسطر 2556–2760).

### 7.1 اصطلاحات البيانات
```js
var funnelSlots = [];                              // 14 خانة
for (var sH = 8; sH <= 21; sH++) funnelSlots.push(hh + ':00');
   // → ["08:00","09:00",…,"21:00"]  (60 دقيقة لكل خانة)
var BOOKING_WINDOW_DAYS = 14;                       // نافذة 14 يومًا
```

### 7.2 حالة التقويم
```js
var calendarState = {
  selectedDate: null,   // "YYYY-MM-DD"
  selectedTime: null,   // "HH:00"
  bookedSlots:  [],     // المحجوزة للتاريخ المختار
  buildsInited: false
};
```

### 7.3 عجلة التاريخ (buildDateScroller، 2597–2635)
- يبني **14 زرًّا (pills)** من اليوم حتى +13.
- كل pill: `funnel__date-pill-day` = اسم اليوم، `funnel__date-pill-num` = `«رقم اليوم» + «اسم الشهر»`.
- **إصلاح الاتجاه (RTL)**: استخدم `Intl.DateTimeFormat('ar-DZ', { weekday:'long' })` و `{ month:'long' }` (وليس المصفوفات المهملة hardcoded) لحل انعكاس/تشتت النص العربي داخل الحاوية المنزلق — ذلك لأن القيم العربية المولدة ديناميكيًا احتاجت إلى `direction: rtl; unicode-bidi: plaintext;` على `.funnel__date-pill-day` و `.funnel__date-pill-num`. (النصوص لم تكن معكوسة في الملف؛ المشكلة كانت في اتجاه bidi للحاوية دون إشارة.)

### 7.4 اختيار تاريخ → تحميل المواعيد المتاحة (selectDate + loadAvailability)
- عند اختيار تاريخ: يُخزّن `selectedDate`، يُصفّر الوقت، يخفي قائمة الأوقات، يعطل زر التأكيد → يستدعي `loadAvailability`:
  - `GET /.netlify/functions/get-availability?date=YYYY-MM-DD` (Netlify Function).
  - يعرض حالة التحميل (`funnel__timeslots--loading` مع spinner).
  - النجاح: `data.bookedSlots` (مصفوفة) → `calendarState.bookedSlots` → renderTimeSlots.
  - الخطأ: يعرض `funnel__timeslots--error` مع زر «إعادة المحاولة».

### 7.5 قائمة الأوقات (renderTimeSlots + selectTime، 2691–2729)
- 14 زر خانة (`funnel__timeslot` مع `textContent` بوقت مثلًا `"14:00"`).
- المحجوزة (`bookedSlots.indexOf(slot) !== -1`): تضيف `funnel__timeslot--booked` + `disabled=true`.
- عند النقر: يزيل التحديد من الجميع، يضيف `is-selected` للخانة المطابقة، يخزن `selectedTime`، ثم `updateCalendarConfirmBtn()` (زر التأكيد مفعل فقط إذا كان التاريخ والوقت كلاهما محددين).

### 7.6 زر التأكيد (الأسطر 2735–2749)
- يخزن الموعد في حالة الفلكسل: `funnelState.appointmentDate` و `funnelState.appointmentTime` (مع console.log).
- مسجل placeholder: «proceed to contact info step - not yet implemented».
- ينتقل إلى `goToStep(10)` (خطوة معلومات الاتصال — **غير مبنية بعد**).

### 7.7 التهيئة
- `buildDateScroller()` مرة واحدة عند الإقلاع، ثم `goToStep(1)`.

---

## 8) الواجهة الخلفية — دوال Netlify (`netlify/functions/`)

**الدور**: وسيط Server-side بين الصفحة و Google Apps Script — يبقي رابط الـGAS سرّيًا بعيدًا عن العميل.

### 8.0 `get-availability.js` (قراءة المواعيد المحجوزة)
- **الطلب**: `GET /.netlify/functions/get-availability?date=YYYY-MM-DD`.
- **الاستجابة (200)**: `{ date: "2026-09-20", bookedSlots: ["10:00","14:00"] }`.
- **التحقق**: فقط GET (405)، صيغة التاريخ مطلوبة `^\d{4}-\d{2}-\d{2}$` (400).
- **الـForwarding**: `gasUrl + '?action=getAvailability&date=' + encodeURIComponent(date)`.

### 8.1 `submit-lead.js` (إرسال الحجز بعد خطوة الاتصال)
- **الطلب**: `POST /.netlify/functions/submit-lead` — JSON camelCase من الخطوة 9:
  `{ fullName, phone, email, contactPreference, notes, currentStatus, careerGoal, experienceLevel, skillInterest, mainChallenge, weeklyTime, investmentReadiness, appointmentDate, appointmentTime, source, utm }`.
- **التحقق (400)**: الاسم/الهاتف/البريد/التاريخ/الوقت مطلوبة؛ البريد بصيغة سليمة؛ الهاتف يسمح بـ `+213`/`05` مع 8-10 أرقام؛ تحويل `05…` ← `+213…`.
- **الـMapping**: يرسل مفاتيح بنفس أسماء أعمدة الورقة: `Full Name`, `Phone`, …, `Notes`.
- **الـForwarding**: `POST gasUrl` مع `?action=submitLead` — يراوغ `SLOT_ALREADY_BOOKED`/`MISSING_REQUIRED_FIELDS` كما هي؛ فشل/مهلة الطرف الغريب ← 502.
- **مهلة**: 10 ثوانٍ عبر `AbortController`؛ Header: `Cache-Control: no-store`.

### 8.2 كود Google Apps Script (يُلصق يدويًا — غير موجود في المستودع)
ينتظر المستخدم تنفيذ:

```javascript
var SHEET_NAME = 'Bookings';

var LEAD_HEADERS = [
  'Date', 'Full Name', 'Phone', 'Email', 'Contact Preference',
  'Current Status', 'Career Goal', 'Experience Level', 'Skill Interest',
  'Main Challenge', 'Weekly Time', 'Investment Readiness',
  'Appointment Date', 'Appointment Time', 'Source', 'UTM',
  'Lead Status', 'Notes'
];

var REQUIRED_FIELDS = ['Full Name', 'Phone', 'Appointment Date', 'Appointment Time'];

function doGet(e) {
  var output = { error: 'INVALID_REQUEST' };
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getAvailability') {
    var date = e.parameter.date;
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    var booked = [];
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      // سطر واحد قد يخفي عمودين "Appointment Date" و"Appointment Time" في خانة واحدة — ندعم الحالتين:
      if (headers.indexOf('Appointment Date') !== -1 && headers.indexOf('Appointment Time') !== -1) {
        var di = headers.indexOf('Appointment Date');
        var ti = headers.indexOf('Appointment Time');
        for (var r = 1; r < data.length; r++) {
          var d = norm_(data[r][di]);
          var t = norm_(data[r][ti]);
          if (d === date && t) booked.push(t);
        }
      } else {
        // متغير قديم: خلية واحدة "Appointment Date Time"
        for (var r2 = 1; r2 < data.length; r2++) {
          var val = norm_(data[r2][0]);
          if (val && val.indexOf(date) === 0) {
            var parts = val.split(' ');
            if (parts[1] && parts[1].indexOf(':') !== -1) booked.push(parts[1]);
          }
        }
      }
    }
    output = { date: date, bookedSlots: booked };
  }
  return json_(output);
}

function doPost(e) {
  var output = { success: false };
  try {
    var body = '';
    if (e && e.postData && e.postData.contents) body = e.postData.contents;
    var params = {};
    try {
      params = JSON.parse(body);
    } catch (err) {
      output.error = 'INVALID_JSON';
      return json_(output);
    }
    // تطبيع التاريخ والوقت من payload
    var apptDate = norm_(params['Appointment Date']);
    var apptTime = norm_(params['Appointment Time']);
    var fullName = String(params['Full Name'] || '').trim();
    var phone = String(params['Phone'] || '').trim();
    if (!fullName || !phone || !apptDate || !apptTime) {
      output.error = 'MISSING_REQUIRED_FIELDS';
      return json_(output);
    }
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) sheet = SpreadsheetApp.getActive().insertSheet(SHEET_NAME);
    ensureHeaders_(sheet);
    // منع الحجز المزدوج: نفس الشركة/التاريخ والوقت مسبقًا
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var di = headers.indexOf('Appointment Date');
    var ti = headers.indexOf('Appointment Time');
    for (var r = 1; r < data.length; r++) {
      if (norm_(data[r][di]) === apptDate && norm_(data[r][ti]) === apptTime) {
        output.error = 'SLOT_ALREADY_BOOKED';
        output.slot = apptDate + ' ' + apptTime;
        return json_(output);
      }
    }
    var row = LEAD_HEADERS.map(function (h) {
      if (h === 'Date') return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      if (h === 'Lead Status') return 'New';
      return params[h] !== undefined && params[h] !== null ? String(params[h]) : '';
    });
    sheet.appendRow(row);
    output = {
      success: true,
      appointmentDate: apptDate,
      appointmentTime: apptTime
    };
  } catch (err) {
    output.error = 'SERVER_ERROR';
  }
  return json_(output);
}

function ensureHeaders_(sheet) {
  var first = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var headers = first.slice();
  var changed = false;
  for (var i = 0; i < LEAD_HEADERS.length; i++) {
    if (headers.indexOf(LEAD_HEADERS[i]) === -1) {
      headers.push(LEAD_HEADERS[i]);
      changed = true;
    }
  }
  if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function norm_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (v && typeof v === 'object' && v.getMonth) {
    return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> الطريقة اليدوية المطلوبة: الصق الكود كاملًا في محرر Apps Script (يفضّل فوق الكود الموجود لدالة التوفر)، ثم انشر كـ Web App بـ«أي شخص» **بنفس الـURL الحالي** (أو حدّث `GAS_WEBAPP_URL` في Netlify عند تغييره)، وأعد نشر التطبيق.
> ملاحظة: `Lead Status` يُملأ تلقائيًا «New» و `Date` = توقيت استلام الحجز (بتوقيت منطقة الـScript).

---

## 9) متغيرات البيئة والنشر (Deployment)

| المتغير | القيمة المطلوبة |
| --- | --- |
| `GAS_WEBAPP_URL` | رابط Google Apps Script Web App المنشور (يُقرأ فقط في الـFunction) |

- `netlify.toml` ينشر جذر المشروع (لاحظ `publish = "."`) مع الـFunctions في `netlify/functions`.
- **بدون `package.json`** — المشروع واجهة خام + دوال Netlify بدون تبعيات.
- الخطوات اليدوية حتى يعمل إرسال الحجز كليًا:
  1. لصق كود GAS في §8.2 في محرر Apps Script (ورقة «Bookings»).
  2. النشر كـ Web App (تنفيذ «anyone») — يُفضّل القيمة «Web app» وإبقاء نفس الـURL.
  3. إضافة `GAS_WEBAPP_URL` في Netlify (Environment Variables) وإعادة النشر.

---

## 10) مكتبة JS الكاملة (جميع الأقسام في `js/main.js`)

| السطر | القسم | المهام |
| --- | --- | --- |
| 11–111 | Navbar IA Router | scroll-state (40px)، toggle الجوال، إغلاق خارجي/Escape/breakpoint |
| 113–156 | HERO | parallax خفيف على المركّبة البصرية |
| 157–206 | PROBLEM | IntersectionObserver reveal موقّت |
| 207–277 | SHARED SCROLL-FILL HELPER | «الخط يمتلئ أثناء التمرير» مولد؛ مدعوم بـrAF، scroll/resize/breakpoints/load؛ مع تقرير تقدم per-section |
| 279–375 | SKILLOVA METHOD | تعبئة الخط الأفقية + حالات المراحل + تحريك النّبض الضوئي مع حافة التعبئة |
| 376–425 | CURRICULUM | wave-card reveals |
| 426–510 | LIVE SESSIONS + COACHING | reveals نص/لوحة |
| 511–574 | COACHING DASHBOARD | أشرطة التقدم/الشفافيات تحديث بعد reveal |
| 575–807 | LIVE PANEL MICRO-DEMO | دورة أكتباك جلسة: quote → prompt → features → badge «Feedback received ✓» ثم fade |
| 808–841 | LIVE TEXT REVEAL | توقيت نص النص column |
| 842–939 | CAREER PATH | تعبئة خط زمني عمودي + حالات المراحل (desktop) |
| 940–1110 | CAREER MOBILE STRIP + MODAL | شريط منزلق أفقي، dots، نافذة محتوى واحدة، اختيار عمود |
| 1111–1305 | CAREER PREPARATION | fall-indexes للـprep وقراءة مؤشرات `IntersectionObserver` للـ building: صفوف → Readiness % → النقل إلى تطبيق CAREER READY؛ مراقبة الوضع المتناظر |
| 1306–1382 | PAID PRACTICE | تعبئة خط التدفق + الحالات |
| 1383–1618 | CAREER COMMUNITY | Typewriter، دورية demo للتبويبات (علامة التبويب لترويع منزلق underline)، دورة دوائر العمل (الكل → الجزائر → ريموت → الدولية) + عودة الكل؛ مع reduced-motion تعطّل الدومو |
| 1619–1754 | SKILL TO SERVICE | multi-step reveal: core scale → الخطوط تتسع → 8 فروع pop → career path |
| 1755–1801 | WHO IS THIS FOR | bento كتب field reveal |
| 1802–1869 | WHAT YOU GET | hub + 4 clusters reveal |
| 1870–1946 | WHY SKILLOVA | wordmark scale + 5 principles + closing |
| 1947–1997 | ABOUT SKILLOVA | image slow fade ثم text block |
| 1998–2143 | TESTIMONIALS | desktop 3-col، موبايل manual carousel (prev/next/dots، swipe) — no auto-advance؛ sync مع reveal |
| 2144–2190 | OFFER | لوحة entrance |
| 2191–2261 | FAQ | accordion toggle + focus trapping بسيط |
| 2262–2307 | FINAL CTA | reveal بترتيب `--delay × 90ms` |
| 2308–2319 | FOOTER | `footer-year` سنة الجاري |
| 2320–2554 | QUALIFICATION FUNNEL | open/close/goToStep/options/multiselect/back جامد |
| 2556–2760 | CALENDAR STEP | date pills، availability fetch، time slots، confirm → `goToStep(10)` (الخطوة 9) |
| 2761–3030 | CONTACT STEP + SUCCESS | التحقق + `buildLeadPayload` → `submit-lead`، منع التكرار، `SLOT_ALREADY_BOOKED`، شاشة الحجز الناجح + `resetFunnelForNewRound` |

كلها داخل **IIFE** (`(function(){ 'use strict'; … })()`) بحيث لا توجد متغيرات عالمية.

---

## 11) قواعد عدم التجاوز (Constraints) السارية حاليًا

1. **خطوات 1–9 ومحتواها لا تُعدَّل في المستقبل بدون طلب** (الـ DOM/الترقيم `goToStep(9)=التقويم، 10=الاتصال، 11=النجاح`).
2. **لا تُرسَل بيانات إحصائية/تحليلات** خارجية — بيانات الحجز تُرسل فقط عبر `submit-lead` (إيصال المنتج/product) ولا تُحلَّل بيانات Steps 1–7 لأي غرض.
3. **لا يجوز** إضافة مكتبات خارجية أو Frameworks.
4. **لا يجوز** كشف رابط GAS في الجانب العميل — يمر فقط عبر Netlify Function عبر `GAS_WEBAPP_URL`.
5. صياغة المحتوى بحذر: التطبيق المدفوع/فرص العمل **غير مضمونة** (تُستخدم صيغ مشروطة).
6. الحقوق التنسيقية placeholder (`[…]`) تبقى حتى تُستبدل بمحتوى حقيقي (المدرب، السعر، التوظيف).

---

## 12) الحالة الحالية والتوافق / خطوات قادمة معتادة

| الخطوة | الحالة |
| --- | --- |
| قمع Steps 1–7 | ✔ منجز |
| شاشة الانتقال (بعد خطوة 7) | ✔ منجز |
| خطوة التقويم 8 (صفحات التواريخ + الأوقات + التأكيد) | ✔ منجز |
| دالة Netlify `get-availability` | ✔ منجز |
| `netlify.toml` | ✔ منجز |
| Step 9 — معلومات الاتصال + إرسال الحجز للـSheet | ✔ منجز (مصدق عبر اختبارات headless) |
| Step 10 — شاشة الحجز الناجح + إعادة فتح نظيفة | ✔ منجز |
| دالة Netlify `submit-lead` | ✔ منجز (17/17 اختبارات محلية) |
| كود GAS في Apps Script | ⏳ إلصاق يدوي (§8.2) + إعادة نشر |
| متغير `GAS_WEBAPP_URL` في Netlify | ⏳ إضافة |
| صورة/معلومات المدرب، السعر، فيديو الـHero | ⏳ محتوى placeholder |

---

## 13) ملاحظات تقنية مهمة

- **اللغة العربية للتقويم**: أسماء أيام/أشهر تأتي من `Intl.DateTimeFormat('ar-DZ', …)` — لا تُغيَّر بأي حال إلى مصفوفات مكتوبة يدويًا (سبب أخطاء التوجيه السابقة).
- **الاتجاه في الأجزاء اللاتينية**: `.skill__path`, `.why__wordmark`, `.finalcta__lines`، إلخ تستخدم `direction: ltr` لقراءة إنجليزية سليمة داخل صفحة RTL.
- **الفواصل**: شعار تكسير الجوال عند 900px (56.25rem)، وأيضًا بقية نقاط بيكسل الحالية: 992px، 480px (30rem).
- **السرعة/المقاربات**: تستخدم rAF + scroll listeners سلبية؛ عند تفعيل `prefers-reduced-motion` تُلغى حركات التكرار/الـmarquee/الدوران وتُعرض الحالات النهائية الساكنة.
- **إمكانية الوصول**: `aria-expanded/controls`، أدوار `role="tablist/tab"`، `role="dialog" aria-modal`، `aria-hidden` للمحتوى المتكرر في الـmarquee، ووصف نصي لجميع الأزرار الأيقونية.
```