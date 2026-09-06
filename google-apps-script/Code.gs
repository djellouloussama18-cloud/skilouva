/**
 * ============================================================================
 * SKILLOVA — Google Apps Script Web App (ADAPTED BACKEND)
 * ============================================================================
 * What this script does:
 *   Deployable Google Apps Script Web App that powers the SKILLOVA booking
 *   funnel. It is adapted from a robust real-estate lead-funnel reference
 *   script and provides shared-secret auth, honeypot spam protection,
 *   formula-injection sanitization, progressive (session_id-based) lead saving,
 *   LockService-protected booking confirmation, an auto-generating availability
 *   sheet with a daily trigger, duplicate-phone checking, and a ready-but-
 *   currently-inactive Meta Conversions API integration.
 *
 * Single routing entry point (doPost) switches on body.action:
 *   update_lead           -> updateLead
 *   get_availability      -> getAvailability
 *   check_slot            -> checkSlot
 *   check_duplicate_phone -> checkDuplicatePhone
 *   confirm_booking       -> confirmBooking
 *   anything else         -> "إجراء غير معروف"
 *
 * All requests MUST send the shared secret in the JSON body as
 * body.shared_secret, matching the Script Property GAS_SHARED_SECRET.
 *
 * DEPLOYMENT NOTE (IMPORTANT):
 *   Paste this file ENTIRELY into the Google Apps Script editor as Code.gs,
 *   REPLACING whatever is already deployed there (handled manually). This repo
 *   cannot deploy to Apps Script itself (no clasp config). After pasting you
 *   must ALSO (manually):
 *     - Set Script Property GAS_SHARED_SECRET to the secret you choose.
 *     - Run setupDailyTrigger() once to schedule daily slot generation.
 *     - Run generateAvailability() once immediately so slots exist now.
 *     - Redeploy as a Web App (Anyone) under the SAME URL.
 * ============================================================================
 */

/* ==========================================================
   إعدادات عامة — أوراق العمل
   ========================================================== */
const SHEET_LEADS_NAME = 'العملاء المحتملون';
const SHEET_AVAILABILITY_NAME = 'الأوقات المتاحة';

/* أعمدة الورقة — Skillova (18 عمودًا رئيسيًا + عمودين داخليين للتتبع) */
const LEADS_HEADERS = [
  'التاريخ', 'الاسم الكامل', 'رقم الهاتف', 'البريد الإلكتروني',
  'طريقة التواصل المفضلة', 'الوضعية الحالية', 'الهدف المهني',
  'مستوى الخبرة', 'المهارة المطلوبة', 'أكبر تحدي',
  'الوقت الأسبوعي المتاح', 'جاهزية الاستثمار', 'تاريخ الموعد',
  'وقت الموعد', 'المصدر', 'تفاصيل UTM', 'حالة العميل', 'ملاحظة',
  'معرف الجلسة', 'حالة التسجيل'
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
 * مباشرة كما هي.
 */
const FIELD_MAP = {
  appointmentDate:     'تاريخ الموعد',
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
  investmentReadiness: 'جاهزية الاستثمار',
  appointmentTime:     'وقت الموعد',
  source:              'المصدر',
  utm:                 'تفاصيل UTM',
  notes:               'ملاحظة'
};

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
      case 'get_availability': result = getAvailability(); break;
      case 'check_slot': result = checkSlot(body); break;
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
  if (sheet.getLastRow() === 0) sheet.appendRow(LEADS_HEADERS);
  return sheet;
}

function getAvailabilitySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_AVAILABILITY_NAME);
}

function findRowBySessionId(sheet, sessionId) {
  const data = sheet.getDataRange().getValues();
  const sessionIdCol = LEADS_HEADERS.indexOf(SESSION_HEADER);
  for (let i = 1; i < data.length; i++) {
    if (data[i][sessionIdCol] === sessionId) return i + 1;
  }
  return -1;
}

/* ==========================================================
   update_lead — حفظ تدريجي عبر session_id
   ========================================================== */

