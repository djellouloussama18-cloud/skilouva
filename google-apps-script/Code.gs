/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App
 * ============================================================================
 * الأكشنات (doPost -> body.action):
 *   update_lead           -> حفظ تدريجي عبر session_id
 *   check_duplicate_phone -> فحص تكرار الهاتف (مقابل الحالة «مؤكد»)
 *   confirm_booking       -> تأكيد التسجيل (حالة «مؤكد»)
 *
 * الجدول: 15 عمودًا (A → O). لا يوجد عمود لمعرف الجلسة؛
 * يُخزَّن session_id كـ Developer Metadata على الصف نفسه (مخفي تمامًا
 * ويتحرك مع الصف عند الحذف/الترتيب اليدوي).
 * عمود «العمر» هو العمود E (الخامس)، وعمود «Prêt à démarrer» (الجاهزية
 * للبدء) هو العمود K. كل كود يتعامل مع التبويبات يتعامل مع الأعمدة
 * بالاسم (عبر صف العناوين) لا برقم ثابت، لذلك نقل عمود أو إعادة ترتيب
 * لاحقًا لا تتطلّب تعديل الكود. لتبويب قائم بلا ترحيل، العمودان الجديدان
 * يظهران في النهاية ويُقرآن/يُكتبان صحيحًا بالاسم؛ الترتيب النهائي يتم
 * عبر `migrateAddAgeColumn()` و`migrateAddReadinessColumn()`
 * (تشغيل يدوي مرة واحدة).
 *
 * عمود «Plus grand défi» (الحقل `mainChallenge`) **حُذف** مع سؤاله من
 * القمع: لا يدخل FIELD_MAP ولا في LEADS_HEADERS، فلا يُكتب ولا يُقرأ
 * ولا يُطلب بعد الآن. لإزالته من الورقة الحية شغّل
 * `migrateRemoveChallengeColumn()` مرة واحدة (تنسخه لورقة احتياطية أولًا).
 *
 * عمود «Moyen de contact préféré» (الحقل `contactPreference` — طريقة
 * التواصل المفضلة: WhatsApp / مكالمة) **حُذف** هو الآخر: حُذف من
 * الواجهة ومن الـpayload، ولا يدخل FIELD_MAP ولا في LEADS_HEADERS ولا
 * في PROTECTED_HEADERS، فلا يُكتب ولا يُقرأ ولا يُطلب بعد الآن. أي
 * payload قديم يرسل المفتاح (تبويب مخبأ قديم) يُتجاهل بصمت.
 * لإزالته من الورقة الحية شغّل `migrateRemoveContactMethodColumn()` مرة
 * واحدة (تنسخه لورقة احتياطية أولًا). الترتيب النهائي بعدها (مع العمود
 * الجديد «Prêt à démarrer»): Statut في N و Closer في O.
 *
 * ----------------------------------------------------------------------------
 * تبويبا الفئة: VIP و Diamond — طبقة التوجيه لكل lead
 * ----------------------------------------------------------------------------
 * كل lead يُوجَّه إلى أحد تبويبين، كلاهما بنفس ترويسات LEADS_HEADERS
 * (بالترتيب نفسه + صفّ عناوين مُثبَّت)، وكل الأعمدة تُقرأ وتُكتب بالاسم:
 *   - VIP: كل lead لا يدخل أي شرط «Diamond» (القاعدة الافتراضية).
 *   - Diamond: lead عمره أقل من 18 سنة، أو أجاب في الخطوة 7 «لا، مازال
 *     نحتاج وقت باش نكون جاهز»، أو في الخطوة 8 «حاليًا ما نقدرش نستثمر».
 *     أي قيمة أخرى (جاهز، جاهز مع توجيه، يحتاج تفاصيل، قيمة غير معروفة)
 *     لا تدفع نحو Diamond أبدًا.
 *
 * الاسم الجديد مفضَّل (VIP / Diamond)؛ الاسم القديم مقبول **للقراءة فقط**
 * (العملاء المحتملون و Moins de 18 ans) حتى يسبق ترحيل التسمية. أي وصول
 * للتبويبات يمرّ عبر findTierSheet()/getTierSheet() حصريًا — لا
 * getSheetByName بالمباشر — فيُقرأ الاسم الجديد أولًا ثم القديم، ولا يُنشأ
 * تبويب مكرر أبدًا (الإنشاء دائمًا بالاسم الجديد).
 *
 * التوجيه في update_lead / confirm_booking:
 *   - قيم الطبقة الثلاث (العمر / الجاهزية للبدء / الاستثمار) تُقارن دائمًا
 *     مدموجة: القيمة الواردة غير الفارغة تغلب على القيمة المخزَّنة (تُقرأ
 *     بالاسم من الصف الحالي). القرار عبر `decideTier()` نقطة واحدة في
 *     الملف كله.
 *   - غياب الحقول الثلاثة كليًا ليس سببًا للنقل أبدًا: جلسة جديدة → VIP،
 *     وصف موجود يبقى مكانه.
 *   - المستخدم رجع وغيّر إحدى الإجابات فانقلب اتجاه الفئة → الصف **يُنقل**:
 *     يُكتب الصف المدموج في التبويب الصحيح (مع معرّف الجلسة) ثم يُحذف
 *     القديم، فلا تبقى الجلسة موجودة في التبويبين معًا أبدًا. كل ذلك داخل
 *     القفل نفسه.
 * check_duplicate_phone يفحص التبويبين بنفس القاعدة الأصلية: الحالة غير
 * الفارغة وليست «جزئي» (أي «مؤكد» وأي حالة أخرى مُدخلة يدويًا).
 *
 * الترحيل اليدوي مرة واحدة (الأسماء القديمة تظهر للأسباب التاريخية):
 *   - migrateRenameTierSheets()   — «العملاء المحتملون» → VIP،
 *     «Moins de 18 ans» → Diamond (لا يلمس البيانات إطلاقًا).
 *   - migrateMinorsToSeparateSheet() — ينقل كل صف «أقل من 18 سنة» من تبويب
 *     الفئة الحالي إليه (نسخة احتياطية أولًا)؛ يعمل حتى لو لم تُشغَّل
 *     إعادة التسمية بعد.
 *   - migrateAddReadinessColumn() — يثبّت «Prêt à démarrer» قبل
 *     «Prêt à investir» في كل تبويب فئة موجود.
 *   - migrateFixAgeHeader()        — يُصلح خلية ترويسة كتب فيها اسمُ المعرّف
 *     نصًّا حرفيًّا (مثل 'LEAD_AGE_HEADER') في العمود E بدل «العمر»،
 *     بلا نقل أي بيانات. آمنة للتكرار.
 *   - migrateRepairOrphanRows()    — تقرير فقط (لا حذف ولا نقل): الصفوف
 *     اليتيمة الجزئية (تاريخ + عمر بلا اسم/هاتف) وأي صفوف متكررة بنفس
 *     معرّف الجلسة أو الهاتف، في التبويبين — افحص الـLogs وقرّر يدويًا.
 *
 * النشر: الصق الملف كاملًا مكان الكود القديم، اضبط Script Property
 * GAS_SHARED_SECRET، ثم أعد نشر Web App بنفس الرابط.
 * بعد النشر شغّل مرة واحدة (بالمحرر): migrateRenameTierSheets() ثم
 * migrateAddReadinessColumn() ثم migrateAddAgeColumn() ثم migrateFixAgeHeader()،
 * ثم runSheetDiagnostics() للتحقق (✗ يعني ترويسة غير معروفة تحتاج إصلاحًا
 * أو عمودًا زائدًا).
 * ============================================================================
 */

/* أسماء تبويبي الفئة: الجديدة (VIP / Diamond) + الأسماء القديمة.
   الأسماء القديمة مقبولة للقراءة فقط — كتابة الاسم الجديد إلزامي:
   كل إنشاء يتم عبر getTierSheet() بالاسم الجديد حصرًا، فلا يُنشأ تبويب
   مكرر أبدًا ما دام أحد الأسماء القديمة موجودًا. */
const VIP_SHEET_NAME = 'VIP';
const DIAMOND_SHEET_NAME = 'Diamond';
const LEGACY_LEADS_SHEET_NAME = 'العملاء المحتملون';
const LEGACY_MINORS_SHEET_NAME = 'Moins de 18 ans';

/* مواصفات الفئتين: sheet = الاسم الجديد؛ legacyNames = أسماء قديمة
   نبحث عنها إن لم يوجد الجديد (لا نُنشئ مكررًا). */
const TIER_SHEET_SPECS = [
  { sheet: VIP_SHEET_NAME, legacyNames: [LEGACY_LEADS_SHEET_NAME] },
  { sheet: DIAMOND_SHEET_NAME, legacyNames: [LEGACY_MINORS_SHEET_NAME] }
];
const VIP_SPEC = TIER_SHEET_SPECS[0];
const DIAMOND_SPEC = TIER_SHEET_SPECS[1];

/* بادئة ورقة النسخة الاحتياطية قبل نقل الصفوف القديمة «أقل من 18 سنة»
   (تُضاف طابعًا زمنيًا تلقائيًا إذا كان الاسم مستعملًا). */
const MINORS_BACKUP_PREFIX = '_backup_before_minors_split';

/* عمود العمر: اسمه وهدفه. الترتيب أدناه مطابق تمامًا لتبويبي الفئة. */
const LEAD_AGE_HEADER = 'العمر';
const LEADS_AGE_TARGET_COL = 5;   // العمود E

/* النص الحرفي الأسوأ حالة في صف العناوين: اسمُ المعرّف القديم كسلسلة نصية
   (نتيجة لصق وسيط/تحرير يدوي). كل ترويسة تُكتب من قيم LEADS_HEADERS فقط —
   لضمان ألا يُكتب أي اسم معرّف نصًّا أبدًا، و migrateFixAgeHeader() يصلحه. */
const AGE_HEADER_LEGACY_LITERAL = 'LEAD_AGE_HEADER';

/* عمود «الجاهزية للبدء» (الخطوة 7، الحقل `readinessToStart`): تحتسِب في
   طبقة الفئة عبر decideTier(). اسمه بالفرنسية مثل بقية الأعمدة، ويُطابق
   على نصوص الواجهة العربية (plus الـslugs) عبر normalizeChoice(). */
const READINESS_HEADER = 'Prêt à démarrer';

/* --- قيمة «أقل من 18 سنة» ----------------------------------------------
   المرجع الوحيد الذي يطابق عليه هذا الملف.

   1) ما يرسله الواجهة فعليًا في `ageRange`: js/main.js يترجم الـslug
      (data-value="under-18" في index.html) إلى التسمية العربية التي رآها
      المستخدم، عبر ARABIC_LABELS.step_1 في buildLeadPayload.
      وهذه هي القيمة التي تُخزَّن في عمود «العمر» وتُقرأ في الترحيل.
   2) الـslug نفسه ('under-18') مقبول احتياطًا لو تغيّرت الواجهة يومًا
      فأرسلت القيمة الخام بدل التسمية.

   أي قيمة أخرى (بما فيها الفراغ و'18-24') = لست قاصرًا. */
const MINOR_AGE_RANGE_LABEL = '🎒 أقل من 18 سنة';
const MINOR_AGE_RANGE_SLUG = 'under-18';
const MINOR_AGE_RANGE_VALUES = [MINOR_AGE_RANGE_SLUG, MINOR_AGE_RANGE_LABEL];

/* عمود «أكبر تحدي» المحذوف: كل الأسماء التي قد تظهر في صف العناوين
   (الاسم الحالي بالفرنسية، الاسم العربي القديم، وكل صيغه بحالة مختلفة).
  المقارنة تتم بعد trim + lowercase. لا يدخل FIELD_MAP ولا LEADS_HEADERS
   إطلاقًا: يبقى هنا فقط ليستعمله migrateRemoveChallengeColumn() على الورقة
   الحية، ولتوثيق سبب حذفه. */
const REMOVED_CHALLENGE_FIELD = 'mainChallenge';
const CHALLENGE_HEADER_ALIASES = ['Plus grand défi', 'Plus grand defi', 'أكبر تحدي'];
const CHALLENGE_BACKUP_PREFIX = '_backup_plus_grand_defi';

/* عمود «طريقة التواصل المفضلة» المحذوف: نفس المعالجة بالضبط —
   كل الأسماء التي قد تظهر في صف العناوين (الاسم الحالي بالفرنسية بنبرات
   وبدونها، والاسمان العربيان القديم والاقصر). المقارنة تتم بعد trim +
   collapse + lowercase + تجاهل النبرات. لا يدخل FIELD_MAP ولا
   LEADS_HEADERS ولا PROTECTED_HEADERS إطلاقًا: يبقى هنا فقط ليستعمله
   migrateRemoveContactMethodColumn() على الورقة الحية، ولتوثيق سبب حذفه. */
const REMOVED_CONTACT_METHOD_FIELD = 'contactPreference';
const CONTACT_METHOD_HEADER_ALIASES = ['Moyen de contact préféré', 'Moyen de contact prefere', 'طريقة التواصل المفضلة', 'طريقة التواصل'];
const CONTACT_METHOD_BACKUP_PREFIX = '_backup_moyen_contact';

/* أسماء أعمدة لا يجوز حذفها أبدًا (حماية إضافية) */
const PROTECTED_HEADERS = [
  'Date', 'Nom complet', 'Téléphone', 'E-mail', LEAD_AGE_HEADER,
  'Situation actuelle', 'Objectif professionnel',
  "Niveau d'expérience", 'Compétence souhaitée', 'Temps disponible par semaine',
  'Prêt à investir', 'Remarque', 'Statut', 'Closer',
  'معرف الجلسة', 'حالة التسجيل'
];

const LEADS_HEADERS = [
  'Date',                          // A
  'Nom complet',                   // B
  'Téléphone',                      // C
  'E-mail',                        // D
  LEAD_AGE_HEADER,                 // E (العمر — في منتصف أعمدة البيانات عمدًا؛
                                   //     أعمدة الحالة والتتبع تبقى في النهاية)
  'Situation actuelle',            // F
  'Objectif professionnel',       // G
  "Niveau d'expérience",          // H
  'Compétence souhaitée',         // I
  'Temps disponible par semaine', // J
  READINESS_HEADER,               // K (الجاهزية للبدء — الخطوة 7، تحتسِب في طبقة الفئة)
  'Prêt à investir',              // L (الاستثمار — الخطوة 8، تحتسِب في طبقة الفئة)
  'Remarque',                     // M
  'Statut',                       // N (قائمة منسدلة: جزئي/مؤكد/لم يرد 1-3/تم الدفع/ملغى)
  'Closer'                        // O (قائمة منسدلة يدوية — السكربت لا يكتب فيها)
];

