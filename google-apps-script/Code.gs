/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App
 * ============================================================================
 * الأكشنات (doPost -> body.action):
 *   update_lead           -> حفظ تدريجي عبر session_id
 *   check_duplicate_phone -> فحص تكرار الهاتف (مقابل الحالة «مؤكد»)
 *   confirm_booking       -> تأكيد التسجيل (حالة «مؤكد»)
 *
 * الجدول: 16 عمودًا (A → P). لا يوجد عمود لمعرف الجلسة؛
 * يُخزَّن session_id كـ Developer Metadata على الصف نفسه (مخفي تمامًا
 * ويتحرك مع الصف عند الحذف/الترتيب اليدوي).
 * عمود «العمر» هو العمود E (الخامس). كل كود يتعامل مع ورقة العملاء
 * المحتملين يتعامل مع الأعمدة بالاسم (عبر صف العناوين) لا برقم ثابت،
 * لذلك نقل عمود «العمر» إلى E أو إعادة ترتيب أي عمود آخر لاحقًا لا
 * تتطلّب تعديل الكود. لورقة قائمة بلا ترحيل، عمود العمر يظهر في النهاية
 * ويقرأ/يكتب صحيحًا بالاسم؛ الترتيب النهائي يتم عبر
 * `migrateAddAgeColumn()` (تشغيل يدوي مرة واحدة).
 *
 * النشر: الصق الملف كاملًا مكان الكود القديم، اضبط Script Property
 * GAS_SHARED_SECRET، ثم أعد نشر Web App بنفس الرابط.
 * ============================================================================
 */

const SHEET_LEADS_NAME = 'العملاء المحتملون';

/* عمود العمر: اسمه وهدفه. الترتيب أدناه مطابق تمامًا لورقة العملاء. */
const LEAD_AGE_HEADER = 'العمر';
const LEADS_AGE_TARGET_COL = 5;   // العمود E

const LEADS_HEADERS = [
  'Date',                          // A
  'Nom complet',                   // B
  'Téléphone',                       // C
  'E-mail',                        // D
  LEAD_AGE_HEADER,                 // E (العمر — في منتصف أعمدة البيانات عمدًا؛
                                   //     أعمدة الحالة والتتبع تبقى في النهاية)
  'Moyen de contact préféré',      // F
  'Situation actuelle',            // G
  'Objectif professionnel',        // H
  "Niveau d'expérience",           // I
  'Compétence souhaitée',          // J
  'Plus grand défi',               // K
  'Temps disponible par semaine',  // L
  'Prêt à investir',               // M
  'Remarque',                      // N
  'Statut',                        // O (قائمة منسدلة: جزئي/مؤكد/لم يرد 1-3/تم الدفع/ملغى)
  'Closer'                         // P (قائمة منسدلة يدوية — السكربت لا يكتب فيها)
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
   ترتيب المدخلات هنا مطابق لترتيب الأعمدة في الورقة (A → P) لسهولة القراءة
   فقط؛ لا يعتمد عليه أي كود (البحث يتم بالاسم عبر صف العناوين).
   كل الأعمدة بالفرنسية عدا «العمر» (عمود جديد، اسمُه عربي كما هو مطلوب).
   أعمدة Date / Statut / Closer ليست هنا: Date يُكتب بالتاريخ الحالي،
   Statut يكتبه الكود («جزئي» ثم «مؤكد»)، و Closer يُملأ يدويًا. */
const FIELD_MAP = {
  fullName:            'Nom complet',
  phone:               'Téléphone',
  email:               'E-mail',
  ageRange:            LEAD_AGE_HEADER,
  contactPreference:   'Moyen de contact préféré',
  currentStatus:       'Situation actuelle',
  careerGoal:          'Objectif professionnel',
  experienceLevel:     "Niveau d'expérience",
  skillInterest:       'Compétence souhaitée',
  mainChallenge:       'Plus grand défi',
  weeklyTime:          'Temps disponible par semaine',
  investmentReadiness: 'Prêt à investir',
  notes:               'Remarque'
};

/* أسماء عربية مقبولة أيضًا (للأعمدة القديمة) — الترتيب لا يهم.
   لا تُحذف هذه القائمة: getPayloadKeyForHeader() يمرّ على كل مفاتيح
   FIELD_MAP ويقرأ LEGACY_AR[k]، فأي مفتاح بلا مدخل هنا يسقط الاستدعاء. */
const LEGACY_AR = {
  fullName:            ['الاسم الكامل'],
  phone:               ['رقم الهاتف'],
  email:               ['البريد الإلكتروني'],
  ageRange:            [LEAD_AGE_HEADER],
  contactPreference:   ['طريقة التواصل المفضلة'],
  currentStatus:       ['الوضعية الحالية'],
  careerGoal:          ['الهدف المهني'],
  experienceLevel:     ['مستوى الخبرة'],
  skillInterest:       ['المهارة المطلوبة'],
  mainChallenge:       ['أكبر تحدي'],
  weeklyTime:          ['الوقت الأسبوعي المتاح'],
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
  try {
    const body = JSON.parse(e.postData.contents);
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
    return jsonOut({ success: false, error: err.toString() });
  }
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
   النهائي (وضع «العمر» في العمود E) من مسؤولية `migrateAddAgeColumn()`
   فقط، لأنها عملية يدوية تُشغَّل مرة واحدة. قبل تشغيلها يمكن أن يظهر عمود
   «العمر» في نهاية الورقة — وهذا آمن تمامًا لأن كل الكتابة بالاسم.

   يُستدعى دائمًا من getLeadsSheet() قبل القراءة/الكتابة. */
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
}

function getLeadsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_LEADS_NAME);
  if (sheet.getLastRow() === 0) {
    /* ورقة جديدة تمامًا: تُكتب الترويسات بالترتيب الجديد (العمر في E) */
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
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

/* يعيد رقم الصف المرتبط بـ session_id أو -1 */
function findRowBySessionId(sheet, sessionId) {
  if (!sessionId) return -1;
  const found = sheet.createDeveloperMetadataFinder()
    .withKey(SESSION_META_KEY)
    .withValue(String(sessionId))
    .find();
  for (let i = 0; i < found.length; i++) {
    const rowRange = found[i].getLocation().getRow();
    if (rowRange) return rowRange.getRow();
  }
  return -1;
}

/* يربط الصف بـ session_id (مخفي) */
function tagRowWithSession(sheet, row, sessionId) {
  if (!sessionId) return;
  sheet.getRange(row + ':' + row).addDeveloperMetadata(SESSION_META_KEY, String(sessionId));
}

/* ==========================================================
   update_lead — حفظ تدريجي
   ========================================================== */

function updateLead(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return updateLeadInternal(body);
  } finally {
    lock.releaseLock();
  }
}

