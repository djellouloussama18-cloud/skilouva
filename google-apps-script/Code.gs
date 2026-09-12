/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App (ADAPTED BACKEND)
 * ============================================================================
 * What this script does:
 *   Deployable Google Apps Script Web App that powers the SKILLOVA lead
 *   funnel. It provides shared-secret auth, honeypot spam protection,
 *   formula-injection sanitization, progressive (session_id-based) lead saving,
 *   duplicate-phone checking, and a ready-but-currently-inactive Meta
 *   Conversions API integration.
 *
 * Single routing entry point (doPost) switches on body.action:
 *   update_lead           -> updateLead
 *   check_duplicate_phone -> checkDuplicatePhone
 *   confirm_booking       -> confirmBooking
 *   anything else         -> "إجراء غير معروف"
 *
 * All requests MUST send the shared secret in the JSON body as
 * body.shared_secret, matching the Script Property GAS_SHARED_SECRET.
 *
 * COLUMN WIRING (IMPORTANT):
 *   This backend always writes to the sheet BY HEADER NAME, never by fixed
 *   column index. updateLead reads row 1 of the live sheet, maps each header
 *   back to a payload key via getPayloadKeyForHeader(), and writes the value
 *   to that header's position. This keeps data aligned even if the user
 *   reorders columns in the spreadsheet.
 *
 *   If your live sheet was built by an OLDER version of this script (header
 *   'جاهزية الاستثمار' at column 12, no 'الجاهزية للبدء الفوري' column),
 *   run migrateSheet() once from the Apps Script editor to restructure the
 *   sheet to the current LEADS_HEADERS while preserving all existing rows.
 *   Run runSheetDiagnostics() first to see what is actually in the sheet.
 *
 * DEPLOYMENT NOTE (IMPORTANT):
 *   Paste this file ENTIRELY into the Google Apps Script editor as Code.gs,
 *   REPLACING whatever is already deployed there (handled manually). This repo
 *   cannot deploy to Apps Script itself (no clasp config). After pasting you
 *   must ALSO (manually):
 *     - Set Script Property GAS_SHARED_SECRET to the secret you choose.
 *     - Redeploy as a Web App (Anyone) under the SAME URL.
 * ============================================================================
 */

/* ==========================================================
   إعدادات عامة — أوراق العمل
   ========================================================== */
const SHEET_LEADS_NAME = 'العملاء المحتملون';

/* أعمدة الورقة — Skillova (14 عمودًا رئيسيًا + عمودين داخليين للتتبع).
   الترتيب النهائي المعتمد من طرف العميل — لا تغيّره إلا بعد تنسيق live sheet
   عبر migrateSheet(). */
const LEADS_HEADERS = [
  'التاريخ', 'الاسم الكامل', 'رقم الهاتف', 'البريد الإلكتروني',
  'طريقة التواصل المفضلة', 'الوضعية الحالية', 'الهدف المهني',
  'مستوى الخبرة', 'المهارة المطلوبة', 'أكبر تحدي',
  'الوقت الأسبوعي المتاح', 'الجاهزية للبدء الفوري', 'جاهزية الاستثمار',
  'الملاحظة', 'معرف الجلسة', 'حالة التسجيل'
];

/* أعمدة داخلية يُديرها السكربت تلقائيًا */
const STATUS_HEADER = 'حالة التسجيل';       // جزئي / مؤكد (داخلي)
const SESSION_HEADER = 'معرف الجلسة';       // session_id (داخلي)
const STATUS_PARTIAL = 'جزئي';
const STATUS_CONFIRMED = 'مؤكد';

/*
 * FIELD_MAP — يرتب كل حقل يرسله الفرونت-إند (funnelState / buildLeadPayload)
 * باسم العمود العربي. المفاتيح تطابق بالضبط أسماء خصائص funnelState في
 * js/main.js (camelCase) — لا تتم أي ترجمة في Netlify Functions، بل تُمرَّر
 * مباشرة كما هي. الكتابة تتم دائمًا بالاسم عبر getPayloadKeyForHeader().
 */
const FIELD_MAP = {
  fullName:            'الاسم الكامل',
  phone:               'رقم الهاتف',
  email:               'البريد الإلكتروني',
  contactPreference:   'طريقة التواصل المفضلة',
  currentStatus:       'الوضعية الحالية',
  careerGoal:          'الهدف المهني',
  experienceLevel:     'مستوى الخبرة',
  skillInterest:       'المهارة المطلوبة',
  mainChallenge:       'أكبر تحدي',
  weeklyTime:          'الوقت الأسبوعي المتاح',
  readinessToStart:    'الجاهزية للبدء الفوري',
  investmentReadiness: 'جاهزية الاستثمار',
  notes:               'الملاحظة'
};