/* كل عنوان يُقبل بالفرنسية أو بالعربية (القديمة) — الترتيب لا يهم */
const DATE_HEADERS   = ['Date', 'التاريخ'];
const PHONE_HEADERS  = ['Téléphone', 'رقم الهاتف'];
const STATUS_HEADERS = ['Statut', 'حالة التسجيل'];
const STATUS_PARTIAL = 'جزئي';
const STATUS_CONFIRMED = 'مؤكد';

/* مفتاح الـ Developer Metadata الذي يحمل session_id (غير ظاهر في الجدول) */
const SESSION_META_KEY = 'skillova_session_id';

/* أسماء خصائص funnelState (camelCase) -> اسم العمود في الورقة.
   ترتيب المدخلات هنا مطابق لترتيب الأعمدة في الورقة (A → O) لسهولة القراءة
   فقط؛ لا يعتمد عليه أي كود (البحث يتم بالاسم عبر صف العناوين).
   كل الأعمدة بالفرنسية عدا «العمر» (عمود جديد، اسمُه عربي كما هو مطلوب).
   أعمدة Date / Statut / Closer ليست هنا: Date يُكتب بالتاريخ الحالي،
   Statut يكتبه الكود («جزئي» ثم «مؤكد»)، و Closer يُملأ يدويًا.
   أي مفتاح خارج هذه القائمة (مثل contactPreference أو mainChallenge
   بعد حذفهما) يتجاهله الكود بصمت: لا يُكتب ولا يُقرأ ولا يخطئ. */
const FIELD_MAP = {
  fullName:            'Nom complet',
  phone:               'Téléphone',
  email:               'E-mail',
  ageRange:            LEAD_AGE_HEADER,
  currentStatus:       'Situation actuelle',
  careerGoal:          'Objectif professionnel',
  experienceLevel:     "Niveau d'expérience",
  skillInterest:       'Compétence souhaitée',
  weeklyTime:          'Temps disponible par semaine',
  readinessToStart:    READINESS_HEADER,
  investmentReadiness: 'Prêt à investir',
  notes:               'Remarque'
};

/* أسماء عربية مقبولة أيضًا (للأعمدة القديمة) — الترتيب لا يهم.
   لا تُحذف هذه القائمة: getPayloadKeyForHeader() يمرّ على كل مفاتيح
   FIELD_MAP ويقرأ LEGACY_AR[k]، فأي مفتاح بلا مدخل هنا يسقط الاستدعاء.
   ملاحظة: لا يوجد مدخل لـ `mainChallenge` ولا لـ `contactPreference` —
   العمودان حُذفا (انظر أعلى الملف). */
const LEGACY_AR = {
  fullName:            ['الاسم الكامل'],
  phone:               ['رقم الهاتف'],
  email:               ['البريد الإلكتروني'],
  ageRange:            [LEAD_AGE_HEADER],
  currentStatus:       ['الوضعية الحالية'],
  careerGoal:          ['الهدف المهني'],
  experienceLevel:     ['مستوى الخبرة'],
  skillInterest:       ['المهارة المطلوبة'],
  weeklyTime:          ['الوقت الأسبوعي المتاح'],
  readinessToStart:    ['الجاهزية للبدء'],
  investmentReadiness: ['جاهزية الاستثمار', 'الجاهزية للاستثمار', 'الاستعداد للاستثمار'],
  notes:               ['ملاحظة', 'الملاحظة']
};

/* يعيد مفتاح payload لاسم العمود (الاسم الحالي أو أي اسم عربي قديم).
   `LEGACY_AR[k]` يُقرأ بأمان (|| []) حتى لا يسقط أي استدعاء بسبب مفتاح
   جديد أُضيف إلى FIELD_MAP ونُسي في LEGACY_AR. */
function getPayloadKeyForHeader(header) {
  if (!header) return null;
  const h = String(header).trim();
  if (h === '') return null;
  return Object.keys(FIELD_MAP).find(function (k) {
    const aliases = LEGACY_AR[k] || [];
    return FIELD_MAP[k] === h || aliases.indexOf(h) !== -1;
  }) || null;
}

/* أول فهرس لأي اسم من القائمة داخل صف العناوين */
function indexOfAny(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    if (names.indexOf(String(headers[i]).trim()) !== -1) return i;
  }
  return -1;
}

/* مثل indexOfAny لكن يتجاهل النبرات (é = e …) — لأسماء الأعمدة المحذوفة */
function indexOfAnyLoose(headers, names) {
  const wanted = names.map(normalizeHeaderLoose);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.indexOf(normalizeHeaderLoose(headers[i])) !== -1) return i;
  }
  return -1;
}

/* --- حل أرقام الأعمدة بالاسم (لا أرقام ثابتة في أي مكان) -------------
   كل قراءة/كتابة في ورقة العملاء المحتملين تمرّ من هنا: نقرأ صف العناوين
   ونشتقّ رقم العمود منه وقت التشغيل. النتيجة: نقل عمود «العمر» إلى E،
   أو إضافة/حذف عمود، أو إعادة ترتيب أي عمود — لا يتطلّب أي تعديل كود،
   ولا يمكن أن يترك فهرسًا ثابتًا قديمًا. */

/* صف العناوين كما هو فعلًا في الورقة (مقاسًا على عرض الورقة) */
function readLeadHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
}

/* رقم العمود (1-based، جاهز لـ getRange) لأول اسم من القائمة، أو -1.
   يقبل الاسم الحالي وأي اسم عربي قديم. */
function resolveColumnIndex(sheet, names) {
  const idx = indexOfAny(getActualHeaders(sheet), names);
  return idx === -1 ? -1 : idx + 1;
}

/* رقم عمود payload بالاسم الحالي أو بأي بديل (1-based، أو -1) */
function resolvePayloadColumn(sheet, header) {
  const key = getPayloadKeyForHeader(header);
  if (!key) return -1;
  return resolveColumnIndex(sheet, [FIELD_MAP[key]].concat(LEGACY_AR[key] || []));
}

/* فهرس (0-based) العمود داخل مصفوفة صف، لملء الصفوف دفعة واحدة */
function columnIndexInRow(headers, names) {
  return indexOfAny(headers, names);
}

/* --- فحص «أقل من 18 سنة» — نقطة مقارنة واحدة في الملف كله --------------
   تتحمّل المسافات وحالة الأحرف وتشكيل الحروف العربية والفواصل والإيموجي،
   فأي قيمة من الواجهة أو من لوحة المفاتيح تُطابَق. لا تُنسَخ هذه المقارنة
   في أي مكان آخر من الملف: استعمل isMinorAgeRange() فقط. */
function normalizeAgeRangeValue(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0640-\u065F\u0670\u200C\u200D\u2060\uFE0E\uFE0F\uFEFF]/g, '') /* تطويل/تشكيل/رابط/VS */
    .replace(/[أإآٱ]/g, 'ا')                        /* أنواع الألف -> ا */
    .replace(/[ىی]/g, 'ي')                             /* ى/ی -> ي */
    .replace(/ة/g, 'ه')                                /* التاء المربوطة -> ه */
    .toLowerCase()
    .replace(/[^0-9A-Za-z\u0621-\u064A\u0660-\u0669]+/g, '') /* يُبقي الحروف والأرقام فقط */
    .replace(/^[\s]+|[\s]+$/g, '');
}

/* true فقط لإجابة «أقل من 18 سنة». يُستعمل في:
   update_lead (توجيه الفئة) + confirm_booking + الترحيل اليدوي. */
function isMinorAgeRange(value) {
  const normalized = normalizeAgeRangeValue(value);
  if (!normalized) return false;
  for (let i = 0; i < MINOR_AGE_RANGE_VALUES.length; i++) {
    if (normalized === normalizeAgeRangeValue(MINOR_AGE_RANGE_VALUES[i])) return true;
  }
  return false;
}

/* --- طبقة الفئة (VIP / Diamond): نقطة قرار واحدة في الملف كله --------------
   Diamond = قاصر، أو «غير جاهز للبدء» (الخطوة 7)، أو «لا يستطيع الاستثمار
   الآن» (الخطوة 8). أي قيمة أخرى — جاهز/جاهز مع توجيه/يحتاج تفاصيل/غريبة —
   لا تدفع نحو Diamond أبدًا. الـslugs تُقبل احتياطًا (translateLabel في
   الواجهة يعود للـslug عند فشل الترجمة إلى العربية). */

const READINESS_LATER_LABEL = '⏳ لا، مازال نحتاج وقت باش نكون جاهز';
const READINESS_LATER_SLUG = 'later';
const READINESS_DIAMOND_VALUES = [READINESS_LATER_SLUG, READINESS_LATER_LABEL];

const INVESTMENT_CANT_LABEL = '⏳ حاليًا ما نقدرش نستثمر';
const INVESTMENT_CANT_LEGACY = '❌ حاليًا ما نقدرش نستثمر';   /* صيغة قديمة */
const INVESTMENT_CANT_SLUG = 'cant-invest';
const INVESTMENT_DIAMOND_VALUES = [INVESTMENT_CANT_SLUG, INVESTMENT_CANT_LABEL, INVESTMENT_CANT_LEGACY];

/* تطبيع خيارات الخطوة 7/8 للمطابقة: إزالة الإيموجي والتشكيل وعلامات الربط،
   توحيد الألف (أ إ آٱ -> ا) والياء (ى ی -> ي) والتاء المربوطة (ة -> ه)،
   خفض حالة الأحرف، وتقليص المسافات. نفس فلسفة normalizeAgeRangeValue لكن
   مع الإبقاء على فراغات الكلمات مفصولة. */
function normalizeChoice(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0640-\u065F\u0670\u200C\u200D\u2060\uFE0E\uFE0F\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^0-9a-z\u0621-\u064A\u0660-\u0669]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* true إذا كانت القيمة تطابق أحد عناصر القائمة (بعد التطبيع) */
function matchesChoice(value, list) {
  if (value == null || String(value).trim() === '') return false;
  const n = normalizeChoice(value);
  if (!n) return false;
  for (let i = 0; i < list.length; i++) {
    if (normalizeChoice(list[i]) === n) return true;
  }
  return false;
}

/* يقرّر فئة الجلسة من القيم المدموجة (الواردة غير الفارغة تغلب على المخزَّنة)
   { ageRange, readinessToStart, investmentReadiness } -> 'VIP' | 'Diamond' |
   null. null = لا معلومة في الحقول الثلاثة: جلسة جديدة تذهب VIP، والصف
   الموجود يبقى مكانه (لا نقل بسبب حقل ناقص). */
function decideTier(values) {
  const age = values && values.ageRange;
  const ready = values && values.readinessToStart;
  const invest = values && values.investmentReadiness;
  const hasAny = String(age == null ? '' : age).trim() !== '' ||
    String(ready == null ? '' : ready).trim() !== '' ||
    String(invest == null ? '' : invest).trim() !== '';
  if (!hasAny) return null;
  if (isMinorAgeRange(age)) return DIAMOND_SHEET_NAME;
  if (matchesChoice(ready, READINESS_DIAMOND_VALUES)) return DIAMOND_SHEET_NAME;
  if (matchesChoice(invest, INVESTMENT_DIAMOND_VALUES)) return DIAMOND_SHEET_NAME;
  return VIP_SHEET_NAME;
}

/* مواصفات فئة من اسمها (VIP/Diamond) — للوصول إلى getTierSheet() */
function tierSheetSpecFor(tierName) {
  for (let i = 0; i < TIER_SHEET_SPECS.length; i++) {
    if (TIER_SHEET_SPECS[i].sheet === tierName) return TIER_SHEET_SPECS[i];
  }
  return null;
}

/* 1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA (للسجلات فقط) */
function colLetter(col) {
  let s = '';
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function leadHeadersToLog(headers) {
  return headers.map(function (h, i) { return colLetter(i + 1) + ':' + (h || '(فارغ)'); }).join(' | ');
}

/* ==========================================================
   نقاط الدخول
   ========================================================== */

function doPost(e) {
  let body = null;
  try {
    body = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('GAS_SHARED_SECRET');
    if (!expectedSecret || body.shared_secret !== expectedSecret) {
      return jsonOut({ success: false, error: 'Unauthorized' });
    }
    let result;
    switch (body.action) {
      case 'update_lead': result = updateLead(body); break;
      case 'check_duplicate_phone': result = checkDuplicatePhone(body); break;
      case 'confirm_booking': result = confirmBooking(body); break;
      default: result = { success: false, error: 'إجراء غير معروف' };
    }
    return jsonOut(result);
  } catch (err) {
    const action = body && body.action ? String(body.action) : '?';
    logError('doPost/action=' + action, err);
    return jsonOut({ success: false, error: err.toString() });
  }
}

/* تسجيل خطأ موحَّد: اسم الدالة + رسالة الخطأ + الـstack. لا يُسجَّل
   الهاتف ولا البريد ولا أي قيمة من الـpayload أبدًا. */
function logError(functionName, err) {
  const msg = err == null ? 'unknown error' : String(err.message || err);
  const stack = err && err.stack ? String(err.stack) : '';
  Logger.log('ERROR [' + functionName + '] ' + msg + (stack ? ' | stack: ' + stack : ''));
}

function doGet(e) {
  return jsonOut({ success: true, message: 'SKILLOVA_V4_FR' });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================
   أدوات الورقة + ربط session_id بالصف (Developer Metadata)
   ========================================================== */

/* يضيف أعمدة LEADS_HEADERS الناقصة إلى ورقة قائمة، في آخرها فقط.
   آمن على البيانات القديمة: لا يحذف ولا يعيد ترتيب ولا يكتب فوق أي خلية
   قائمة، ويضيف العمود الجديد كعمود فارغ في النهاية.

   لا تعيد كتابة صف العناوين إطلاقًا ولا تحرّك أي عمود قائم: الترتيب
   النهائي (وضع «العمر» في العمود E و«Prêt à démarrer» قبل «Prêt à
   investir») من مسؤولية `migrateAddAgeColumn()` و`migrateAddReadinessColumn()`
   فقط، لأنها عمليات يدوية تُشغَّل مرة واحدة. قبل تشغيلها يمكن أن يظهر
   العمودان في نهاية الورقة — وهذا آمن تمامًا لأن كل الكتابة بالاسم.

   يُستدعى دائمًا من getTierSheet() قبل القراءة/الكتابة.

   * ملاحظة: لأن العمودين «Plus grand défi» و«Moyen de contact préféré» خرجا من
   * LEADS_HEADERS (وFIELD_MAP)، فإن هذه الدالة **لن تعيد إنشاءهما** على ورقة
   * قائمة — بل العكس: لو كان أي عمود منهما ما زال موجودًا في الورقة الحية
   * فلن يُلمس إطلاقًا. إزالتهما من هناك من مسؤولية إحدى الدالتين:
   * migrateRemoveChallengeColumn() أو migrateRemoveContactMethodColumn(). */
function ensureHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const actual = readLeadHeaders(sheet);
  const missing = LEADS_HEADERS.filter(function (h) { return actual.indexOf(h) === -1; });
  if (!missing.length) return;
  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  Logger.log('ensureHeaders: أُضيفت في النهاية (لم تُزحزح أعمدة قائمة): ' + missing.join(' ، '));
  if (missing.indexOf(LEAD_AGE_HEADER) !== -1) {
    Logger.log('ensureHeaders: عمود «' + LEAD_AGE_HEADER + '» في عمود ' + (lastCol + missing.indexOf(LEAD_AGE_HEADER) + 1) +
      ' وليس العمود ' + LEADS_AGE_TARGET_COL + ' — شغّل migrateAddAgeColumn() مرة واحدة لنقله إلى E.');
  }
  if (missing.indexOf(READINESS_HEADER) !== -1) {
    Logger.log('ensureHeaders: عمود «' + READINESS_HEADER + '» أُضيف في النهاية — شغّل ' +
      'migrateAddReadinessColumn() مرة واحدة لوضعه مباشرة قبل «Prêt à investir».');
  }
}

/* --- تبويبا الفئة (VIP / Diamond) ------------------------------------------
   نفس ترويسات LEADS_HEADERS بالترتيب نفسه في التبويبين، وتُنشأ تلقائيًا عند
   أول lead يستهدفها. findTierSheet() = قراءة فقط (الاسم الجديد أولًا ثم
   الأسماء القديمة)؛ getTierSheet() = قراءة أو إنشاء، والإنشاء دائمًا
   بالاسم الجديد حصرًا فلا يُنشأ تبويب مكرر أبدًا ما دام أحد الأسماء
   القديمة موجودًا. */
function findTierSheet(spec) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(spec.sheet);
  if (sheet) return sheet;
  for (let i = 0; i < spec.legacyNames.length; i++) {
    sheet = ss.getSheetByName(spec.legacyNames[i]);
    if (sheet) return sheet;
  }
  return null;
}