function updateLead(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  const sheet = getLeadsSheet();
  const sessionId = body.session_id;
  const data = body.data || {};
  const now = new Date();
  const combined = {
    appointmentDate:     sanitizeValue(data.appointmentDate || ''),
    fullName:            sanitizeValue(data.fullName || ''),
    phone:               sanitizeValue(data.phone || ''),
    email:               sanitizeValue(data.email || ''),
    contactPreference:   sanitizeValue(data.contactPreference || ''),
    currentStatus:       sanitizeValue(data.currentStatus || ''),
    careerGoal:          sanitizeValue(data.careerGoal || ''),
    experienceLevel:     sanitizeValue(data.experienceLevel || ''),
    skillInterest:       sanitizeValue(Array.isArray(data.skillInterest) ? data.skillInterest.join(', ') : (data.skillInterest || '')),
    mainChallenge:       sanitizeValue(data.mainChallenge || ''),
    weeklyTime:          sanitizeValue(data.weeklyTime || ''),
    investmentReadiness: sanitizeValue(data.investmentReadiness || ''),
    appointmentTime:     sanitizeValue(data.appointmentTime || ''),
    source:              sanitizeValue(data.source || ''),
    utm:                 sanitizeValue(data.utm || ''),
    notes:               sanitizeValue(buildNote(data)),
  };
  let row = findRowBySessionId(sheet, sessionId);
  if (row === -1) {
    const newRow = new Array(LEADS_HEADERS.length).fill('');
    LEADS_HEADERS.forEach((header, idx) => {
      const key = Object.keys(FIELD_MAP).find(k => FIELD_MAP[k] === header);
      if (key && combined[key] !== undefined) newRow[idx] = combined[key];
    });
    newRow[LEADS_HEADERS.indexOf('التاريخ')] = now; // عمود التاريخ — طابع زمني من الخادم
    newRow[LEADS_HEADERS.indexOf(STATUS_HEADER)] = STATUS_PARTIAL;
    newRow[LEADS_HEADERS.indexOf(SESSION_HEADER)] = sessionId;
    sheet.appendRow(newRow);
  } else {
    LEADS_HEADERS.forEach((header, idx) => {
      const key = Object.keys(FIELD_MAP).find(k => FIELD_MAP[k] === header);
      if (key && combined[key]) sheet.getRange(row, idx + 1).setValue(combined[key]);
    });
  }
  return { success: true };
}

function buildNote(data) {
  let parts = [];
  if (data.notes) parts.push(data.notes);
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

/* ==========================================================
   get_availability — يعيد المواعيد المتاحة لكامل النافذة
   ========================================================== */

function getAvailability() {
  const sheet = getAvailabilitySheet();
  if (!sheet) return { success: true, availability: {} };
  const data = sheet.getDataRange().getValues();
  const availability = {};
  for (let i = 1; i < data.length; i++) {
    const date = data[i][0];
    const time = data[i][1];
    const isBooked = data[i][2];
    if (isBooked !== true && isBooked !== 'TRUE') {
      const dateKey = formatDateKey(date);
      const timeKey = formatTimeKey(time);
      if (!availability[dateKey]) availability[dateKey] = [];
      availability[dateKey].push(timeKey);
    }
  }
  return { success: true, availability: availability };
}

function formatTimeKey(timeValue) {
  if (timeValue instanceof Date) return Utilities.formatDate(timeValue, Session.getScriptTimeZone(), 'HH:mm');
  return timeValue.toString();
}

function formatDateKey(dateValue) {
  if (dateValue instanceof Date) return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return dateValue.toString();
}

function checkSlot(body) {
  const sheet = getAvailabilitySheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const dateKey = formatDateKey(data[i][0]).trim();
    const time = formatTimeKey(data[i][1]).trim();
    const isBooked = data[i][2];
    if (dateKey === String(body.data.date).trim() && time === String(body.data.time).trim()) {
      return { success: true, available: !(isBooked === true || isBooked === 'TRUE') };
    }
  }
  return { success: true, available: false };
}