/*
 * getPayloadKeyForHeader — يعيد مفتاح payload لكل اسم عمود، بما في ذلك
 * الأسماء التاريخية القديمة حتى لا تنكسر الورقة القديمة. هذا هو المكان
 * الوحيد الذي يتم فيه الربط بين اسم العمود الفعلي في الورقة والبيانات.
 */
function getPayloadKeyForHeader(header) {
  if (!header) return null;
  const h = String(header).toString().trim();
  if (h === '' ) return null;
  /* الاستثمار — الأسماء الجديدة والقديمة معًا */
  if (h === 'جاهزية الاستثمار' || h === 'الجاهزية للاستثمار' || h === 'الاستعداد للاستثمار') return 'investmentReadiness';
  /* البدء الفوري — الأسماء الجديدة والقديمة معًا */
  if (h === 'الجاهزية للبدء الفوري' || h === 'جاهزية البدء الفوري' || h === 'الاستعداد للبدء الفوري') return 'readinessToStart';
  /* الملاحظة — بمسمّيين قديم/جديد */
  if (h === 'الملاحظة' || h === 'ملاحظة') return 'notes';
  /* ±غرها من الحقول حسب FIELD_MAP */
  return Object.keys(FIELD_MAP).find(k => FIELD_MAP[k] === h) || null;
}

/* ==========================================================
   نقاط الدخول (Entry Points)
   ========================================================== */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('GAS_SHARED_SECRET');
    if (!expectedSecret || body.shared_secret !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }
    const action = body.action;
    let result;
    switch (action) {
      case 'update_lead': result = updateLead(body); break;
      case 'check_duplicate_phone': result = checkDuplicatePhone(body); break;
      case 'confirm_booking': result = confirmBooking(body); break;
      default: result = { success: false, error: 'إجراء غير معروف' };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Google Apps Script يعمل بشكل صحيح' })).setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================
   أدوات الوصول للأوراق
   ========================================================== */

function getLeadsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_LEADS_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(LEADS_HEADERS);
    sheet.setFrozenRows(1);
  } else {
    /* ضمان أن كل أعمدة LEADS_HEADERS موجودة حتى لو كانت الورقة قديمة */
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    let added = false;
    LEADS_HEADERS.forEach(header => {
      if (!existing.includes(header)) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        added = true;
      }
    });
    if (added) Logger.log('getLeadsSheet: تمت إضافة أعمدة ناقصة إلى ' + SHEET_LEADS_NAME);
  }
  return sheet;
}

function getActualHeaders(sheet) {
  if (sheet.getLastRow() === 0) return LEADS_HEADERS.slice();
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
}

function findRowBySessionId(sheet, sessionId) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  const actualHeaders = data[0].map(h => String(h).trim());
  const sessionIdCol = actualHeaders.indexOf(SESSION_HEADER);
  if (sessionIdCol === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) return i + 1;
  }
  return -1;
}

/* ==========================================================
   update_lead — حفظ تدريجي عبر session_id (يتعامل مع الأعمدة بالاسم)
   ========================================================== */