function getTierSheet(spec) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = findTierSheet(spec);
  if (!sheet) {
    sheet = ss.insertSheet(spec.sheet);
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    if (spec.sheet !== VIP_SHEET_NAME) copyLeadsHeaderFormat(findTierSheet(VIP_SPEC), sheet);
    sheet.setFrozenRows(1);
    Logger.log('getTierSheet: أُنشئت ورقة "' + spec.sheet + '" بترويسات LEADS_HEADERS (' +
      LEADS_HEADERS.length + ' عمودًا، «' + LEAD_AGE_HEADER + '» = ' + colLetter(LEADS_AGE_TARGET_COL) + ').');
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    /* ورقة موجودة لكن فارغة تمامًا: تُكتب الترويسات بالترتيب نفسه */
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    if (spec.sheet !== VIP_SHEET_NAME) copyLeadsHeaderFormat(findTierSheet(VIP_SPEC), sheet);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet);
  }
  return sheet;
}

function getActualHeaders(sheet) {
  if (sheet.getLastRow() === 0) return LEADS_HEADERS.slice();
  return readLeadHeaders(sheet);
}

/* كل أسماء تبويبات الفئة الممكنة (الجديد + القديم، بلا تكرار) — للبحث
   في findLeadRowBySession و checkDuplicatePhone. */
function tierSheetLookupNames() {
  const names = [];
  for (let i = 0; i < TIER_SHEET_SPECS.length; i++) {
    const spec = TIER_SHEET_SPECS[i];
    if (names.indexOf(spec.sheet) === -1) names.push(spec.sheet);
    for (let j = 0; j < spec.legacyNames.length; j++) {
      if (names.indexOf(spec.legacyNames[j]) === -1) names.push(spec.legacyNames[j]);
    }
  }
  return names;
}

/* مطابقة تنسيق صف العناوين مع الورقة الرئيسية (بلا fatal إن تعذّر) */
function copyLeadsHeaderFormat(fromSheet, toSheet) {
  if (!fromSheet || !toSheet) return;
  try {
    fromSheet.getRange(1, 1, 1, Math.max(fromSheet.getLastColumn(), 1))
      .copyTo(toSheet.getRange(1, 1, 1, LEADS_HEADERS.length), CopyPasteType.PASTE_FORMAT, false);
  } catch (err) {
    Logger.log('copyLeadsHeaderFormat: تعذّر نسخ تنسيق الترويسة (غير مهم): ' + err.toString());
  }
}

/* كل الصفوف المرتبطة بـ session_id — للبحث ولرصد التكرارات.
   DeveloperMetadata.getLocation() تُرجع Range، وRange.getRow() تُرجع رقمًا
   (وليس Range) — لذلك تُستدعى getRow() مرة واحدة على النطاق مباشرة. */
function listRowsBySessionId(sheet, sessionId) {
  const rows = [];
  if (!sessionId) return rows;
  const found = sheet.createDeveloperMetadataFinder()
    .withKey(SESSION_META_KEY)
    .withValue(String(sessionId))
    .find();
  for (let i = 0; i < found.length; i++) {
    const location = found[i].getLocation();
    if (!location) continue;
    const row = location.getRow();
    if (row && rows.indexOf(row) === -1) rows.push(row);
  }
  return rows;
}

/* يعيد أول صف مرتبط بـ session_id أو -1 (سياسة «صف واحد بالضبط»
   مع التحذير عند التكرار تكون في findLeadRowBySession). */
function findRowBySessionId(sheet, sessionId) {
  const rows = listRowsBySessionId(sheet, sessionId);
  return rows.length ? rows[0] : -1;
}

/* يربط الصف بـ session_id (مخفي) — idempotent: لا يضيف وسومًا مكررة
   على نفس الصف، لأن وسومًا مكررة تُنتج صفًا متكررًا في listRowsBySessionId. */
function tagRowWithSession(sheet, row, sessionId) {
  if (!sessionId) return;
  const rows = listRowsBySessionId(sheet, sessionId);
  if (rows.indexOf(row) !== -1) return;
  sheet.getRange(row + ':' + row).addDeveloperMetadata(SESSION_META_KEY, String(sessionId));
}

/* --- الجلسة عبر تبويبي الفئة (VIP + Diamond، بالاسمين الجديد والقديم) ----
   يُرجع { sheet, row } أو null. لا يُنشئ أي ورقة: البحث فقط.
   يضمن «صفًا واحدًا بالضبط»: يسرد كل الوسوم المطابقة عبر كل تبويبات الفئة
   ويُحذّر بـ Logger عند وجود تكرار (يُفحص لاحقًا بـ migrateRepairOrphanRows). */
function findLeadRowBySession(sessionId) {
  if (!sessionId) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = tierSheetLookupNames();
  const marks = [];
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (!sheet) continue;
    const rows = listRowsBySessionId(sheet, sessionId);
    for (let j = 0; j < rows.length; j++) marks.push({ sheet: sheet, row: rows[j] });
  }
  if (!marks.length) return null;
  if (marks.length > 1) {
    Logger.log('findLeadRowBySession: ⚠ معرّف الجلسة مرتبط بالصفوف: ' +
      marks.map(function (m) { return '«' + m.sheet.getName() + '»#' + m.row; }).join(' ، ') +
      ' — استُعمل الأول؛ راجع التكرارات بـ migrateRepairOrphanRows().');
  }
  return marks[0];
}

/* كل معرّفات الجلسات في الورقة: { رقم الصف: session_id } — للترحيل اليدوي */
function listSessionIdsByRow(sheet) {
  const map = {};
  const found = sheet.createDeveloperMetadataFinder().withKey(SESSION_META_KEY).find();
  for (let i = 0; i < found.length; i++) {
    const loc = found[i].getLocation();
    if (!loc) continue;
    map[loc.getRow()] = String(found[i].getValue() == null ? '' : found[i].getValue());
  }
  return map;
}

/* --- قراءة/كتابة صفوف lead بالاسم (بلا أي رقم عمود ثابت) --------------
   valueMapKeyForHeader: مفتاح موحَّد لكل عمود — «مفتاح payload» للأعمدة
   القابلة للكتابة (fullName, phone …) و«اسم العمود» لبقية الأعمدة
   (Date, Statut, Closer). بنفسه يُقرأ من ورقة وبُكتب في أخرى، فالورقتان
   لا تحتاجان حتى أن يتطابق ترتيبهما أو عدد أعمدتهما. */
function valueMapKeyForHeader(header) {
  const key = getPayloadKeyForHeader(header);
  return key ? 'p:' + key : 'h:' + String(header == null ? '' : header).trim();
}

/* خريطة قيم صف واحد: { valueMapKeyForHeader: value } */
function readRowValueMap(sheet, row) {
  const headers = getActualHeaders(sheet);
  if (row < 1 || row > sheet.getLastRow()) return {};
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const map = {};
  headers.forEach(function (h, i) { map[valueMapKeyForHeader(h)] = values[i]; });
  return map;
}

/* قيمة payload واحدة بعد sanitizeValue (نفس قاعدة الفراغ المتروك) */
function buildCombinedValues(data) {
  const combined = {};
  Object.keys(FIELD_MAP).forEach(function (key) {
    combined[key] = sanitizeValue(data[key] || '');
  });
  return combined;
}

/* تملأ مصفوفة صف بقيم الخريطة (الفارغ/null لا يكتب فوق الموجود) */
function applyValueMapToRow(headers, rowValues, map) {
  if (!map) return;
  headers.forEach(function (h, idx) {
    const k = valueMapKeyForHeader(h);
    if (!Object.prototype.hasOwnProperty.call(map, k)) return;
    const v = map[k];
    if (v === '' || v === null || v === undefined) return;
    rowValues[idx] = v;
  });
}

/* قيم الـpayload غير الفارغة فقط تغلب على الموجود (تحديث تدريجي) */
function applyCombinedToRow(headers, rowValues, combined) {
  headers.forEach(function (h, idx) {
    const key = getPayloadKeyForHeader(h);
    if (key && combined[key]) rowValues[idx] = combined[key];
  });
}

/* خلية فارغة (تعامل المعالجة الذكية للقيم الفارغة بنفس المبدأ) */
function isEmptyCell(value) {
  return value === '' || value === null || value === undefined;
}

/* يكتب صف lead في الورقة حسب أسماء الأعمدة ويعيد رقم الصف.
   row = -1  -> صف جديد في النهاية (تاريخ من الخادم + حالة «جزئي»).
   row >= 1  -> تحديث ذلك الصف: تاريخه وحالته محفوظان كما هما.
   valueMap  -> قيم محفوظة من صف سابق (تُستعمل عند النقل من تبويب لآخر).

   ملاحظة أثناء النقل: القيم المحفوظة (Date / Statut / Closer …) تُطبَّق
   أولًا على الصف الجديد، ثم تُملأ القيم الافتراضية (الآن / جزئي) فقط إن
   بقيت خلاياها فارغة — فلا تُفقد حالة «مؤكد» أو تاريخ الصف الأصلي عند
   نقل صف من تبويب الفئة إلى الآخر. */
function writeLeadRow(sheet, row, valueMap, combined, sessionId) {
  const headers = getActualHeaders(sheet);
  const rowValues = row === -1
    ? new Array(headers.length).fill('')
    : sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  applyValueMapToRow(headers, rowValues, valueMap);
  applyCombinedToRow(headers, rowValues, combined);

  if (row === -1) {
    const dateIdx = columnIndexInRow(headers, DATE_HEADERS);
    const statusIdx = columnIndexInRow(headers, STATUS_HEADERS);
    if (dateIdx !== -1 && isEmptyCell(rowValues[dateIdx])) rowValues[dateIdx] = new Date();
    if (statusIdx !== -1 && isEmptyCell(rowValues[statusIdx])) rowValues[statusIdx] = STATUS_PARTIAL;
  }
  const target = row === -1 ? sheet.getLastRow() + 1 : row;
  sheet.getRange(target, 1, 1, headers.length).setValues([rowValues]);
  tagRowWithSession(sheet, target, sessionId);
  return target;
}

/* ==========================================================
   update_lead — حفظ تدريجي
   ========================================================== */