function checkDuplicatePhone(body) {
  const sheet = getLeadsSheet();
  const data = sheet.getDataRange().getValues();
  const phoneCol = LEADS_HEADERS.indexOf('رقم الهاتف');
  const statusCol = LEADS_HEADERS.indexOf(STATUS_HEADER);
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
   confirm_booking — تأكيد الحجز بحماية LockService
   ========================================================== */

function confirmBooking(body) {
  if (isHoneypotTriggered(body.data)) return { success: true };
  if (!isValidAlgerianPhone(body.data && body.data.phone)) return { success: false, error: 'رقم الهاتف غير صالح' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const leadResult = updateLead(body);
    // Meta CAPI معطّل مؤقتًا — أعد تفعيله فقط بعد ضبط META_PIXEL_ID وMETA_ACCESS_TOKEN لـ Skillova.
    // sendLeadToMetaCAPI(body.data);
    const sheet = getLeadsSheet();
    const row = findRowBySessionId(sheet, body.session_id);
    if (row !== -1) sheet.getRange(row, LEADS_HEADERS.indexOf(STATUS_HEADER) + 1).setValue(STATUS_CONFIRMED);
    const availSheet = getAvailabilitySheet();
    if (availSheet && body.data.appointmentDate && body.data.appointmentTime) {
      const data = availSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        const sessionIdCol = data[i][3];
        const isBookedCol = data[i][2];
        if (sessionIdCol === body.session_id && (isBookedCol === true || isBookedCol === 'TRUE')) {
          const stillNewSlot = formatDateKey(data[i][0]).trim() === String(body.data.appointmentDate).trim() && formatTimeKey(data[i][1]).trim() === String(body.data.appointmentTime).trim();
          if (!stillNewSlot) { availSheet.getRange(i + 1, 3).setValue(false); availSheet.getRange(i + 1, 4).setValue(''); }
        }
      }
      let matched = false;
      for (let i = 1; i < data.length; i++) {
        const dateKey = formatDateKey(data[i][0]).trim();
        const time = formatTimeKey(data[i][1]).trim();
        if (dateKey === String(body.data.appointmentDate).trim() && time === String(body.data.appointmentTime).trim()) {
          availSheet.getRange(i + 1, 3).setValue(true);
          availSheet.getRange(i + 1, 4).setValue(body.session_id);
          matched = true;
          break;
        }
      }
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/* ==========================================================
   توليد المواعيد — نافذة 14 يومًا، أوقات 08:00 → 21:00
   ========================================================== */

const AVAILABILITY_WINDOW_DAYS = 14;
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 22; // الحدّ: الحلقة تولّد أوقات بدء 08:00..21:00 (14 خانة/يوم)

function generateAvailability() {
  const sheet = getAvailabilitySheet();
  if (!sheet) throw new Error('ورقة "الأوقات المتاحة" غير موجودة.');
  if (sheet.getLastRow() === 0) sheet.appendRow(['التاريخ', 'الوقت', 'محجوز', 'معرف الجلسة الحاجزة']);
  const data = sheet.getDataRange().getValues();
  const existingDates = new Set();
  for (let i = 1; i < data.length; i++) existingDates.add(formatDateKey(data[i][0]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rowsToAdd = [];
  for (let d = 0; d < AVAILABILITY_WINDOW_DAYS; d++) {
    const targetDate = new Date(today); targetDate.setDate(today.getDate() + d);
    const dateKey = Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (!existingDates.has(dateKey)) {
      // أوقات بدء 08:00 حتى 21:00 (حصريًا < 22) = 14 خانة/يوم
      for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
        const timeStr = (hour < 10 ? '0' + hour : hour) + ':00';
        rowsToAdd.push([dateKey, timeStr, false, '']);
      }
    }
  }
  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 4).setValues(rowsToAdd);
  }
  cleanupPastDates(sheet, today);
}

function cleanupPastDates(sheet, today) {
  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    const rowDate = new Date(formatDateKey(data[i][0]));
    if (rowDate < today) rowsToDelete.push(i + 1);
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) sheet.deleteRow(rowsToDelete[i]);
}

function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { if (t.getHandlerFunction() === 'generateAvailability') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('generateAvailability').timeBased().everyDays(1).atHour(0).create();
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
