/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App
 * ============================================================================
 * الأكشنات (doPost -> body.action):
 *   update_lead           -> حفظ تدريجي عبر session_id
 *   check_duplicate_phone -> فحص تكرار الهاتف (مقابل الحالة «مؤكد»)
 *   confirm_booking       -> تأكيد التسجيل (حالة «مؤكد»)
 *
 * الجدول في تبويبي الفئة: العمود الذي يحمل «العمر» يُحلّ بالاسم، وعمود
 * «Prêt à démarrer» (الجاهزية للبدء) يُحلّ بالاسم كذلك. كل كود يتعامل مع
 * التبويبات يتعامل مع الأعمدة بالاسم (عبر صف العناوين) لا برقم ثابت، لذلك
 * نقل عمود أو إعادة ترتيب لاحقًا لا يتطلّب تعديل الكود.
 *
 * معرّف الجلسة (session_id):
 *   - عمود واحد مضافة في نهاية كل تبويب فئة (بعد «note 02») نصُّه الحرفي
 *     'session_id'، ويُخفى بعد الإنشاء. هو مصدر الحقيقة الوحيد للربط:
 *     يُكتب في نفس عملية كتابة الصف، ويُقرأ بمطابقة نصّية صريحة في
 *     التبويبين معًا.
 *   - Developer Metadata تبقى آلية احتياطية فقط: إن فشل البحث في العمود
 *     نبحث في الوسوم (داخل try/catch) ونعبّئ خلية المعرّف احتياطيًّا؛
 *     إرفاقها لم يعد مطلوبًا (best-effort).
 *   - لا يوجد أي احتياط بالاسم/الهاتف (قيمتهما غير معروفة قبل الخطوة 10).
 *
 * لا يُعاد إنشاء صف العناوين في ورقة قائمة ولا يُعاد ترتيبه ولا يُعادت
 * كتابة أي ترويسة قائمة أبدًا (الترويسات ملك مستخدم). أي عمود ناقص من
 * LEADS_HEADERS يُضاف في النهاية فقط، وأي نص ترويسة يشبه اسم معرّف
 * (مثل 'LEAD_AGE_HEADER') يُرفض تمامًا ولا يُكتب ولا يُعاد إنشاؤه.
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
 *   - migrateRepairOrphanRows()    — تقرير فقط (لا حذف ولا نقل): الصفوف
 *     اليتيمة الجزئية وأي صفوف متكررة بنفس معرّف الجلسة أو الهاتف، في
 *     التبويبين — افحص الـLogs وقرّر يدويًا.
 *
 * توابع تعديل الأعمدة القديمة (migrateAddAgeColumn / migrateAddReadinessColumn /
 * migrateFixAgeHeader / migrateRemoveChallengeColumn /
 * migrateRemoveContactMethodColumn / migrateSheet) **معطّلة بعد اليوم**:
 * الكود بالاسم يتكيّف مع أي صف عناوين مهما كان (لا يُعاد كتابة ترويسة أبدًا)،
 * والترويسات الحرفية مثل 'LEAD_AGE_HEADER' تُعتبر أسماءً بديلة صالحة دون
 * لمسها.
 *
 * النشر: الصق الملف كاملًا مكان الكود القديم، اضبط Script Property
 * GAS_SHARED_SECRET (و SPREADSHEET_ID إن كان الملف قائمًا بذاته)، ثم أعد
 * نشر Web App بنفس الرابط.
 * بعد النشر شغّل مرة واحدة (بالمحرر): migrateRenameTierSheets() ثم
 * migrateRepairOrphanRows() ثم runSheetDiagnostics() للتحقق.
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

/* عمود العمر: اسمه وهدفه. الترتيب أدناه مطابق لتبويبي الفئة. */
const LEAD_AGE_HEADER = 'العمر';
const LEADS_AGE_TARGET_COL = 5;   // العمود E

/* النص الحرفي الأسوأ حالة في صف العناوين: اسمُ المعرّف القديم كسلسلة نصية
   (نتيجة لصق وسيط/تحرير يدوي). تُقبل هذه الصيغة (وأمثالها) كاسمٍ بديل عند
   حلّ عمود «العمر» بالاسم — ولا تُعاد كتابة في أي حال، ولا يُعاد إنشاؤها. */
const AGE_HEADER_LEGACY_LITERAL = 'LEAD_AGE_HEADER';

/* عمود «الجاهزية للبدء» (الخطوة 7، الحقل `readinessToStart`): تحتسِب في
   طبقة الفئة عبر decideTier(). اسمه بالفرنسية مثل بقية الأعمدة، ويُطابق
   على نصوص الواجهة العربية (plus الـslugs) عبر normalizeChoice(). */
const READINESS_HEADER = 'Prêt à démarrer';

/* عمود معرّف الجلسة: العمود الوحيد الذي يُتاح إضافته (في نهاية كل تبويب
   فئة بعد «note 02»)، نصُّه نصٌّ حرفي بسيط، ويُخفى بعد الإنشاء. التراسي:
   يُكتب مع الصف نفسه، ويُقرأ بمطابقة نصّية صريحة. */
const SESSION_ID_HEADER = 'session_id';
const SESSION_HEADER_ALIASES = [SESSION_ID_HEADER, 'معرف الجلسة'];

/* رفض أي نص ترويسة يشبه اسمَ معرّف (مثل 'LEAD_AGE_HEADER'): لا يُكتب ولا
   يُعاد إنشاؤه أبدًا (يُطبق داخل ensureHeaders على النصوص المُضافَة). */
const CODE_HEADER_GUARD = /^[A-Z0-9_]+_HEADER$/i;

/* إصدار الكود: يُعاد في health check (doGet) وفي كل سطر نجاح/خطأ من doPost. */
const CODE_VERSION = '2026-10-06.2';


/* معرّف ورقة بديلة عند الحاجة للفتح عبر openById (standalone) — يُستبدل
   عبر Script Property SPREADSHEET_ID إن بقي فارغًا هنا. */