/* بدون قفل — تُستدعى من داخل دوال تمتلك القفل أصلًا */
function updateLeadInternal(body) {
  const sheet = getLeadsSheet();
  const sessionId = body.session_id;
  const data = body.data || {};

  const combined = {};
  Object.keys(FIELD_MAP).forEach(function (key) {
    combined[key] = sanitizeValue(data[key] || '');
  });

  /* كل الحقول اختيارية: أي مفتاح غائب في data أو فارغ لا يُكتب ولا يُخطئ.
     «العمر» تحديدًا اختياري ولا يُتحقَّق منه إطلاقًا (لا في update_lead ولا
     في confirm_booking) — قيمة غائبة أو فارغة تُترك كما هي.

     الكتابة بالاسم لا بالترتيب: نبني صفًا بطول صف العناوين الفعلي ونملؤه
     حسب اسم كل عمود، لذلك لا يمكن أن تُكتب قيمة في العمود الخطأ مهما كان
     ترتيب الأعمدة في الورقة. */
  const actualHeaders = getActualHeaders(sheet);
  const row = findRowBySessionId(sheet, sessionId);

  if (row === -1) {
    const newRow = new Array(actualHeaders.length).fill('');
    actualHeaders.forEach(function (header, idx) {
      const key = getPayloadKeyForHeader(header);
      if (key && combined[key]) newRow[idx] = combined[key];
    });
    const dateIdx = columnIndexInRow(actualHeaders, DATE_HEADERS);
    const statusIdx = columnIndexInRow(actualHeaders, STATUS_HEADERS);
    if (dateIdx !== -1) newRow[dateIdx] = new Date();
    if (statusIdx !== -1) newRow[statusIdx] = STATUS_PARTIAL;
    const target = sheet.getLastRow() + 1;
    sheet.getRange(target, 1, 1, actualHeaders.length).setValues([newRow]);
    tagRowWithSession(sheet, target, sessionId);
  } else {
    const rowValues = sheet.getRange(row, 1, 1, actualHeaders.length).getValues()[0];
    actualHeaders.forEach(function (header, idx) {
      const key = getPayloadKeyForHeader(header);
      if (key && combined[key]) rowValues[idx] = combined[key];
    });
    sheet.getRange(row, 1, 1, actualHeaders.length).setValues([rowValues]);
  }
  return { success: true };
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
   check_duplicate_phone
   ========================================================== */

function checkDuplicatePhone(body) {
  const sheet = getLeadsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, isDuplicate: false };
  /* الهاتف والحالة يُحلّان بالاسم من صف العناوين — يعملان مهما تغيّر ترتيب
     الأعمدة (بما في ذلك بعد نقل «العمر» إلى E). */
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const phoneCol = columnIndexInRow(headers, PHONE_HEADERS);
  const statusCol = columnIndexInRow(headers, STATUS_HEADERS);
  if (phoneCol === -1 || statusCol === -1) return { success: true, isDuplicate: false };
  const phone = body.data && body.data.phone ? body.data.phone.toString().trim() : '';
  if (!phone) return { success: true, isDuplicate: false };
  for (let i = 1; i < data.length; i++) {
    const p = (data[i][phoneCol] || '').toString().trim();
    const st = String(data[i][statusCol] || '').trim();
    if (p === phone && st !== '' && st !== STATUS_PARTIAL) {
      return { success: true, isDuplicate: true };
    }
  }
  return { success: true, isDuplicate: false };
}