function updateLead(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  const sheet = getLeadsSheet();
  const sessionId = body.session_id;
  const data = body.data || {};
  const now = new Date();
  const combined = {
    fullName:            sanitizeValue(data.fullName || ''),
    phone:               sanitizeValue(data.phone || ''),
    email:               sanitizeValue(data.email || ''),
    contactPreference:   sanitizeValue(data.contactPreference || ''),
    currentStatus:       sanitizeValue(data.currentStatus || ''),
    careerGoal:          sanitizeValue(data.careerGoal || ''),
    experienceLevel:     sanitizeValue(data.experienceLevel || ''),
    skillInterest:       sanitizeValue(data.skillInterest || ''),
    mainChallenge:       sanitizeValue(data.mainChallenge || ''),
    weeklyTime:          sanitizeValue(data.weeklyTime || ''),
    readinessToStart:    sanitizeValue(data.readinessToStart || ''),
    investmentReadiness: sanitizeValue(data.investmentReadiness || ''),
    notes:               sanitizeValue(buildNote(data)),
  };

  const actualHeaders = getActualHeaders(sheet);

  let row = findRowBySessionId(sheet, sessionId);
  if (row === -1) {
    const newRow = new Array(actualHeaders.length).fill('');
    actualHeaders.forEach((header, idx) => {
      const key = getPayloadKeyForHeader(header);
      if (key && combined[key] !== undefined && combined[key] !== '') newRow[idx] = combined[key];
    });
    const dateCol = actualHeaders.indexOf('التاريخ');
    const statusCol = actualHeaders.indexOf(STATUS_HEADER);
    const sessionCol = actualHeaders.indexOf(SESSION_HEADER);
    if (dateCol !== -1) newRow[dateCol] = now;
    if (statusCol !== -1) newRow[statusCol] = STATUS_PARTIAL;
    if (sessionCol !== -1) newRow[sessionCol] = sessionId;
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, actualHeaders.length).setValues([newRow]);
    Logger.log('updateLead: سطر جديد — readinessToStart="' + combined.readinessToStart + '" investmentReadiness="' + combined.investmentReadiness + '" (row ' + (sheet.getLastRow()) + ')');
  } else {
    const rowValues = sheet.getRange(row, 1, 1, actualHeaders.length).getValues()[0];
    actualHeaders.forEach((header, idx) => {
      const key = getPayloadKeyForHeader(header);
      if (key && combined[key]) rowValues[idx] = combined[key];
    });
    sheet.getRange(row, 1, 1, actualHeaders.length).setValues([rowValues]);
    Logger.log('updateLead: تحديث سطر ' + row + ' — readinessToStart="' + combined.readinessToStart + '" investmentReadiness="' + combined.investmentReadiness + '"');
  }
  return { success: true };
}

function buildNote(data) {
  let parts = [];
  if (data.notes && String(data.notes).trim() !== '') parts.push(String(data.notes).trim());
  if (data.source && String(data.source).trim() !== '') parts.push('المصدر: ' + String(data.source).trim());
  if (data.utm && String(data.utm).trim() !== '') parts.push('UTM: ' + String(data.utm).trim());
  return parts.join(' | ');
}

/* ==========================================================
   حماية عامة — honeypot + تطهير من حقن الصيغ
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

function checkDuplicatePhone(body) {
  const sheet = getLeadsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, isDuplicate: false };
  const actualHeaders = data[0].map(h => String(h).trim());
  const phoneCol = actualHeaders.indexOf('رقم الهاتف');
  const statusCol = actualHeaders.indexOf(STATUS_HEADER);
  if (phoneCol === -1 || statusCol === -1) return { success: true, isDuplicate: false };
  for (let i = 1; i < data.length; i++) {
    const phone = (data[i][phoneCol] || '').toString().trim();
    const status = data[i][statusCol];
    if (phone === body.data.phone && status === STATUS_CONFIRMED) {
      return { success: true, isDuplicate: true };
    }
  }
  return { success: true, isDuplicate: false };
}

/* ==========================================================
   confirm_booking — تأكيد التسجيل (updateLead + حالة «مؤكد»)
   ========================================================== */

function confirmBooking(body) {
  const startTime = Date.now();
  if (isHoneypotTriggered(body.data)) return { success: true };
  if (!isValidAlgerianPhone(body.data && body.data.phone)) return { success: false, error: 'رقم الهاتف غير صالح' };
  updateLead(body);
  const sheet = getLeadsSheet();
  const row = findRowBySessionId(sheet, body.session_id);
  if (row !== -1) {
    const actualHeaders = getActualHeaders(sheet);
    const statusCol = actualHeaders.indexOf(STATUS_HEADER);
    if (statusCol !== -1) {
      sheet.getRange(row, statusCol + 1, 1, 1).setValues([[STATUS_CONFIRMED]]);
    }
  }

  /* Meta Conversions API — Schedule event, مضمَّن في try/catch داخلي حتى
     لا يفشل الحجز أبدًا بسبب فشل إرسال الحدث. يعمل فقط عند التأكيد الناجح. */
  try {
    sendScheduleToMetaCAPI(body.data);
  } catch (metaErr) {
    Logger.log('confirmBooking: Meta Schedule call failed silently: ' + metaErr.toString());
  }

  console.log('confirm_booking completed in ' + (Date.now() - startTime) + ' ms');
  return { success: true };
}

/* ==========================================================
   تشخيص الورقة + ترحيل (تشغيل يدوي مرة واحدة من المحرر)
   ========================================================== */