const SPREADSHEET_ID = '';

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
  LEAD_AGE_HEADER,                 // E (العمر)
  'Situation actuelle',            // F
  'Objectif professionnel',       // G
  "Niveau d'expérience",          // H
  'Compétence souhaitée',         // I
  'Temps disponible par semaine', // J
  READINESS_HEADER,               // K (الجاهزية للبدء — الخطوة 7)
  'Prêt à investir',              // L (الاستثمار — الخطوة 8)
  'Remarque',                     // M
  '',                             // N (مقعد محجوز لعمود الترويسة الحرفية
                                  //     المكررة 'READINESS_HEADER' في ورقة
                                  //     حية قديمة — تُرى أيضًا كحقل قراءة
                                  //     لا يُكتب؛ انظر runSheetDiagnostics)
  'Statut',                       // O (قائمة منسدلة: جزئي/مؤكد/لم يرد 1-3/تم الدفع/ملغى)
  'Offer',                        // P (يدوي — لا يُكتب)
  'Closer',                       // Q (قائمة منسدلة يدوية — لا يُكتب)
  'NOTE',                         // R (يدوي — لا يُكتب)
  'adress',                       // S (يدوي — لا يُكتب)
  'Code Tracking',                // T (يدوي — لا يُكتب)
  'note 02',                      // U (يدوي — لا يُكتب)
  SESSION_ID_HEADER               // V (معرّف الجلسة — يُخفى)
];

/* كل عنوان يُقبل بالفرنسية أو بالعربية (القديمة) — الترتيب لا يهم، لكن
   المدخل الأول = الاسم المتعارف (canonical): يُفضَّل دائمًا عند حلّ العمود،
   ثم تُفحص بقية الأسماء (البدائل) من اليسار، وكل ذلك بعد normalizeHeader. */
const HEADER_ALIASES = {
  date:                ['Date', 'التاريخ'],
  fullName:            ['Nom complet', 'الاسم الكامل'],
  phone:               ['Téléphone', 'رقم الهاتف'],
  email:               ['E-mail', 'Email', 'البريد الإلكتروني'],
  ageRange:            [LEAD_AGE_HEADER, 'age', AGE_HEADER_LEGACY_LITERAL],
  currentStatus:       ['Situation actuelle', 'الوضعية الحالية'],
  careerGoal:          ['Objectif professionnel', 'الهدف المهني'],
  experienceLevel:     ["Niveau d'expérience", 'مستوى الخبرة'],
  skillInterest:       ['Compétence souhaitée', 'المهارة المطلوبة'],
  weeklyTime:          ['Temps disponible par semaine', 'الوقت الأسبوعي المتاح'],
  readinessToStart:    [READINESS_HEADER, 'الجاهزية للبدء', 'READINESS_HEADER'],
  investmentReadiness: ['Prêt à investir', 'جاهزية الاستثمار', 'الجاهزية للاستثمار', 'الاستعداد للاستثمار'],
  notes:               ['Remarque', 'ملاحظة', 'الملاحظة'],
  status:              ['Statut', 'حالة التسجيل'],
  closer:              ['Closer'],
  session:             SESSION_HEADER_ALIASES
};

/* المفاتيح المقنّنة للقراءة/الكتابة بالاسم، بالترتيب: حقول payload ثم
   أعمدة التشغيل (Date/Statut/Closer/معرّف الجلسة). */
const ROW_MAP_KEYS = Object.keys(HEADER_ALIASES);

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
/* يعيد مفتاح payload لاسم العمود (الاسم الحالي في HEADER_ALIASES أو أي
   بديل عربي/مشوّه) — المقارنة بعد normalizeHeader. */
function getPayloadKeyForHeader(header) {
  if (header == null || String(header).trim() === '') return null;
  const h = normalizeHeader(header);
  return Object.keys(FIELD_MAP).find(function (k) {
    const aliases = HEADER_ALIASES[k] || [];
    for (let i = 0; i < aliases.length; i++) {
      if (normalizeHeader(aliases[i]) === h) return true;
    }
    return false;
  }) || null;
}

/* أول فهرس لأي اسم من القائمة داخل صف العناوين (بعد التطبيع الكامل:
   النبرات + الفراغات المتنوّعة + حالة الأحرف) */
function indexOfAny(headers, names) {
  const wanted = names.map(normalizeHeader);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.indexOf(normalizeHeader(headers[i])) !== -1) return i;
  }
  return -1;
}

/* مرادفة كاملة — التطبيع الجديد يشمل تجاهل النبرات أصلًا */
function indexOfAnyLoose(headers, names) {
  return indexOfAny(headers, names);
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

/* رقم العمود (1-based، جاهز لـ getRange) لأول اسم من القائمة، أو -1 */
function resolveColumnIndex(sheet, names) {
  const idx = indexOfAny(getActualHeaders(sheet), names);
  return idx === -1 ? -1 : idx + 1;
}

/* رقم عمود payload بالاسم الحالي أو بأي بديل (1-based، أو -1) */
function resolvePayloadColumn(sheet, header) {
  const key = getPayloadKeyForHeader(header);
  if (!key) return -1;
  return resolveColumnIndex(sheet, HEADER_ALIASES[key] || []);
}

/* فهرس (0-based) العمود داخل مصفوفة صف، لملء الصفوف دفعة واحدة */
function columnIndexInRow(headers, names) {
  return indexOfAny(headers, names);
}

/* --- الحل الهرمي «canonical أولًا ثم البدائل» -----------------------
   كل مفتاح حلّه قاعدتان: نبحث أولًا عن الاسم المتعارف (المدخل الأول في
   HEADER_ALIASES) في كل الصف، فإن لم يُصب نبحث عن أول بديل من اليسار.
   هذا يجعله مثلًا: الترويسة الحرفية 'LEAD_AGE_HEADER' أو 'READINESS_HEADER'
   بدائلُ صالحة، لكن وجود «العمر» / «Prêt à démarrer» الحقيقيين يُقدَّم
   دائمًا — البيانات تُقرأ/تُكتب في العمود الحقيقي دون لمس الحرفي. */

function resolveIndexCanonicalFirst(headers, key) {
  const aliases = HEADER_ALIASES[key];
  if (!aliases || !aliases.length) {
    const n = normalizeHeader(key);
    for (let i = 0; i < headers.length; i++) {
      if (normalizeHeader(headers[i]) === n) return i;
    }
    return -1;
  }
  const canonical = normalizeHeader(aliases[0]);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i]) === canonical) return i;
  }
  for (let a = 1; a < aliases.length; a++) {
    const w = normalizeHeader(aliases[a]);
    for (let i = 0; i < headers.length; i++) {
      if (normalizeHeader(headers[i]) === w) return i;
    }
  }
  return -1;
}