/* ==========================================================
   confirm_booking — تثبيت البيانات بحالة «مؤكد»
   ========================================================== */

function confirmBooking(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  if (!isValidAlgerianPhone(body.data && body.data.phone)) return { success: false, error: 'رقم الهاتف غير صالح' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    updateLeadInternal(body);
    const sheet = getLeadsSheet();
    const row = findRowBySessionId(sheet, body.session_id);
    if (row !== -1) {
      /* عمود الحالة يُحلّ بالاسم من صف العناوين (لا رقم ثابت) */
      const statusCol = resolveColumnIndex(sheet, STATUS_HEADERS);
      if (statusCol !== -1) {
        const cell = sheet.getRange(row, statusCol);
        const current = String(cell.getValue() || '').trim();
        if (current === '' || current === STATUS_PARTIAL) cell.setValue(STATUS_CONFIRMED);
      }
    }
  } finally {
    lock.releaseLock();
  }

  /* Meta CAPI — لا يُفشل التأكيد أبدًا؛ يتجاهل بصمت إن لم تُضبط بيانات Meta */
  try {
    sendScheduleToMetaCAPI(body.data);
  } catch (metaErr) {
    Logger.log('confirmBooking: Meta call failed silently: ' + metaErr.toString());
  }
  return { success: true };
}

/* ==========================================================
   تشخيص + ترحيل (تشغيل يدوي من المحرر)
   ========================================================== */