/*
 * runSheetDiagnostics — يسجل في Logger كل ما يوجد فعليًا في الجدول:
 *   - الأعمدة الحالية بالترتيب وموقعها
 *   - هل تطابق LEADS_HEADERS؟
 *   - عدد الصفوف
 * شغّلها من المحرر: Run > runSheetDiagnostics ثم عرض السجل.
 */
function runSheetDiagnostics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LEADS_NAME);
  Logger.log('=== تشخيص الورقة ===');
  if (!sheet) {
    Logger.log('لا توجد ورقة باسم "' + SHEET_LEADS_NAME + '" — سيتم إنشاؤها بأول استدعاء.');
    return;
  }
  Logger.log('اسم الورقة: ' + sheet.getName());
  Logger.log('آخر صف: ' + sheet.getLastRow() + ' | آخر عمود: ' + sheet.getLastColumn());
  if (sheet.getLastRow() === 0) {
    Logger.log('الورقة فارغة.');
    return;
  }
  const actualHeaders = getActualHeaders(sheet);
  Logger.log('الأعمدة الفعلية في الورقة (' + actualHeaders.length + '):');
  actualHeaders.forEach(function (h, i) { Logger.log('  [' + (i + 1) + '] ' + h); });
  Logger.log('--- تطابق مع LEADS_HEADERS ---');
  LEADS_HEADERS.forEach((h, i) => {
    const pos = actualHeaders.indexOf(h);
    Logger.log('  ' + h + ' => في الورقة: ' + (pos === -1 ? 'مفقود' : 'العمود ' + (pos + 1)) + (pos === i ? ' ✓' : (pos === -1 ? '' : ' (يُتوقع ' + (i + 1) + ')')));
  });
  Logger.log('الأعمدة الزائدة (غير مطلوبة): ' + actualHeaders.filter(h => !LEADS_HEADERS.includes(h)).join(' ، '));
  Logger.log('=== نهاية التشخيص ===');
}

/*
 * migrateSheet — يهيكل الورقة الحية وفق LEADS_HEADERS:
 *   1) يُنشئ ورقة جديدة مؤقتة بأعمدة LEADS_HEADERS الصحيحة
 *   2) ينسخ كل الصفوف ناقلاً كل قيمة حسب اسم العمود (بالاسم، لا بالموقع)
 *   3) يحذف الورقة القديمة، ويعيد تسمية الجديدة
 * الآمن تشغيله مرة واحدة فقط بعد أخذ نسخة احتياطية. يمكنك أيضًا التراجع
 * يدويًا من نسخة الجدول. الأعمدة المزالة (المصدر/UTM/حالة العميل/تاريخ الموعد/وقت الموعد)
 * لن تُنقل.
 */
function migrateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let oldSheet = ss.getSheetByName(SHEET_LEADS_NAME);
  if (!oldSheet) {
    Logger.log('لا توجد ورقة "' + SHEET_LEADS_NAME + '" — إنشاء ورقة جديدة بأعمدة LEADS_HEADERS.');
    ss.insertSheet(SHEET_LEADS_NAME);
    getLeadsSheet();
    Logger.log('تم إنشاء الورقة الجديدة.');
    return;
  }
  const tmpName = SHEET_LEADS_NAME + '_OLD_BACKUP';
  const tmp = ss.insertSheet(tmpName);
  const data = oldSheet.getDataRange().getValues();

  /* تهيئة الأعمدة في الورقة الجديدة */
  tmp.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
  tmp.setFrozenRows(1);

  const oldHeaders = (data.length > 0) ? data[0].map(h => String(h).trim()) : [];

  let copied = 0;
  for (let r = 1; r < data.length; r++) {
    const newRow = new Array(LEADS_HEADERS.length).fill('');
    LEADS_HEADERS.forEach((header, newIdx) => {
      /* تطابق بالاسم، وإن لم يوجد نطابق عبر مفتاح payload (للأسماء القديمة) */
      let oldIdx = oldHeaders.indexOf(header);
      if (oldIdx === -1) {
        const key = getPayloadKeyForHeader(header);
        if (key) oldIdx = oldHeaders.findIndex(h => getPayloadKeyForHeader(h) === key);
      }
      if (oldIdx !== -1) newRow[newIdx] = data[r][oldIdx];
    });
    tmp.getRange(r + 1, 1, 1, newRow.length).setValues([newRow]);
    copied++;
  }

  /* حذف القديمة وإعادة التسمية */
  ss.deleteSheet(oldSheet);
  tmp.setName(SHEET_LEADS_NAME);

  Logger.log('migrateSheet: تم ترحيل ' + copied + ' صفًا إلى الأعمدة الجديدة.');
  Logger.log('الورقة الآن بترتيب: ' + LEADS_HEADERS.join(' | '));
  Logger.log('الورقة الاحتياطية القديمة حُذفت. إن أردت الاحتفاظ بها استخدم خيار "Duplicate" في Google Sheets قبل الترحيل.');
}