function canonicalColumnIndex(sheet, key) {
  const idx = resolveIndexCanonicalFirst(getActualHeaders(sheet), key);
  return idx === -1 ? -1 : idx + 1;
}

/* مفتاح موحَّد للقيمة داخل خريطة صف: 'p:<mفتاح payload>' أو 'h:<مفتاح
   تشغيل>' أو 'x:<نص ترويسة معيّر>' — الأخيرة لأي عمود حر غير مقنّن
   (مثل Offer/NOTE/adress/Code Tracking/note 02 أو الترويسات الحرفية
   المكررة) تُنسخ بنصّها المعياري حرفيًّا عبر التبويبات. */
function rowMapValueKey(key) {
  return Object.prototype.hasOwnProperty.call(FIELD_MAP, key) ? 'p:' + key : 'h:' + key;
}

function mapKeyToCanonical(k) {
  if (k.length > 2 && (k[0] === 'p' || k[0] === 'h') && k[1] === ':') return k.substring(2);
  return null;
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
    const action = body && body.action ? String(body.action) : '?';
    Logger.log('doPost v' + CODE_VERSION + ' action=' + action + ' success=' +
      (result && result.success ? 'true' : 'false'));
    return jsonOut(result);
  } catch (err) {
    const action = body && body.action ? String(body.action) : '?';
    logError('doPost/action=' + action, err);
    return jsonOut({ success: false, error: err.toString() });
  }
}

/* تسجيل خطأ موحَّد: الإصدار + اسم الدالة + رسالة الخطأ + الـstack.
   لا يُسجَّل الهاتف ولا البريد ولا أي قيمة من الـpayload أبدًا. */
function logError(functionName, err) {
  const msg = err == null ? 'unknown error' : String(err.message || err);
  const stack = err && err.stack ? String(err.stack) : '';
  Logger.log('ERROR v' + CODE_VERSION + ' [' + functionName + '] ' + msg +
    (stack ? ' | stack: ' + stack : ''));
}

function doGet(e) {
  return jsonOut({ success: true, message: 'SKILLOVA_V4_FR', version: CODE_VERSION });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* الوصول إلى Spreadsheet: المحرّر المتصل (active) أولًا؛ إن لم يتوفر
   (standalone / نشر بلا حاوية) يُفتح عبر المعرّف SPREADSHEET_ID من
   Script Property أو الثابت أعلاه. runSheetDiagnostics() يخبرك بالمسار. */
function getSpreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || SPREADSHEET_ID;
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('لا يوجد جدول بيانات متاح — اضبط Script Property SPREADSHEET_ID.');
}

/* ==========================================================
   أدوات الورقة + ربط session_id بالصف (Developer Metadata)
   ========================================================== */

/* المفتاح المقنّن الذي يمثّله نص ترويسة LEADS_HEADERS (إن كان كذلك) */
function canonicalKeyForHeader(h) {
  return Object.keys(HEADER_ALIASES).find(function (k) {
    return (HEADER_ALIASES[k] || []).indexOf(h) !== -1;
  }) || null;
}

/* يضيف أعمدة LEADS_HEADERS الناقصة إلى ورقة قائمة، في آخرها فقط، ثم يضمن
   عمود `session_id`. آمن على البيانات القديمة: لا يحذف ولا يعيد ترتيب ولا
   يكتب فوق أي خلية قائمة، ولا يكتب أي نص ترويسة يشبه اسم معرّف (guard).

   الوجود يُفحص بالاسم بعد normalize (canonical أولًا ثم بدائل)، فالترويسة
   الحرفية 'LEAD_AGE_HEADER' تُحسب موجودة ولا يُضاف عمود «العمر» مكرر.

   يُستدعى دائمًا من getTierSheet() قبل القراءة/الكتابة. */
function ensureHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const actual = readLeadHeaders(sheet);
  const missing = [];
  LEADS_HEADERS.forEach(function (h) {
    if (h === '') return;
    const key = canonicalKeyForHeader(h);
    const present = key
      ? resolveIndexCanonicalFirst(actual, key) !== -1
      : actual.some(function (a) { return normalizeHeader(a) === normalizeHeader(h); });
    if (present) return;
    if (missing.indexOf(h) === -1) missing.push(h);
  });
  if (missing.length) {
    const guarded = missing.filter(function (h) { return CODE_HEADER_GUARD.test(String(h)); });
    const safe = missing.filter(function (h) { return !CODE_HEADER_GUARD.test(String(h)); });
    if (guarded.length) {
      Logger.log('ensureHeaders: ⚠ رُفضت ترويسات تشبه اسم معرّف ولا يمكن إنشاؤها أبدًا: ' + guarded.join(' ، '));
    }
    if (safe.length) {
      sheet.getRange(1, lastCol + 1, 1, safe.length).setValues([safe]);
      Logger.log('ensureHeaders: أُضيفت في النهاية (لم تُزحزح أعمدة قائمة): ' + safe.join(' ، '));
    }
  }
  ensureSessionColumn(sheet);
}

