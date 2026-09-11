/**
 * Netlify Function: confirm-booking
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
 *   POST /.netlify/functions/confirm-booking
 *   { session_id, data: { fullName, phone, ..., skillInterest, ... } }
 *
 * Response (GAS passthrough):
 *   { success: true }
 *   or { success: false, error: "رقم الهاتف غير صالح" | ... }
 */

const gas = require('./_gas');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return gas.jsonResponse(405, { error: 'Method not allowed' });
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return gas.jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!payload.session_id) {
    return gas.jsonResponse(400, { error: 'Missing session_id' });
  }
  if (!payload.data) {
    return gas.jsonResponse(400, { error: 'Missing data payload' });
  }

  var result = await gas.callGasApp('confirm_booking', payload);

  if (!result.ok) {
    return gas.jsonResponse(result.statusCode, result.body);
  }

  return gas.jsonResponse(200, result.body);
};