function updateLead(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    updateLeadInternal(body);
  } catch (err) {
    logError('update_lead', err);
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

/* بلا قفل — تُستدعى من داخل دوال تمتلك القفل أصلًا.
   ترجع موضع الصف { sheet, row } ليسهل على confirm_booking كتابة الحالة فيه،
   دون كشف أي شيء في الردّ المرجوع للواجهة. */
function updateLeadInternal(body) {
  const sessionId = body.session_id;
  const data = body.data || {};
  const combined = buildCombinedValues(data);
  const existing = findLeadRowBySession(sessionId);

  /* كل الحقول اختيارية: أي مفتاح غائب في data أو فارغ لا يُكتب ولا يُخطئ.
     «العمر» تحديدًا اختياري ولا يُتحقَّق منه إطلاقًا (لا في update_lead ولا
     في confirm_booking) — قيمة غائبة أو فارغة تُترك كما هي.

     الكتابة بالاسم لا بالترتيب: نبني صفًا بطول صف العناوين الفعلي ونملؤه
     حسب اسم كل عمود، لذلك لا يمكن أن تُكتب قيمة في العمود الخطأ مهما كان
     ترتيب الأعمدة في التبويب.

     توجيه الفئة: قيم الطبقة الثلاث (العمر / الجاهزية للبدء / الاستثمار)
     تُدمج — الواردة غير الفارغة تغلب على المخزَّن (يُقرأ من الصف الحالي
     بالاسم) — ويقرّرها decideTier() بضربة واحدة: أي شرط Diamond -> Diamond،
     وعداه -> VIP. غياب الحقول الثلاثة كليًا ليس سببًا للنقل أبدًا:
     جلسة جديدة -> VIP، وصف موجود يبقى مكانه. */
  const storedMap = existing ? readRowValueMap(existing.sheet, existing.row) : {};
  const tier = decideTier(mergedTierInputs(data, storedMap));
  let targetSheet;
  if (tier) {
    targetSheet = getTierSheet(tierSheetSpecFor(tier));
  } else if (existing) {
    targetSheet = existing.sheet;          // الصف يبقى مكانه
  } else {
    targetSheet = getTierSheet(VIP_SPEC);
  }

  /* المقارنة بالاسم لا بمرجع الكائن: Sheets يستعيد غلافًا جديدًا في كل
     getSheetByName، فقد لا يتساوى مرجعان لنفس التبويب. */
  const sameSheet = !!(existing && existing.sheet.getName() === targetSheet.getName());

  if (sameSheet) {
    const row = writeLeadRow(targetSheet, existing.row, null, combined, sessionId);
    return { sheet: targetSheet, row: row };
  }

  /* --- نقل: تغيّرت شروط الفئة (العمر/الجاهزية/الاستثمار)، فالصف موجود في
     التبويب الخطأ -----------------------------------------------------
     الترتيب مقصود: نكتب المدموج في التبويب الصحيح (بالأسماء + معرّف
     الجلسة) ثم نحذف القديم. أي خطأ في الكتابة يوقف العملية قبل الحذف. */
  const sourceValues = existing ? readRowValueMap(existing.sheet, existing.row) : {};
  const duplicatedRow = existing ? findRowBySessionId(targetSheet, sessionId) : -1;
  let newRow;
  try {
    newRow = writeLeadRow(targetSheet, duplicatedRow === -1 ? -1 : duplicatedRow, sourceValues, combined, sessionId);
  } catch (moveErr) {
    Logger.log('updateLeadInternal: فشل نقل الصف إلى "' + targetSheet.getName() + '" — لم يُحذف الصف القديم: ' +
      moveErr.toString());
    throw moveErr;
  }
  if (existing) {
    existing.sheet.deleteRow(existing.row);
    Logger.log('updateLeadInternal: تغيّرت شروط الفئة — نُقل صف الجلسة ' + sessionId + ' من "' +
      existing.sheet.getName() + '" (الصف ' + existing.row + ') إلى "' + targetSheet.getName() + '" (الصف ' + newRow + ')' +
      (duplicatedRow !== -1 ? ' (استُبدل صف موجود مسبقًا في التبويب الهدف)' : '') + '.');
  }
  return { sheet: targetSheet, row: newRow };
}

/* قيم الطبقة الثلاث المدموجة من الـpayload والمخزَّنة: الواردة غير الفارغة
   تغلب، والباقي يُقرأ من الصف المخزَّن باسم العمود (مفتاح 'p:...'). */
function mergedTierInputs(data, storedMap) {
  function pick(key) {
    const incoming = data && data[key];
    if (incoming != null && String(incoming).trim() !== '') return incoming;
    const stored = storedMap ? storedMap['p:' + key] : '';
    return stored == null ? '' : stored;
  }
  return {
    ageRange: pick('ageRange'),
    readinessToStart: pick('readinessToStart'),
    investmentReadiness: pick('investmentReadiness')
  };
}

/* ==========================================================
   حماية عامة
   ========================================================== */

function isHoneypotTriggered(data) {
  return data && data.website_url && data.website_url.toString().trim() !== '';
}

function sanitizeValue(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

function isValidAlgerianPhone(phone) {
  if (!phone) return true;
  const cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
  return /^0[567]\d{8}$/.test(cleaned);
}

/* ==========================================================
   check_duplicate_phone — تبويبا الفئات (VIP + Diamond)
   ========================================================== */

/* القاعدة كما هي تمامًا (لا تغيير): تكرار فقط مقابل صف حالته ليست فارغة
   وليست «جزئي» — أي «مؤكد» وأي حالة أخرى مُدخلة يدويًا. عمود الهاتف
   والحالة يُحلّان بالاسم من صف العناوين في كل تبويب فئة على حدة
   (VIP و Diamond، بالاسمين الجديد والقديم). */
function checkDuplicatePhone(body) {
  const phone = body.data && body.data.phone ? body.data.phone.toString().trim() : '';
  if (!phone) return { success: true, isDuplicate: false };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const names = tierSheetLookupNames();
  for (let s = 0; s < names.length; s++) {
    const sheet = ss.getSheetByName(names[s]);
    if (!sheet) continue;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const phoneCol = columnIndexInRow(headers, PHONE_HEADERS);
    const statusCol = columnIndexInRow(headers, STATUS_HEADERS);
    if (phoneCol === -1 || statusCol === -1) continue;
    for (let i = 1; i < data.length; i++) {
      const p = (data[i][phoneCol] || '').toString().trim();
      const st = String(data[i][statusCol] || '').trim();
      if (p === phone && st !== '' && st !== STATUS_PARTIAL) {
        return { success: true, isDuplicate: true };
      }
    }
  }
  return { success: true, isDuplicate: false };
}

/* ==========================================================
   confirm_booking — تثبيت البيانات بحالة «مؤكد»
   ========================================================== */

/* ==========================================================
   Meta CAPI — القاصر «أقل من 18 سنة» لا يُرسل إطلاقًا
   ------------------------------------------------------------
   ageRange موجود في الـpayload -> isMinorAgeRange مباشرة. وإن غاب عن
   هذا الـpayload نقرأ «العمر» من الصف الذي استقرت فيه الجلسة فعلًا
   (بالاسم لا باسم التبويب). الدالة تُستدعى أيضًا بحاجز داخلي (defense
   in depth) في sendScheduleToMetaCAPI، فلا يرسل قاصرًا أي caller مستقبلي.
   لا يُسجَّل الهاتف ولا البريد أبدًا. */
function isMinorLeadForMeta(data, placedRow) {
  const raw = data && data.ageRange != null ? data.ageRange : '';
  if (String(raw).trim() !== '') return isMinorAgeRange(raw);
  return isStoredRowMinor(placedRow);
}

/* يُقرأ «العمر» من الصف الذي استقرت فيه الجلسة، بالاسم لا باسم التبويب
   (التوجيه في VIP/Diamond يعتمد على القيم المدموجة وليس على اسم التبويب).
   أي خطأ في القراءة -> fail closed (لا يُرسل): القاعدة أن القاصر لا يبلغ
   Meta أبدًا. */
function isStoredRowMinor(placedRow) {
  if (!placedRow || !placedRow.sheet || !(placedRow.row >= 1)) return false;
  try {
    if (placedRow.row > placedRow.sheet.getLastRow()) return false;
    const headers = getActualHeaders(placedRow.sheet);
    const ageIdx = columnIndexInRow(headers, [LEAD_AGE_HEADER]);
    if (ageIdx === -1) return false;
    const value = placedRow.sheet.getRange(placedRow.row, ageIdx + 1).getValue();
    return isMinorAgeRange(value);
  } catch (err) {
    Logger.log('isStoredRowMinor: تعذّر قراءة «العمر» من الصف المخزَّن — لا يُرسل (fail closed): ' + err.toString());
    return true;
  }
}

function confirmBooking(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  if (!isValidAlgerianPhone(body.data && body.data.phone)) return { success: false, error: 'رقم الهاتف غير صالح' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let placed = null;
  try {
    /* نفس توجيه update_lead: الصف يُنقل إن انقلب اتجاه فئته، ثم تُكتب
       «مؤكد» في عمود الحالة بالاسم — في التبويب الذي استقر فيه الصف فعلاً.
       أي استثناء هنا يُسجَّل ويُعيد success:false (لا يصل الجلسة أبدًا). */
    placed = updateLeadInternal(body);
    if (placed && placed.row !== -1) {
      const statusCol = resolveColumnIndex(placed.sheet, STATUS_HEADERS);
      if (statusCol !== -1) {
        const cell = placed.sheet.getRange(placed.row, statusCol);
        const current = String(cell.getValue() || '').trim();
        if (current === '' || current === STATUS_PARTIAL) cell.setValue(STATUS_CONFIRMED);
      }
    }
  } catch (err) {
    logError('confirm_booking_update', err);
    return { success: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }

  /* Meta CAPI — لا يُفشل التأكيد أبدًا؛ يتجاهل بصمت إن لم تُضبط بيانات Meta.
     القاصر لا يُرسل: النتيجة من ageRange في الـpayload، وإن غاب منها
     فمن قيمة «العمر» في الصف المخزَّن (الاسم لا اسم التبويب). */
  try {
    if (isMinorLeadForMeta(body.data, placed)) {
      Logger.log('confirmBooking: تخطّي Meta CAPI — lead «أقل من 18 سنة» (لا يُرسل إلى Meta).');
      return { success: true };
    }
    try {
      sendScheduleToMetaCAPI(body.data, placed);
    } catch (metaErr) {
      Logger.log('confirmBooking: Meta call failed silently: ' + metaErr.toString());
    }
  } catch (err) {
    Logger.log('confirmBooking: فشل المسار غير الحرج (Meta) — لا يُفشل التأكيد: ' + err.toString());
  }
  return { success: true };
}

/* ==========================================================
   تشخيص + ترحيل (تشغيل يدوي من المحرر)
   ----------------------------------------------------------------
ترتيب التشغيل: الدوال التالية تعمل **بأي ترتيب** لأنها
   كلها تبحث عن أعمدتها بالاسم في صف العناوين ولا تفترض أي رقم عمود:
      1) migrateRenameTierSheets()          — «العملاء المحتملون» → VIP،
                                               «Moins de 18 ans» → Diamond
      2) migrateAddAgeColumn()               — يثبّت «العمر» في العمود E (ينقل عمودًا ملحقًا كاملًا)
      3) migrateAddReadinessColumn()         — يثبّت «Prêt à démarrer» قبل «Prêt à investir»
      4) migrateRemoveChallengeColumn()      — يحذف «Plus grand défi»
      5) migrateRemoveContactMethodColumn()  — يحذف «Moyen de contact préféré»
      6) migrateMinorsToSeparateSheet()      — ينقل «أقل من 18» إلى تبويب Diamond (مرة واحدة)
      7) migrateFixAgeHeader()               — يُصلح ترويسة كُتب فيها 'LEAD_AGE_HEADER' نصًّا (بلا نقل بيانات)
      8) migrateRepairOrphanRows()           — تقرير فقط: الصفوف اليتيمة والتكرارات لكل تبويب
   شغّل runSheetDiagnostics() في النهاية للتأكد: 15 عمودًا، «العمر» = E،
   «Prêt à démarrer» = K، Statut = N، Closer = O، بلا ترويسات غير معروفة
   (✗ تظهر الآن لأي ترويسة ليست في LEADS_HEADERS ولا بديلًا معروفًا) —
   في تبويبي VIP و Diamond.
   ⚠ migrateSheet() وحدها مدمّرة (تحذف التبويب القديم) — لا تُستخدم لهذا الغرض.
   ============================================================ */

/* عدد صفوف «أقل من 18 سنة» في ورقة (نفس المقارنة الواحدة)، أو -1 إن كان
   عمود «العمر» مفقودًا في تلك الورقة. */
function countMinorRows(sheet) {
  const headers = readLeadHeaders(sheet);
  const ageIdx = columnIndexInRow(headers, [LEAD_AGE_HEADER]);
  if (ageIdx === -1) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const col = sheet.getRange(2, ageIdx + 1, lastRow - 1, 1).getValues();
  let n = 0;
  for (let i = 0; i < col.length; i++) if (isMinorAgeRange(col[i][0])) n++;
  return n;
}

/* عدد صفوف تبويب يقرّرها decideTier() في فئة مخالفة لفئة التبويب الذي
   استقرّت فيه حاليًا. تُقرأ قيم الصف من الورقة نفسها (لا payload). */
function countTierMismatches(sheet, ownSheetName) {
  const headers = readLeadHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let n = 0;
  for (let r = 0; r < data.length; r++) {
    const map = {};
    headers.forEach(function (h, i) { map[valueMapKeyForHeader(h)] = data[r][i]; });
    const tier = decideTier(mergedTierInputs({}, map));
    if (tier && tier !== ownSheetName) n++;
  }
  return n;
}

/* سطر ✓/✗ واحد لكل تبويب فئة: العناوين مطابقة لـ LEADS_HEADERS بالترتيب،
   «العمر» في E، «Prêt à démarrer» قبل «Prêt à investir»، لا أعمدة زائدة،
   وعدد الصفوف التي تصوّب فئة أخرى. لا تفشل إن لم يكن التبويب موجودًا،
   ويُنوَّه إذا كانت الورقة تحمل اسمًا قديمًا (الترحيل لم يُشغَّل بعد). */
function logTierStructureLine(spec) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const label = spec.sheet;
  const sheet = findTierSheet(spec);
  if (!sheet) {
    Logger.log('✗ تبويب «' + label + '»: غير موجود — ' + (label === DIAMOND_SHEET_NAME
      ? 'لا مشكلة: يُنشأ تلقائيًا عند أول lead يصوّب Diamond (getTierSheet()/update_lead).'
      : 'يُنشأ تلقائيًا عند أول lead جديد (getTierSheet()).'));
    return;
  }
  if (sheet.getName() !== label) {
    Logger.log('⚠ تبويب «' + sheet.getName() + '» يُستعمل حاليًا كفئة ' + label +
      ' (اسم قديم) — شغّل migrateRenameTierSheets() مرة واحدة لإعادة التسمية.');
  }
  const actual = readLeadHeaders(sheet);
  const orderOk = actual.length === LEADS_HEADERS.length &&
    LEADS_HEADERS.every(function (h, i) { return actual[i] === h; });
  const ageCol = actual.indexOf(LEAD_AGE_HEADER) + 1;
  const ageOk = ageCol === LEADS_AGE_TARGET_COL;
  const readCol = actual.indexOf(READINESS_HEADER) + 1;
  const investCol = actual.indexOf('Prêt à investir') + 1;
  const readOk = readCol !== -1 && investCol === readCol + 1;
  const extra = actual.filter(function (h) { return LEADS_HEADERS.indexOf(h) === -1; });
  const extraOk = extra.length === 0;
  const invalid = listInvalidHeaders(sheet);
  const invalidOk = invalid.length === 0;
  const minorsHere = countMinorRows(sheet);
  const mismatches = countTierMismatches(sheet, label);
  Logger.log((orderOk && ageOk && readOk && extraOk && invalidOk ? '✓' : '✗') + ' تبويب «' + label + '»:' +
    ' العناوين مطابقة لـ LEADS_HEADERS بالترتيب: ' + (orderOk ? 'نعم' : 'لا') +
    ' | الأعمدة: ' + actual.length + '/' + LEADS_HEADERS.length +
    ' | «' + LEAD_AGE_HEADER + '» = ' + (ageCol ? colLetter(ageCol) + ' (' + ageCol + ')' : 'مفقود') +
    (ageOk ? ' ✓' : ' ✗ (المتوقع ' + colLetter(LEADS_AGE_TARGET_COL) + ' = ' + LEADS_AGE_TARGET_COL + ')') +
    ' | «' + READINESS_HEADER + '» = ' + (readOk ? colLetter(readCol) + ' ✓'
      : (readCol ? colLetter(readCol) + ' ✗ (المتوقع قبل «Prêt à investir»)' : 'مفقود — شغّل migrateAddReadinessColumn()')) +
    ' | أعمدة زائدة: ' + (extra.join(' ، ') || '(لا شيء)') + (extraOk ? ' ✓' : ' ✗') +
    ' | ترويسات غير معروفة: ' + (invalidOk ? 'لا شيء ✓'
      : invalid.map(function (x) { return '"' + x.header + '"@' + colLetter(x.col); }).join(' ، ') + ' ✗ — شغّل migrateFixAgeHeader() إن كانت «' + AGE_HEADER_LEGACY_LITERAL + '»') +
    ' | صفوف بيانات: ' + Math.max(0, sheet.getLastRow() - 1) +
    ' | «أقل من 18» هنا: ' + (minorsHere < 0 ? 'غير قابل للقراءة' : minorsHere) +
    (label === VIP_SHEET_NAME && minorsHere > 0 ? ' — شغّل migrateMinorsToSeparateSheet()' : '') +
    ' | تصوّب فئة أخرى: ' + (mismatches ? mismatches + ' — ستُعاد توجيهها عند أول save/confirm' : '0'));
  if (invalid.length) {
    invalid.forEach(function (x) {
      Logger.log('✗ ترويسة غير معروفة في «' + label + '» العمود ' + colLetter(x.col) + ': ' + JSON.stringify(x.header) +
        ' — ليست في LEADS_HEADERS ولا بديلًا معروفًا. إن كانت «' + AGE_HEADER_LEGACY_LITERAL +
        '» فشغّل migrateFixAgeHeader()، وإلا فافحص الورقة يدويًا.');
    });
  }
  logOrphanPartialRows(sheet);
}

function runSheetDiagnostics() {
  /* سطر مختصر (✓/✗) لكل تبويب فئة أولًا: يعملان حتى لو لم يكونا موجودين
     بعد، ولا يمنعان بقية الفحوص التفصيلية لتبويب VIP. */
  logTierStructureLine(VIP_SPEC);
  logTierStructureLine(DIAMOND_SPEC);

  const sheet = findTierSheet(VIP_SPEC);
  if (!sheet) { Logger.log('لا يوجد تبويب "' + VIP_SHEET_NAME + '" (ولن يُنشأ هنا).'); return; }
  if (sheet.getLastRow() === 0) { Logger.log('التبويب فارغ.'); return; }
  const actual = getActualHeaders(sheet);
  Logger.log('آخر صف: ' + sheet.getLastRow() + ' | الأعمدة: ' + actual.length);
  Logger.log('ترتيب العناوين: ' + leadHeadersToLog(actual));
  LEADS_HEADERS.forEach(function (h, i) {
    const pos = actual.indexOf(h);
    Logger.log(colLetter(i + 1) + ' ' + h + ' => ' + (pos === -1 ? 'مفقود' : 'العمود ' + (pos + 1)) + (pos === i ? ' ✓' : (pos === -1 ? '' : ' (يُتوقع ' + colLetter(i + 1) + ')')));
  });
  Logger.log('أعمدة زائدة: ' + (actual.filter(function (h) { return LEADS_HEADERS.indexOf(h) === -1; }).join(' ، ') || '(لا شيء)'));

  /* ملاحظة: العمود المحذوف «Moyen de contact préféré» يظهر ضمن «أعمدة زائدة»
     ما دام migrateRemoveContactMethodColumn() لم تُشغَّل بعد — هذا متوقّع. */
  const leftovers = CONTACT_METHOD_HEADER_ALIASES.filter(function (alias) {
    return actual.some(function (h) { return normalizeHeaderLoose(h) === normalizeHeaderLoose(alias); });
  });
  if (leftovers.length) {
    Logger.log('⚠ عمود «' + leftovers[0] + '» ما زال موجودًا في الورقة (' +
      'col ' + colLetter(indexOfAnyLoose(actual, CONTACT_METHOD_HEADER_ALIASES) + 1) + ') — ' +
      'شغّل migrateRemoveContactMethodColumn() لإزالته (تنسخه لورقة احتياطية أولًا).');
  }

  const ageCol = actual.indexOf(LEAD_AGE_HEADER) + 1;
  if (ageCol === 0) {
    Logger.log('⚠ عمود «' + LEAD_AGE_HEADER + '» غير موجود — شغّل migrateAddAgeColumn().');
  } else if (ageCol !== LEADS_AGE_TARGET_COL) {
    Logger.log('⚠ عمود «' + LEAD_AGE_HEADER + '» في العمود ' + colLetter(ageCol) + ' (' + ageCol +
      ') والهدف ' + colLetter(LEADS_AGE_TARGET_COL) + ' (' + LEADS_AGE_TARGET_COL + ') — شغّل migrateAddAgeColumn().');
  } else {
    Logger.log('✓ عمود «' + LEAD_AGE_HEADER + '» في مكانه: العمود ' + colLetter(LEADS_AGE_TARGET_COL) + '.');
  }

  /* عمود «Prêt à démarrer» — يجب أن يكون مباشرة قبل «Prêt à investir» */
  const readIdx = actual.indexOf(READINESS_HEADER);
  const investIdx = actual.indexOf('Prêt à investir');
  if (readIdx === -1) {
    Logger.log('⚠ عمود «' + READINESS_HEADER + '» غير موجود — شغّل migrateAddReadinessColumn() (أو سيتضاف في النهاية عبر ensureHeaders بلا موضع).');
  } else if (investIdx === readIdx + 1) {
    Logger.log('✓ عمود «' + READINESS_HEADER + '» في مكانه: مباشرة قبل «Prêt à investir».');
  } else {
    Logger.log('⚠ عمود «' + READINESS_HEADER + '» في ' + colLetter(readIdx + 1) + ' ويجب أن يكون مباشرة قبل «Prêt à investir» (' +
      (investIdx === -1 ? 'مفقود' : colLetter(investIdx + 1)) + ') — شغّل migrateAddReadinessColumn().');
  }

  /* مواضع عمودَي الحالة والتتبع — تُحلّ بالاسم دائمًا (N و O بعد الترحيل) */
  const statusCol = resolveColumnIndex(sheet, STATUS_HEADERS);
  const closerCol = resolveColumnIndex(sheet, ['Closer']);
  const statusTxt = statusCol === -1 ? 'مفقود' : colLetter(statusCol) + ' (' + statusCol + ')';
  const closerTxt = closerCol === -1 ? 'مفقود' : colLetter(closerCol) + ' (' + closerCol + ')';
  Logger.log((statusCol === -1 ? '⚠' : '✓') + ' Statut => ' + statusTxt +
    ' | ' + (closerCol === -1 ? '⚠' : '✓') + ' Closer => ' + closerTxt +
    ' | عدد الأعمدة: ' + actual.length + ' / ' + LEADS_HEADERS.length + ' متوقّع' +
    (actual.length === LEADS_HEADERS.length ? ' ✓' : ' — راجع «أعمدة زائدة» و«مفقود» أعلاه'));
}

/* ==========================================================
   migrateAddAgeColumn — وضع عمود «العمر» في العمود E
   تشغيل يدوي من المحرر مرة واحدة. آمنة للتكرار.
   ========================================================== */

/*
 * ثلاث حالات ابتدائية:
 *   1) «العمر» غير موجود  -> insertColumnBefore(5) + كتابة الترويسة فقط.
 *   2) «العمر» موجود في عمود آخر (مثل P، إن كان append قد سبق) ->
 *      sheet.moveColumns(...) ينقل العمود كاملًا (ترويسة + كل قيم العمر)
 *      إلى ما قبل E. باقي الأعمدة تحتفظ بترتيبها النسبي.
 *   3) «العمر» موجود في E أصلًا -> لا تغيير إطلاقًا (already migrated).
 *
 * لا تحذف ولا تعيد ترتيب ولا تكتب فوق أي عمود أو صف آخر، ولا تمسّ
 * صف البيانات إطلاقًا (الإدراج/النقل يحافظان على القيم). أخذ نسخة
 * احتياطية من الجدول قبل التشغيل موصى به.
 */
function migrateAddAgeColumn() {
  TIER_SHEET_SPECS.forEach(function (spec) {
    const sheet = findTierSheet(spec);
    if (!sheet) {
      Logger.log('migrateAddAgeColumn: «' + spec.sheet +
        '» غير موجود (لن يُنشأ هنا) — يُنشأ تلقائيًا عند أول save.');
      return;
    }
    migrateAddAgeInSheet(sheet);
  });
}

function migrateAddAgeInSheet(sheet) {
  const targetCol = LEADS_AGE_TARGET_COL;
  const before = readLeadHeaders(sheet);
  Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '» قبل -> ' + leadHeadersToLog(before));

  const ageCol = before.indexOf(LEAD_AGE_HEADER) + 1;   // 0 = غير موجود

  if (ageCol === targetCol) {
    Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: العمود ' + colLetter(targetCol) + ' هو «' + LEAD_AGE_HEADER +
      '» بالفعل — لا تغيير (already migrated).');
    return;
  }

  if (ageCol > 0) {
    /* الحالة 2: نقل العمود كاملًا إلى ما قبل العمود E.
       moveColumns ينقل كل الصفوف، فقيم العمر الحالية تُحفظ.
       تحذير: إن كانت E تحمل ترويسة حرفية ('LEAD_AGE_HEADER') فستنتقل
       إلى العمود التالي — تُزال بعده يدويًا أو تُعاد كتابتها بـ migrateFixAgeHeader. */
    sheet.moveColumns(sheet.getRange(1, ageCol, 1, 1), targetCol);
    Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: نُقل العمود «' + LEAD_AGE_HEADER + '» من ' + colLetter(ageCol) +
      ' إلى ' + colLetter(targetCol) + ' (قيم العمر محفوظة، وباقي الأعمدة بترتيبها).');
  } else {
    /* الحالة 1: إدراج عمود جديد قبل E، وكتابة الترويسة فقط.
       خلايا العمر في الصفوف القائمة تبقى فارغة — لا يُكتب فوق أي خلية. */
    sheet.insertColumnBefore(targetCol);
    const fmtSource = targetCol - 1 >= 1 ? targetCol - 1 : targetCol + 1;   // من العمود المجاور
    const headerCell = sheet.getRange(1, targetCol);
    try {
      /* نسخ تنسيق الترويسة من الجار حتى يطابق بقية صف العناوين */
      sheet.getRange(1, fmtSource).copyTo(headerCell, CopyPasteType.PASTE_FORMAT, false);
    } catch (fmtErr) {
      Logger.log('migrateAddAgeColumn: تعذّر نسخ تنسيق الترويسة: ' + fmtErr.toString());
    }
    headerCell.setValue(LEAD_AGE_HEADER);
    Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: أُدرج عمود «' + LEAD_AGE_HEADER + '» قبل ' + colLetter(targetCol) +
      ' (تنسيقه منسوخ من ' + colLetter(fmtSource) + '، قيم الصفوف القائمة فارغة).');
  }

  const after = readLeadHeaders(sheet);
  Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '» بعد  -> ' + leadHeadersToLog(after));
  const finalCol = after.indexOf(LEAD_AGE_HEADER) + 1;
  Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: موضع «' + LEAD_AGE_HEADER + '» = العمود ' +
    (finalCol ? colLetter(finalCol) + ' (' + finalCol + ')' : 'مفقود!') +
    ' | عدد الأعمدة: ' + after.length +
    ' | عدد الصفوف (دون الترويسة): ' + Math.max(0, sheet.getLastRow() - 1));
  if (finalCol !== targetCol) {
    Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: ⚠ لم يبلغ العمود ' + colLetter(targetCol) + ' — راجع يدويًا.');
  } else {
    Logger.log('migrateAddAgeColumn: «' + sheet.getName() + '»: ✓ تم. العمود ' + colLetter(targetCol) + ' = «' + LEAD_AGE_HEADER + '».');
  }
}