/* --- عمود معرّف الجلسة --------------------------------------------------
   يبحث بالاسم (canonical أولًا ثم بدائله)؛ إن لم يوجد يُضاف في النهاية
   نصًّا حرفيًّا ويُخفى. إضافةً، يُخفى العمود دائمًا (idempotent). */
function sessionColumnIndex(sheet) {
  const idx = resolveIndexCanonicalFirst(getActualHeaders(sheet), 'session');
  return idx === -1 ? -1 : idx + 1;
}

function ensureSessionColumn(sheet) {
  const existing = sessionColumnIndex(sheet);
  const col = existing !== -1 ? existing : sheet.getLastColumn() + 1;
  if (existing === -1) {
    try {
      sheet.getRange(1, col).setValue(SESSION_ID_HEADER);
      Logger.log('ensureSessionColumn: أُضيف عمود `' + SESSION_ID_HEADER + '` في النهاية (' + colLetter(col) + ').');
    } catch (err) {
      Logger.log('ensureSessionColumn: تعذّرت كتابة الترويسة: ' + err.toString());
      return -1;
    }
  }
  try {
    sheet.hideColumns(col, 1);
  } catch (err) {
    Logger.log('ensureSessionColumn: تعذّر إخفاء العمود ' + colLetter(col) + ' (غير مهم): ' + err.toString());
  }
  return col;
}

/* --- تبويبا الفئة (VIP / Diamond) ------------------------------------------
   نفس ترويسات LEADS_HEADERS بالترتيب نفسه في التبويبين، وتُنشأ تلقائيًا عند
   أول lead يستهدفها. findTierSheet() = قراءة فقط (الاسم الجديد أولًا ثم
   الأسماء القديمة)؛ getTierSheet() = قراءة أو إنشاء، والإنشاء دائمًا
   بالاسم الجديد حصرًا فلا يُنشأ تبويب مكرر أبدًا ما دام أحد الأسماء
   القديمة موجودًا. */
function findTierSheet(spec) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(spec.sheet);
  if (sheet) return sheet;
  for (let i = 0; i < spec.legacyNames.length; i++) {
    sheet = ss.getSheetByName(spec.legacyNames[i]);
    if (sheet) return sheet;
  }
  return null;
}

function getTierSheet(spec) {
  const ss = getSpreadsheet();
  let sheet = findTierSheet(spec);
  if (!sheet) {
    sheet = ss.insertSheet(spec.sheet);
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    if (spec.sheet !== VIP_SHEET_NAME) copyLeadsHeaderFormat(findTierSheet(VIP_SPEC), sheet);
    sheet.setFrozenRows(1);
    Logger.log('getTierSheet: أُنشئت ورقة "' + spec.sheet + '" بترويسات LEADS_HEADERS (' +
      LEADS_HEADERS.length + ' عمودًا، «' + LEAD_AGE_HEADER + '» = ' + colLetter(LEADS_AGE_TARGET_COL) + ').');
    ensureSessionColumn(sheet);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    /* ورقة موجودة لكن فارغة تمامًا: تُكتب الترويسات بالترتيب نفسه */
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    if (spec.sheet !== VIP_SHEET_NAME) copyLeadsHeaderFormat(findTierSheet(VIP_SPEC), sheet);
    sheet.setFrozenRows(1);
    ensureSessionColumn(sheet);
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

/* يعيد أول صف مرتبط بـ session_id أو -1 (سياسة «صف واحد بالضبط» مع
   التحذير عند التكرار تكون في findLeadRowBySession). البحث في العمود أولًا
   (مصدر الحقيقة) ثم احتياطيًّا عبر Developer Metadata للصفوف القديمة. */
function findRowBySessionId(sheet, sessionId) {
  if (!sessionId) return -1;
  const byCol = sessionIdsByColumn(sheet);
  for (let i = 0; i < byCol.length; i++) {
    if (byCol[i].sessionId === String(sessionId)) return byCol[i].row;
  }
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

/* --- عمود معرّف الجلسة: قراءة القيم والصفوف الفارغة ------------------ */

function sessionIdsByColumn(sheet) {
  const out = [];
  const col = sessionColumnIndex(sheet);
  if (col === -1) return out;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return out;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][0] == null ? '' : values[i][0]).trim();
    if (v) out.push({ row: 2 + i, sessionId: v });
  }
  return out;
}

/* صفوف فيها خلية معرّف جلسة فارغة (للتشخيص والترحيل) */
function emptySessionRows(sheet) {
  const out = [];
  const col = sessionColumnIndex(sheet);
  if (col === -1) return out;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return out;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] == null ? '' : values[i][0]).trim() === '') out.push(2 + i);
  }
  return out;
}

/* تعبئة خلية المعرّف في صف عُثر عليه عبر Metadata فقط (احتياطي قديم) */
function backfillSessionCell(sheet, row, sessionId) {
  const col = sessionColumnIndex(sheet);
  if (col === -1) return;
  const cur = String(sheet.getRange(row, col).getValue() || '').trim();
  if (cur === '') sheet.getRange(row, col).setValue(String(sessionId));
}

/* --- الجلسة عبر تبويبي الفئة (VIP + Diamond، بالاسمين الجديد والقديم) ----
   يُرجع { sheet, row } أو null. لا يُنشئ أي ورقة: البحث فقط.
   المصدر الأساسي: قيم عمود session_id (مطابقة نصّية صريحة في التبويبين)؛
   إن فشل، احتياطي عبر Developer Metadata، ومع العثور يُعبَّأ العمود.
   يضمن «صفًا واحدًا بالضبط»: يُحذّر بالـLogger عند أي تكرار. */