/* ==========================================================
   Meta Conversions API — جاهز لكن غير مفعّل بعد
   ========================================================== */

/*
 * مؤقّت معطّل حتى تُهيّئ Skillova بياناتها الخاصة:
 *   - META_PIXEL_ID (أدناه) + Script Property META_ACCESS_TOKEN
 * ثم قم بإلغاء تعليق السطر sendLeadToMetaCAPI(...) في confirmBooking.
 */
const META_PIXEL_ID = 'REPLACE_WITH_SKILLOVA_PIXEL_ID';
const META_API_VERSION = 'v21.0';
/* رابط صفحة الهبوط (ثابت مؤقتًا — اتركه placeholder أو غيّره لرابط Skillova الفعلي) */
const META_EVENT_SOURCE_URL = 'https://skillova.com';

function sha256Hash(value) {
  if (!value) return '';
  const normalized = value.toString().trim().toLowerCase();
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized, Utilities.Charset.UTF_8);
  return rawHash.map(function(byte) { const hex = (byte < 0 ? byte + 256 : byte).toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
}

function normalizePhoneForMeta(phone) {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '213' + cleaned.substring(1);
  return cleaned;
}

function sendLeadToMetaCAPI(data) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('META_ACCESS_TOKEN');
    if (!token) return { success: false, error: 'Missing access token' };
    const hashedPhone = data.phone ? sha256Hash(normalizePhoneForMeta(data.phone)) : '';
    const hashedEmail = data.email ? sha256Hash(data.email) : '';
    const userData = {};
    if (hashedPhone) userData.ph = [hashedPhone];
    if (hashedEmail) userData.em = [hashedEmail];
    if (data.fbp) userData.fbp = data.fbp;
    if (data.fbc) userData.fbc = data.fbc;
    const eventPayload = { data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: data.event_id || '', action_source: 'website', event_source_url: data.event_source_url || '', user_data: userData, custom_data: { content_name: 'Skillova Application', content_category: 'Course' } }] };
    const url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + META_PIXEL_ID + '/events?access_token=' + token;
    const response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(eventPayload), muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (responseCode !== 200) return { success: false, error: responseText };
    return { success: true, response: JSON.parse(responseText) };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/*
 * sendScheduleToMetaCAPI — يرسل حدث Schedule إلى Meta Conversions API بعد
 * تأكيد الحجز. يقرأ META_ACCESS_TOKEN و META_PIXEL_ID من Script Properties
 * (لا يتم ترميزهما في الكود). أي فشل هنا يُسجَّل فقط عبر Logger.log ولا يؤثر
 * على نجاح الحجز. لا يتضمن أي بيانات شخصية غير الهاتف (مبشّر SHA-256).
 */
function sendScheduleToMetaCAPI(data) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('META_ACCESS_TOKEN');
    const pixelId = PropertiesService.getScriptProperties().getProperty('META_PIXEL_ID');
    if (!token || !pixelId) {
      Logger.log('sendScheduleToMetaCAPI: missing META_ACCESS_TOKEN or META_PIXEL_ID script property');
      return { success: false, error: 'Missing Meta credentials' };
    }

    const userData = {};
    if (data && data.phone) {
      userData.ph = [sha256Hash(normalizePhoneForMeta(data.phone))];
    }

    const eventPayload = {
      data: [{
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: META_EVENT_SOURCE_URL,
        user_data: userData,
        custom_data: {
          content_name: 'Closer Bootcamp',
          appointment_type: 'Qualification Call'
        }
      }]
    };

    const url = 'https://graph.facebook.com/' + META_API_VERSION + '/' + pixelId + '/events?access_token=' + token;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(eventPayload),
      muteHttpExceptions: true
    });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (responseCode !== 200) {
      Logger.log('sendScheduleToMetaCAPI: Meta API returned ' + responseCode + ' — ' + responseText);
      return { success: false, error: responseText };
    }
    return { success: true, response: JSON.parse(responseText) };
  } catch (err) {
    Logger.log('sendScheduleToMetaCAPI: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}