function runSheetDiagnostics() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEADS_NAME);
  if (!sheet) { Logger.log('لا توجد ورقة "' + SHEET_LEADS_NAME + '"'); return; }
  if (sheet.getLastRow() === 0) { Logger.log('الورقة فارغة.'); return; }
  const actual = getActualHeaders(sheet);
  Logger.log('آخر صف: ' + sheet.getLastRow() + ' | الأعمدة: ' + actual.length);
  Logger.log('ترتيب العناوين: ' + leadHeadersToLog(actual));
  LEADS_HEADERS.forEach(function (h, i) {
    const pos = actual.indexOf(h);
    Logger.log(colLetter(i + 1) + ' ' + h + ' => ' + (pos === -1 ? 'مفقود' : 'العمود ' + (pos + 1)) + (pos === i ? ' ✓' : (pos === -1 ? '' : ' (يُتوقع ' + colLetter(i + 1) + ')')));
  });
  Logger.log('أعمدة زائدة: ' + (actual.filter(function (h) { return LEADS_HEADERS.indexOf(h) === -1; }).join(' ، ') || '(لا شيء)'));

  const ageCol = actual.indexOf(LEAD_AGE_HEADER) + 1;
  if (ageCol === 0) {
    Logger.log('⚠ عمود «' + LEAD_AGE_HEADER + '» غير موجود — شغّل migrateAddAgeColumn().');
  } else if (ageCol !== LEADS_AGE_TARGET_COL) {
    Logger.log('⚠ عمود «' + LEAD_AGE_HEADER + '» في العمود ' + colLetter(ageCol) + ' (' + ageCol +
      ') والهدف ' + colLetter(LEADS_AGE_TARGET_COL) + ' (' + LEADS_AGE_TARGET_COL + ') — شغّل migrateAddAgeColumn().');
  } else {
    Logger.log('✓ عمود «' + LEAD_AGE_HEADER + '» في مكانه: العمود ' + colLetter(LEADS_AGE_TARGET_COL) + '.');
  }
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!sheet) {
    Logger.log('migrateAddAgeColumn: لا توجد ورقة "' + SHEET_LEADS_NAME + '".');
    return;
  }

  const targetCol = LEADS_AGE_TARGET_COL;
  const before = readLeadHeaders(sheet);
  Logger.log('migrateAddAgeColumn: قبل -> ' + leadHeadersToLog(before));

  const ageCol = before.indexOf(LEAD_AGE_HEADER) + 1;   // 0 = غير موجود

  if (ageCol === targetCol) {
    Logger.log('migrateAddAgeColumn: العمود ' + colLetter(targetCol) + ' هو «' + LEAD_AGE_HEADER +
      '» بالفعل — لا تغيير (already migrated).');
    return;
  }

  if (ageCol > 0) {
    /* الحالة 2: نقل العمود كاملًا إلى ما قبل العمود E.
       moveColumns ينقل كل الصفوف، فقيم العمر الحالية تُحفظ. */
    sheet.moveColumns(sheet.getRange(1, ageCol, 1, 1), targetCol);
    Logger.log('migrateAddAgeColumn: نُقل العمود «' + LEAD_AGE_HEADER + '» من ' + colLetter(ageCol) +
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
    Logger.log('migrateAddAgeColumn: أُدرج عمود «' + LEAD_AGE_HEADER + '» قبل ' + colLetter(targetCol) +
      ' (تنسيقه منسوخ من ' + colLetter(fmtSource) + '، قيم الصفوف القائمة فارغة).');
  }

  const after = readLeadHeaders(sheet);
  Logger.log('migrateAddAgeColumn: بعد  -> ' + leadHeadersToLog(after));
  const finalCol = after.indexOf(LEAD_AGE_HEADER) + 1;
  Logger.log('migrateAddAgeColumn: موضع «' + LEAD_AGE_HEADER + '» = العمود ' +
    (finalCol ? colLetter(finalCol) + ' (' + finalCol + ')' : 'مفقود!') +
    ' | عدد الأعمدة: ' + after.length +
    ' | عدد الصفوف (دون الترويسة): ' + Math.max(0, sheet.getLastRow() - 1));
  if (finalCol !== targetCol) {
    Logger.log('migrateAddAgeColumn: ⚠ لم يبلغ العمود ' + colLetter(targetCol) + ' — راجع يدويًا.');
  } else {
    Logger.log('migrateAddAgeColumn: ✓ تم. العمود ' + colLetter(targetCol) + ' = «' + LEAD_AGE_HEADER + '».');
  }
}

/*
 * migrateSheet — يعيد بناء الورقة بالأعمدة الـ16 مع نقل البيانات بالاسم
 * (بما فيها «العمر» في E). الأعمدة المحذوفة لا تُنقل. معرفات الجلسة
 * القديمة تُنقل إلى Developer Metadata حتى تبقى الجلسات الجزئية الجارية
 * سليمة. ⚠ يحذف الورقة القديمة — خذ نسخة احتياطية. لا يلزم لهذا التغيير:
 * استخدم migrateAddAgeColumn() بدلًا منه.
 */
function migrateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const oldSheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!oldSheet) { getLeadsSheet(); Logger.log('تم إنشاء ورقة جديدة.'); return; }

  const data = oldSheet.getDataRange().getValues();
  const oldHeaders = data.length ? data[0].map(function (h) { return String(h).trim(); }) : [];
  const oldSessionCol = oldHeaders.indexOf('معرف الجلسة');

  const tmp = ss.insertSheet(SHEET_LEADS_NAME + '_NEW');
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
  tmp.setName(SHEET_LEADS_NAME);
  Logger.log('migrateSheet: تم ترحيل ' + Math.max(0, data.length - 1) + ' صفًا.');
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

function sendScheduleToMetaCAPI(data) {
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