/* ==========================================================
   تشخيص الترويسات غير المعروفة + الصفوف اليتيمة الجزئية
   ----------------------------------------------------------------
   listInvalidHeaders: أي ترويسة ليست في LEADS_HEADERS وليست بديلًا
   عربيًّا حيًّا (getPayloadKeyForHeader) وليست عمودًا محذوفًا معروفًا
   (Plus grand défi / Moyen de contact préféré) تُعَدّ ترويسة غير
   معروفة — منها NAME الحرفي في الثغرة التي سبّبت هذه الجلسة.
   ============================================================ */

function listInvalidHeaders(sheet) {
  const actual = sheet.getLastRow() === 0 ? [] : readLeadHeaders(sheet);
  const out = [];
  const known = {};
  CHALLENGE_HEADER_ALIASES.concat(CONTACT_METHOD_HEADER_ALIASES).forEach(function (a) {
    known[normalizeHeaderLoose(a)] = true;
  });
  actual.forEach(function (h, i) {
    if (h === '') return;
    if (LEADS_HEADERS.indexOf(h) !== -1) return;
    if (getPayloadKeyForHeader(h)) return;
    if (known[normalizeHeaderLoose(h)]) return;
    out.push({ header: h, col: i + 1 });
  });
  return out;
}

/* الصفوف اليتيمة الجزئية: قيمة تاريخ + قيمة «العمر» مع خاليَّ
   «الاسم الكامل» و«الهاتف» — بصمة أثر قطع/فشل في منتصف الكتابة. */
function collectOrphanPartialRows(sheet) {
  const rows = [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return rows;
  const headers = readLeadHeaders(sheet);
  const dateIdx = columnIndexInRow(headers, DATE_HEADERS);
  const ageIdx = columnIndexInRow(headers, [LEAD_AGE_HEADER]);
  const nameIdx = columnIndexInRow(headers, ['Nom complet', 'الاسم الكامل']);
  const phoneIdx = columnIndexInRow(headers, PHONE_HEADERS);
  if (dateIdx === -1 || ageIdx === -1) return rows;
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < data.length; i++) {
    const hasDate = !isEmptyCell(data[i][dateIdx]);
    const hasAge = !isEmptyCell(data[i][ageIdx]);
    const hasName = nameIdx !== -1 && !isEmptyCell(data[i][nameIdx]);
    const hasPhone = phoneIdx !== -1 && !isEmptyCell(data[i][phoneIdx]);
    if (hasDate && hasAge && !hasName && !hasPhone) rows.push(2 + i);
  }
  return rows;
}

function logOrphanPartialRows(sheet) {
  const rows = collectOrphanPartialRows(sheet);
  if (!rows.length) return;
  Logger.log('⚠ «' + sheet.getName() + '»: صفوف يتيمة جزئية (تاريخ + «' + LEAD_AGE_HEADER +
    '» بلا «Nom complet» و«Téléphone»): ' + rows.join(' ، ') +
    ' — راجعها بـ migrateRepairOrphanRows() ثم احذف/أكمل يدويًا.');
}

