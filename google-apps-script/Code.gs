/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App
 * ============================================================================
 * الأكشنات (doPost -> body.action):
 *   update_lead           -> حفظ تدريجي عبر session_id
 *   check_duplicate_phone -> فحص تكرار الهاتف (مقابل الحالة «مؤكد»)
 *   confirm_booking       -> تأكيد التسجيل (حالة «مؤكد»)
 *
 * الجدول: 14 عمودًا فقط (A → N). لا يوجد عمود لمعرف الجلسة؛
 * يُخزَّن session_id كـ Developer Metadata على الصف نفسه (مخفي تمامًا
 * ويتحرك مع الصف عند الحذف/الترتيب اليدوي).
 *
 * النشر: الصق الملف كاملًا مكان الكود القديم، اضبط Script Property
 * GAS_SHARED_SECRET، ثم أعد نشر Web App بنفس الرابط.
 * ============================================================================
 */

const SHEET_LEADS_NAME = 'العملاء المحتملون';

const LEADS_HEADERS = [
  'Date',                          // A
  'Nom complet',                   // B
  'Téléphone',                     // C
  'E-mail',                        // D
  'Moyen de contact préféré',      // E
  'Situation actuelle',            // F
  'Objectif professionnel',        // G
  "Niveau d'expérience",           // H
  'Compétence souhaitée',          // I
  'Plus grand défi',               // J
  'Temps disponible par semaine',  // K
  'Prêt à investir',               // L
  'Remarque',                      // M
  'Statut',                        // N (قائمة منسدلة: جزئي/مؤكد/لم يرد 1-3/تم الدفع/ملغى)
  'Closer'                         // O (قائمة منسدلة يدوية — السكربت لا يكتب فيها)
];

/* كل عنوان يُقبل بالفرنسية أو بالعربية (القديمة) — الترتيب لا يهم */
const DATE_HEADERS   = ['Date', 'التاريخ'];
const PHONE_HEADERS  = ['Téléphone', 'رقم الهاتف'];
const STATUS_HEADERS = ['Statut', 'حالة التسجيل'];
const STATUS_PARTIAL = 'جزئي';
const STATUS_CONFIRMED = 'مؤكد';

/* مفتاح الـ Developer Metadata الذي يحمل session_id (غير ظاهر في الجدول) */
const SESSION_META_KEY = 'skillova_session_id';

/* أسماء خصائص funnelState (camelCase) -> اسم العمود (فرنسي) */
const FIELD_MAP = {
  fullName:            'Nom complet',
  phone:               'Téléphone',
  email:               'E-mail',
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

/* الأسماء العربية القديمة (تبقى مقبولة كي لا يتعطل شيء أثناء إعادة التسمية) */
const LEGACY_AR = {
  fullName:            ['الاسم الكامل'],
  phone:               ['رقم الهاتف'],
  email:               ['البريد الإلكتروني'],
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

/* يعيد مفتاح payload لاسم العمود (فرنسي أو عربي قديم) */
function getPayloadKeyForHeader(header) {
  if (!header) return null;
  const h = String(header).trim();
  if (h === '') return null;
  return Object.keys(FIELD_MAP).find(function (k) {
    return FIELD_MAP[k] === h || LEGACY_AR[k].indexOf(h) !== -1;
  }) || null;
}

/* أول فهرس لأي اسم من القائمة داخل صف العناوين */
function indexOfAny(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    if (names.indexOf(String(headers[i]).trim()) !== -1) return i;
  }
  return -1;
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

function getLeadsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_LEADS_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getActualHeaders(sheet) {
  if (sheet.getLastRow() === 0) return LEADS_HEADERS.slice();
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
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

  const actualHeaders = getActualHeaders(sheet);
  const row = findRowBySessionId(sheet, sessionId);

  if (row === -1) {
    const newRow = new Array(actualHeaders.length).fill('');
    actualHeaders.forEach(function (header, idx) {
      const key = getPayloadKeyForHeader(header);
      if (key && combined[key]) newRow[idx] = combined[key];
    });
    const dateCol = indexOfAny(actualHeaders, DATE_HEADERS);
    const statusCol = indexOfAny(actualHeaders, STATUS_HEADERS);
    if (dateCol !== -1) newRow[dateCol] = new Date();
    if (statusCol !== -1) newRow[statusCol] = STATUS_PARTIAL;
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
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const phoneCol = indexOfAny(headers, PHONE_HEADERS);
  const statusCol = indexOfAny(headers, STATUS_HEADERS);
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
      const statusCol = indexOfAny(getActualHeaders(sheet), STATUS_HEADERS);
      if (statusCol !== -1) {
        const cell = sheet.getRange(row, statusCol + 1);
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
  LEADS_HEADERS.forEach(function (h, i) {
    const pos = actual.indexOf(h);
    Logger.log(h + ' => ' + (pos === -1 ? 'مفقود' : 'العمود ' + (pos + 1)) + (pos === i ? ' ✓' : (pos === -1 ? '' : ' (يُتوقع ' + (i + 1) + ')')));
  });
  Logger.log('أعمدة زائدة: ' + actual.filter(function (h) { return LEADS_HEADERS.indexOf(h) === -1; }).join(' ، '));
}

/*
 * migrateSheet — يعيد بناء الورقة بالأعمدة الـ14 مع نقل البيانات بالاسم.
 * الأعمدة المحذوفة لا تُنقل. معرفات الجلسة القديمة تُنقل إلى Developer
 * Metadata حتى تبقى الجلسات الجزئية الجارية سليمة.
 * خذ نسخة احتياطية من الجدول قبل التشغيل، وشغّلها مرة واحدة فقط.
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