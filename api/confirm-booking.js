/**
 * Vercel Function: confirm-booking
 *
 * Proxies final booking confirmation to the Google Apps Script Web App via
 * action=confirm_booking. Forwards session_id and the full lead payload from
 * the frontend (funnelState field names, camelCase). GAS handles validation,
 * duplicate-phone/honeypot protection and the «مؤكد» status marking.
 *
 * THIS FUNCTION REPLACES submit-lead.js (removed) — it fills the same role
 * against the new action-based backend.
 *
 * Request:
 *   POST /api/confirm-booking
 *   { session_id, data: { fullName, phone, ..., skillInterest, ... } }
 *
 * Response (GAS passthrough):
 *   { success: true }
 *   or { success: false, error: "رقم الهاتف غير صالح" | ... }
 */

const gas = require('./_gas');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return gas.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  var payload;
  if (req.body === undefined || req.body === null) {
    payload = {};
  } else if (typeof req.body === 'object') {
    payload = req.body;
  } else {
    return gas.jsonResponse(res, 400, { error: 'Invalid JSON body' });
  }

  if (!payload.session_id) {
    return gas.jsonResponse(res, 400, { error: 'Missing session_id' });
  }
  if (!payload.data) {
    return gas.jsonResponse(res, 400, { error: 'Missing data payload' });
  }

  var result = await gas.callGasApp('confirm_booking', payload);

  if (!result.ok) {
    return gas.jsonResponse(res, result.statusCode, result.body);
  }

  return gas.jsonResponse(res, 200, result.body);
};