/* ==========================================================
   migrateFixAgeHeader — إصلاح ترويسة كُتب فيها اسمُ المعرّف نصًّا
   تشغيل يدوي من المحرر مرة واحدة. آمنة للتكرار، ولا تنقل أي بيانات.
   ----------------------------------------------------------------
   القلب: خلية ترويسة قيمتها النصّ الحرفي 'LEAD_AGE_HEADER' تُعاد كتابتها
   إلى قيمة LEAD_AGE_HEADER (العمر). إذا كان «العمر» موجودًا أصلًا في
   عمود آخر بالورقة (كتعمود ملحق عشوائي) نتوقف ونخبرك لماذا — الحل إذن
   هو migrateAddAgeColumn() الذي ينقل العمود كاملًا (ترويسة + قيم) إلى E،
   ولا نعيد كتابة خلية فوق قيم صفوفها هنا أبدًا.
   ============================================================ */

function migrateFixAgeHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  TIER_SHEET_SPECS.forEach(function (spec) {
    const sheet = findTierSheet(spec);
    if (!sheet) {
      Logger.log('migrateFixAgeHeader: «' + spec.sheet + '» غير موجود — لا شيء.');
      return;
    }
    fixAgeHeaderInSheet(sheet);
  });
}

function fixAgeHeaderInSheet(sheet) {
  const headers = readLeadHeaders(sheet);
  const corruptIdx = [];
  headers.forEach(function (h, i) {
    if (String(h).trim() === AGE_HEADER_LEGACY_LITERAL) corruptIdx.push(i);
  });
  const canonicalIdx = headers.indexOf(LEAD_AGE_HEADER);

  if (!corruptIdx.length) {
    Logger.log('migrateFixAgeHeader: «' + sheet.getName() + '»: لا ترويسة حرفية ' +
      (canonicalIdx !== -1 ? '— «' + LEAD_AGE_HEADER + '» سليمة في ' + colLetter(canonicalIdx + 1) + '. لا تغيير.'
        : 'ولا «' + LEAD_AGE_HEADER + '» — شغّل migrateAddAgeColumn().'));
    return;
  }
  if (canonicalIdx !== -1) {
    Logger.log('migrateFixAgeHeader: «' + sheet.getName() + '»: ⚠ ترويسة حرفية في ' +
      corruptIdx.map(function (i) { return colLetter(i + 1); }).join('، ') +
      ' لكن «' + LEAD_AGE_HEADER + '» موجود أصلًا في ' + colLetter(canonicalIdx + 1) +
      ' — توقّف (لا تغيير). شغّل migrateAddAgeColumn() لنقل العمود كاملًا إلى E، أو افحص يدويًا.');
    return;
  }
  if (corruptIdx.length > 1) {
    Logger.log('migrateFixAgeHeader: «' + sheet.getName() + '»: ⚠ ' + corruptIdx.length +
      ' ترويسات حرفية (' + corruptIdx.map(function (i) { return colLetter(i + 1); }).join('، ') +
      ') — توقّف؛ راجع الورقة يدويًا قبل الإصلاح.');
    return;
  }

  const col = corruptIdx[0] + 1;
  const before = leadHeadersToLog(headers);
  sheet.getRange(1, col).setValue(LEAD_AGE_HEADER);
  const after = readLeadHeaders(sheet);
  Logger.log('migrateFixAgeHeader: «' + sheet.getName() + '»: ✓ أُصلحت ترويسة العمود ' + colLetter(col) +
    ': «' + AGE_HEADER_LEGACY_LITERAL + '» → «' + LEAD_AGE_HEADER + '» (بلا نقل أي بيانات) |' +
    ' صفوف بيانات: ' + Math.max(0, sheet.getLastRow() - 1) +
    ' | قبل: ' + before + ' | بعد: ' + leadHeadersToLog(after));
}

/* ==========================================================
   migrateRepairOrphanRows — تقرير فقط، لا حذف ولا نقل
   تشغيل يدوي من المحرر، آمنة للتكرار (لا نُغيِّر أي خلية أو وسم أو صف).
   ----------------------------------------------------------------
   تسجّل في Logger لكل تبويب فئة:
     1) الصفوف اليتيمة الجزئية (تاريخ + عمر بلا اسم/هاتف).
     2) تكرار معرّف جلسة واحد ضمن التبويب نفسه أو عبر التبويبين.
     3) صفوف تحمل نفس رقم الهاتف ضمن التبويب نفسه أو عبر التبويبين.
   القرار (حذف/دمج/إكمال) يبقى يدويًا من الـLogs — لا يُلمس شيء هنا.
   ============================================================ */

function collectPhonesByRow(sheet) {
  const out = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return out;
  const headers = readLeadHeaders(sheet);
  const phoneIdx = columnIndexInRow(headers, PHONE_HEADERS);
  if (phoneIdx === -1) return out;
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < data.length; i++) {
    const p = String(data[i][phoneIdx] == null ? '' : data[i][phoneIdx]).trim();
    if (p) out[p] = 2 + i;
  }
  return out;
}

function migrateRepairOrphanRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [];
  TIER_SHEET_SPECS.forEach(function (spec) {
    const sheet = findTierSheet(spec);
    if (sheet && sheet.getLastRow() >= 2) sheets.push({ name: sheet.getName(), sheet: sheet });
  });
  Logger.log('migrateRepairOrphanRows: تقرير فقط — لا حذف ولا نقل ولا تعديل.');
  if (!sheets.length) {
    Logger.log('migrateRepairOrphanRows: لا توجد تبويبات فئة فيها بيانات.');
    return;
  }

  /* 1) صفوف يتيمة جزئية في كل تبويب */
  sheets.forEach(function (ent) {
    const orphans = collectOrphanPartialRows(ent.sheet);
    if (orphans.length) {
      Logger.log('migrateRepairOrphanRows: [«' + ent.name + '»] صفوف يتيمة جزئية ' +
        '(تاريخ + عمر بلا اسم وهاتف): صفوف ' + orphans.join('، ') + '.');
    }
  });

  /* 2) تكرار معرّف الجلسة ضمن التبويب نفسه */
  sheets.forEach(function (ent) {
    const byRow = listSessionIdsByRow(ent.sheet);
    const groups = {};
    Object.keys(byRow).forEach(function (r) {
      const sid = byRow[r];
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(Number(r));
    });
    Object.keys(groups).forEach(function (sid) {
      if (sid && groups[sid].length > 1) {
        Logger.log('migrateRepairOrphanRows: [«' + ent.name + '»] معرّف الجلسة نفسه في الصفوف: ' +
          groups[sid].join('، ') + '.');
      }
    });
  });

  /* 3) تكرار الهاتف ضمن التبويب نفسه */
  sheets.forEach(function (ent) {
    const groups = {};
    const lastRow = ent.sheet.getLastRow();
    if (lastRow < 2) return;
    const headers = readLeadHeaders(ent.sheet);
    const phoneIdx = columnIndexInRow(headers, PHONE_HEADERS);
    if (phoneIdx === -1) return;
    const data = ent.sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (let i = 0; i < data.length; i++) {
      const p = String(data[i][phoneIdx] == null ? '' : data[i][phoneIdx]).trim();
      if (!p) continue;
      if (!groups[p]) groups[p] = [];
      groups[p].push(2 + i);
    }
    Object.keys(groups).forEach(function (p) {
      if (groups[p].length > 1) {
        Logger.log('migrateRepairOrphanRows: [«' + ent.name + '»] صفوف بنفس رقم الهاتف: ' +
          groups[p].join('، ') + '.');
      }
    });
  });

  /* 4) عبر التبويبين: نفس الجلسة أو نفس الهاتف */
  if (sheets.length > 1) {
    for (let a = 0; a < sheets.length - 1; a++) {
      for (let b = a + 1; b < sheets.length; b++) {
        const A = sheets[a], B = sheets[b];
        const sidA = listSessionIdsByRow(A.sheet), sidB = listSessionIdsByRow(B.sheet);
        Object.keys(sidA).forEach(function (rA) {
          const v = sidA[rA];
          if (!v) return;
          Object.keys(sidB).forEach(function (rB) {
            if (v && sidB[rB] === v) {
              Logger.log('migrateRepairOrphanRows: [عبر التبويبين] معرّف الجلسة نفسه في «' +
                A.name + '»#' + rA + ' و «' + B.name + '»#' + rB + '.');
            }
          });
        });
        const phoneA = collectPhonesByRow(A.sheet), phoneB = collectPhonesByRow(B.sheet);
        Object.keys(phoneA).forEach(function (p) {
          if (p && phoneB[p]) {
            Logger.log('migrateRepairOrphanRows: [عبر التبويبين] نفس رقم الهاتف في «' +
              A.name + '»#' + phoneA[p] + ' و «' + B.name + '»#' + phoneB[p] + '.');
          }
        });
      }
    }
  }

  Logger.log('migrateRepairOrphanRows: انتهى — افحص الـLogs وقم بالحذف/الدمج يدويًا.');
}

/* ==========================================================
   migrateRemoveChallengeColumn — حذف عمود «Plus grand défi»
   تشغيل يدوي من المحرر مرة واحدة. آمنة للتكرار وغير مدمّرة.
   ========================================================== */

/* تطبيع اسم الترويسة للمقارنة: trim + collapse spaces + lowercase */
function normalizeHeader(h) {
  return String(h == null ? '' : h).trim().replace(/\s+/g, ' ').toLowerCase();
}

/* نفس التطبيع مع تجاهل النبرات (é/è/ê = e، ä = a …) ثم trim/collapse/lowercase.
   يُستعمل لأسماء الأعمدة المحذوفة فقط: ورقة قديمة كُتبت French بلا نبرات
   يجب أن تُطابَق أيضًا، حتى لا يبقى العمود في الورقة للأبد. */
function normalizeHeaderLoose(h) {
  const flat = String(h == null ? '' : h)
    .replace(/[\u0300-\u036f]/g, '')                   /* علامات التشكيل المركّبة */
    .replace(/[àâäãáå]/g, 'a')
    .replace(/[çć]/g, 'c')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôöõ]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/ñ/g, 'n');
  return normalizeHeader(flat);
}

/* كل الأعمدة المحمية، مع أسمائها الحالية وأي بدائل عربية معروفة */
function getProtectedHeaderNames() {
  const base = PROTECTED_HEADERS.slice();
  Object.keys(FIELD_MAP).forEach(function (k) {
    base.push(FIELD_MAP[k]);
    base.push.apply(base, LEGACY_AR[k] || []);
  });
  base.push.apply(base, DATE_HEADERS);
  base.push.apply(base, PHONE_HEADERS);
  base.push.apply(base, STATUS_HEADERS);
  base.push(LEAD_AGE_HEADER);
  return base;
}

/* اسم ورقة احتياطية غير مستعملة: يضيف طابعًا زمنيًا عند وجود الاسم.
   `prefix` معامل لأن عمودين محذوفين لكل منهما ورقة احتياطية. */
function pickBackupSheetName(ss, prefix) {
  const base = prefix || CHALLENGE_BACKUP_PREFIX;
  if (!ss.getSheetByName(base)) return base;
  const stamp = Utilities.formatDate(new Date(), 'Etc/GMT', 'yyyyMMdd-HHmmss');
  let name = base + '_' + stamp;
  let n = 2;
  while (ss.getSheetByName(name)) { name = base + '_' + stamp + '_' + n; n++; }
  return name;
}

/*
 * تحذف عمود «Plus grand défi» (الحقل `mainChallenge`) من ورقة العملاء المحتملين:
 *   - تُطابَق الترويسة بكل الأسماء المعروفة (trim + case-insensitive):
 *     `Plus grand défi` / `Plus grand defi` / `أكبر تحدي`.
 *   - إذا لم يُعثر عليه: لا تغيير (آمنة للتكرار).
 *   - إذا وُجد أكثر من عمود مطابق أو كان محميًا (الهاتف/الحالة/العمر/
 *     معرّف الجلسة): خطأ واضح وتوقّف، بلا أي حذف.
 *   - قبل الحذف تُنسخ كل قيمه (ترويسة + كل الصفوف، + معرّف الجلسة كمرجع)
 *     إلى ورقة احتياطية جديدة، حتى لا تضيع أي بيانات.
 *   - لا يُمسّ أي عمود أو صف آخر.
 */
function migrateRemoveChallengeColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findTierSheet(VIP_SPEC);
  if (!sheet) { Logger.log('migrateRemoveChallengeColumn: لا يوجد تبويب "' + VIP_SHEET_NAME + '" (ولا الاسم القديم).'); return; }

  const before = readLeadHeaders(sheet);
  Logger.log('migrateRemoveChallengeColumn: قبل -> ' + leadHeadersToLog(before));

  const wanted = CHALLENGE_HEADER_ALIASES.map(normalizeHeader);
  const matches = [];
  before.forEach(function (h, i) { if (wanted.indexOf(normalizeHeader(h)) !== -1) matches.push(i + 1); });

  if (!matches.length) {
    Logger.log('migrateRemoveChallengeColumn: العمود غير موجود — لا تغيير (already removed / not found). الحقل ' +
      '`' + REMOVED_CHALLENGE_FIELD + '` غير موجود أصلًا في FIELD_MAP.');
    return;
  }
  if (matches.length > 1) {
    Logger.log('migrateRemoveChallengeColumn: ⚠ توقّف — ' + matches.length + ' أعمدة مطابقة (' +
      matches.map(function (c) { return colLetter(c); }).join('، ') + '). لم يتم الحذف. راجع يدويًا.');
    return;
  }

  const col = matches[0];
  const header = before[col - 1];
  const normalized = normalizeHeader(header);
  const protectedNames = getProtectedHeaderNames().map(normalizeHeader);
  if (protectedNames.indexOf(normalized) !== -1) {
    Logger.log('migrateRemoveChallengeColumn: ⚠ توقّف — العمود ' + colLetter(col) + ' («' + header +
      '») اسم محمي. لم يتم الحذف.');
    return;
  }

  /* ---1) كم صفًا فيه بيانات؟ --- */
  const lastRow = sheet.getLastRow();
  const colData = sheet.getRange(1, col, Math.max(lastRow, 1), 1).getValues().map(function (r) { return r[0]; });
  let filled = 0;
  for (let i = 1; i < colData.length; i++) {
    if (String(colData[i] == null ? '' : colData[i]).trim() !== '') filled++;
  }
  Logger.log('migrateRemoveChallengeColumn: المرشّح للحذف = العمود ' + colLetter(col) + ' («' + header + '») | صفوف فيها بيانات: ' + filled);

  /* ---2) نسخة احتياطية: الترويسة + كل الصفوف + عمود معرّف الجلسة كمرجع --- */
  const lastCol = before.length;
  const allData = sheet.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
  const sessionCol = indexOfAny(before, ['معرف الجلسة']);
  const backup = ss.insertSheet(pickBackupSheetName(ss));
  const outHead = ['_original_column', '_original_header', '_session_id', '_value'];
  const out = [outHead];
  for (let r = 1; r < allData.length; r++) {
    const sid = (sessionCol !== -1 ? allData[r][sessionCol] : '');
    out.push([colLetter(col), header, sid == null ? '' : sid, colData[r]]);
  }
  backup.getRange(1, 1, out.length, outHead.length).setValues(out);
  backup.setFrozenRows(1);
  Logger.log('migrateRemoveChallengeColumn: نسخة احتياطية في "' + backup.getName() + '" (' +
    out.length + ' صف × ' + outHead.length + ' عمود).');

  /* ---3) الحذف --- */
  sheet.deleteColumn(col);

  const after = readLeadHeaders(sheet);
  Logger.log('migrateRemoveChallengeColumn: بعد  -> ' + leadHeadersToLog(after));
  Logger.log('migrateRemoveChallengeColumn: الأعمدة ' + before.length + ' → ' + after.length +
    ' | صفوف بيانات محفوظة: ' + Math.max(0, sheet.getLastRow() - 1) +
    (after.length === before.length - 1 ? ' | ✓ حُذف عمود واحد بالضبط' : ' | ⚠ عدد الأعمدة لم ينقص بواحد!'));
  if (resolveColumnIndex(sheet, [LEAD_AGE_HEADER]) !== LEADS_AGE_TARGET_COL) {
    Logger.log('migrateRemoveChallengeColumn: ⚠ عمود «' + LEAD_AGE_HEADER + '» لم يعد في العمود ' +
      colLetter(LEADS_AGE_TARGET_COL) + ' — شغّل migrateAddAgeColumn() إن لزم.');
  }
}