function findLeadRowBySession(sessionId) {
  if (!sessionId) return null;
  const ss = getSpreadsheet();
  const names = tierSheetLookupNames();
  const marks = [];
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (!sheet) continue;
    const rows = sessionIdsByColumn(sheet);
    for (let j = 0; j < rows.length; j++) {
      if (rows[j].sessionId === String(sessionId)) marks.push({ sheet: sheet, row: rows[j].row });
    }
  }
  if (marks.length) {
    logSessionDuplicates(marks);
    return marks[0];
  }
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (!sheet) continue;
    const rows = listRowsBySessionId(sheet, sessionId);
    for (let j = 0; j < rows.length; j++) marks.push({ sheet: sheet, row: rows[j] });
  }
  if (!marks.length) return null;
  logSessionDuplicates(marks);
  const found = marks[0];
  try {
    backfillSessionCell(found.sheet, found.row, sessionId);
  } catch (bfErr) {
    Logger.log('findLeadRowBySession: تعذّر تعبئة خلية معرّف الجلسة احتياطيًّا: ' + bfErr.toString());
  }
  return found;
}

function logSessionDuplicates(marks) {
  if (marks.length > 1) {
    Logger.log('findLeadRowBySession: ⚠ معرّف الجلسة الواحد في الصفوف: ' +
      marks.map(function (m) { return '«' + m.sheet.getName() + '»#' + m.row; }).join(' ، ') +
      ' — استُعمل الأول؛ راجع التكرارات بـ migrateRepairOrphanRows().');
  }
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
   خريطة الصف تُبنى من المفاتيح المقنّنة (canonical-first) + الأعمدة الحرة
   بنصّها المعياري ('x:'). بذلك يُقرأ من ورقة ويُكتب في أخرى حتى لو اختلف
   ترتيبهما أو عدد أعمدتهما، والترويسة الحرفية المكررة لا تزاحم الحقيقية. */

function buildRowValueMap(headers, values) {
  const map = {};
  const claimed = {};
  ROW_MAP_KEYS.forEach(function (key) {
    const idx = resolveIndexCanonicalFirst(headers, key);
    if (idx === -1) return;
    claimed[idx] = true;
    map[rowMapValueKey(key)] = values[idx];
  });
  headers.forEach(function (h, i) {
    if (claimed[i]) return;
    const n = normalizeHeader(h);
    if (!n) return;
    map['x:' + n] = values[i];
  });
  return map;
}

/* خريطة قيم صف واحد */
function readRowValueMap(sheet, row) {
  const headers = getActualHeaders(sheet);
  if (row < 1 || row > sheet.getLastRow()) return {};
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  return buildRowValueMap(headers, values);
}

/* قيمة payload واحدة بعد sanitizeValue (نفس قاعدة الفراغ المتروك) */
function buildCombinedValues(data) {
  const combined = {};
  Object.keys(FIELD_MAP).forEach(function (key) {
    combined[key] = sanitizeValue(data[key] || '');
  });
  return combined;
}

/* تملأ مصفوفة صف بقيم الخريطة (الفارغ/null لا يكتب فوق الموجود).
   يعيد قائمة المفاتيح التي لا يوجد لها عمود مقابل في هذا التبويب. */
function applyValueMapToRow(headers, rowValues, map) {
  const skipped = [];
  if (!map) return skipped;
  const assigned = {};
  Object.keys(map).forEach(function (k) {
    const key = mapKeyToCanonical(k);
    if (key) {
      const idx = resolveIndexCanonicalFirst(headers, key);
      if (idx === -1 || assigned[idx]) { if (idx === -1) skipped.push(k); return; }
      assigned[idx] = true;
      const v = map[k];
      if (isEmptyCell(v)) return;
      rowValues[idx] = v;
      return;
    }
    if (k.indexOf('x:') === 0) {
      const n = k.substring(2);
      let placed = false;
      for (let i = 0; i < headers.length; i++) {
        if (assigned[i]) continue;
        if (normalizeHeader(headers[i]) === n) {
          assigned[i] = true;
          const v = map[k];
          if (!isEmptyCell(v)) rowValues[i] = v;
          placed = true;
          break;
        }
      }
      if (!placed) skipped.push(k);
    }
  });
  return skipped;
}

/* قيم الـpayload غير الفارغة فقط تغلب على الموجود (تحديث تدريجي) —
   كل حقل يُحلّ canonical-first فلا تُكتب قيمة تحت ترويسة حرفية مكررة. */
function applyCombinedToRow(headers, rowValues, combined) {
  Object.keys(FIELD_MAP).forEach(function (key) {
    const idx = resolveIndexCanonicalFirst(headers, key);
    if (idx === -1) return;
    const v = combined[key];
    if (isEmptyCell(v)) return;
    rowValues[idx] = v;
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

   معرّف الجلسة يُكتب في نفس عملية الكتابة (لا صف بلا معرّف أبدًا)،
   وتثبيت Developer Metadata احتياطي (best-effort داخل try/catch). */
function writeLeadRow(sheet, row, valueMap, combined, sessionId) {
  const headers = getActualHeaders(sheet);
  const rowWidth = Math.max(sheet.getLastColumn(), headers.length);
  const rowValues = row === -1
    ? new Array(rowWidth).fill('')
    : sheet.getRange(row, 1, 1, rowWidth).getValues()[0];
  const skipped = applyValueMapToRow(headers, rowValues, valueMap);
  applyCombinedToRow(headers, rowValues, combined);

  if (row === -1) {
    const dateIdx = resolveIndexCanonicalFirst(headers, 'date');
    const statusIdx = resolveIndexCanonicalFirst(headers, 'status');
    if (dateIdx !== -1 && isEmptyCell(rowValues[dateIdx])) rowValues[dateIdx] = new Date();
    if (statusIdx !== -1 && isEmptyCell(rowValues[statusIdx])) rowValues[statusIdx] = STATUS_PARTIAL;
  }
  const sessionIdx = resolveIndexCanonicalFirst(headers, 'session');
  if (sessionId && sessionIdx !== -1) rowValues[sessionIdx] = sessionId;

  const target = row === -1 ? sheet.getLastRow() + 1 : row;
  sheet.getRange(target, 1, 1, rowWidth).setValues([rowValues]);
  if (sessionId) {
    try {
      tagRowWithSession(sheet, target, sessionId);
    } catch (metaErr) {
      Logger.log('writeLeadRow: تعذّر ربط Developer Metadata (احتياطي — غير مطلوب): ' + metaErr.toString());
    }
  }
  if (skipped && skipped.length) {
    Logger.log('writeLeadRow: لا عمود مقابل في هذا التبويب للقيم المحفوظة (متروكة): ' + skipped.join(' ، '));
  }
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

     تحذير «جلسة ضائعة»: وصل payload فيه عدة حقول مجابة لكن لا صف (بحث
     العمود + Metadata فشل) → يُنشأ صف جديد بكامل البيانات مع سطر تحذير
     واحد (بلا أي بيانات شخصية). */
  if (!existing) {
    const answered = Object.keys(FIELD_MAP).filter(function (k) {
      const v = data && data[k];
      return v != null && String(v).trim() !== '';
    });
    if (answered.length >= 3) {
      Logger.log('updateLeadInternal: ⚠ معرّف جلسة بلا صف (بحث العمود + Metadata فشل) والـpayload فيه ' +
        answered.length + ' حقول مجابة — أُنشئ صف جديد بكامل البيانات (راجع migrateRepairOrphanRows()).');
    }
  }

  /* توجيه الفئة: قيم الطبقة الثلاث (العمر / الجاهزية للبدء / الاستثمار)
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
  const ss = getSpreadsheet();
  const names = tierSheetLookupNames();
  for (let s = 0; s < names.length; s++) {
    const sheet = ss.getSheetByName(names[s]);
    if (!sheet) continue;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const phoneIdx = resolveIndexCanonicalFirst(headers, 'phone');
    const statusIdx = resolveIndexCanonicalFirst(headers, 'status');
    if (phoneIdx === -1 || statusIdx === -1) continue;
    for (let i = 1; i < data.length; i++) {
      const p = (data[i][phoneIdx] || '').toString().trim();
      const st = String(data[i][statusIdx] || '').trim();
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
   Meta CAPI — فئة Diamond لا تُرسل إطلاقًا (والقاصر ضمنها)
   ------------------------------------------------------------
   فئة Diamond تشمل: «أقل من 18 سنة» + «غير جاهز للبدء الآن» + «غير
   قادر على الاستثمار». الحكم أولًا من الحقول الثلاثة في الـpayload
   (mergedTierInputs) ثم من الصف الذي استقرت فيه الجلسة بالاسم — لا
   باسم التبويب. أي خطأ في القراءة -> fail closed (لا يُرسل): القاصر
   لا يبلغ Meta أبدًا. تُستدعى بحاجز داخلي في sendScheduleToMetaCAPI
   فلا يرسل فئة Diamond أي caller مستقبلي، ولا يُسجَّل الهاتف ولا
   البريد أبدًا. */
function isDiamondLeadForCAPI(data, placedRow) {
  const payloadTier = decideTier(mergedTierInputs(data || {}, null));
  if (payloadTier) return payloadTier === DIAMOND_SHEET_NAME;
  if (placedRow && placedRow.sheet && placedRow.row >= 1) {
    try {
      const storedMap = readRowValueMap(placedRow.sheet, placedRow.row);
      const storedTier = decideTier(mergedTierInputs(null, storedMap));
      if (storedTier) return storedTier === DIAMOND_SHEET_NAME;
    } catch (readErr) {
      Logger.log('isDiamondLeadForCAPI: تعذّر قراءة الصف المخزَّن — لا يُرسل (fail closed): ' + readErr.toString());
      return true;
    }
  }
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
    const ageIdx = resolveIndexCanonicalFirst(headers, 'ageRange');
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
      const statusIdx = resolveIndexCanonicalFirst(getActualHeaders(placed.sheet), 'status');
      if (statusIdx !== -1) {
        const cell = placed.sheet.getRange(placed.row, statusIdx + 1);
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
      فئة Diamond لا تُرسل: الحكم من «العمر»/«الجاهزية»/«الاستثمار» في
      الـpayload، وإن غابت فمن الصف المخزَّن (الاسم لا اسم التبويب). */
   try {
     if (isDiamondLeadForCAPI(body.data, placed)) {
       Logger.log('confirmBooking: Skipping Meta CAPI - lead is Diamond (no conversion).');

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
   تشغيل يدوي (لا يتطلّب أي ترتيب):
      1) migrateRenameTierSheets()        — «العملاء المحتملون» → VIP،
                                              «Moins de 18 ans» → Diamond
      2) migrateMinorsToSeparateSheet()   — ينقل «أقل من 18» إلى Diamond
      3) migrateRepairOrphanRows()        — تقرير فقط: الصفوف اليتيمة
                                              والتكرارات لكل تبويب
      ثم runSheetDiagnostics() للتحقق النهائي.

   كل توابع «إصلاح الأعمدة» القديمة (migrateAddAgeColumn،
   migrateAddReadinessColumn، migrateFixAgeHeader، migrateRemoveChallengeColumn،
   migrateRemoveContactMethodColumn، migrateSheet) **معطّلة بعد اليوم** —
   no-op تسجّل فقط: الكود بالاسم يتكيّف مع أي صف عناوين دون إعادة كتابته.
   ============================================================ */

/* عدد صفوف «أقل من 18 سنة» في ورقة (نفس المقارنة الواحدة)، أو -1 إن كان
   عمود «العمر» مفقودًا في تلك الورقة. */
function countMinorRows(sheet) {
  const headers = readLeadHeaders(sheet);
  const ageIdx = resolveIndexCanonicalFirst(headers, 'ageRange');
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
    const map = buildRowValueMap(headers, data[r]);
    const tier = decideTier(mergedTierInputs({}, map));
    if (tier && tier !== ownSheetName) n++;
  }
  return n;
}

/* --- تقرير العناوين لكل تبويب: الحلول المقنّنة + المكرّرة + المجهولة ----
   resolved: { مفتاح: رقم عمود 1-based } — كل مفتاح حلّ canonical-first.
   duplicates: أعمدة غير مُدّعاة لكنها تطابق اسم مفتاح (ترويسة حرفية/مكررة).
   unknowns:   أعمدة لا تطابق أي اسم معروف إطلاقًا.
   literals:   أعمدة نصُّها يشبه اسم معرّف (قناع كود). */
function collectHeaderReport(sheet) {
  const actual = sheet.getLastRow() === 0 ? [] : readLeadHeaders(sheet);
  const resolved = {};
  const claimed = {};
  ROW_MAP_KEYS.forEach(function (key) {
    const idx = resolveIndexCanonicalFirst(actual, key);
    if (idx === -1) return;
    resolved[key] = idx + 1;
    claimed[idx] = true;
  });
  const knownFree = {};
  ['Offer', 'NOTE', 'adress', 'Code Tracking', 'note 02'].forEach(function (h) {
    knownFree[normalizeHeader(h)] = true;
  });
  const duplicates = [];
  const unknowns = [];
  const literals = [];
  actual.forEach(function (h, i) {
    if (claimed[i]) return;
    if (h === '') return;
    if (normalizeHeader(h) === '') return;
    const pk = getPayloadKeyForHeader(h);
    let knownKey = pk;
    if (!knownKey) {
      ['date', 'status', 'closer', 'session'].forEach(function (k) {
        if (knownKey) return;
        if ((HEADER_ALIASES[k] || []).some(function (a) { return normalizeHeader(a) === normalizeHeader(h); })) knownKey = k;
      });
    }
    if (knownKey) { duplicates.push({ col: i + 1, header: h, key: knownKey }); return; }
    if (knownFree[normalizeHeader(h)]) return;
    if (CODE_HEADER_GUARD.test(String(h).trim())) { literals.push({ col: i + 1, header: h }); return; }
    unknowns.push({ col: i + 1, header: h });
  });
  return { actual: actual, resolved: resolved, duplicates: duplicates, unknowns: unknowns, literals: literals };
}

function logTierSheetDiagnostics(spec) {
  const label = spec.sheet;
  const sheet = findTierSheet(spec);
  if (!sheet) {
    Logger.log('✗ تبويب «' + label + '»: غير موجود — ' + (label === DIAMOND_SHEET_NAME
      ? 'يُنشأ تلقائيًا عند أول lead يصوّب Diamond.'
      : 'يُنشأ تلقائيًا عند أول lead جديد.'));
    return;
  }
  if (sheet.getName() !== label) {
    Logger.log('⚠ تبويب «' + sheet.getName() + '» يُستعمل حاليًا كفئة ' + label +
      ' (اسم قديم) — شغّل migrateRenameTierSheets() مرة واحدة.');
  }
  if (sheet.getLastRow() === 0) { Logger.log('✗ تبويب «' + label + '»: فارغ — بلا صف عناوين.'); return; }

  const report = collectHeaderReport(sheet);
  const r = report.resolved;
  const txt = {};
  ['fullName', 'phone', 'email', 'ageRange', 'readinessToStart', 'investmentReadiness', 'status', 'closer', 'session']
    .forEach(function (k) {
      txt[k] = r[k] ? colLetter(r[k]) + ' (' + r[k] + ')' : 'مفقود';
    });

  Logger.log('تبويب «' + label + '» (' + sheet.getName() + ') — ' + sheet.getLastRow() + ' صفًا / ' +
    report.actual.length + ' عمودًا:');
  Logger.log('  الحقول: الاسم ' + (r.fullName ? '✓ ' : '✗ ') + txt.fullName +
    ' | الهاتف ' + (r.phone ? '✓ ' : '✗ ') + txt.phone +
    ' | البريد ' + (r.email ? '✓ ' : '✗ ') + txt.email +
    ' | العمر ' + (r.ageRange ? '✓ ' : '✗ ') + txt.ageRange +
    ' | الجاهزية ' + (r.readinessToStart ? '✓ ' : '✗ ') + txt.readinessToStart +
    ' | الاستثمار ' + (r.investmentReadiness ? '✓ ' : '✗ ') + txt.investmentReadiness);
  Logger.log('  الحالة والتتبع: Statut ' + (r.status ? '✓ ' : '✗ ') + txt.status +
    ' | Closer ' + (r.closer ? '✓ ' : '✗ ') + txt.closer +
    ' | عمود session_id: ' + (r.session ? 'موجود في ' + txt.session : 'غير موجود — يُضاف تلقائيًا عبر ensureHeaders'));
  if (r.session) {
    const empty = emptySessionRows(sheet).length;
    Logger.log('  صفوف بخلية session_id فارغة: ' + (empty ? empty + ' (راجع migrateRepairOrphanRows)' : 'لا شيء ✓'));
  } else {
    Logger.log('  (لا يمكن عدّ الصفوف الفارغة لمعرّف الجلسة — عمود غير موجود بعد).');
  }
  Logger.log('  أعمدة يدوية (لا تُكتب): ' +
    ['Offer', 'NOTE', 'adress', 'Code Tracking', 'note 02'].map(function (h) {
      const c = indexOfAny(report.actual, [h]);
      return h + '=' + (c === -1 ? 'مفقود' : colLetter(c + 1));
    }).join(' | '));
  if (report.literals.length) {
    Logger.log('  ترويسات تشبه اسم معرّف (تُتساهل ولا تُعاد كتابة أبدًا): ' +
      report.literals.map(function (x) { return '"' + x.header + '"@' + colLetter(x.col); }).join(' ، '));
  }
  if (report.duplicates.length) {
    Logger.log('  مكرّرات معروفة (تُقرأ ولا تُكتب): ' +
      report.duplicates.map(function (x) { return '"' + x.header + '"@' + colLetter(x.col) + '(' + x.key + ')'; }).join(' ، '));
  }
  if (report.unknowns.length) {
    report.unknowns.forEach(function (x) {
      Logger.log('✗ ترويسة مجهولة في «' + label + '» العمود ' + colLetter(x.col) + ': ' + JSON.stringify(x.header) +
        ' — أضِفها إلى جمعية الأسماء (HEADER_ALIASES/قيم LEADS_HEADERS) أو افحص الورقة يدويًا.');
    });
  }
  const minorsHere = countMinorRows(sheet);
  const mismatches = countTierMismatches(sheet, label);
  Logger.log('  «أقل من 18» هنا: ' + (minorsHere < 0 ? 'غير قابل للقراءة' : minorsHere) +
    ' | تصوّب فئة أخرى: ' + (mismatches ? mismatches + ' (ستُعاد توجيهها عند أول save/confirm)' : '0'));
  logOrphanPartialRows(sheet);
}

function runSheetDiagnostics() {
  Logger.log('=== Skillova Diagnostics | Code ' + CODE_VERSION + ' ===');
  let activeSpreadsheet = null;
  try { activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { activeSpreadsheet = null; }
  Logger.log('SpreadsheetApp.getActiveSpreadsheet() => ' +
    (activeSpreadsheet ? 'متاح (ملف مرتبط)' : 'فارغ/null (ملف قائم بذاته)'));
  Logger.log('مسار الفتح الذي يعتمد عليه الكود: ' + (activeSpreadsheet
    ? 'getActiveSpreadsheet()'
    : 'openById عبر SPREADSHEET_ID (Script Property أو الثابت)'));
  logSessionUserPresence();

  logTierSheetDiagnostics(VIP_SPEC);
  logTierSheetDiagnostics(DIAMOND_SPEC);

  const sheet = findTierSheet(VIP_SPEC);
  if (sheet && sheet.getLastRow() > 0) {
    Logger.log('ترتيب العناوين في VIP: ' + leadHeadersToLog(readLeadHeaders(sheet)));
    runMetadataE2E(sheet);
  }
  Logger.log('=== نهاية Skillova Diagnostics ===');
}

/* حضور البريد للمستخدم (فارغ vs موجود فقط — لا يُطبع البريد أبدًا) */
function logSessionUserPresence() {
  let effective = '';
  try { effective = String(Session.getEffectiveUser().getEmail() || ''); } catch (err) { effective = ''; }
  let active = '';
  try { active = String(Session.getActiveUser().getEmail() || ''); } catch (err) { active = ''; }
  Logger.log('المستخدم الفعّال (EffectiveUser): ' + (effective ? 'بريد موجود' : 'بريد فارغ') +
    ' | المستخدم النشط (ActiveUser): ' + (active ? 'بريد موجود' : 'بريد فارغ'));
}

/* Developer Metadata E2E: إنشاء/قراءة/حذف وسم مؤقت على خلية scratch */
function runMetadataE2E(sheet) {
  const KEY = 'skillova_diag_e2e';
  const VAL = 'e2e_' + new Date().getTime();
  Logger.log('Developer Metadata E2E (وسم مؤقت على ' + colLetter(1) + '1):');
  try {
    sheet.getRange(1, 1).addDeveloperMetadata(KEY, VAL);
    Logger.log('  إنشاء: ✓');
  } catch (err) {
    Logger.log('  إنشاء: ✗ (' + err.toString() + ')');
    return;
  }
  let readOk = false;
  try {
    readOk = sheet.createDeveloperMetadataFinder().withKey(KEY).withValue(VAL).find().length > 0;
  } catch (err) { readOk = false; }
  Logger.log('  قراءة: ' + (readOk ? '✓' : '✗'));
  let deleteOk = false;
  try {
    const found = sheet.createDeveloperMetadataFinder().withKey(KEY).find();
    for (let i = 0; i < found.length; i++) found[i].remove();
    deleteOk = true;
  } catch (err) { deleteOk = false; }
  Logger.log('  حذف: ' + (deleteOk ? '✓' : '✗'));
}

/* ==========================================================
   migrateAddAgeColumn — معطّلة بعد اليوم (لا تغيير في الورقة):
   الكود بالاسم يتكيّف مع جرّ عمود العمر في أي موضع. تسجّل فقط.
   ========================================================== */
function migrateAddAgeColumn() {
  noOpColumnMigration('migrateAddAgeColumn', 'وضع «العمر» في العمود E');
}
function migrateAddAgeInSheet(sheet) {
  noOpColumnMigration('migrateAddAgeInSheet', 'وضع «' + LEAD_AGE_HEADER + '» في العمود E');
}

/* ==========================================================
   الصفوف اليتيمة الجزئية (تشخيص فقط — لا حذف ولا نقل)
   بصمة: قيمة تاريخ + قيمة «العمر» مع خاليَّ «الاسم الكامل» و«الهاتف»
   ============================================================ */

/* الصفوف اليتيمة الجزئية: قيمة تاريخ + قيمة «العمر» مع خاليَّ
   «الاسم الكامل» و«الهاتف» — بصمة أثر قطع/فشل في منتصف الكتابة. */
function collectOrphanPartialRows(sheet) {
  const rows = [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return rows;
  const headers = readLeadHeaders(sheet);
  const dateIdx = resolveIndexCanonicalFirst(headers, 'date');
  const ageIdx = resolveIndexCanonicalFirst(headers, 'ageRange');
  const nameIdx = resolveIndexCanonicalFirst(headers, 'fullName');
  const phoneIdx = resolveIndexCanonicalFirst(headers, 'phone');
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
   فئة Diamond (ومنها القاصر) حتى لو نسِي الفحص. CAPI معطّل كما هو (يعمل
   فقط عند ضبط META_ACCESS_TOKEN و META_PIXEL_ID) ولا تتغير قراءته للخصائص. */
function sendScheduleToMetaCAPI(data, placedRow) {
  if (isDiamondLeadForCAPI(data, placedRow)) {
    Logger.log('sendScheduleToMetaCAPI: Skipping Meta CAPI - lead is Diamond.');
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