/* ==========================================================
   migrateRemoveContactMethodColumn — حذف عمود «طريقة التواصل المفضلة»
   نفس آلية migrateRemoveChallengeColumn بالضبط: بحث بالاسم في صف
   العناوين، نسخة احتياطية قبل أي حذف، آمنة للتكرار، ولا تلمس أي
   عمود أو صف آخر.
   ========================================================== */

/*
 * تحذف عمود «Moyen de contact préféré» (الحقل `contactPreference`) من ورقة
 * العملاء المحتملين. الحقل نفسه حُذف من القمع ومن الـpayload:
 *   - تُطابَق الترويسة بكل الأسماء المعروفة (trim + collapse + case-insensitive
 *     + تجاهل النبرات): `Moyen de contact préféré` / `Moyen de contact prefere` /
 *     `طريقة التواصل المفضلة` / `طريقة التواصل`.
 *   - إذا لم يُعثر عليه: لا تغيير (آمنة للتكرار).
 *   - إذا وُجد أكثر من عمود مطابق أو كان محميًا (الهاتف/الحالة/العمر/
 *     معرّف الجلسة): خطأ واضح وتوقّف، بلا أي حذف.
 *   - قبل الحذف تُنسخ كل قيمه (ترويسة + كل الصفوف، + الاسم والهاتف كمرجع)
 *     إلى ورقة احتياطية جديدة، حتى لا تضيع أي بيانات.
 *   - لا يُمسّ أي عمود أو صف آخر. النتيجة: 15 عمودًا، «العمر» = E،
 *     «Prêt à démarrer» = K، Statut = N، Closer = O.
 */
function migrateRemoveContactMethodColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findTierSheet(VIP_SPEC);
  if (!sheet) { Logger.log('migrateRemoveContactMethodColumn: لا يوجد تبويب "' + VIP_SHEET_NAME + '" (ولا الاسم القديم).'); return; }

  const before = readLeadHeaders(sheet);
  Logger.log('migrateRemoveContactMethodColumn: قبل -> ' + leadHeadersToLog(before));

  /* لو عاد الحقل إلى FIELD_MAP يومًا فهو حيّ من جديد — لا نحذف عمودًا حيًّا */
  if (Object.prototype.hasOwnProperty.call(FIELD_MAP, REMOVED_CONTACT_METHOD_FIELD)) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ توقّف — الحقل `' + REMOVED_CONTACT_METHOD_FIELD +
      '` موجود في FIELD_MAP (عاد إلى الواجهة؟). لم يتم الحذف.');
    return;
  }

  const wanted = CONTACT_METHOD_HEADER_ALIASES.map(normalizeHeaderLoose);
  const matches = [];
  before.forEach(function (h, i) { if (wanted.indexOf(normalizeHeaderLoose(h)) !== -1) matches.push(i + 1); });

  if (!matches.length) {
    Logger.log('migrateRemoveContactMethodColumn: العمود غير موجود — لا تغيير (already removed / not found). الحقل `' +
      REMOVED_CONTACT_METHOD_FIELD + '` غير موجود أصلًا في FIELD_MAP.');
    return;
  }
  if (matches.length > 1) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ توقّف — ' + matches.length + ' أعمدة مطابقة (' +
      matches.map(function (c) { return colLetter(c); }).join('، ') + '). لم يتم الحذف. راجع يدويًا.');
    return;
  }

  const col = matches[0];
  const header = before[col - 1];
  const normalized = normalizeHeaderLoose(header);
  const protectedNames = getProtectedHeaderNames().map(normalizeHeaderLoose);
  if (protectedNames.indexOf(normalized) !== -1) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ توقّف — العمود ' + colLetter(col) + ' («' + header +
      '») اسم محمي. لم يتم الحذف.');
    return;
  }

  /* ---1) كم صفًا فيه بيانات؟ --- */
  const lastRow = sheet.getLastRow();
  const colData = sheet.getRange(1, col, Math.max(lastRow, 1), 1).getValues().map(function (r) { return r[0]; });
  let filled = 0;
  for (let i = 1; i < colData.length; i++) {
    if (String(colData[i] == null ? '' : colData[i]).trim() !== '') filled++;
  }
  Logger.log('migrateRemoveContactMethodColumn: المرشّح للحذف = العمود ' + colLetter(col) + ' («' + header + '») | صفوف فيها بيانات: ' + filled);

  /* ---2) نسخة احتياطية: الترويسة + كل الصفوف + الاسم والهاتف كمرجع --- */
  const lastCol = before.length;
  const allData = sheet.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
  const nameCol = indexOfAny(before, ['Nom complet', 'الاسم الكامل']);
  const phoneCol = indexOfAny(before, ['Téléphone', 'رقم الهاتف']);
  const backup = ss.insertSheet(pickBackupSheetName(ss, CONTACT_METHOD_BACKUP_PREFIX));
  const outHead = ['_original_column', '_original_header', '_nom_complet', '_telephone', '_value'];
  const out = [outHead];
  for (let r = 1; r < allData.length; r++) {
    const who = (nameCol !== -1 ? allData[r][nameCol] : '');
    const tel = (phoneCol !== -1 ? allData[r][phoneCol] : '');
    out.push([colLetter(col), header, who == null ? '' : who, tel == null ? '' : tel, colData[r]]);
  }
  backup.getRange(1, 1, out.length, outHead.length).setValues(out);
  backup.setFrozenRows(1);
  Logger.log('migrateRemoveContactMethodColumn: نسخة احتياطية في "' + backup.getName() + '" (' +
    out.length + ' صف × ' + outHead.length + ' عمود).');

  /* ---3) الحذف --- */
  sheet.deleteColumn(col);

  const after = readLeadHeaders(sheet);
  Logger.log('migrateRemoveContactMethodColumn: بعد  -> ' + leadHeadersToLog(after));
  Logger.log('migrateRemoveContactMethodColumn: الأعمدة ' + before.length + ' → ' + after.length +
    ' | صفوف بيانات محفوظة: ' + Math.max(0, sheet.getLastRow() - 1) +
    (after.length === before.length - 1 ? ' | ✓ حُذف عمود واحد بالضبط' : ' | ⚠ عدد الأعمدة لم ينقص بواحد!'));

  /* تأكيد ما بعد الحذف: صف العناوين يُقرأ فقط (لا إعادة كتابة)،
     وStatut/Closer يُحلّان بالاسم لا برقم عمود ثابت. */
  const leftover = indexOfAnyLoose(after, CONTACT_METHOD_HEADER_ALIASES);
  if (leftover !== -1) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ ما زال العمود ' + colLetter(leftover + 1) + ' موجودًا بعد الحذف!');
  }
  if (after.length !== LEADS_HEADERS.length) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ عدد الأعمدة ' + after.length + ' ≠ ' + LEADS_HEADERS.length +
      ' (المتوقّع) — شغّل runSheetDiagnostics() وراجع «أعمدة زائدة».');
  }
  if (resolveColumnIndex(sheet, [LEAD_AGE_HEADER]) !== LEADS_AGE_TARGET_COL) {
    Logger.log('migrateRemoveContactMethodColumn: ⚠ عمود «' + LEAD_AGE_HEADER + '» ليس في العمود ' +
      colLetter(LEADS_AGE_TARGET_COL) + ' — شغّل migrateAddAgeColumn() إن لزم.');
  }
  ['Statut', 'Closer'].forEach(function (h) {
    const c = resolveColumnIndex(sheet, [h]);
    Logger.log('migrateRemoveContactMethodColumn: ' + (c === -1 ? '⚠ ' : '✓ ') + h + ' => ' +
      (c === -1 ? 'مفقود!' : colLetter(c) + ' (' + c + ')'));
  });
}

/* ==========================================================
   migrateMinorsToSeparateSheet — نقل «أقل من 18» إلى تبويب Diamond
   تشغيل يدوي من المحرر مرة واحدة. آمنة للتكرار/idempotent.
   ------------------------------------------------------------
   تنقل كل صف في تبويب الفئة الحالي (VIP) عمره «أقل من 18 سنة» إلى تبويب
   Diamond، بالأعمدة بالاسم ومع الاحتفاظ بمعرّف الجلسة (Developer Metadata)
   وبتاريخ الصف وحالته.

   الترتيب (لا يُكسر):
     1) لا صف تحت 18 -> لا تغيير إطلاقًا (بلا نسخة احتياطية جديدة).
     2) نسخة احتياطية كاملة لبيانات تبويب الفئة الحالي في ورقة جديدة
        `_backup_before_minors_split` (+ طابع زمني إن وُجد الاسم).
     3) نسخ الصفوف المرشّحة بالاسم إلى تبويب Diamond.
     4) تحقق: عدد المنسوخ + الموجود مسبقًا = عدد المرشّحين، وكل صف موجود
        فعلًا في تبويب Diamond، وعدد صفوف التبويب زاد بالعدد المنسوخ بالضبط.
        أي عدم تطابق -> توقّف **بلا حذف** مع تسجيل السبب.
     5) الحذف من تبويب الفئة الحالي من الأسفل إلى الأعلى (أرقام الصفوف ثابتة).
   ============================================================ */

/* صف بنفس (الاسم + الهاتف) — احتياط للصفوف التي بلا معرّف جلسة
   حتى لا يتكرر نسخها لو أُعيد تشغيل الدالة بعد توقف midway. */
function findRowByIdentity(sheet, headers, values) {
  const nameIdx = columnIndexInRow(headers, ['Nom complet', 'الاسم الكامل']);
  const phoneIdx = columnIndexInRow(headers, PHONE_HEADERS);
  if (nameIdx === -1 && phoneIdx === -1) return -1;
  const wantName = nameIdx !== -1 ? String(values[nameIdx] == null ? '' : values[nameIdx]).trim() : '';
  const wantPhone = phoneIdx !== -1 ? String(values[phoneIdx] == null ? '' : values[phoneIdx]).trim() : '';
  if (!wantPhone && !wantName) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (let i = 0; i < data.length; i++) {
    const nm = nameIdx !== -1 ? String(data[i][nameIdx] == null ? '' : data[i][nameIdx]).trim() : '';
    const ph = phoneIdx !== -1 ? String(data[i][phoneIdx] == null ? '' : data[i][phoneIdx]).trim() : '';
    if (nm === wantName && ph === wantPhone) return 2 + i;
  }
  return -1;
}

function migrateMinorsToSeparateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const main = findTierSheet(VIP_SPEC);
  if (!main) { Logger.log('migrateMinorsToSeparateSheet: لا يوجد تبويب "' + VIP_SHEET_NAME + '" (ولا الاسم القديم).'); return; }

  const headers = readLeadHeaders(main);
  const ageIdx = columnIndexInRow(headers, [LEAD_AGE_HEADER]);
  if (ageIdx === -1) {
    Logger.log('migrateMinorsToSeparateSheet: ⚠ عمود «' + LEAD_AGE_HEADER + '» غير موجود في ' +
      main.getName() + ' — لا تغيير. شغّل migrateAddAgeColumn() أولًا.');
    return;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    /* ---1) الصفوف المرشّحة (نفس المقارنة الواحدة).
       الفحص يتم داخل القفل نفسه حتى تكون أرقام الصفوف المستعملة لاحقًا
       (النسخ ثم الحذف من الأسفل) صحيحة حتى لو جاءت كتابة متزامنة. --- */
    const lastRow = main.getLastRow();
    const sessionByRow = listSessionIdsByRow(main);
    const matched = [];
    if (lastRow >= 2) {
      main.getRange(2, 1, lastRow - 1, headers.length).getValues().forEach(function (values, i) {
        if (isMinorAgeRange(values[ageIdx])) matched.push({ row: 2 + i, values: values });
      });
    }
    Logger.log('migrateMinorsToSeparateSheet: «' + main.getName() + '»: ' + Math.max(0, lastRow - 1) +
      ' صف بيانات | مرشّحون (أقل من 18 سنة): ' + matched.length +
      ' | صفوف بلا معرّف جلسة: ' + matched.filter(function (m) { return !sessionByRow[m.row]; }).length);
    if (!matched.length) {
      Logger.log('migrateMinorsToSeparateSheet: لا يوجد ما ينقل — لا تغيير (آمنة للتكرار).');
      return;
    }
    /* ---2) نسخة احتياطية كاملة قبل أي كتابة/حذف --- */
    const backupName = pickBackupSheetName(ss, MINORS_BACKUP_PREFIX);
    const backup = ss.insertSheet(backupName);
    const backupHead = headers.concat(['_session_id']);
    backup.getRange(1, 1, 1, backupHead.length).setValues([backupHead]);
    if (lastRow >= 2) {
      const dataRows = main.getRange(2, 1, lastRow - 1, headers.length).getValues();
      const withSession = dataRows.map(function (vals, r) {
        return vals.concat([sessionByRow[r + 2] || '']);
      });
      backup.getRange(2, 1, lastRow - 1, backupHead.length).setValues(withSession);
    }
    backup.setFrozenRows(1);
    Logger.log('migrateMinorsToSeparateSheet: نسخة احتياطية "' + backupName + '" (' + lastRow +
      ' صف × ' + backupHead.length + ' عمود، منها عمود _session_id كمرجع).');

    /* ---3) النسخ إلى تبويب القُصّر (Diamond) بالاسم --- */
    const minors = getTierSheet(DIAMOND_SPEC);
    const minorsHeaders = getActualHeaders(minors);
    const minorsRowsBefore = minors.getLastRow();
    const pending = [];
    let alreadyThere = 0;
    matched.forEach(function (m) {
      const sid = sessionByRow[m.row];
      let targetRow = -1;
      if (sid) targetRow = findRowBySessionId(minors, sid);
      else targetRow = findRowByIdentity(minors, minorsHeaders, m.values);
      if (targetRow !== -1) { alreadyThere++; return; }

      const map = {};
      headers.forEach(function (h, i) { map[valueMapKeyForHeader(h)] = m.values[i]; });
      const rowValues = new Array(minorsHeaders.length).fill('');
      applyValueMapToRow(minorsHeaders, rowValues, map);
      pending.push({ values: rowValues, session: sid });
    });

    if (pending.length) {
      const first = minors.getLastRow() + 1;
      minors.getRange(first, 1, pending.length, minorsHeaders.length)
        .setValues(pending.map(function (p) { return p.values; }));
      pending.forEach(function (p, i) { tagRowWithSession(minors, first + i, p.session); });
    }
    const added = minors.getLastRow() - minorsRowsBefore;
    Logger.log('migrateMinorsToSeparateSheet: «' + DIAMOND_SHEET_NAME + '»: وُجد مسبقًا ' + alreadyThere +
      ' صفًا | نُسخ ' + pending.length + ' صفًا (صفوفها ' + (pending.length ? minorsRowsBefore + 1 + ' → ' + minors.getLastRow() : '—') + ').');

    /* ---4) التحقق قبل أي حذف --- */
    const copiedTotal = alreadyThere + pending.length;
    if (copiedTotal !== matched.length) {
      Logger.log('migrateMinorsToSeparateSheet: ⚠ عدد الصفوف في تبويب القُصّر (' + copiedTotal +
        ') ≠ المرشّحين (' + matched.length + ') — لم يُحذف أي صف من ' + main.getName() +
        '. راجع «' + backupName + '».');
      return;
    }
    if (added !== pending.length) {
      Logger.log('migrateMinorsToSeparateSheet: ⚠ عدد الصفوف المضافة فعليًا (' + added + ') ≠ المنسوخ (' +
        pending.length + ') — لم يُحذف أي صف.');
      return;
    }
    const missing = matched.filter(function (m) {
      const sid = sessionByRow[m.row];
      if (sid) return findRowBySessionId(minors, sid) === -1;
      return findRowByIdentity(minors, minorsHeaders, m.values) === -1;
    });
    if (missing.length) {
      Logger.log('migrateMinorsToSeparateSheet: ⚠ ' + missing.length +
        ' صفًا ناقص في ورقة القُصّر بعد النسخ — لم يُحذف أي صف. الصفوف الناقصة: ' +
        missing.map(function (m) { return m.row; }).join('، '));
      return;
    }

    /* ---5) الحذف من الأسفل إلى الأعلى --- */
    const rowsDesc = matched.map(function (m) { return m.row; }).sort(function (a, b) { return b - a; });
    rowsDesc.forEach(function (r) { main.deleteRow(r); });

    Logger.log('migrateMinorsToSeparateSheet: ✓ تم. مطابق: ' + matched.length +
      ' | نُسخ: ' + pending.length + ' (موجود مسبقًا: ' + alreadyThere + ')' +
      ' | حُذف: ' + rowsDesc.length + ' | نسخة احتياطية: "' + backupName + '"' +
      ' | ' + main.getName() + ' الآن: ' + Math.max(0, main.getLastRow() - 1) + ' صفًا | ' +
      DIAMOND_SHEET_NAME + ' الآن: ' + Math.max(0, minors.getLastRow() - 1) + ' صفًا.');
  } finally {
    lock.releaseLock();
  }
}

/*
 * migrateSheet — يعيد بناء التبويب بالأعمدة الـ15 مع نقل البيانات بالاسم
 * (بما فيها «العمر» في E و«Prêt à démarrer» في K). الأعمدة المحذوفة لا
 * تُنقل (ومنها «Plus grand défi» و«Moyen de contact préféré»)، فقيم العمود
 * المحذوف تُفقد هنا — استخدم migrateRemoveChallengeColumn() أو
 * migrateRemoveContactMethodColumn() بدلًا منه (كلتاهما تنسخان العمود
 * أولًا). معرفات الجلسة القديمة تُنقل إلى Developer Metadata حتى تبقى
 * الجلسات الجزئية الجارية سليمة. ⚠ يحذف التبويب القديم — خذ نسخة احتياطية.
 * لا يلزم لأي من تغييرات الأعمدة: استخدم دوال الترحيل اليدوية أعلاه.
 */
function migrateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const oldSheet = findTierSheet(VIP_SPEC);
  if (!oldSheet) { getTierSheet(VIP_SPEC); Logger.log('تم إنشاء تبويب جديد.'); return; }

  const data = oldSheet.getDataRange().getValues();
  const oldHeaders = data.length ? data[0].map(function (h) { return String(h).trim(); }) : [];
  const oldSessionCol = oldHeaders.indexOf('معرف الجلسة');

  const tmp = ss.insertSheet(VIP_SHEET_NAME + '_NEW');
  tmp.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
  tmp.setFrozenRows(1);

  for (let r = 1; r < data.length; r++) {
    const newRow = new Array(LEADS_HEADERS.length).fill('');
    LEADS_HEADERS.forEach(function (header, newIdx) {
      let oldIdx = oldHeaders.indexOf(header);
      if (oldIdx === -1) {
        const key = getPayloadKeyForHeader(header);
        if (key) oldIdx = oldHeaders.findIndex(function (h) { return getPayloadKeyForHeader(h) === key; });
      }
      if (oldIdx !== -1) newRow[newIdx] = data[r][oldIdx];
    });
    tmp.getRange(r + 1, 1, 1, newRow.length).setValues([newRow]);
    if (oldSessionCol !== -1 && data[r][oldSessionCol]) {
      tagRowWithSession(tmp, r + 1, data[r][oldSessionCol]);
    }
  }

  ss.deleteSheet(oldSheet);
  tmp.setName(VIP_SHEET_NAME);
  Logger.log('migrateSheet: تم ترحيل ' + Math.max(0, data.length - 1) + ' صفًا.');
}

/* ==========================================================
   migrateRenameTierSheets — «العملاء المحتملون» → VIP،
   «Moins de 18 ans» → Diamond
   ----------------------------------------------------------------
   آمنة للتكرار: إذا وُجد التبويب الجديد بالاسم فهو المعتمَد. إن وُجد
   الاسم القديم فقط (نفس التبويب، البيانات تُحفظ) يُعاد تسميته. إن وُجدا
   معًا مع تناقض، يبقى الجديد ويُنوَّه بالقديم حتى يُنظّف يدويًا. التبويب
   الجديد الذي لم يُنشأ بعد يُترك: getTierSheet() ينشئه عند أول save.
   ============================================================ */
function migrateRenameTierSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  TIER_SHEET_SPECS.forEach(function (spec) {
    const newSheet = ss.getSheetByName(spec.sheet);
    let legacy = null;
    for (let i = 0; i < spec.legacyNames.length && !legacy; i++) {
      legacy = ss.getSheetByName(spec.legacyNames[i]);
    }
    const legacyLabel = spec.legacyNames[0];
    if (newSheet) {
      if (legacy) {
        Logger.log('migrateRenameTierSheets: «' + spec.sheet + '» موجود و «' + legacy.getName() +
          '» ما زال — لم تُمسَّ أسماء التبويبات (البيانات في «' + spec.sheet + '» معتمدة).');
      } else {
        Logger.log('migrateRenameTierSheets: «' + spec.sheet + '» موجود بالفعل — لا تغيير.');
      }
      return;
    }
    if (legacy) {
      try {
        legacy.setName(spec.sheet);
        findTierSheet(spec); /* reset لأي نسخة محفوظة خلف كل getSheetByName */
        Logger.log('migrateRenameTierSheets: ✓ «' + legacyLabel + '» → «' + spec.sheet + '» (' +
          Math.max(0, legacy.getLastRow() - 1) + ' صف بيانات).');
      } catch (err) {
        Logger.log('migrateRenameTierSheets: ⚠ فشلت إعادة تسمية «' + legacyLabel + '»: ' + err.toString());
      }
      return;
    }
    Logger.log('migrateRenameTierSheets: «' + spec.sheet +
      '» غير موجود (لن يُنشأ هنا) — يُنشأ تلقائيًا عند أول save أو confirm_booking.');
  });
}

/* ==========================================================
   migrateAddReadinessColumn — تثبيت «Prêt à démarrer» قبل
   «Prêt à investir» (العمود K)
   ----------------------------------------------------------------
   تُشغَّل على تبويبي VIP و Diamond معًا. الحالات:
     1) العمود مفقود -> insertColumnBefore أمام «Prêt à investir» + الترويسة.
     2) موجود مكانه (مباشرة قبل «Prêt à investir») -> لا تغيير.
     3) موجود في عمود آخر -> moveColumns ينقله (كل قيمه) ليكون قبل «Prêt
        à investir». لا تُمسَّ أي بيانات أخرى.
   ============================================================ */
function migrateAddReadinessColumn() {
  TIER_SHEET_SPECS.forEach(function (spec) {
    const sheet = findTierSheet(spec);
    if (!sheet) {
      Logger.log('migrateAddReadinessColumn: «' + spec.sheet +
        '» غير موجود (لن يُنشأ هنا) — يُنشأ تلقائيًا عند أول save.');
      return;
    }
    migrateReadinessInSheet(sheet);
  });
}

function migrateReadinessInSheet(sheet) {
  const before = readLeadHeaders(sheet);
  const readCol = before.indexOf(READINESS_HEADER) + 1;
  const investCol = before.indexOf('Prêt à investir') + 1;
  if (readCol > 0 && investCol === readCol + 1) {
    Logger.log('migrateAddReadinessColumn: «' + sheet.getName() +
      '»: «' + READINESS_HEADER + '» قبل «Prêt à investir» بالفعل — لا تغيير.');
    return;
  }
  if (readCol > 0) {
    /* moveColumns(.., pos) يجعل العمود يصير رقم pos (1-يبدأ). الهدف: أن يكون
       «Prêt à investir» بعده مباشرة -> pos = investCol - 1 إن نُقل من قبلُ، وإلا investCol. */
    const dest = readCol < investCol ? investCol - 1 : investCol;
    sheet.moveColumns(sheet.getRange(1, readCol, 1, 1), dest);
    Logger.log('migrateAddReadinessColumn: «' + sheet.getName() + '»: نُقل «' + READINESS_HEADER +
      '» من ' + colLetter(readCol) + ' إلى ' + colLetter(dest) + '.');
    return;
  }
  if (investCol < 1) {
    Logger.log('migrateAddReadinessColumn: «' + sheet.getName() +
      '»: لا «' + READINESS_HEADER + '» ولا «Prêt à investir» — أُضيف في النهاية.');
    const pos = sheet.getLastColumn() + 1;
    sheet.getRange(1, pos).setValue(READINESS_HEADER);
    return;
  }
  sheet.insertColumnBefore(investCol);
  sheet.getRange(1, investCol).setValue(READINESS_HEADER);
  copyLeadsHeaderFormat(findTierSheet(VIP_SPEC) || findTierSheet(DIAMOND_SPEC) || sheet, sheet);
  Logger.log('migrateAddReadinessColumn: «' + sheet.getName() + '»: أُدخل «' + READINESS_HEADER +
    '» قبل «Prêt à investir» (' + colLetter(investCol) + ').');
}

/* ==========================================================
   Meta Conversions API — يعمل فقط عند ضبط META_ACCESS_TOKEN و META_PIXEL_ID
   في Script Properties
   ========================================================== */

const META_API_VERSION = 'v21.0';
const META_EVENT_SOURCE_URL = 'https://skillova.com';

function sha256Hash(value) {
  if (!value) return '';
  const normalized = value.toString().trim().toLowerCase();
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized, Utilities.Charset.UTF_8);
  return raw.map(function (b) { const hex = (b < 0 ? b + 256 : b).toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
}

function normalizePhoneForMeta(phone) {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '213' + cleaned.substring(1);
  return cleaned;
}

/* placedRow اختياري: الصف الذي استقرت فيه الجلسة {sheet, row} (confirm_booking
   يمرّرها). الغرض حاجز ثانٍ — أي caller مستقبلي لا يستطيع إرسال بيانات
   قاصر حتى لو نسِي الفحص. CAPI معطّل كما هو (يعمل فقط عند ضبط
   META_ACCESS_TOKEN و META_PIXEL_ID) ولا تتغير قراءته للخصائص. */
function sendScheduleToMetaCAPI(data, placedRow) {
  if (isMinorLeadForMeta(data, placedRow)) {
    Logger.log('sendScheduleToMetaCAPI: تخطّي — lead «أقل من 18 سنة» (حارس داخلي، لا يُرسل).');
    return { success: true, skipped: true };
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('META_ACCESS_TOKEN');
    const pixelId = props.getProperty('META_PIXEL_ID');
    if (!token || !pixelId) return { success: false, error: 'Missing Meta credentials' };

    const userData = {};
    if (data && data.phone) userData.ph = [sha256Hash(normalizePhoneForMeta(data.phone))];

    const payload = {
      data: [{
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: META_EVENT_SOURCE_URL,
        user_data: userData,
        custom_data: { content_name: 'Closer Bootcamp', appointment_type: 'Qualification Call' }
      }]
    };
    const url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + pixelId + '/events?access_token=' + token;
    const response = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code !== 200) {
      Logger.log('sendScheduleToMetaCAPI: ' + code + ' — ' + response.getContentText());
      return { success: false, error: response.getContentText() };
    }
    return { success: true };
  } catch (err) {
    Logger.log('sendScheduleToMetaCAPI: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}
